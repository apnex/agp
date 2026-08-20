# Conformance test ownership

| File | Contract protected | Primary axis | Oracle |
|---|---|---|---|
| `traceability-graph.test.js` | Ratified requirement authorities and design references resolve | intent graph | trace schema, authority set, and local targets |
| `schema-catalog-composition.test.js` | Package-owned schemas compose without copied ownership | root schema catalog | paths, digests, owners, and validator loading |
| `event-schema-catalog.test.js` | Every event and event-data DTO is sovereign and union-referenced | event family closure | exact IDs, generated types, discriminators, and `$ref` set |
| `no-legacy-surface.test.js` | In-place v1 replacement retains no router/spoke workspace or package | public replacement boundary | workspace, package, and lockfile absence |
| `semantic-rule-registry.test.js` | Every contextual rule resolves to one implementation and test | semantic ownership | schema annotation, source symbol, and test path |
| `public-node-consumer.test.js` | Package-root exports compose for an application | public boundary | uniform factory, local RIB, and management response |
| `verification-evidence-contract.test.js` | Verification manifests encode recursive binary gate evidence | evidence contract | strict schema, exact AX1 subgates, aggregate status, and path-key oracle |
| `design-mrc.test.js` | Every normative artifact preserves inspectable reasoning structure | knowledge completeness | exact mechanics/rationale/consequence allowlist |
| `design-link-integrity.test.js` | Local design and trace references cannot silently rot | reference integrity | exact file and heading-anchor resolution |
| `design-vocabulary.test.js` | Cross-document target terms retain one owner and meaning | vocabulary closure | canonical presence and stale-name absence |
| `review-finding-closure.test.js` | Every transport review finding has durable closure evidence | finding lifecycle | exact TSR sets, statuses, owners, and downstream obligations |
| `transport-sovereignty.test.js` | Concrete carrier concepts remain outside the AGP kernel | dependency and vocabulary boundary | exact internal graph plus production-source absence/presence checks |
| `schema-generation-isolation.test.js` | Every schema owner regenerates and resolves from a clean consumer | generated-boundary isolation | byte-current generators, declared imports, and package-root declaration compilation |

These files prove assembly contracts only. Package schema keywords, routing
semantics, transport behavior, and presentation details remain in their
owning package suites.
They do not exercise live sockets, route convergence, or application delivery;
those behaviors remain in the integration and topology suites.
