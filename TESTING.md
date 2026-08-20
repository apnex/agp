# AGP test architecture

AGP tests are executable contracts, owned at the same boundary as the code
they verify. A test suite is considered healthy only when a maintainer can
identify its owner, stimulus, observable oracle, and non-overlapping purpose
without reading implementation internals.

## Ownership structure

```text
packages/<package>/
  test/
    README.md       invariant-to-file ownership map
    unit/           one package, no live external adapter
    contract/       public port/schema/adapter boundary
    fixtures/       named immutable inputs and expected outcomes
    support/        mechanical setup with no hidden assertions

test/
  integration/      composition of two or more AGP packages
  topology/         production-Loopback star/line/triangle/diamond behavior
  resilience/       overload, race, timeout, and fault injection
  e2e/              public SDK/HTTP/CLI and independent-process WebSocket
```

Package behavior is tested beside that package. The workspace-level suite may
test only a real composition boundary; it must not duplicate package-unit
coverage. Adapter conformance is package-owned; workspace equivalence tests run
the same normalized star and line behaviors over production Loopback and
independent-process WebSocket compositions.

## Test form

Every test:

1. names a **given**, **when**, and **then** in the test title;
2. protects one primary observable contract;
3. varies one behavioral axis;
4. arranges all mutable state within the test;
5. observes public exports, ports, wire documents, processes, or CLI output;
6. uses deterministic clocks/IDs/barriers instead of arbitrary sleeps; and
7. performs cleanup in `finally` or registered test teardown.

Secondary assertions are allowed only when they prove that the primary
operation did not violate a directly adjacent invariant—for example, rejecting
an endpoint update and also proving the RIB did not mutate.

Table-driven cases belong together only when they share the same stimulus and
oracle. A broad table covering unrelated error families must be split.

## Fixtures and helpers

- Fixture names state intent, not implementation provenance.
- A fixture contains only input and expected public outcome.
- Support helpers remove transport/process mechanics; they do not assert,
  choose hidden defaults, or swallow errors.
- Shared mutable topology and test-order dependencies are prohibited.
- Tests do not import another package's `src/` tree or inspect private maps and
  sockets.

## Required ownership README

Each package test directory and each workspace suite
(`conformance`, `integration`, `topology`, `resilience`, and `e2e`) contains an
ownership table with:

| File | Contract protected | Primary axis | Oracle |
|---|---|---|---|

It also lists deliberately deferred behavior and points cross-package behavior
to the owning workspace suite. This map is reviewed whenever a public contract
changes.

## Anti-rot checks

`npm run test:architecture` rejects:

- package test suites without an ownership README or package-local test script;
- workspace test files omitted from, or duplicated in, their suite ownership
  README;
- test files larger than 300 lines;
- focused tests (`.only`);
- placeholder markers;
- package tests importing another package's private `src/`; and
- non-descriptive test titles that omit given/when/then.

Passing the architecture check is necessary but not sufficient: reviewers
still confirm that suites remain orthogonal and that helpers do not hide their
oracles.
