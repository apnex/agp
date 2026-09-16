# Native Rust CLI integration

Status: complete for the selected local native integration.\
The owner requested a complete configured Rust consumer in `rustcli/`, validated against the live local AGP suite, with reusable mechanisms contributed to `apnex/cli`.\
This is the consumer implementation record for `B42` and `MX8`.

The later [operator increment](OPERATOR.md) adds compact discovery and in-shell management settings under `B43` and `MX9`.

---

## Scope and authority

Cover the management server's ten existing read-only resources: health, snapshot, configuration, endpoints, connections, advertisements, routes, forwarding, resources, and counters.\
Retain the dotted connection and route commands and their tables, and add contextual `show` and `ls` verbs.\
The CLI entry point embeds authored definition and application data; endpoint access, navigation, argument handling, completion, and tables belong to the shared Rust kernel.\
The user's instruction selects this work directly; no additional survey is needed for these bounded implementation choices.

---

## Acceptance

Run existing frozen-state parity, live timer, independent-process star, and loopback inspection assertions with the native executable selected explicitly.\
Add coverage for every management resource and view, native execution without helper binaries, contextual navigation, and HTTP error boundaries.\
Replay both authoring recipes and compare the resulting documents against the embedded data.\
Retain the original CLI as an independently runnable compatibility reference.

---

## Measured results

The [native gate](evidence/native-gate.txt) passes five consumer tests and the original twelve-file e2e suite against the Rust executable.\
It also rebuilds both binaries, checks Rust lint/formatting and AGP documentation/test ownership, and reproduces both authored documents byte for byte.\
Every one of the thirty declared commands executes in raw JSON and table-event mode against a real frozen-clock node pair; independently specified cells agree with the public SDK and HTTP responses.

The [installed operator journey](evidence/operator-guide.json) exercises eight commands and a real terminal session against the persistent Loopback example.\
The [terminal capture](evidence/operator-terminal.raw) includes context entry, a live connection table, help, parent navigation, the verb tree, and clean exit.\
All-resource tests use an empty PATH for the native executable.

The live node's global resource gauge map is empty.\
A separate HTTP-boundary case covers populated gauge rows with exact large values, while the live check proves the resource request and envelope.\
A stalled HTTP response is tested against the total deadline; no partial JSON reaches stdout.

The full [standard gate capture](evidence/standard-gate-before-board-correction.txt) passed packages, legacy CLI, e2e, integration, resilience, and topology, but rejected the new board row because it lacked a build-order entry.\
That record was corrected, and all [35 conformance assertions](evidence/conformance-corrected.txt) then passed.\
The original failure remains recorded; neither the checker nor runtime acceptance was weakened.

The [measurements](evidence/measurements.json) identify the consumer baseline and installed binary; the [source manifest](evidence/source.sha256) identifies its Rust entry point, data, scripts, and tests.\
The shared CLI gate passed 92 normal tests, 109 instrumented tests, 13 scaffold tests, strict lint, formatting, and frozen output compatibility.

Successful IPv6 transport is [unmeasured on this host](evidence/ipv6-boundary.txt) because loopback IPv6 is disabled.\
Literal IPv6 grant validation and explicit unavailable-transport failure are tested; IPv4 live acceptance passes.\
No production deployment or independent reviewer verdict is claimed.

The dedicated native CI job checks out the kernel commit recorded in [`rustcli/cli-revision`](../../rustcli/cli-revision) beside AGP and runs the same native gate.\
Local evidence does not claim that the hosted job has executed.

---

## Mechanics, rationale, and consequence

### Mechanics

AGP declares its verbs and views as data and supplies launch-time authority for literal loopback management reads.\
The shared kernel persists read observations, keeps raw results available, and renders bounded tables.

### Rationale

Operators can use a named native CLI while projects reuse one implementation of terminal mechanics and rendering.\
AGP's existing management API and independently written parity assertions provide a concrete first consumer contract.

### Consequence of violation

Hardcoded AGP dispatch or rendering in Rust would duplicate the shared kernel and weaken the configuration workflow this exercise is intended to prove.\
A fixture-only test would leave the requested live local integration unmeasured.
