# Protocol test ownership

This directory is the sovereign executable contract for `@agp/protocol`.\
Run it from the workspace root with:
```bash
npm test --workspace @agp/protocol
```

Every test title states its Given/When/Then arrangement.\
Each file owns one primary axis, creates no shared mutable state, and imports only the public package root.

## Invariant map

| Test file | Primary axis and public oracle | Scoped fixture | Explicitly does not test |
|---|---|---|---|
| `contract/schema-catalog.test.js` | Sovereign file/URN/owner/type/digest/reference composition and external-only root union | Package schema catalog and files | Wire sequencing, contextual path meaning, FSM behavior |
| `contract/semantic-rule-catalog.test.js` | Exact package ownership and implementation/test anchors for protocol semantic rules | Package semantic-rule catalog | Semantic outcomes, core/node-owned registry entries |
| `contract/valid-variants.test.js` | Schema-valid encode/decode preservation for exactly seven wire variants, including a disposition carrying both arms | `fixtures/valid-wire-messages.json` | Negative classification and contextual semantics |
| `contract/carrier-neutrality.test.js` | Packet codec and schema surfaces expose no concrete carrier semantics | Package root, codec source, and sovereign schema descriptions | WebSocket binary/close mapping and transport channel behavior |
| `contract/closed-language.test.js` | Exact v1 code domains and removal of legacy/ambiguous object shapes | One valid fixture is cloned with one shape stimulus | Raw JSON grammar, identity admission, routing mutation |
| `unit/open-identity.test.js` | `OPEN-IDENTITY-1` distinct/expected/admitted identity precedence | Valid OPEN body | Pair allocation, collision, timers |
| `unit/route-path-semantics.test.js` | `ROUTE-PATH-OWNERSHIP-1` origin/sender/repetition precedence and snapshot-local canonicality | Inline immutable routes | Receiver-loop policy, RIB mutation, path limit |
| `unit/route-path-limit.test.js` | `ROUTE-PATH-LIMIT-1` receiver-append equality boundary | One inline immutable route | Path ownership and negotiated-value derivation |
| `unit/return-token-shape.test.js` | Fixed 16-hex `ReturnToken` shape and separation from six-hex/message textual domains | Inline boundary strings | Stateful allocation, exhaustion, breadcrumb lifetime |
| `unit/preflight-safety.test.js` | Duplicate/raw grammar, numeric/runtime graphs, UTF-8, and packet-byte precedence before schema interpretation | Values are constructed because token/byte identity is the stimulus | Binding close mapping, protocol path semantics, FSM legality |
| `unit/disposition-denominator.test.js` | Absence is the only wire spelling of a denominator of one, and `destinationsOf` is the single site that reads it back | Inline disposition bodies | Batching, binding release, outstanding accounting |

---

## Non-overlap rule

A test may reuse a valid fixture only as arrangement.\
The assertion remains in the owning file and changes one stimulus dimension.\
Schema tests do not infer temporal rules; semantic tests do not mutate a session or RIB; and absence of a wire packet is proved later by the owning node test rather than by timeout here.
