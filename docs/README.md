# AGP documentation

Every document in this project lives here, except the repository [`README.md`](../README.md).\
Start from the question you are trying to answer.

---

## By question

| I want to | Read |
|---|---|
| Understand what AGP is and run it | [`../README.md`](../README.md) |
| Know whether it is safe to expose | [`SECURITY.md`](SECURITY.md) |
| Change the code | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Write or move a test | [`testing.md`](testing.md) |
| Understand a protocol behavior | [`design/agp-uniform-node/`](design/agp-uniform-node/README.md) |
| Know why a design choice was made | [`design/agp-uniform-node/decisions.md`](design/agp-uniform-node/decisions.md) |
| Know what proves a behavior correct | [`design/agp-uniform-node/verification.md`](design/agp-uniform-node/verification.md) |

---

## Design set

The architecture entry point is [`design/agp-uniform-node/README.md`](design/agp-uniform-node/README.md), which also lists this set with its own commentary.

| Domain | Document | Owns |
|---|---|---|
| Architecture | [`README.md`](design/agp-uniform-node/README.md) | Mandate, non-negotiable outcomes, package composition, processing paths |
| Authority | [`axioms.md`](design/agp-uniform-node/axioms.md) | Which Mission Kit axioms apply, and at which evidence boundary |
| Authority | [`decisions.md`](design/agp-uniform-node/decisions.md) | The `D1`-`D17` decision register |
| Authority | [`mechanisms.md`](design/agp-uniform-node/mechanisms.md) | `M01`-`M35` feature index, RFC alignment, and the `F01`-`F07` deferred set |
| Contracts | [`contracts.md`](design/agp-uniform-node/contracts.md) | Schema ownership and the catalog model |
| Protocol | [`protocol.md`](design/agp-uniform-node/protocol.md) | Packet language and symmetric adjacency behavior |
| Protocol | [`fsm.md`](design/agp-uniform-node/fsm.md) | Connection states, timers, events, and teardown order |
| Routing | [`routing.md`](design/agp-uniform-node/routing.md) | RIB model, selection, propagation, and forwarding |
| Transport | [`transport-contract.md`](design/agp-uniform-node/transport-contract.md) | The carrier-neutral packet-channel contract |
| Transport | [`bindings/websocket.md`](design/agp-uniform-node/bindings/websocket.md) | The AGP v1 over WebSocket binding |
| Transport | [`transports/loopback.md`](design/agp-uniform-node/transports/loopback.md) | The process-local production transport |
| Surface | [`sdk-operations.md`](design/agp-uniform-node/sdk-operations.md) | Public API and canonical operational state |
| Verification | [`verification.md`](design/agp-uniform-node/verification.md) | The `AX0`-`AX8` gates and the test-file ownership map |
| Verification | [`traceability.json`](design/agp-uniform-node/traceability.json) | Machine-checked requirement, authority, and gate ownership |

---

## Records

These capture intent and review at a point in time rather than current state.

| Document | Holds |
|---|---|
| [`surveys/uniform-agp-node-routing-survey.md`](surveys/uniform-agp-node-routing-survey.md) | The confirmed intent the design set implements |
| [`design/agp-uniform-node/transport-sovereignty-authority.md`](design/agp-uniform-node/transport-sovereignty-authority.md) | Fixed transport intent and its explicit survey bypass |
| [`design/agp-uniform-node/transport-sovereignty-review.md`](design/agp-uniform-node/transport-sovereignty-review.md) | The `TSR-01`-`TSR-57` sovereignty audit and its dispositions |

---

## Conventions

Markdown follows the style rules published in [apnex/mission-kit](https://github.com/apnex/mission-kit/tree/main/style), enforced by the vendored checkers in [`../tools/`](../tools/README.md).

Check before committing:
```bash
npm run docs:check
```

Every normative document carries an explicit mechanics, rationale, and consequence triad.\
`test/conformance/design-mrc.test.js` enforces that, so a document stating a rule cannot omit why the rule exists or what breaks without it.
