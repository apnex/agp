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

In another terminal, select the example's hub and call ordinary verbs:
```sh
export AGP_MANAGEMENT_URL=http://127.0.0.1:47201
./rustcli/target/debug/agp connections show
./rustcli/target/debug/agp routes ls
./rustcli/target/debug/agp health show
./rustcli/target/debug/agp resources show
./rustcli/target/debug/agp counters show
./rustcli/target/debug/agp snapshot show --json
```

The example prints its actual management addresses at startup.\
If you override its ports, use those addresses instead.\
Stop the example with Ctrl-C in its own terminal.\
For another existing node, supply its actual management URL through `--url` or `AGP_MANAGEMENT_URL`; the explicit option wins.

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

Entering a context displays its available commands and updates the prompt.\
Tab completes contexts, commands, and control shortcuts.\
`show` and `ls` read the current resource; `?` or `help` explains its commands.\
`up` selects the parent, `top` selects root, and `tree` prints the complete verb structure.\
The same input can be piped to the executable.

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
An exported interface carries no endpoint authority; another process must receive `--url` or the environment variable for fresh reads.\
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
