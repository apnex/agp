# AGP MVP wire protocol

| Field | Value |
|---|---|
| Status | Proposed |
| Wire version | 1 |
| WebSocket subprotocol | `agp.v1` |
| Schema | [`schemas/agp-message.schema.json`](schemas/agp-message.schema.json) |
| Intent source | [AGP MVP survey](../../../surveys/agent-gateway-protocol-mvp-survey.md) |

## 1. Purpose and scope

AGP version 1 is a language-neutral application protocol carried as JSON over a
persistent WebSocket. The same connection carries:

- control-plane messages that open and maintain an AGP session and announce or
  withdraw named endpoints; and
- data-plane messages addressed to those named endpoints.

The MVP permits one `hub` and multiple directly connected `spoke` nodes. It
does not define router-to-router sessions, propagated reachability, path-vector
attributes, multi-hop forwarding, or loop prevention. Those are a later
protocol version or extension, not hidden version-1 behaviour.

This boundary implements survey Q1 `a,c` (formal correctness and visible
state), Q3 `b,c` (contracts before layered implementation), and Q4 `a,b`
(preserve next-hop/RIB abstractions while deferring multi-hop signalling).

The words **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are normative in the
sense of [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html).

## 2. Deliberate relationship to BGP

AGP borrows BGP's separation of session establishment, reachability updates,
liveness, fatal notifications, and an Established-only update phase. It also
borrows the operational distinction among received candidates, selected local
routes, and export state. RFC 4271 defines these as Adj-RIBs-In, Loc-RIB, and
Adj-RIBs-Out and requires a selected route's next hop to be resolvable
([RFC 4271 §3.2](https://www.rfc-editor.org/rfc/rfc4271.html#section-3.2)).

AGP is not BGP and does not claim wire compatibility:

| BGP concept | AGP MVP adaptation |
|---|---|
| TCP session | WebSocket connection |
| BGP Identifier | stable `nodeId` |
| OPEN | `open` control message |
| KEEPALIVE | `keepalive` control message |
| UPDATE NLRI | direct endpoint names in `endpoint.update` |
| NOTIFICATION | fatal `notification`, then WebSocket close |
| IP forwarding plane | JSON `message` on the same WebSocket |

BGP defines a route as destinations plus path attributes and treats connection
loss as an implicit withdrawal of routes learned over it
([RFC 4271 §3.1](https://www.rfc-editor.org/rfc/rfc4271.html#section-3.1)).
AGP retains the session-ownership and implicit-withdrawal invariant, but the
MVP advertises named endpoints and does not place future path attributes on the
wire.

## 3. Roles and identifiers

### 3.1 Roles

- A `spoke` initiates a WebSocket connection to one configured hub, originates
  endpoint advertisements, sends application data, and receives data for its
  local endpoints.
- A `hub` accepts connections, owns the RIB and forwarding resolver, validates
  source ownership, and forwards data to the selected next hop. A hub MAY also
  originate local endpoints through its SDK, but does not advertise them on a
  spoke session.

Version 1 permits only a `spoke`–`hub` pair. `hub`–`hub` and `spoke`–`spoke`
OPEN exchanges are fatal role mismatches.

### 3.2 Identity layers

| Identifier | Lifetime | Wire-visible | Meaning |
|---|---|---|---|
| `nodeId` | stable across reconnects | yes, in `open` | configured protocol identity of one node |
| `sessionId` | one AGP lifecycle; new on every reconnect | yes, in `open` | sender-generated opaque, node-local session token; reference default is six lowercase hex |
| `transportId` | one local WebSocket object | no | implementation-only diagnostic handle |
| envelope `id` | one emitted AGP message | yes | deployment-globally unique correlation/diagnostic identity |

For message-identifier scope, an **AGP deployment** is one configured routing domain:
the version-1 hub plus every spoke and hub-local producer permitted to exchange
messages through it. That scope survives node process restarts and individual
session replacement. An envelope `id` MUST NOT be reused by any producer
anywhere in that deployment during the deployment's lifetime.

A `sessionId` has a narrower scope. It is not globally unique: semantic
participant/session identity and learned-route provenance use
`(nodeId, sessionId)`. Different nodes may use the same session value. A hub's
locally generated session value, exposed as `owningSessionId` in routing and
operations state, MUST be unique among the sessions owned by that router so it
can safely index cleanup and forwarding.

`peer` means the relationship to the remote `nodeId`; it is not another
identifier type. Socket address tuples and private WebSocket implementation
fields MUST NOT be protocol identity.

The hub MUST bind the claimed `nodeId` either to connection authentication or
to an explicit development-mode trust policy before accepting OPEN. A session
that passes that configured binding is **identity-admitted**; this term does not
claim that development trust is authenticated. Collision checks cover every
identity-bound, nonterminal controller for that remote `nodeId`, including
`OpenConfirm` as well as `Established`; they are not limited to fully
established sessions. A failed identity-policy binding is permanent
`IDENTITY_REJECTED`. A new connection that is otherwise valid but temporarily
collides with such a controller receives retryable `IDENTITY_COLLISION`; this
lets a reconnect back off while the prior controller finishes closing.

### 3.3 Lexical forms

- `nodeId` is 1–128 lowercase ASCII characters matching
  `^[a-z0-9][a-z0-9._-]{0,127}$`.
- `sessionId`, message `id`, and `refId` are 1–128 printable ASCII identifier
  characters matching `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`. They are opaque
  on the wire. The reference default session generator emits exactly six
  lowercase hexadecimal characters matching `^[0-9a-f]{6}$`: it starts at a
  random 24-bit position and advances a node-local nonrepeating cursor, failing
  after all 16,777,216 values have been issued by that source instance.
  Injected sources may choose another valid representation. Session values
  have no cross-node or cross-process uniqueness requirement.
- Message IDs SHOULD use UUIDv4/v7, ULID, or an equivalently
  collision-resistant generator. A node-prefix/counter scheme for message IDs
  is conforming only if it cannot reuse an ID across process restart or
  reconnect. `refId` carries the ID of another envelope and inherits that
  envelope-ID scope.
- Optional application `correlationId` uses the same 1–128-character lexical
  form, but has no AGP uniqueness requirement and is never interpreted by the
  protocol.
- An endpoint is a case-sensitive canonical lowercase name of at most 253
  characters matching
  `^[a-z0-9][a-z0-9._-]{0,62}(?:/[a-z0-9][a-z0-9._-]{0,62})*$`.
  Examples are `orders/submit` and `inventory.lookup`.

Endpoint comparison is exact byte-for-byte comparison after schema validation.
There is no Unicode, case folding, wildcard, or prefix-match behaviour in
version 1.

## 4. WebSocket binding

### 4.1 Opening

The WebSocket client MUST offer and the server MUST select the exact
`Sec-WebSocket-Protocol` token `agp.v1`. RFC 6455 defines this header as the
opening-handshake agreement on an application subprotocol
([RFC 6455 §11.3.4](https://www.rfc-editor.org/rfc/rfc6455.html#section-11.3.4)).
If the token is not selected, the client fails the connection without sending
AGP messages.

The MVP does not define a fixed URL path. A deployment supplies the `ws:` or
`wss:` URL and handshake authentication. `wss:` is REQUIRED outside a
trusted loopback/test environment.

### 4.2 Message mapping

- Every AGP envelope is exactly one complete WebSocket **text message**.
- The message contains one UTF-8 JSON document whose top level is an object.
- Binary WebSocket messages are unsupported.
- WebSocket fragmentation is transparent to AGP: validation begins only after
  a complete message is reassembled. A JSON document is never split across
  multiple WebSocket messages and multiple documents are never concatenated.

RFC 6455 requires a complete text message to be valid UTF-8 and requires
receivers to support fragmented and unfragmented messages
([§5.6](https://www.rfc-editor.org/rfc/rfc6455.html#section-5.6),
[§5.4](https://www.rfc-editor.org/rfc/rfc6455.html#section-5.4)).

### 4.3 Two distinct liveness layers

WebSocket Ping/Pong is transport liveness. AGP `keepalive` plus the negotiated
hold timer is protocol-session liveness. They are deliberately distinct:

- an adapter MAY use Ping/Pong to detect a broken transport;
- Ping/Pong MUST NOT advance the AGP FSM, confirm OPEN, or reset the AGP hold
  timer; and
- implementations MUST implement AGP keepalives even if their WebSocket
  library also emits Ping/Pong.

RFC 6455 allows Ping as keepalive/remote responsiveness checking
([§5.5.2](https://www.rfc-editor.org/rfc/rfc6455.html#section-5.5.2)); it does
not establish that the remote AGP state machine is progressing.

## 5. Common envelope

All messages conform to:

```json
{
  "agp": 1,
  "plane": "control",
  "type": "keepalive",
  "id": "019d2e48-0001-7000-8000-000000000042",
  "body": {},
  "extensions": {}
}
```

| Field | Rule |
|---|---|
| `agp` | required integer constant `1`; breaking changes use a new WebSocket subprotocol and value |
| `plane` | required discriminator: `control` or `data` |
| `type` | required discriminator defined below |
| `id` | required opaque identifier; MUST be unique across the AGP deployment |
| `body` | required type-specific object |
| `extensions` | optional object for ignorable, namespaced extension data |

Unknown top-level fields are invalid. Unknown `extensions` keys MUST be
preserved when a data message is forwarded and otherwise ignored. No version-1
extension may alter base validation, routing, delivery, or error semantics.
An extension requiring critical handling needs a future negotiated contract.

Message-ID deployment-global uniqueness is a sender obligation so a correlated
`refId` identifies one operation unambiguously even after a hub forwards IDs
unchanged from many ingress sessions onto one egress session. It does not create
acknowledgement or replay semantics: receivers are not required to enforce
global uniqueness and MUST NOT suppress, replay, or report success merely by
tracking `id`.

JSON object member ordering has no meaning. Duplicate member names anywhere in
the envelope, including the application payload, MUST be rejected before or
during parsing because otherwise parsers can disagree on the interpreted value.
This strengthens the interoperability baseline in
[RFC 8259](https://www.rfc-editor.org/rfc/rfc8259.html).

AGP version 1 uses an IEEE-754 binary64 numeric profile so the TypeScript SDK
and other implementations interpret the same document:

- every JSON number, recursively including values in `payload` and
  `extensions`, MUST parse to a finite IEEE-754 binary64 value;
- a mathematically integer-valued number MUST be in
  `[-9007199254740991, 9007199254740991]`; and
- an application that needs a larger exact integer or exact decimal quantity
  MUST encode it as a string under its own payload contract.

This is semantic validation over the original number token, before a
lossy runtime conversion can make an out-of-range integer appear valid.

### 5.1 Reference `protocol` package surface

The TypeScript reference package exports its wire contract from one public
entry point; consumers do not deep-import schema/compiler internals.
Publication naming remains an implementation-planning choice, but these export
names and discriminated results are the MVP baseline:

```ts
export type JsonValue =
  | null
  | boolean
  | string
  | number
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
export type JsonObject = Readonly<Record<string, JsonValue>>;

export type NodeId = string;
export type SessionId = string;
export type MessageId = string;
export type EndpointName = string;
export type WireRevision = number;

export interface AgpEnvelope<
  P extends "control" | "data",
  T extends string,
  B extends object,
> {
  readonly agp: 1;
  readonly plane: P;
  readonly type: T;
  readonly id: MessageId;
  readonly body: B;
  readonly extensions?: JsonObject;
}

export interface OpenBody {
  readonly nodeId: NodeId;
  readonly sessionId: SessionId;
  readonly role: "hub" | "spoke";
  readonly holdTimeMs: number;
  readonly receiveLimitBytes: number;
  readonly maxEndpointsPerSession: number;
}
export interface EndpointUpdateBody {
  readonly revision: WireRevision;
  readonly endpoints: readonly EndpointName[];
}
export interface EndpointAckBody {
  readonly refId: MessageId;
  readonly revision: WireRevision;
}

export type FatalNotificationCode =
  | "CEASE" | "UNSUPPORTED_VERSION" | "INVALID_MESSAGE"
  | "UNEXPECTED_MESSAGE" | "ROLE_MISMATCH" | "IDENTITY_REJECTED"
  | "IDENTITY_COLLISION" | "HOLD_TIMEOUT"
  | "ENDPOINT_CAPACITY_MISMATCH" | "UPDATE_REVISION_ERROR"
  | "SOURCE_NOT_OWNED" | "INTERNAL_ERROR";
export type RecoverableDataErrorCode =
  | "NO_ROUTE" | "SOURCE_NOT_ACTIVE" | "SOURCE_NOT_SELECTED"
  | "DESTINATION_UNAVAILABLE" | "DESTINATION_LIMIT_EXCEEDED"
  | "BACKPRESSURE";
export type RecoverableErrorCode =
  | RecoverableDataErrorCode
  | "ENDPOINT_REJECTED";
export type EndpointRejectionReasonCode = "POLICY" | "CAPACITY";
export type SourceNotActiveReasonCode =
  | "POLICY_REJECTED"
  | "CAPACITY_REJECTED"
  | "UPDATE_NOT_INSTALLED";

export type OpenMessage =
  AgpEnvelope<"control", "open", OpenBody>;
export type KeepaliveMessage =
  AgpEnvelope<"control", "keepalive", Record<string, never>>;
export type EndpointUpdateMessage =
  AgpEnvelope<"control", "endpoint.update", EndpointUpdateBody>;
export type EndpointAckMessage =
  AgpEnvelope<"control", "endpoint.ack", EndpointAckBody>;
export type NotificationMessage =
  AgpEnvelope<"control", "notification", NotificationBody>;
export type ErrorMessage =
  AgpEnvelope<"control", "error", RecoverableErrorBody>;
export type DataMessage =
  AgpEnvelope<"data", "message", DataMessageBody>;
export type AgpMessage =
  | OpenMessage | KeepaliveMessage | EndpointUpdateMessage
  | EndpointAckMessage | NotificationMessage | ErrorMessage | DataMessage;

export interface NotificationBody {
  readonly code: FatalNotificationCode;
  readonly reason: string;
  readonly refId?: MessageId;
}
export type RecoverableErrorBody =
  | DeliveryErrorBody
  | EndpointRejectedErrorBody
  | SourceNotActiveErrorBody;
export interface DeliveryErrorBody {
  readonly code: Exclude<RecoverableDataErrorCode, "SOURCE_NOT_ACTIVE">;
  readonly reason: string;
  readonly refId: MessageId;
}
export interface EndpointRejectedErrorBody {
  readonly code: "ENDPOINT_REJECTED";
  readonly reasonCode: EndpointRejectionReasonCode;
  readonly reason: string;
  readonly refId: MessageId;
  readonly revision: WireRevision;
  readonly rejectedEndpoints: readonly EndpointName[];
}
export interface SourceNotActiveErrorBody {
  readonly code: "SOURCE_NOT_ACTIVE";
  readonly reasonCode: SourceNotActiveReasonCode;
  readonly reason: string;
  readonly refId: MessageId;
  readonly source: EndpointName;
}
export interface DataMessageBody {
  readonly source: EndpointName;
  readonly destination: EndpointName;
  readonly correlationId?: string;
  readonly payload: JsonObject;
}

export const AGP_V1_LIMITS: {
  readonly defaultReceiveBytes: 1048576;
  readonly minReceiveBytes: 131072;
  readonly maxReceiveBytes: 16777216;
  readonly maxOpenBytes: 4096;
  readonly maxDepth: 32;
  readonly maxEndpointEntries: 256;
  readonly maxWireRevision: 9007199254740991;
  readonly maxSafeIntegerMagnitude: 9007199254740991;
  readonly maxReasonCharacters: 256;
  readonly maxExtensionKeys: 32;
  readonly maxCloseReasonUtf8Bytes: 123;
};
export interface ParseLimits {
  readonly receiveLimitBytes: number;
}
export type InvalidValueReasonCode =
  | "TOP_LEVEL_NOT_OBJECT"
  | "SCHEMA"
  | "NUMERIC_PROFILE"
  | "DEPTH_LIMIT";
export type InvalidTextReasonCode =
  | "INVALID_JSON"
  | "DUPLICATE_MEMBER"
  | InvalidValueReasonCode;
export type ValidationReasonCode =
  | InvalidValueReasonCode
  | "UNSUPPORTED_VERSION";
export type ParseReasonCode =
  | InvalidTextReasonCode
  | "UNSUPPORTED_VERSION"
  | "INVALID_UTF8"
  | "MESSAGE_TOO_LARGE"
  | "LIMIT_INVALID";
export type ValidationFailure =
  | {
      readonly ok: false;
      readonly reasonCode: InvalidValueReasonCode;
      readonly notificationCode: "INVALID_MESSAGE";
      readonly closeCode?: never;
    }
  | {
      readonly ok: false;
      readonly reasonCode: "UNSUPPORTED_VERSION";
      readonly notificationCode: "UNSUPPORTED_VERSION";
      readonly closeCode?: never;
    };
export type ValidationResult =
  | { readonly ok: true; readonly message: AgpMessage }
  | ValidationFailure;
export type ParseFailure =
  | ValidationFailure
  | {
      readonly ok: false;
      readonly reasonCode: "INVALID_JSON" | "DUPLICATE_MEMBER";
      readonly notificationCode: "INVALID_MESSAGE";
      readonly closeCode?: never;
    }
  | {
      readonly ok: false;
      readonly reasonCode: "INVALID_UTF8";
      readonly notificationCode?: never;
      readonly closeCode: 1007;
    }
  | {
      readonly ok: false;
      readonly reasonCode: "MESSAGE_TOO_LARGE";
      readonly notificationCode?: never;
      readonly closeCode: 1009;
    }
  | {
      readonly ok: false;
      readonly reasonCode: "LIMIT_INVALID";
      readonly notificationCode?: never;
      readonly closeCode?: never;
    };
export type ParseResult =
  | { readonly ok: true; readonly message: AgpMessage; readonly utf8Bytes: number }
  | ParseFailure;
export type EncodeResult =
  | { readonly ok: true; readonly text: string; readonly utf8Bytes: number }
  | {
      readonly ok: false;
      readonly reasonCode: "INVALID_MESSAGE";
      readonly notificationCode?: never;
      readonly closeCode?: never;
    }
  | {
      readonly ok: false;
      readonly reasonCode: "MESSAGE_TOO_LARGE";
      readonly notificationCode?: never;
      readonly closeCode?: never;
    }
  | {
      readonly ok: false;
      readonly reasonCode: "LIMIT_INVALID";
      readonly notificationCode?: never;
      readonly closeCode?: never;
    };

export const agpMessageSchemaV1: JsonObject;
export function validateAgpMessage(value: unknown): ValidationResult;
export function parseAgpText(
  input: string | Uint8Array,
  limits: ParseLimits,
): ParseResult;
export function encodeAgpMessage(
  message: AgpMessage,
  sendLimitBytes: number,
): EncodeResult;
```

`parseAgpText` is the authoritative untrusted-wire path: it enforces byte/UTF-8
limits, duplicate-member rejection, lossless numeric-token validation, schema,
depth, and the fixed 4,096-byte OPEN limit before returning a DTO.
`validateAgpMessage` is for in-memory values and cannot recover duplicate
member names already erased by a generic parser or apply an encoded-byte
limit.
The failure unions make disposition deterministic: unsupported version is
notified as `UNSUPPORTED_VERSION`; invalid JSON, duplicates, a non-object top
level, schema, numeric-profile, and depth failures are notified as
`INVALID_MESSAGE`; and invalid UTF-8 or oversize input is close-only with
`1007` or `1009`. A conforming transport adapter normally rejects those last
two before this parser is called, except that the codec itself discovers a
schema-valid OPEN exceeding its smaller fixed limit. Session integration begins
the indicated close and dispatches `TransportInputRejected` for either
adapter- or codec-detected close-only input rejection.

The codec is non-throwing for anticipated caller input. An invalid parse or
send limit returns local `LIMIT_INVALID` before inspecting the document or
message. Encoding a structurally/numerically invalid DTO returns
`INVALID_MESSAGE`; a valid encoding above `sendLimitBytes`, or a valid OPEN
encoding above the fixed 4,096-byte `maxOpenBytes`, returns
`MESSAGE_TOO_LARGE`. Encode failures never authorize an AGP notification or
WebSocket Close because no peer input caused them.
The depth limit is fixed at 32 and is not caller-overridable.
`receiveLimitBytes` and `sendLimitBytes` must be safe integers in the exported
131,072–16,777,216 range.

A `Uint8Array` input means the UTF-8 bytes of a WebSocket **text** message; it
does not erase the WebSocket frame/message kind. The transport adapter rejects
a binary message and maps it to Close `1003` before calling this API. It also
enforces the configured reassembled/post-decompression byte bound while
materializing the message, before allocating an over-limit buffer; compression
is disabled by default. Parser limits are a second boundary, not a substitute
for adapter enforcement.

## 6. Message catalogue

| Plane | `type` | Direction | Valid FSM state | Effect |
|---|---|---|---|---|
| control | `open` | both | `OpenSent` | identify role/session and negotiate limits/timers |
| control | `keepalive` | both | `OpenConfirm`, `Established` | confirm OPEN or maintain session liveness |
| control | `endpoint.update` | spoke → hub | `Established` | atomically replace the session's exported endpoint set |
| control | `endpoint.ack` | hub → spoke | `Established` | confirm one accepted endpoint-set revision |
| control | `notification` | both | any open transport | report fatal session error, then close |
| control | `error` | hub → spoke | `Established` | report a recoverable correlated operation/delivery failure |
| data | `message` | both | `Established` | carry one routed application JSON object |

Receiving a known message in a direction or state not listed above is an
`UNEXPECTED_MESSAGE` fatal notification.

### 6.1 `open`

Each side sends one OPEN immediately after the WebSocket opens:

```json
{
  "agp": 1,
  "plane": "control",
  "type": "open",
  "id": "019d2e48-0001-7000-8000-000000000001",
  "body": {
    "nodeId": "spoke-a",
    "sessionId": "9f2c10",
    "role": "spoke",
    "holdTimeMs": 30000,
    "receiveLimitBytes": 1048576,
    "maxEndpointsPerSession": 64
  }
}
```

Rules:

1. `sessionId` MUST be generated for this connection. It MUST NOT collide with
   another live local session owned by the same controller/router. The
   reference source does not repeat within its source-instance lifetime, but
   neither the protocol nor the receiver assumes deployment-global or
   post-restart uniqueness; remote semantic identity is
   `(nodeId, sessionId)`.
2. `holdTimeMs` is either `0` or 3,000–300,000. The negotiated value is zero
   if either side offers zero; otherwise it is the smaller offer.
3. `receiveLimitBytes` is 131,072–16,777,216 and declares the maximum
   post-decompression, reassembled WebSocket message the sender accepts. The
   peer MUST constrain future sends to this value.
4. `maxEndpointsPerSession` is 1–256. The effective active-endpoint cap is the
   smaller local and remote offer. The reference default is 64 and the
   version-1 hard maximum is 256.
5. OPEN itself MUST be no larger than 4,096 bytes.
   After version-1/type validation, `parseAgpText` maps an otherwise valid
   over-4,096-byte OPEN to close-only `MESSAGE_TOO_LARGE`/`1009`; it does not
   authorize an AGP notification. `encodeAgpMessage` applies the same fixed
   limit and returns local `MESSAGE_TOO_LARGE`, even when the general
   send/receive limit is larger.
6. OPEN is not authentication proof. The receiver's identity policy must accept
   the claimed node before the FSM reaches `OpenConfirm`.
7. A spoke's configured local endpoint cap MUST NOT exceed its OPEN offer, and
   local `expose` beyond the configured/effective cap fails before wire state
   changes. If registrations created before OPEN exceed the newly negotiated
   minimum, the spoke sends fatal `ENDPOINT_CAPACITY_MISMATCH` and stops before
   `OpenConfirm`; it MUST NOT export an arbitrary subset. Router-local endpoint
   capacity is a separate SDK configuration bound.

After accepting OPEN, a node sends `keepalive` and enters `OpenConfirm`.

### 6.2 `keepalive`

```json
{
  "agp": 1,
  "plane": "control",
  "type": "keepalive",
  "id": "019d2e48-0001-7000-8000-000000000002",
  "body": {}
}
```

Receipt in `OpenConfirm` completes establishment. In `Established`, any valid
received AGP message resets the hold timer. For this rule, “received” means the
message has reached ordered session dispatch and passed state/direction
semantics, not merely occupied the bounded inbound queue. The
`endpoint.update` that starts an admission callback resets hold immediately
before the callback; later wire messages behind that callback's continuation
barrier do not reset hold until they are dequeued. `HoldExpired` may therefore
invalidate the callback even if a later keepalive is queued. Deployments that
want the callback deadline to win first configure it below the negotiated hold
time.

If the negotiated hold time is non-zero, the sender emits a keepalive whenever
it has emitted no other AGP
message for `floor(holdTimeMs / 3)` milliseconds. This follows BGP's
one-third keepalive convention
([RFC 4271 §10](https://www.rfc-editor.org/rfc/rfc4271.html#section-10))
without copying BGP's Internet-scale timer defaults.

### 6.3 `endpoint.update`

```json
{
  "agp": 1,
  "plane": "control",
  "type": "endpoint.update",
  "id": "019d2e48-0001-7000-8000-000000000003",
  "body": {
    "revision": 1,
    "endpoints": ["orders/submit", "orders/status"]
  }
}
```

Rules:

1. Only a spoke sends this message, and only after `Established`.
2. `revision` is scoped to the sender's `sessionId`. The first update is `1`;
   each subsequent update increments the immediately previous **consumed**
   revision by exactly one, whether that previous update was installed or
   rejected.
   A spoke has one dedicated endpoint-update slot and permits exactly one
   `endpoint.update` to be outstanding. “Outstanding” begins when the current
   desired set is placed in that slot and assigned a revision, before it is
   necessarily written. While it is outstanding, local changes coalesce into
   exactly one bounded, unrevisioned successor desired set.
   The greatest wire value is `9007199254740991`. It MUST NOT wrap or be
   reused within a session. After that value is consumed, the session may
   continue with its current accepted set; if another endpoint change is
   required, the spoke sends `CEASE` and closes. The next automatically or
   explicitly started fresh session begins again at revision `1`.
3. `endpoints` is the complete authoritative exported endpoint set for this
   session. It is a unique array with a wire hard maximum of 256 entries. A
   sender MUST keep its length at or below negotiated
   `maxEndpointsPerSession`; a schema-valid, sequential update above that
   dynamic cap is nevertheless handled deterministically by the receiver as
   the recoverable capacity rejection in rule 9, not `INVALID_MESSAGE`.
   Omission from the new set withdraws an endpoint; inclusion announces or
   retains it.
4. The whole update is validated before mutation and atomically replaces the
   previously accepted set. Partial installation is forbidden. After commit,
   the hub records this complete set as `lastClaimedEndpoints`, clears prior
   rejection subset/reason state, and sends `endpoint.ack` with the update's
   `id` and `revision`. A within-cap update whose
   `requestedEndpoints - acceptedEndpoints` set is empty retains and/or
   withdraws names only; the core auto-allows it without invoking the endpoint
   admission port.
5. Replacing a set with an identical set is an idempotent route-state operation,
   although its valid new revision is still consumed.
6. A duplicate, stale, or skipped revision is `UPDATE_REVISION_ERROR`, a fatal
   protocol notification. WebSocket ordering means such a gap indicates a
   broken sender/session implementation; reconnect creates a fresh revision
   sequence.
7. A spoke may own no more than the negotiated
   `maxEndpointsPerSession` active endpoints. The SDK rejects local
   registrations beyond its current effective cap; the version-1 hard cap is
   256. Sending an over-negotiated-cap set is nonconforming even though the hub
   uses the recoverable capacity path for defensive interoperability.
8. After each establishment, the spoke admits its complete desired local
   exported set—including an empty set—into the dedicated slot as revision 1
   before any application data. When no update is outstanding,
   `LocalEndpointsChanged` always admits the current desired set into that
   slot; admission never depends on spare capacity in a shared control queue.
9. A syntactically valid update rejected by endpoint authorization, policy, or
   because its post-update active set would exceed the negotiated cap makes no
   route mutation but **does consume** its revision; the hub advances the
   expected revision and returns correlated `ENDPOINT_REJECTED` with a stable
   `reasonCode` and bounded `rejectedEndpoints`. The list MUST be unique,
   non-empty, sorted in ascending unsigned UTF-8 byte order, and a subset of
   names newly added relative to the hub's current accepted set:
   `requestedEndpoints - acceptedEndpoints`. Retained names remain authorized
   and active because rejection of the whole update leaves the current
   accepted set unchanged. A capacity rejection deterministically lists
   **all** newly added names, so a successor that excludes them necessarily
   fits the negotiated cap.
   The hub records the rejected update's complete set as bounded
   `lastClaimedEndpoints`, its denied subset as `rejectedEndpoints`, and the
   stable rejection reason for source-race classification. Thus
   `lastClaimedEndpoints` always reflects the most recently consumed update;
   rejection context is present only when that update was rejected.
10. For the current session, the spoke marks those registrations rejected and
    sends the next authoritative set excluding them. It validates rejected
    names against both the outstanding requested set and its last ACKed export:
    every rejected name must be newly added, not retained. Because every update
    is a whole set, this resynchronizes without an accepted-baseline inference.
    Authorization of a retained name is immutable for that session. A changed
    policy takes effect only on natural session replacement or a host-wide
    router stop/restart, either of which withdraws all routes owned by the old
    session; endpoint-update rejection is not a hidden revocation mechanism.
    A rejection marker is sticky only for that registration binding on the
    current session: unrelated desired-state changes do not retry it, while
    closing that binding and explicitly exposing a fresh binding for the same
    name clears the marker and permits a new update attempt. The spoke snapshots
    local binding tokens for newly added names in its outstanding record; a
    rejection arriving after a binding was replaced cannot mark the fresh
    binding, which remains eligible for the promoted successor.
    Reconnect clears every session-scoped rejection marker, so the new
    session's mandatory initial whole set retries every still-desired
    registration.
11. Every accepted endpoint is owned by the current session. Session loss
    atomically withdraws the accepted set before forwarding continues.
12. Data using a newly exposed source cannot be admitted to the spoke's
    outbound data queue until the authoritative set containing that source has
    been ACKed. This is stricter than merely placing the update earlier in the
    queue.
13. On admitting an `endpoint.update` to the dedicated slot, the spoke starts
    an endpoint-write timer. The timer covers scheduler and removed-source
    barrier waiting as well as the adapter write. After the adapter successfully
    places the complete update into the WebSocket send sequence, the spoke
    stops that timer and starts an endpoint-response timer. Both phases use the
    configured
    `endpointResponseTimeoutMs`: reference default 10,000 ms, allowed range
    1,000–300,000 ms. Only write progress advances from the first phase, and
    only the exactly correlated `endpoint.ack` or `ENDPOINT_REJECTED` completes
    the second; unrelated messages do not reset either timer. On either expiry,
    the spoke sends `CEASE` if safe and closes. It retries with a fresh session
    when automatic reconnect is enabled; otherwise it enters `Idle` until an
    explicit start. Both timers remain enabled when negotiated `holdTimeMs` is
    zero.
14. Resolving the exact outstanding update is one serialized operation. The
    spoke clears its current slot and determines one canonical next snapshot.
    After an ACK, that is the latest coalesced desired snapshot, if any. After
    a rejection, it always recomputes the latest application-desired bindings
    (including any coalesced changes) minus all current-session rejection
    markers, so unrelated additions and withdrawals are not lost; this
    resynchronization snapshot is promoted even when it equals the last ACKed
    set. The spoke assigns the next revision and starts its write timer in the
    same operation. If an ACK has no successor the slot becomes empty.
    Revision exhaustion instead takes the defined session rollover path. There
    is no state in which an unrevisioned current update waits for shared
    control-queue capacity.

The hub derives origin and next hop from the identity-admitted session. The spoke
cannot supply an origin node, next hop, path, preference, or transport handle.
Duplicate advertisements by different sessions are valid RIB candidates and
are resolved by the routing design; they are not a wire-protocol collision.

### 6.4 `endpoint.ack`

```json
{
  "agp": 1,
  "plane": "control",
  "type": "endpoint.ack",
  "id": "019d2e48-0001-7000-8000-000000000005",
  "body": {
    "refId": "019d2e48-0001-7000-8000-000000000003",
    "revision": 1
  }
}
```

The hub sends this only after atomically committing the referenced
authoritative set. The spoke MUST have exactly one outstanding update and the
ACK's `refId` and `revision` MUST match it. A mismatch is `INVALID_MESSAGE`.
The ACK clears the outstanding record, makes its set the spoke's known active
export, and in the same serialized operation promotes the one coalesced
successor into the dedicated slot, if present.

This ACK confirms control-plane convergence only. It does not acknowledge a
data message, remote handler execution, or application delivery and therefore
does not alter AGP's at-most-once/no-data-ACK decision.

### 6.5 `message`

```json
{
  "agp": 1,
  "plane": "data",
  "type": "message",
  "id": "019d2e48-0001-7000-8000-000000000004",
  "body": {
    "source": "orders/submit",
    "destination": "inventory.lookup",
    "correlationId": "request:8b17",
    "payload": {
      "sku": "A-42",
      "quantity": 2
    }
  }
}
```

The payload MUST be a JSON object; its nested property values may be any RFC
8259 JSON values. `correlationId` is optional and opaque; AGP does not
interpret it.

Before forwarding, the hub MUST verify:

- for a spoke-ingress envelope, the ingress session is `Established`, its
  `source` is currently advertised by that exact session, and that session's
  candidate is the selected source route;
- for a hub-originated envelope, its source is registered and selected locally;
- `destination` resolves through the selected RIB to a tagged abstract next
  hop;
- a `NextHop.local` resolves to an active local endpoint binding and atomically
  reserves one currently free handler execution slot plus the payload's active
  bytes; or
- a `NextHop.session` resolves to an `Established` session, and the encoded
  unchanged envelope fits that destination session's negotiated peer receive
  limit and bounded outbound queue.

For `NextHop.session`, the hub forwards the envelope, including unknown
`extensions`, without changing `id`, addresses, correlation, or payload. For
`NextHop.local`, it dispatches that same logical envelope to the exact active
local binding; no peer receive-limit check applies. A receiving spoke likewise
delivers only to an exact local endpoint registration after reserving an
execution slot.

Local handler admission has zero waiting backlog. It MUST atomically reserve
both one of exactly `inboundHandlerConcurrency` execution slots (reference
default 32) and the payload's bytes within `inboundHandlerBytes` (reference
default 32 MiB and configured no lower than the maximum envelope size).
Failure of either reservation takes the saturation path immediately. If this
occurs for a spoke-ingress message resolving to `NextHop.local`, the hub
returns correlated `BACKPRESSURE`. If a hub-local `send()` targets that same
saturated execution pool, it rejects synchronously with SDK `QUEUE_FULL`;
there is no wire error. Handler completion releases both reservations. Once a
local dispatch has been admitted, a later handler throw/rejection is only a
local handler-failure event/counter. It does not create a wire error or
retroactively alter the send receipt.

Reservation, route/binding revalidation, and admission commit occur on the
canonical executor; application handler code does not. After commit the core
invokes the handler outside that executor with a core-owned `AbortSignal`.
Completion re-enters with the binding/session/delivery token and releases the
slot and byte reservation exactly once. Binding close, session teardown, host
teardown after drain, or drain expiry aborts the signal; entering host
`Stopping` alone allows an already active handler to settle within the drain
deadline. A late settlement is discarded except for idempotent reservation
release and cannot mutate routes, receipts, or FSM state.

A spoke-local `send()` MUST encode the complete envelope and compare it with
the established hub session's `peerReceiveLimitBytes` before outbound queue
admission. Excess rejects synchronously with SDK `MESSAGE_TOO_LARGE`. This is
distinct from a hub discovering that a forwarded spoke message exceeds a
different destination session's limit and returning asynchronous
`DESTINATION_LIMIT_EXCEEDED`.

Source failure has three intentionally different outcomes:

- a source that is not active but is present in `lastClaimedEndpoints` while
  the latest consumed update has rejection context receives recoverable
  `SOURCE_NOT_ACTIVE`; membership in `rejectedEndpoints` maps to
  `POLICY_REJECTED` or `CAPACITY_REJECTED` according to the retained rejection
  reason, while another claimed name maps to `UPDATE_NOT_INSTALLED`;
- any other source absent from the active accepted set is truly unowned; it
  causes fatal `SOURCE_NOT_OWNED` and session close; and
- a source advertised by the ingress session whose duplicate candidate lost
  route selection receives recoverable `SOURCE_NOT_SELECTED`, because forwarding
  it would direct replies to a different owner.

### 6.6 Fatal `notification`

```json
{
  "agp": 1,
  "plane": "control",
  "type": "notification",
  "id": "019d2e48-0001-7000-8000-000000000009",
  "body": {
    "code": "UNEXPECTED_MESSAGE",
    "reason": "endpoint.update received before Established",
    "refId": "019d2e48-0001-7000-8000-000000000003"
  }
}
```

Every notification is fatal. If the transport can still safely carry AGP, the
sender emits one notification, starts the WebSocket closing handshake, and
accepts no more AGP input. The receiver also closes. This mirrors BGP's
NOTIFICATION-and-close rule
([RFC 4271 §3](https://www.rfc-editor.org/rfc/rfc4271.html#section-3)).
“Retryable” below applies only to a spoke supervisor starting a new session
after this one closes; it never preserves the notified session.

| Code | Meaning |
|---|---|
| `CEASE` | deliberate protocol-session stop |
| `UNSUPPORTED_VERSION` | envelope/subprotocol version is unsupported |
| `INVALID_MESSAGE` | JSON or type-specific semantic validation failed |
| `UNEXPECTED_MESSAGE` | message is invalid for the current state or direction |
| `ROLE_MISMATCH` | the two OPEN roles are not one hub and one spoke |
| `IDENTITY_REJECTED` | claimed identity failed authentication or identity policy; permanent |
| `IDENTITY_COLLISION` | otherwise-valid identity is temporarily owned by another nonterminal controller; retryable |
| `HOLD_TIMEOUT` | no valid AGP input arrived before hold expiry |
| `ENDPOINT_CAPACITY_MISMATCH` | spoke's pre-OPEN desired registrations exceed negotiated capacity |
| `UPDATE_REVISION_ERROR` | endpoint update revision was not exactly expected |
| `SOURCE_NOT_OWNED` | data claimed a source not advertised by its ingress session |
| `INTERNAL_ERROR` | local failure makes continued protocol processing unsafe |

`reason` is diagnostic text, not a parser input. It MUST NOT contain secrets.

### 6.7 Recoverable `error`

```json
{
  "agp": 1,
  "plane": "control",
  "type": "error",
  "id": "019d2e48-0001-7000-8000-000000000010",
  "body": {
    "code": "NO_ROUTE",
    "reason": "destination is not currently reachable",
    "refId": "019d2e48-0001-7000-8000-000000000004"
  }
}
```

An error rejects one referenced operation and does **not** change FSM state or
close the session:

| Code | Meaning |
|---|---|
| `NO_ROUTE` | no selected route exists for the destination |
| `SOURCE_NOT_ACTIVE` | source was claimed in the last consumed rejected update but is not active |
| `SOURCE_NOT_SELECTED` | ingress owns a candidate for source, but another candidate is selected |
| `DESTINATION_UNAVAILABLE` | selected local binding is inactive or selected session is no longer Established |
| `DESTINATION_LIMIT_EXCEEDED` | encoded envelope exceeds a destination session's peer receive limit |
| `BACKPRESSURE` | a hub is stopping, cannot immediately reserve the selected local handler execution slot, or cannot admit to the selected session queue |
| `ENDPOINT_REJECTED` | authoritative endpoint set was rejected by policy or capacity |

For `ENDPOINT_REJECTED`, the error body additionally requires:

```json
{
  "code": "ENDPOINT_REJECTED",
  "reasonCode": "POLICY",
  "reason": "one or more endpoint names are not authorized",
  "refId": "019d2e48-0001-7000-8000-000000000003",
  "revision": 1,
  "rejectedEndpoints": ["orders/admin"]
}
```

`reasonCode` is `POLICY` or `CAPACITY`. `rejectedEndpoints` is a unique,
non-empty array of at most 256 endpoint names in ascending unsigned UTF-8 byte
order. It MUST be a subset of names newly added by the rejected request
relative to the hub's current accepted set. For `POLICY`, it identifies the
denied new names. `CAPACITY` is valid only when the requested set exceeds the
negotiated cap, and its list is exactly **all** newly added names; a conforming
spoke SDK normally prevents this case locally. The whole update is rejected,
so no requested route mutation occurs and previously accepted retained names
remain active.

Before changing local rejection state, the spoke MUST validate `refId` and
`revision` against its single outstanding endpoint update and verify that every
`rejectedEndpoints` member belongs to that update's authoritative set **and is
absent from the spoke's last ACKed export set**, and that the array is in the
required order. For `CAPACITY`, it also verifies the outstanding set exceeds
the negotiated cap and the array exactly equals
`outstandingEndpoints - lastAckedEndpoints`. A partial, unsorted, duplicate,
retained, out-of-request, empty, or otherwise mismatched result is fatal
`INVALID_MESSAGE`; rejected names from an uncorrelated error must never affect
local endpoint admission.

For `SOURCE_NOT_ACTIVE`, the error body additionally requires the claimed
`source` and `reasonCode`:

```json
{
  "code": "SOURCE_NOT_ACTIVE",
  "reasonCode": "POLICY_REJECTED",
  "reason": "source was claimed but its endpoint set was not installed",
  "refId": "019d2e48-0001-7000-8000-000000000004",
  "source": "orders/submit"
}
```

`reasonCode` is `POLICY_REJECTED` or `CAPACITY_REJECTED` when `source` is in
the retained rejected subset, according to the retained endpoint-rejection
reason; it is `UPDATE_NOT_INSTALLED` when another endpoint caused the
authoritative set to be rejected. This error closes the update/data race
without treating a previously claimed source as spoofing.

The spoke retains a bounded, session-scoped recent-send correlation table of
data-message `(id, source)` pairs (configurable positive bound; reference
default: 4,096 entries). On overflow it evicts the oldest entry. Every
recoverable **data** error (`NO_ROUTE`, `SOURCE_NOT_ACTIVE`,
`SOURCE_NOT_SELECTED`, `DESTINATION_UNAVAILABLE`,
`DESTINATION_LIMIT_EXCEEDED`, or `BACKPRESSURE`) is attributed to a message
only when its `refId` is present in that table. `SOURCE_NOT_ACTIVE` additionally
requires the returned `source` to equal the retained source. A known exact
reference is surfaced as correlated `message.failed` evidence; an unknown,
evicted, or source-mismatched reference is surfaced only as an uncorrelated
protocol-error event/counter. It MUST NOT be falsely attributed, and neither
case closes the session or changes desired registration, endpoint-update
ACK/rejection state, or later source admission. `ENDPOINT_REJECTED` instead
uses the exact outstanding-update correlation rules above. Only endpoint
ACK/rejection control changes export/admission state. The table is cleared at
session teardown.

The spoke surfaces the error through SDK state/events. Version 1 defines no
data-message or application-success wire ACK, and the receiver MUST NOT resend
automatically. A destination registration race detected after a hub-forwarded
message reaches a spoke is dropped and recorded as a local delivery-failure
event/counter; version 1 does not send an error back to the hub or define
correlation/relay state for that case.

A correlated hub error is asynchronous delivery evidence, not a success
acknowledgement: a local spoke `send()` that already resolved after
bounded-queue admission is not retroactively rejected or otherwise redefined by
it. This is the boundary recorded in
[ADR-0006](decisions/0006-local-admission-delivery-semantics.md).

Before forwarding to `NextHop.session`, the hub encodes the unchanged logical
envelope using the version-1 codec and compares its byte length with the
destination session's `peerReceiveLimitBytes`. Excess produces correlated
nonfatal `DESTINATION_LIMIT_EXCEEDED` to a spoke ingress. A hub-local send
performs the same check before that session's queue admission and therefore
rejects synchronously; a spoke cannot know the eventual destination limit and
learns asynchronously. `NextHop.local` instead uses zero-backlog local
execution-slot admission and never applies a peer receive limit.

### 6.8 Admission callback execution

Configured identity- and endpoint-admission ports may be asynchronous, but
they MUST NOT hold the canonical/global state executor while awaiting
application code. Each invocation receives immutable input, has a configurable
1–300,000-ms deadline (reference default 5,000 ms), and carries the owning
session plus a unique request token. Its completion re-enters the owning
session's serialized executor, revalidates the token and all preconditions, and
commits at most one result. A completion for an invalidated session, transport,
request, or FSM state is stale and is discarded with a diagnostic counter.
The port receives a core-owned `AbortSignal`, aborted on deadline or owning
session/host teardown; an implementation that ignores it still cannot make a
late settlement current.

While one callback is pending, later wire input for that session remains in its
bounded input sequence behind a continuation barrier. Other sessions, queries,
route transactions, and all timers continue to progress. Callback-deadline,
timer, transport, and lifecycle events—including `OpenExpired`, `HoldExpired`,
`Stop`, `TransportFailed`, and `TransportClosed`—may pass the wire-input
barrier. Any teardown path invalidates the pending token before releasing state,
so a later callback completion cannot commit. The barrier is never permission
for an unbounded per-session queue.

For OPEN, structural, role, offer, and prospective negotiation checks occur
before identity admission. If a spoke's existing desired registrations exceed
that prospective endpoint cap, it sends `ENDPOINT_CAPACITY_MISMATCH` and skips
the callback; this check has deterministic precedence. Otherwise an allowed
result is rechecked for current token, identity collision, and any desired-set
growth while the callback was pending before the session becomes
identity-admitted and enters `OpenConfirm`. A newly over-cap desired set then
gets `ENDPOINT_CAPACITY_MISMATCH`; the initial precheck still ensured an
already-over-cap set never invoked identity policy. A policy denial sends fatal
`IDENTITY_REJECTED`. Callback
deadline expiry invalidates the request and closes locally **without** an AGP
notification, so the peer observes transport loss and applies its ordinary
retry policy. A thrown or malformed result is fatal `INTERNAL_ERROR`.

For an expected `endpoint.update`, the hub resets hold on valid receipt. A set
above the dynamic negotiated cap takes the immediate core `CAPACITY` rejection
path from rule 9 and does not invoke endpoint policy. An expected, within-cap
set with no newly added names is auto-allowed and likewise skips the port. An
expected, within-cap set with additions begins endpoint admission without
consuming the revision. An allowed result then consumes the revision and
atomically applies the whole set. A denial is valid only with a canonical,
unique, non-empty subset of newly added names; it consumes the revision,
records rejection context, changes no route, and returns
`ENDPOINT_REJECTED`. Callback deadline expiry closes locally without an AGP
notification or revision consumption. A thrown or malformed result is fatal
`INTERNAL_ERROR` and likewise cannot partially mutate routes. Explicit
allow-all/development-trust modes may produce an immediate internal result, but
do not weaken these serialized commit and validation rules.

## 7. Delivery, ordering, and overload

AGP version 1 provides **at-most-once, best-effort application delivery**:

- WebSocket preserves message order on one connection, but AGP has no durable
  store, application acknowledgement, retry, replay, or duplicate suppression.
- SDK send success linearizes when validated data atomically reserves its
  selected bounded admission target: an outbound session queue for
  `NextHop.session`, or a local handler execution slot plus payload bytes for
  `NextHop.local`. It does not wait for adapter serialization, socket write,
  remote receipt, or asynchronous application-handler completion.
- In-flight data may be lost on connection failure.
- Ordering is defined per WebSocket send sequence only; no total order exists
  across multiple ingress sessions.

Each session has one serialized wire scheduler. Data messages retain FIFO order
relative to other data messages. Fatal `notification`, recoverable `error`,
`endpoint.ack`, and `keepalive` control messages MAY overtake queued data;
fatal close discards anything it overtakes. `endpoint.update` is a special
ordering barrier: before writing a whole-set update, the spoke MUST first write
every earlier-admitted data message whose source the update removes. It may
overtake earlier data from sources that remain in the set. Data from a newly
added source remains inadmissible until the containing update is ACKed. These
rules prevent priority scheduling from turning valid queued data into a
post-withdrawal source violation.

Version 1 fixes the per-session urgent-control reservation so signalling does
not depend on data-queue capacity:

- one preemptive fatal-`notification` slot;
- one coalescing `keepalive` slot—repeated expiries while it is occupied do not
  allocate more messages; and
- 16 FIFO response slots shared by `endpoint.ack` and recoverable `error`,
  additionally bounded to 2 MiB of encoded bytes.

Fatal notification is selected first. A pending keepalive is selected after
the current adapter call and any fatal notification, ahead of responses and
data; a response is selected ahead of data. OPEN is emitted directly during
transport establishment, and the endpoint-update slot is separate. Failure to
reserve the mandatory ACK/error response lane records local outcome/counter
`CONTROL_QUEUE_OVERFLOW`, force-aborts the transport, and takes ordinary
teardown. Because work ahead is bounded and every active adapter call has a
finite write deadline, urgent control cannot wait forever before its own
adapter deadline begins.

Mandatory response reservation is part of the triggering serialized
transaction. Overflow wins before an accepted route result or apparently
healthy rejection response is published.

Where this contract describes a retry, it is conditional on the local
automatic-reconnect policy, whose spoke reference default is enabled. With
automatic reconnect disabled, the same event still closes and cleans up the
failed session but leaves the spoke `Idle`; an explicit SDK/admin start
allocates a fresh session and dials again.

Host `Stopping` orchestration is outside the six-state session FSM. While an
existing session drains work admitted before the stopping revision, a hub
returns correlated `BACKPRESSURE` for new valid spoke data instead of
forwarding it; a spoke drops new inbound data with local
`STOPPING_REJECTED` evidence because it cannot send recoverable errors in that
direction. The host may attempt the spoke's empty whole-set withdrawal without
mutating application registrations preserved for a possible restart, then
dispatches FSM `Stop` after drain completion or its finite deadline.

Every adapter and SDK queue MUST be bounded. The dedicated endpoint-update slot
has capacity one plus its one coalesced successor; it does not consume or wait
for a shared control-queue entry. A local application send fails locally when
its outbound queue is full. A hub that cannot admit a received data message
returns `BACKPRESSURE` and discards that message. It MUST NOT silently create
an unbounded queue. Queue sizes and counters are operational state, not wire
fields.

Admission of complete inbound WebSocket messages is separately bounded by
per-session and implementation-global message-count and encoded-byte budgets.
If either budget cannot reserve a complete incoming message, the adapter
invalidates any pending admission token, increments
`INBOUND_ADMISSION_OVERFLOW`, and force-aborts/closes that session; it sends no
AGP notification when the message cannot be safely admitted for protocol
processing. This is an input-overload transport failure, not correlated
`BACKPRESSURE`: the core has not processed a data envelope or established a
safe `refId` to reject.

Every invocation of the adapter's WebSocket text-send operation, for **every**
AGP envelope type, has a `transportWriteTimeoutMs` deadline in 1–300,000 ms
(reference default 10,000 ms). The deadline begins when the serialized writer
invokes the adapter. Successful adapter completion cancels it. Rejection,
throw, or expiry force-aborts the transport and enters the ordinary
transport-failure teardown; AGP never waits indefinitely on a stalled send
promise and never retries an envelope in place. The endpoint-write timer is
additional: it begins earlier, at dedicated-slot admission, and bounds
scheduler/barrier waiting through successful adapter completion, while the
generic transport deadline bounds the active adapter call itself.

Failure to reserve the fixed urgent-response lane for a mandatory
`endpoint.ack` or `error` records `CONTROL_QUEUE_OVERFLOW` and force-aborts;
failure to write it likewise tears down the hub session and withdraws its
session-owned routes. The response is never silently dropped while the session
remains Established. Graceful WebSocket close is also finite:
`transportCloseTimeoutMs` is in 1–300,000 ms and defaults to 5,000 ms, after
which the adapter force-aborts the transport and completes teardown.

## 8. Validation and limits

Validation order is:

1. reject an invalid caller-supplied limit as local `LIMIT_INVALID`, before
   inspecting input;
2. enforce the reassembled/decompressed byte limit;
3. require a WebSocket text message and valid UTF-8;
4. parse one RFC 8259 JSON value while rejecting duplicate member names and
   any container that would exceed depth 32, retaining original numeric tokens
   (or equivalent lossless numeric values);
5. require a top-level object and inspect only the `agp` version discriminator;
   an integer other than `1` produces `UNSUPPORTED_VERSION`, while a missing or
   non-integer value is `INVALID_MESSAGE`;
6. recursively validate original numeric tokens against the finite binary64
   and safe-integer profile, then perform any runtime-number conversion;
7. validate the version-1 JSON Schema;
8. for a schema-valid version-1 OPEN, enforce the fixed 4,096-byte encoded
   limit; overflow is close-only `MESSAGE_TOO_LARGE`/`1009`;
9. enforce remaining semantic rules not expressible in the schema (direction,
   state, negotiated endpoint-set size, revision, identity, ownership, and
   policy); then
10. mutate state or forward.

No routing or forwarding mutation occurs before all applicable checks succeed.
A syntactically and sequentially valid but policy/capacity-rejected endpoint
update performs only the explicitly specified rejection bookkeeping: consume
its revision and retain bounded claim/rejection context; it installs no route.
This includes an update whose schema-valid set is at or below the hard maximum
of 256 but above the session's dynamically negotiated cap.

Error taxonomy is deterministic:

- malformed JSON, schema failure, or invalid type-specific syntax/semantics is
  `INVALID_MESSAGE`, except the explicitly defined sequential
  over-negotiated-cap endpoint set takes `ENDPOINT_REJECTED/CAPACITY` and a
  schema-valid OPEN above its fixed byte cap takes close-only
  `MESSAGE_TOO_LARGE`/`1009`;
- a schema-valid known message in the wrong FSM state or role direction is
  `UNEXPECTED_MESSAGE`; and
- integer version mismatch, role mismatch, identity rejection, and transient
  identity collision use their dedicated notification codes.

JSON nesting depth is computed with the root object at depth 1. Entering any
object or array increments depth by one; a primitive value does not increment
it. A receiver rejects `INVALID_MESSAGE` before application dispatch when any
value would exceed depth 32.

Version-1 minimum limits:

| Item | Limit |
|---|---|
| Default receive limit | 1,048,576 bytes |
| Negotiable receive range | 131,072–16,777,216 bytes |
| OPEN size | 4,096 bytes |
| Parsed JSON nesting depth | 32 containers |
| Endpoint update entries | conforming sender 0–negotiated cap; schema/defensive capacity path hard maximum 256 |
| Active endpoints per session | negotiated 1–256; reference default 64, hard maximum 256 |
| Endpoint revision | 1–9,007,199,254,740,991; roll the session before a successor |
| JSON numeric value | finite IEEE-754 binary64; integer-valued numbers limited to ±9,007,199,254,740,991 |
| Endpoint write/response phase timeout | each phase uses `endpointResponseTimeoutMs`, configurable 1,000–300,000 ms; reference default 10,000 ms |
| Urgent control reservation per session | 1 fatal slot; 1 coalescing keepalive slot; 16 ACK/error slots and 2 MiB encoded response bytes; endpoint update is separate |
| Identity/endpoint admission callback | configurable 1–300,000-ms deadline per callback; reference default 5,000 ms |
| Adapter text-send deadline | `transportWriteTimeoutMs` in 1–300,000 ms; reference default 10,000 ms |
| Graceful transport close deadline | `transportCloseTimeoutMs` in 1–300,000 ms; reference default 5,000 ms, then force-abort |
| Host stop drain deadline | `drainTimeoutMs` in 0–300,000 ms; reference default 5,000 ms; zero expires immediately |
| Inbound queued work per session | count and encoded bytes both bounded; reference defaults 256 messages / 16 MiB |
| Hub-total inbound queued work | count and encoded bytes both bounded; reference defaults 4,096 messages / 256 MiB |
| Local handler execution | zero backlog; reserve one `inboundHandlerConcurrency` slot (reference default 32) plus payload bytes within `inboundHandlerBytes` (reference default 32 MiB; at least maximum envelope size) |
| Recent-send correlation records | configurable positive bound; reference default 4,096; evict oldest on overflow |
| Diagnostic `reason` | 256 characters |
| WebSocket Close reason | empty or sanitized stable reason-code token, at most 123 UTF-8 bytes |
| Extension keys | 32 per envelope |

The byte limit applies after WebSocket reassembly and decompression. WebSocket
compression SHOULD be disabled by default. RFC 6455 explicitly recommends frame
and reassembled-message limits to prevent memory exhaustion
([§10.4](https://www.rfc-editor.org/rfc/rfc6455.html#section-10.4)).

## 9. Close mapping

Fatal AGP notification details live in the JSON message when it is safe to send
one. The following RFC 6455 close codes provide the transport-level summary:

| Condition | Close code |
|---|---|
| clean `CEASE` / normal shutdown | `1000` |
| malformed AGP, wrong state/direction, unsupported AGP version | `1002` |
| binary WebSocket message | `1003` |
| invalid UTF-8 (normally detected by adapter) | `1007` |
| fatal identity/authentication/source-spoofing/admission-security policy | `1008` |
| message exceeds enforced limit | `1009` |
| unsafe internal failure | `1011` |
| AGP `HOLD_TIMEOUT` | `4000` |
| AGP `ENDPOINT_CAPACITY_MISMATCH` | `4001` |
| AGP `IDENTITY_COLLISION` | `4002` |

An RFC 6455 Close control payload is at most 125 bytes; the two-byte status
code leaves at most 123 bytes for the optional reason
([RFC 6455 §5.5.1](https://www.rfc-editor.org/rfc/rfc6455.html#section-5.5.1)).
An AGP adapter MUST therefore send either no Close reason or a sanitized stable
reason-code token matching `^[A-Za-z0-9._-]{1,123}$` and occupying at most 123
UTF-8 bytes. It MUST NOT copy the AGP notification body's diagnostic `reason`
into the Close frame.

The meanings of `1002`, `1003`, and `1009` are standardized in
[RFC 6455 §7.4.1](https://www.rfc-editor.org/rfc/rfc6455.html#section-7.4.1).
Codes `4000`–`4002` are AGP-private application codes in RFC 6455's private-use
range. Recoverable `ENDPOINT_REJECTED` is not a close condition and MUST NOT be
mapped to `1008`.
If a message is too large, invalid UTF-8, or otherwise unsafe to parse, the
endpoint MAY close without first constructing an AGP notification.

## 10. Security boundary

- AGP OPEN identity is a claim. Identity admission binds `nodeId` through
  WebSocket-handshake/application-callback authentication or an explicitly
  configured development trust policy.
- Credentials and bearer tokens MUST NOT appear in AGP envelopes, errors, close
  reasons, query snapshots, or logs.
- Servers MUST validate allowed Origin values when browser clients are in
  scope; non-browser deployments SHOULD reject unexpected Origin headers.
- `wss:` and authenticated identity are required on untrusted networks.
- Source ownership and selected-source consistency are checked on every data
  message; they are never inferred only from the source string.
- Schema validation does not replace authorization, rate limits, bounded
  queues, or payload handling by the destination application.

RFC 6455 intentionally leaves client authentication to mechanisms available to
the HTTP server
([§10.5](https://www.rfc-editor.org/rfc/rfc6455.html#section-10.5)).

## 11. Evolution seam

Version 1 deliberately contains no router role negotiation, route propagation,
path attribute, AS-path analogue, hop limit, or loop-prevention field. Future
work may:

- define an optional, explicitly negotiated extension that does not alter
  version-1 base semantics; or
- use `agp.v2` for breaking/new required semantics.

The MVP remains ready for that work because endpoint advertisements are
session-owned inputs to a RIB and data forwarding resolves an abstract next
hop. It does not pretend direct spoke updates are multi-hop updates.

## 12. Required conformance evidence

A conforming implementation must prove at least:

- subprotocol mismatch, binary input, invalid JSON, duplicate names, excess
  size/depth, unknown fields, non-finite binary64 conversion, and unsafe
  integer-valued numbers are rejected deterministically;
- codec failures carry the exact discriminated disposition: unsupported
  version notification, invalid-message notification, close-only `1007`/`1009`,
  or local `LIMIT_INVALID`; invalid limits win before input inspection, and
  encode distinguishes invalid DTOs from valid oversize output, including an
  OPEN that exceeds 4,096 bytes while remaining below the general limit;
- an external TypeScript consumer imports the closed message/code unions,
  schema, limits, and parse/validate/encode results from only the protocol
  package entry point;
- OPEN roles, identity admission, timer negotiation, and one-live-session
  policy;
- permanent identity rejection versus retryable identity collision while an
  older controller closes;
- asynchronous identity/endpoint callback isolation, per-session continuation
  ordering, finite deadline, no-notification timeout, malformed/throw fault,
  teardown-token invalidation, and stale-result discard;
- no endpoint update or data is accepted before `Established`;
- authoritative whole-set replacement (including empty-set withdrawal),
  revision consumption and resynchronization after policy/capacity rejection,
  single-outstanding ACK correlation, and the 256 active endpoint bound;
- newly-added-only rejection subsets, deterministic sorted capacity rejection,
  binding-token isolation across close/fresh expose, retained authorization for
  the session lifetime, and policy change taking effect only after session
  replacement or host-wide restart;
- immediate dedicated endpoint-slot admission, one unrevisioned coalesced
  successor, atomic promotion, rejection-time merging of coalesced
  additions/withdrawals with binding-token rejection markers, and absence of
  shared-control capacity limbo;
- non-wrapping revision exhaustion with controlled automatic or explicit
  session rollover;
- retained rejected-claim race handling, fatal never-claimed source spoofing,
  and recoverable inactive/losing-source rejection;
- tagged local/session next-hop resolution, session peer-limit enforcement,
  spoke-local synchronous `MESSAGE_TOO_LARGE`, and hub-forwarded asynchronous
  `DESTINATION_LIMIT_EXCEEDED`;
- zero-backlog handler execution-slot plus payload-byte reservation, including
  spoke-ingress `BACKPRESSURE`, hub-local `QUEUE_FULL`, spoke-local drop, and
  outside-executor invocation, abort/stale completion, exactly-once release,
  and event-only handler failure;
- endpoint-write and response timeouts with non-zero and zero hold time,
  including response-send failure teardown;
- finite adapter deadlines for every envelope write, force-abort on a stalled
  send, and finite graceful-close fallback;
- fixed urgent-control reservation, keepalive coalescing/priority,
  `CONTROL_QUEUE_OVERFLOW` teardown, removed-source update barriers, and
  new-source data gating;
- known, unknown, evicted, and source-mismatched recent-send correlation for
  every recoverable data error, with no false attribution or endpoint-state
  mutation;
- bounded inbound message/byte overflow recording
  `INBOUND_ADMISSION_OVERFLOW` and closing without AGP notification or a
  fabricated correlated `BACKPRESSURE`;
- host stopping gates new work, uses hub wire `BACKPRESSURE` versus spoke-local
  `STOPPING_REJECTED`, attempts empty withdrawal, and dispatches session Stop
  only after bounded drain/expiry;
- endpoint-capacity mismatch before OpenConfirm, session-loss withdrawal, and
  exact invalid-versus-unexpected taxonomy;
- fatal notification closes, while each recoverable error leaves the session
  Established;
- Close reasons are empty or bounded sanitized tokens and never diagnostic
  notification text;
- AGP keepalive/hold behaviour is independent of WebSocket Ping/Pong; and
- at-most-once/no-data-ACK behaviour is visible in the SDK contract and tests.
