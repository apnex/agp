# Security

## Supported posture

AGP is a routing library, not a hardened network service.\
Read this before exposing it to anything you do not control.

The WebSocket binding offers two profiles, and which one you configure decides what you get.

### `preshared-key`

TLS 1.3 with pre-shared keys.\
No certificate authority, no issuance, no expiry, no revocation.\
Confidentiality and integrity on every channel.

`keying` is required, and it decides what a completed handshake proves:

| `keying` | Protects traffic | Identifies the peer |
|---|---|---|
| `network` | Yes | No. One secret covers the topology, so any holder can present any identity |
| `node` | Yes | Yes, to a listener. Each node has its own secret, so a presented identity is proven |

`network` is the simpler starting point.\
`node` is what makes a claimed AGP `nodeId` worth anything, because without it every insider can impersonate every other.

Two limits to understand before relying on this:

- **The transport reports; it does not enforce.** A listener passes the observed
  principal to `IdentityAdmissionPort`, and your policy decides whether that
  principal may claim that `nodeId`.
- **Declaring `node` keying while wiring one secret for every identity produces
  `verified` evidence that is false.** The binding cannot detect this, so the
  declaration is a deployment responsibility.

Specified for star and line topologies.\
In a full mesh every node would hold every other node's secret, so one compromise forges every identity; that case needs a per-pair model and is not supported.

Forward secrecy is provided.\
The handshake negotiates `psk_dhe_ke` with an ephemeral X25519 key share, verified against a live socket, so a secret disclosed later does not decrypt traffic captured earlier.

### `trusted-development`

Cleartext `ws:`.\
OPEN identity is self-asserted, and the transport provides no confidentiality and no peer authentication.\
Traffic is readable and forgeable by anything on the path.\
Use it only on a network you already trust.

Certificate-based profiles and HTTP Upgrade authentication remain unimplemented.\
The adapter rejects that configuration before constructing a resolver rather than silently downgrading.

The process-local Loopback transport carries no network exposure, so it remains the safest option for component-to-component routing inside one process.

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
