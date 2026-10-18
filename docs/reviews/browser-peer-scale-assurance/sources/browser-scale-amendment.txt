# Browser peer scale intent amendment

Status: proposed, 2026-10-11; revised 2026-10-18.\
The director approved drafting this amendment, not ratifying its wording, selecting capacity defaults or claiming verified support.\
Original AGP source baseline: `f16266aaafa66f6301d7afbf09c55e3a1f990274`.\
The [revision record](../VERIFICATION.md#473-browser-peer-scale-amendment-refinement) identifies the reviewed sources and preserves the earlier draft.

---

## Proposed direction

Expand the declared deployment scale without changing AGP's purpose or introducing a browser-specific node.\
Proposed replacement for the scale sentence in [confirmed intent](../DECISIONS.md#23-confirmed-transport-security-intent):

> Intended deployments include small star and line topologies and stars with hundreds of concurrently established direct peers connected to one node, including browser, CLI and service applications.\
> Every position uses the same node contract; a hub is a topology role, not a privileged protocol role.\
> A supported capacity is stated against a defined and verified operating envelope, not inferred from a configurable limit.\
> Within that envelope, the required routes and message exchanges must remain usable under AGP's contract.

This is a target for engineering and verification, not evidence that today's implementation supports it.\
It does not promise hundreds of fully active peers under every workload, runtime or topology.

---

## Authority and scope

The director raised hundreds of concurrent browser endpoints against a single AGP node and approved the offered scale-intent draft.\
That fixes this draft's direction; exact counts, workloads, resource limits and acceptance criteria remain open.

The survey skill's fixed-intent bypass applies to this draft only: asking the director to select that direction again would repeat an answered question.\
No new survey answers, envelope or calibration result are claimed.\
The [earlier shared-transport survey](../surveys/shared-transport-survey.md) remains the input for unified semantics and honest resource guarantees, not evidence of a scale choice.

Zorg's [sent follow-up, section 4](../../../zorg/upstream/agp-review-response-reply.md#4-a-question-about-agps-direction), at `1b7f4a3cc5029ddeb2c1b2d79a4b7d897a3c7e74`, independently asks to record shared-network scale.\
Its end-to-end caller identity candidate, exact-peer reply option and establishment-deadline proposal are separate design inputs, not adopted by this amendment.

---

## What changes, and what does not

| Existing statement or boundary | Proposed disposition | Reason |
|---|---|---|
| "The target scale is small and known: fewer than twenty nodes, in star and line topologies." | Re-aim: replace with the proposed direction above, through a numbered amendment if ratified | The former deployment assumption excludes the director's intended use case |
| [Vision: named reach across a topology, one uniform node](../../VISION.md) | Retain unchanged | More direct peers expand the operating scope, not the purpose or ownership of routing |
| [No general performance target](../DECISIONS.md#24-confirmed-performance-intent) | Retain; define capacity acceptance for the chosen deployment envelope | A functional capacity requirement is not an arbitrary global throughput target; missed deadlines and exhausted bounds remain correctness concerns |
| Transport owns encryption; applications own identity policy and call semantics | Retain these boundaries; leave open security-profile choices to their existing review | Peer scale does not select credentials, browser carriage, authorization policy or an RPC layer |
| Multi-hop routing and selected-route forwarding | Retain | A larger star is an intended deployment, not a restriction turning AGP into a central broker |

Neither `VISION.md` nor `DECISIONS.md` is changed by this proposal.\
It creates no full-mesh, clustering, durable-delivery or end-to-end identity guarantee.

---

## Current limits are not a capacity result

The [node configuration](../../packages/node/src/node.ts) defaults `capacity.maxSessions` and `capacity.maxPendingHandshakes` to 64 each.\
These are configurable resource guards, not a measured support envelope; the session guard counts live controllers, not only established peers.

The [protocol ceiling](../../packages/protocol/src/constants.ts) of 256 routes applies to one route snapshot, not to peer count.\
[Export derivation](../design/routing.md#7-selected-route-export) selects and bounds what each peer receives.\
Hundreds of peers can imply more than 256 exportable names, but that depends on endpoint counts, route selection and transit policy.\
Conversely, a smaller peer population can exceed the route ceiling.

The [export implementation](../../packages/core/src/routing.ts) suppresses candidates beyond the snapshot bound with `CAPACITY`.\
Keeping sessions established while required routes are suppressed does not demonstrate useful capacity.

Raising the session limit alone would neither establish safe aggregate resource use nor solve a route-export limit.\
Keeping the old scale assumption would leave the new deployment outside declared intent; claiming unlimited scale would invent support without evidence.

---

## Operating envelope still to define

Use an explicit reference deployment and workload to make "hundreds" testable.\
Do not treat a tab, user, named endpoint or application identity as automatically equivalent to one AGP peer: the consumer must state its connection-sharing arrangement.

Zorg's [declared browser connection model](../../../zorg/upstream/agp-requirements-response.md#1-corrections-to-the-briefs-assumptions) uses one shared-worker connection per application, identity and hub within its worker scope, not one connection per tab.\
Its [initial workload proposal](../../../zorg/upstream/agp-requirements-response.md#5-workload) describes one hub with 19 peers, each producing up to 30 changes in five seconds with application fan-out to every other peer, and all 19 reconnecting within one second.

That proposal is an input to the expanded envelope, not a measurement or a hundreds-of-peers requirement.\
Agree the larger population, active workload and fan-out explicitly rather than multiplying the connection count alone.

Within-envelope service and safe overload refusal are separate acceptance obligations.\
The chosen workload must retain its required routes and message exchanges within agreed convergence and recovery bounds, under the existing delivery contract.\
Bounded refusal and recovery beyond that workload do not substitute for showing useful service within it.

| Dimension | Required input or acceptance evidence |
|---|---|
| Concurrent peers | Exact established-peer target and headroom at one node; separate acquired, opening and established sessions |
| Topology and names | Direct peers, any transit paths, endpoints per peer, candidate and selected routes, and each peer's export size |
| Traffic | Active-peer fraction, message sizes and rates, bursts, bidirectional exchanges, application fan-out group sizes and aggregate ingress/egress; no assumption that every connected peer is busy |
| Workload cases | Distinguish idle occupancy, active service, startup/reconnect waves and recovery after suspension; connection-count evidence alone does not establish the other cases |
| Churn and admission | Startup and reconnect waves, credential/admission work, deadlines, cleanup and finite accounting for work that has not actually released |
| Resource ownership | Per-peer and aggregate memory, queues, timers and pending work; bounded refusal and recovery when capacity is exhausted |
| Service under load | Required route coverage and usable message exchanges, including replies where the application requires them; convergence, delivery and terminal behaviour within the agreed contract, including the effect of slow peers on other admitted peers |
| Reference environment | Host resources, runtime/carrier versions and the applicable browser set; results stated for that environment and workload |

The contract remains common to CLI, browser and service applications.\
Physical capabilities and deployment budgets must be stated honestly rather than concealed by a nominally uniform setting.\
Conservative defaults may remain appropriate even if a larger, verified deployment profile requires explicit configuration.

---

## Effect on current work

These are dependency obligations; the [board](../BOARD.md#build-order) owns current priorities and status.

| Work | Consequence |
|---|---|
| `B53` admission lifetime | Its correctness repair is owed at small scale independently of this amendment; review proposed work budgets against the envelope before endorsing them for hundreds of peers, without postponing the repair or silently increasing defaults |
| `B54` scale scope | Decide this amendment, then define the reference envelope and derive implementation and verification work from it |
| `B51` reply isolation and `B6` credential lifecycle | Follow their own review and adoption gates; endpoint naming and authentication costs feed the envelope, but scale alone selects neither mechanism |
| `B50` browser feasibility | Retain the shared contract and browser obligations; peer-count tests cannot certify browser portability or physical resource release |
| `B7` route volume | Re-triage if the intended envelope needs exports beyond the snapshot bound; peer count alone neither resolves nor proves that requirement |
| `B48` consumer acceptance | Remains separate, revision-pinned evidence; neither this draft nor capacity tests certify operation-call |

The likely engineering cost is broader capacity accounting and load/churn verification, with implementation changes where evidence requires them.\
No particular optimization, route-delta design or scheduling mechanism is selected here.

---

## Adoption and collaboration

Next: compare the revised proposal with the prior confirmed intent through `M2` fresh-reader assurance, then ask the director to ratify or revise it.\
If ratified, record a numbered decision and the sentence-level amendment; leave the vision unchanged with the reason above.\
Then agree the operating envelope with Zorg and derive bounded verification and implementation work before making a support claim.

Zorg's request for shared-network intent is compatible with this proposal; its other mechanisms follow their own review and adoption gates.\
The previous AGP response was received unedited and remains historical correspondence.\
This draft is not a new outbound response and does not change that received document.
