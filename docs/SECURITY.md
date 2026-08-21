# Security

## Supported posture

AGP is a routing library, not a hardened network service.\
Read this before exposing it to anything you do not control.

The certified WebSocket security mode is `trusted-development` and nothing else.\
Concretely, that means:

- OPEN identity is **self-asserted**. A peer claims its node ID and the transport
  does not authenticate that claim. `expectedNodeId` states what you intend to
  reach; it does not prove what you reached.
- The `ws:` transport provides **no confidentiality and no peer
  authentication**. Traffic is readable and forgeable by anything on the path.
- `wss:`, TLS, client certificates, and HTTP Upgrade authentication are
  **deliberately not implemented**. They are deferred under F07 in
  [`mechanisms.md`](./design/mechanisms.md), and the
  adapter rejects that configuration before it constructs a resolver rather than
  silently downgrading.

Use it only on a trusted development network, or embed it behind a transport you have separately reviewed.

A production integration owns the secure transport binding, authenticated identity admission through `IdentityAdmissionPort`, and deployment-specific policy.\
AGP does not claim those on a consumer's behalf.

The process-local Loopback transport carries no network exposure, so it is the safer default for component-to-component routing inside one process.

---

## Management surface

The management HTTP server binds literal loopback only, by design, and exposes read-only projections.\
`agpctl` is an inspection surface, not a remote administration API.

There is no mutating management verb, and adding one is out of scope for v1.

---

## Reporting a vulnerability

Report suspected vulnerabilities through [GitHub security advisories](https://github.com/apnex/agp/security/advisories/new).

Please do not open a public issue for an unfixed vulnerability.

Include the affected package, the AGP version or commit, and a reproduction.\
Because the shipped security mode is explicitly `trusted-development`, a report that an unauthenticated `ws:` peer can assert an identity describes documented behavior rather than a vulnerability.
