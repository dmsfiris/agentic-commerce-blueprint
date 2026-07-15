import { deepFreeze } from './text.mjs';

const DEFAULT_MAX_DEPTH = 100;
const DEFAULT_MAX_NODES = 25_000;

function boundaryError(path, message) {
  return new TypeError(
    `agent_commerce_decision_envelope_capture_failed:${message}:${path}`,
  );
}

function isCanonicalArrayIndex(key, length) {
  if (!/^(?:0|[1-9]\d*)$/u.test(key)) return false;
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < length;
}

function captureJsonValue(value, path, state, depth) {
  state.nodes += 1;
  if (state.nodes > state.maxNodes) {
    throw boundaryError(path, 'node_limit_exceeded');
  }
  if (depth > state.maxDepth) {
    throw boundaryError(path, 'depth_limit_exceeded');
  }

  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw boundaryError(path, 'non_finite_number');
    }
    return value;
  }
  if (typeof value !== 'object') {
    throw boundaryError(path, 'non_json_value');
  }
  if (state.ancestors.has(value)) {
    throw boundaryError(path, 'cyclic_value');
  }

  state.ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Array.prototype && prototype !== null) {
        throw boundaryError(path, 'unsupported_array_prototype');
      }

      const length = value.length;
      if (!Number.isSafeInteger(length) || length < 0) {
        throw boundaryError(path, 'invalid_array_length');
      }
      if (length > state.maxNodes) {
        throw boundaryError(path, 'array_length_limit_exceeded');
      }
      const ownKeys = Reflect.ownKeys(value);
      for (const key of ownKeys) {
        if (typeof key === 'symbol') {
          const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
          if (descriptor?.enumerable) {
            throw boundaryError(path, 'enumerable_symbol_key');
          }
          continue;
        }
        if (key === 'length') continue;
        const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
        if (!descriptor?.enumerable) continue;
        if (!isCanonicalArrayIndex(key, length)) {
          throw boundaryError(`${path}.${key}`, 'non_index_array_property');
        }
      }

      const captured = new Array(length);
      for (let index = 0; index < length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw boundaryError(`${path}[${index}]`, 'sparse_array');
        }
        let child;
        try {
          child = Reflect.get(value, `${index}`);
        } catch {
          throw boundaryError(`${path}[${index}]`, 'input_access_failed');
        }
        captured[index] = captureJsonValue(
          child,
          `${path}[${index}]`,
          state,
          depth + 1,
        );
      }
      return captured;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw boundaryError(path, 'unsupported_object_prototype');
    }

    const captured = {};
    let keys;
    try {
      keys = Reflect.ownKeys(value);
    } catch {
      throw boundaryError(path, 'input_access_failed');
    }
    for (const key of keys) {
      if (typeof key === 'symbol') {
        let descriptor;
        try {
          descriptor = Reflect.getOwnPropertyDescriptor(value, key);
        } catch {
          throw boundaryError(path, 'input_access_failed');
        }
        if (descriptor?.enumerable) {
          throw boundaryError(path, 'enumerable_symbol_key');
        }
        continue;
      }

      let descriptor;
      try {
        descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      } catch {
        throw boundaryError(`${path}.${key}`, 'input_access_failed');
      }
      if (!descriptor?.enumerable) continue;

      let child;
      try {
        child = Reflect.get(value, key);
      } catch {
        throw boundaryError(`${path}.${key}`, 'input_access_failed');
      }
      const capturedChild = captureJsonValue(
        child,
        `${path}.${key}`,
        state,
        depth + 1,
      );
      Object.defineProperty(captured, key, {
        value: capturedChild,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return captured;
  } finally {
    state.ancestors.delete(value);
  }
}

/**
 * Captures caller-controlled runtime input once into a detached, deeply frozen,
 * JSON-compatible snapshot. Getters are evaluated at most once per enumerable
 * property; subsequent verification and projection must consume this snapshot.
 */
export function captureAgentCommerceDecisionEnvelope(
  value,
  { maxDepth = DEFAULT_MAX_DEPTH, maxNodes = DEFAULT_MAX_NODES } = {},
) {
  if (!Number.isInteger(maxDepth) || maxDepth < 1) {
    throw new TypeError('maxDepth must be a positive integer.');
  }
  if (!Number.isInteger(maxNodes) || maxNodes < 1) {
    throw new TypeError('maxNodes must be a positive integer.');
  }
  let captured;
  try {
    captured = captureJsonValue(
      value,
      '$',
      {
        ancestors: new WeakSet(),
        maxDepth,
        maxNodes,
        nodes: 0,
      },
      0,
    );
  } catch (error) {
    if (
      error instanceof TypeError &&
      error.message.startsWith(
        'agent_commerce_decision_envelope_capture_failed:',
      )
    ) {
      throw error;
    }
    throw boundaryError('$', 'input_access_failed');
  }
  if (!captured || typeof captured !== 'object' || Array.isArray(captured)) {
    throw boundaryError('$', 'envelope_must_be_object');
  }
  return deepFreeze(captured);
}
