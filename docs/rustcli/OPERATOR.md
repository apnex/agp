# Native operator configuration

Status: complete for `B43` and `MX9`.\
The owner approved compact discovery and asked to configure management from inside the CLI.\
The [operator guide](USE.md#management-settings) describes the shipped commands.

---

## Implementation

The shared Rust kernel provides endpoint selection, explicit saving, context listing, and compact help.\
AGP selects `management`, `ls`, `show`, and `/` through its authored profile, and declares which compatibility commands are aliases.\
Its thin Rust entry point remains unchanged.\
Both specification documents still replay from contextual authoring commands without serialized container literals.

`management set <url>` takes effect immediately in an interactive session.\
`management save` persists the selected endpoint; future launches use it unless the environment or explicit URL overrides it.\
`management show`, `clear`, and `load` expose the current and saved choices.\
One-shot changes require `--save`.\
Selections remain separate from portable exports and saved read observations.

---

## Measured acceptance

The [native gate](operator-evidence/agp-native-gate.txt) passes six consumer tests and twelve existing e2e tests against the Rust executable.\
All thirty resource commands retain their live raw-response and independently specified table checks.\
The recipes reproduce 4143 definition events and 1870 application events, byte-for-byte matching the embedded data.\
The gate also checks build, strict Rust lint, formatting, documentation, and test ownership.

The [installed journey](operator-evidence/installed-measurements.json) uses the executable on the user's PATH against the real persistent Loopback example.\
Its [terminal capture](operator-evidence/installed-operator-terminal.raw) exercises root discovery, slash navigation, an unconfigured read, in-shell setup, saving, and a live connection table.\
Fresh invocations reopen the saved hub endpoint and then switch to `leaf.alpha`; both health reads report ready.\
Clearing the saved endpoint makes the next read fail with the management setup instruction.\
The deliberate missing-endpoint read leaves terminal status 2 even after recovery.\
The exact example child exits cleanly, and the probe's isolated settings file leaves the user default absent.

Root help decreases from 55 to 21 lines.\
Detailed help and structured discovery retain the full command surface.\
The [measurements](operator-evidence/measurements.json) record the baselines, shared and consumer source manifests, installed binary digest, and shared kernel checks.\
Those checks pass 100 normal tests, 117 full instrumented tests, and 13 scaffold tests; the final filename-escaping assertion also passes in the instrumented application suite.

---

## Corrections and limits

The [initial new live fixture](operator-evidence/agp-tests-initial.txt) lacked its required listener; the [corrected journey](operator-evidence/management-journey-corrected.txt) supplies one and passes.\
The first release probe expected `alpha` as the node ID, while the example configuration specifies `leaf.alpha`; the [failed probe](operator-evidence/release-journey.txt) is retained and the installed journey checks the actual configured identity.\
No production deployment, hosted CI execution, independent reviewer verdict, or successful IPv6 transport is claimed.\
Management settings configure this CLI's access to the existing read-only API; selecting a URL alone does not establish that a node is reachable.

---

## Mechanics, rationale, and consequence

### Mechanics

AGP authors descriptions and alias declarations; the shared kernel owns discovery, routing, endpoint validation, persistence, and transport.\
Saved settings use an application-specific local document with stale-write detection.

### Rationale

An operator can discover and configure a usable CLI without learning its provider model, exporting a shell variable, or editing JSON.

### Consequence of violation

A duplicated AGP implementation would weaken the shared configurable kernel.\
Silent unsaved one-shot changes or overwriting another session's settings would make reported configuration unreliable.
