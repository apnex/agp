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
| Know why a design choice was made, or what was confirmed as intent | [`DECISIONS.md`](DECISIONS.md) |
| Decide what to work on next | [`BOARD.md`](BOARD.md) |
| Understand a protocol behavior | [`design/`](design/README.md) |
| Know what proves a behavior correct | [`GATES.md`](GATES.md) |

---

## Project

| Document | Owns |
|---|---|
| [`BOARD.md`](BOARD.md) | The triaged set of legal next moves, scored, with what is held and why |
| [`DECISIONS.md`](DECISIONS.md) | Confirmed intent, and the decision register: what was chosen, why, and what a reversal would cost |
| [`TESTING.md`](TESTING.md) | Test ownership, suite structure, and the anti-rot checks |
| [`VERIFICATION.md`](VERIFICATION.md) | The certification model, traceability, and permutation matrices |
| [`GATES.md`](GATES.md) | The `AX0`-`AX8` gate definitions and the test-file ownership map |
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
| Surface | [`sdk.md`](design/sdk.md) | Public API, lifecycle, endpoint binding, and messaging |
| Surface | [`operations.md`](design/operations.md) | Canonical operational state, management HTTP, and `agpctl` |
| Verification | [`traceability.json`](design/traceability.json) | Machine-checked requirement, authority, and gate ownership |
| Authority | [`transport-sovereignty-authority.md`](design/transport-sovereignty-authority.md) | Fixed transport intent and its explicit survey bypass |

---

## Conventions

Markdown follows the style rules published in [apnex/mission-kit](https://github.com/apnex/mission-kit/tree/main/style), enforced by the vendored checkers in [`../tools/`](../tools/README.md).

Check before committing:
```bash
npm run docs:check
```

Every normative document carries an explicit mechanics, rationale, and consequence triad, and every design contract enumerates the faults it averts.\
`design-mrc.test.js` and `consequence-of-violation.test.js` enforce both, so a document stating a rule cannot omit why the rule exists or what breaks without it.
