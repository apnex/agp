# AGP documentation

Every document in this project lives here, except the repository [`README.md`](../README.md).\
Start from the question you are trying to answer.

Project-generalised documents are `UPPERCASE.md`; domain design contracts are `lowercase.md`.

---

## By question

| I want to | Read |
|---|---|
| Understand what AGP is and run it | [`../README.md`](../README.md) |
| Know whether it is safe to expose | [`SECURITY.md`](SECURITY.md) |
| Change the code | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Write or move a test | [`TESTING.md`](TESTING.md) |
| Know why a design choice was made | [`DECISIONS.md`](DECISIONS.md) |
| Understand a protocol behavior | [`design/`](design/README.md) |
| Know what proves a behavior correct | [`design/verification.md`](design/verification.md) |

---

## Project

| Document | Owns |
|---|---|
| [`DECISIONS.md`](DECISIONS.md) | The `D1`-`D17` decision register: what was chosen, why, and what a reversal would cost |
| [`TESTING.md`](TESTING.md) | Test ownership, suite structure, and the anti-rot checks |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How to build, verify, and land a change |
| [`SECURITY.md`](SECURITY.md) | Supported security posture and how to report a vulnerability |

---

## Design set

The architecture entry point is [`design/README.md`](design/README.md), which lists this set with its own commentary.

| Domain | Document | Owns |
|---|---|---|
| Architecture | [`README.md`](design/README.md) | Mandate, non-negotiable outcomes, package composition, processing paths |
| Authority | [`axioms.md`](design/axioms.md) | Which Mission Kit axioms apply, and at which evidence boundary |
| Authority | [`mechanisms.md`](design/mechanisms.md) | `M01`-`M35` feature index, RFC alignment, and the `F01`-`F07` deferred set |
| Contracts | [`contracts.md`](design/contracts.md) | Schema ownership and the catalog model |
| Protocol | [`protocol.md`](design/protocol.md) | Packet language and symmetric adjacency behavior |
| Protocol | [`fsm.md`](design/fsm.md) | Connection states, timers, events, and teardown order |
| Routing | [`routing.md`](design/routing.md) | RIB model, selection, propagation, and forwarding |
| Transport | [`transport-contract.md`](design/transport-contract.md) | The carrier-neutral packet-channel contract |
| Transport | [`binding-websocket.md`](design/binding-websocket.md) | The AGP v1 over WebSocket binding |
| Transport | [`transport-loopback.md`](design/transport-loopback.md) | The process-local production transport |
| Surface | [`sdk-operations.md`](design/sdk-operations.md) | Public API and canonical operational state |
| Verification | [`verification.md`](design/verification.md) | The `AX0`-`AX8` gates and the test-file ownership map |
| Verification | [`traceability.json`](design/traceability.json) | Machine-checked requirement, authority, and gate ownership |

---

## Intent records

These capture confirmed intent rather than current state.\
The design set implements them; they are cited as authority by [`design/axioms.md`](design/axioms.md) and [`design/traceability.json`](design/traceability.json).

| Document | Holds |
|---|---|
| [`surveys/uniform-agp-node-routing-survey.md`](surveys/uniform-agp-node-routing-survey.md) | The confirmed intent behind the uniform-node design |
| [`design/transport-sovereignty-authority.md`](design/transport-sovereignty-authority.md) | Fixed transport intent and its explicit survey bypass |
| [`design/transport-sovereignty-review.md`](design/transport-sovereignty-review.md) | The sovereignty audit that produced the transport contract |

---

## Conventions

Markdown follows the style rules published in [apnex/mission-kit](https://github.com/apnex/mission-kit/tree/main/style), enforced by the vendored checkers in [`../tools/`](../tools/README.md).

Check before committing:
```bash
npm run docs:check
```

Every normative document carries an explicit mechanics, rationale, and consequence triad, and every design contract enumerates the faults it averts.\
`design-mrc.test.js` and `consequence-of-violation.test.js` enforce both, so a document stating a rule cannot omit why the rule exists or what breaks without it.
