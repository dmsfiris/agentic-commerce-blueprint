# Technical architecture review notes

This repository encodes the review themes attributed in the article to Vinicius Pereira:

- semantic-drift control through reason colocality;
- eligibility-versus-authority separation;
- payment artifacts as evidence rather than permission;
- envelope-first projection ergonomics;
- scoped grounding for generated claims;
- generated-claim capability gates;
- evidence pins and freshness horizons;
- dependency-pinned input hashes;
- distinct negative states;
- inherited-refusal propagation;
- content-addressed rule sets;
- verifiable detached authenticators.

The checks are semantic rather than file-oriented. They assert the behavior most likely to drift when feeds, adapters, checkout paths, or tools rebuild decisions locally.
