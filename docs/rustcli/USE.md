# Use the native AGP CLI

`agp` is the configured Rust management CLI.\
It reads the same local management API as `agpctl` and provides all ten resources with contextual verbs and native tables.\
The executable needs no Bash, curl, jq, or column at runtime.

---

## Build and install

Use sibling `agp/` and `cli/` checkouts; the Cargo dependency points to `../../cli` from `rustcli/`.\
The native CI job selects the exact kernel commit recorded in [`rustcli/cli-revision`](../../rustcli/cli-revision); local development uses the sibling working tree.\
Rust, Cargo, and a C linker are build prerequisites.\
AGP's live tests also require the existing Node/npm environment and the legacy CLI's dependencies.

From the AGP repository:
```sh
cargo build --locked --manifest-path rustcli/Cargo.toml
./rustcli/target/debug/agp --help
./rustcli/target/debug/agp tree
```

Install a standalone executable under Cargo's usual binary directory:
```sh
cargo install --locked --path rustcli
agp --help
```

The installed executable embeds its specification and application profile.\
Operators do not need to locate either file or use the kernel's authoring commands.

---

## Inspect a local example

Start the shipped example in one terminal from the AGP repository:
```sh
npm run build
node examples/loopback-star/example.mjs --persist
```

In another terminal, open the native CLI:
```sh
./rustcli/target/debug/agp
```

Select the example's default hub from inside the shell and save the selection:
```text
management set http://127.0.0.1:47201
management save
connections
show
up
routes
ls
exit
```

The example prints its actual management addresses at startup.\
If you override its ports, use those addresses instead.\
Stop the example with Ctrl-C in its own terminal.\
For another existing node, use its actual management URL in `management set`.\
Selection takes effect immediately and does not itself make a network request.\
Future launches use the saved default unless `--url` or `AGP_MANAGEMENT_URL` supplies an override; the explicit option wins.

Start an interactive shell:
```sh
./rustcli/target/debug/agp
```

Enter these lines at its prompt:
```text
connections
?
show
ls
up
routes
show
top
tree
exit
```

Entering a context displays a short command hint and updates the prompt.\
Tab completes contexts, commands, and control shortcuts.\
`show` and `ls` read the current resource; `?` or `help` explains its commands.\
`up` selects the parent; `top` and `/` select root.\
At root, `ls` and `show` list contexts; inside resources they execute the configured read.\
`tree` prints the compact verb structure; `tree --all` and `help --all` include compatibility aliases and full metadata.\
The same input can be piped to the executable.

---

## Management settings

These controls work from any context:

| Command | Effect |
|---|---|
| `management show` | Show the current endpoint, its selection source, saved default, and settings file |
| `management set <url>` | Validate and select an endpoint for this session |
| `management clear` | Remove this session's endpoint selection |
| `management save` | Save the current selection or cleared state for future launches |
| `management load` | Reload the saved selection into this session |

The default file is `$XDG_CONFIG_HOME/programmable-cli/agp/management.json`, falling back to `$HOME/.config/programmable-cli/agp/management.json`.\
Launch with `--config FILE` to use a separate settings file.\
The CLI authors this file; operators do not edit JSON.\
A malformed endpoint leaves the current selection intact.\
If another session saves first, a stale save is rejected; use `management load`, inspect the new selection, then make the intended change.\
These commands configure the CLI's management access; the AGP server remains read-only.

To configure the default in a single invocation, use the intended node's management URL:
```sh
agp management set http://127.0.0.1:47201 --save
```

One-shot set and clear require `--save`; an interactive session can keep an unsaved selection until it exits.

---

## Resource views

Every context provides `show` and `ls`, and every resource also has a dotted `<resource>.list` command at root.\
The existing `connections.list` and `routes.list` commands retain their column layouts and raw JSON semantics.

| Context | Default view |
|---|---|
| `health` | Node identity, lifecycle, health, readiness, and time of state change |
| `snapshot` | Canonical revision, lifecycle, listener, and collection counts |
| `configuration` | Effective redacted configuration by setting |
| `endpoints` | Local endpoint, binding, activity, and registration time |
| `connections` | Session, peer, direction, state, uptime, hold TTL, last event |
| `advertisements` | Received endpoint, origin, advertising peer, session, path, revision |
| `routes` | Selected marker, endpoint, class, next hop, origin, path, eligibility, reason |
| `forwarding` | Endpoint, resolved next hop, origin, selected route, revision |
| `resources` | Current usage, maximum, and high-water mark per resource |
| `counters` | Every named operational counter and value |

`--json` exposes the complete response, including configuration's raw/effective fields and all snapshot sections.\
`--events` exposes the runtime event containing original JSON, read observation, and table presentation.\
Tables and JSON come from the same read; presentation never performs another HTTP request.

---

## Continue a session

Retain context and observations across launches:
```sh
./rustcli/target/debug/agp --session ./agp-session.json
```

Useful canonical controls inside the shell are `:status`, `:views`, `:render connections`, and `:export FILE`.\
A re-render uses the saved result and labels it historical.\
An exported interface carries no endpoint authority; another process selects its endpoint independently through its own settings, launch options, or in-shell management control.\
The application profile remains a separate reusable document when using the generic kernel's `cli app` launcher.

---

## Author and verify the configuration

The sources are contextual recipes in [`rustcli/spec`](../../rustcli/spec), with generated JSON consumed by the executable.\
They construct every object and array through authoring verbs.\
No serialized container literals are needed in the recipes.

Build the authoring kernel and reproduce both documents byte for byte:
```sh
cargo build --locked --manifest-path ../cli/Cargo.toml --bin cli
node rustcli/scripts/author-specs.mjs
```

After changing a recipe, regenerate its derived files and rebuild:
```sh
node rustcli/scripts/author-specs.mjs --write
cargo build --locked --manifest-path rustcli/Cargo.toml
```

Run the native integration gate:
```sh
npm run test:rustcli
```

This builds both binaries, checks Rust formatting/lint, replays authoring, checks AGP build/docs/test ownership, runs all-resource native tests, and runs the existing e2e suite with the Rust executable selected.\
The standard `npm test` retains the original Bash CLI compatibility coverage.\
`AGP_TEST_CLI` is the explicit executable selection used by the existing system parity helper; it never silently falls back after a chosen executable fails.

---

## Error and transport contract

| Exit | Meaning |
|---|---|
| `0` | Success |
| `1` | Kernel, storage, or delivery failure |
| `2` | Usage, arguments, missing endpoint authority, or invalid endpoint |
| `4` | HTTP transport or deadline failure |
| `5` | HTTP status other than 200, including redirects |
| `6` | Invalid JSON or failed configured management response requirement |
| `7` | Presentation failure; the successful read observation remains retained |

Reads require literal loopback HTTP with an explicit valid port.\
The client disables proxies and redirects, allows two seconds to connect and seven seconds overall, and limits response bodies to one MiB.\
This client limit is lower than the management server's configurable maximum; larger responses are rejected explicitly.\
The configured requirements check management envelopes and the shapes needed by views, while the server owns full schema validation.\
Dynamic entity contexts, general remote endpoints, authentication, and mutation verbs are outside this consumer.
