# Contributing

## Prerequisites

Node.js 24 and npm.\
The repository pins the major in [`.nvmrc`](./.nvmrc) and in each manifest's `engines` field.

Confirm the toolchain before starting:
```bash
node --version
```

---

## The loop

Install, build, and run the whole gate:
```bash
npm install
npm test
```

`npm test` builds the workspace, then runs documentation style, test architecture, package suites, CLI suites, and the system suites in that order.\
It is the same command CI runs, so a green local run means a green pipeline.

Narrower scopes exist for iteration:
```bash
npm run build
npm run docs:check
npm run test:architecture
npm run test:packages
npm run test:integration
npm run test:topology
npm run test:resilience
npm run test:e2e
```

Each workspace suite runs in its own test process.\
When a change breaks several suites at once and you want the lowest broken layer rather than the full picture, stop at the first failing gate:
```bash
npm run test:gated
```

---

## What a change must carry

**Contracts move first.**\
Every named public data-only DTO owns a sovereign JSON Schema.\
Change the schema, regenerate, and only then change runtime code:
```bash
npm run schemas:generate
npm run schemas:check
```

**Tests are owned where the code is owned.**\
A package's behavior is tested beside that package; the workspace suites test composition only.\
Add the file to its suite `README.md` ownership table in the same change.\
[`TESTING.md`](./TESTING.md) states the rules and `npm run test:architecture` enforces them.

**Gate evidence stays truthful.**\
If a change adds or moves a test that section 14 of [`verification.md`](./docs/design/agp-uniform-node/verification.md) names, update that map.\
`test/conformance/verification-ownership-map.test.js` fails when the map and the tree disagree.

**Design records are layered.**\
Current-state contracts under `docs/design/agp-uniform-node/` are edited in place.\
Frozen records - surveys, the decision register, and the transport sovereignty review - are not rewritten when policy later changes; they take a status banner and a cross-link instead.

---

## Documentation style

Markdown follows the style rules published in [apnex/mission-kit](https://github.com/apnex/mission-kit/tree/main/style).\
The per-rule checkers are vendored into [`tools/`](./tools/README.md) so a clone can verify itself.

Apply the mechanical fixes, then check:
```bash
npm run docs:fix
npm run docs:check
```

S6, S10, S12, and S13 are fixed automatically.\
S8 needs a judgement call.

---

## Commits and pull requests

Write a subject line that states the change, not the activity.\
Explain in the body why the change is correct, not only what moved.

A pull request should leave `npm test` green and should not widen the public surface without a matching contract and design record.
