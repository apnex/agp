# Conformance test ownership

| File | Contract protected | Primary axis | Oracle |
|---|---|---|---|
| `traceability-graph.test.js` | Ratified requirement authorities and design references resolve | intent graph | trace schema, authority set, and local targets |
| `schema-catalog-composition.test.js` | Package-owned schemas compose without copied ownership | root schema catalog | paths, digests, owners, and validator loading |
| `event-schema-catalog.test.js` | Every event and event-data DTO is sovereign and union-referenced | event family closure | exact IDs, generated types, discriminators, and `$ref` set |
| `no-legacy-surface.test.js` | In-place v1 replacement retains no router/spoke workspace or package | public replacement boundary | workspace, package, and lockfile absence |
| `semantic-rule-registry.test.js` | Every contextual rule resolves to one implementation and test | semantic ownership | schema annotation, source symbol, and test path |
| `public-node-consumer.test.js` | Package-root exports compose for an application | public boundary | uniform factory, local RIB, and management response |
| `design-mrc.test.js` | Every normative artifact preserves inspectable reasoning structure | knowledge completeness | exact mechanics/rationale/consequence allowlist |
| `markdown-link-integrity.test.js` | Every tracked markdown file resolves its local links and anchors, not just the design set | repository-wide link integrity | file existence and heading slugs across all tracked markdown |
| `board-record.test.js` | Board items are scored on both dimensions, cite a resolvable record, and every held item carries a revival trigger | board-record invariant | score format, link resolution, trigger presence, and blocked-item naming |
| `coverage-register.test.js` | The live coverage permutation register names runnable tests and records exclusions as decisions | permutation-register integrity | file existence, axis completeness, and re-entry conditions |
| `verification-ownership-map.test.js` | Gate evidence named in the verification plan resolves to real, singly-owned test files | ownership-map integrity | exact file existence, gate/file uniqueness, and suite README ownership |
| `design-link-integrity.test.js` | Local design and trace references cannot silently rot | reference integrity | exact file and heading-anchor resolution |
| `design-vocabulary.test.js` | Cross-document target terms retain one owner and meaning | vocabulary closure | canonical presence and stale-name absence |
| `consequence-of-violation.test.js` | Every design contract names the faults it averts | knowledge durability | enumerated fault entries and minimum substance per consequence section |
| `transport-sovereignty.test.js` | Concrete carrier concepts remain outside the AGP kernel | dependency and vocabulary boundary | exact internal graph plus production-source absence/presence checks |
| `schema-generation-isolation.test.js` | Every schema owner regenerates and resolves from a clean consumer | generated-boundary isolation | byte-current generators, declared imports, and package-root declaration compilation |

These files prove assembly contracts only.\
Package schema keywords, routing semantics, transport behavior, and presentation details remain in their owning package suites.\
They do not exercise live sockets, route convergence, or application delivery; those behaviors remain in the integration and topology suites.
