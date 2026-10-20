# Direct peer context-lab request handoff

The director selected owner delivery with "continue".\
The request is placed in context-lab's existing local `incoming` folder; this records placement, not acknowledgment, acceptance or execution readiness.

## Placement and identity

| Artifact | Measured identity |
|---|---|
| [Retained request as handed off](https://github.com/apnex/agp/blob/a97932d8582efa02ce4521061e0608852820f00d/docs/reviews/direct-peer-send-assurance/direct-peer-context-lab-contract-request.md) | 8,914 bytes; SHA-256 `b9227b06087d98b21089e168021cd7527ef0252724600bcd83b5c83e7a75ebdc` |
| [Placed request](../../../../context-lab/incoming/agp-direct-peer-assurance-contract-request.md) | 9,617 bytes; SHA-256 `e4791ef59b32cd477677c99b3c4675e7edc70c1992bac5baf7d257e74639a0b7` |
| Delivery readback | `2026-10-17T10:44:08.675Z`; the 703-byte delivery cover is followed by the complete byte-identical retained request |
| AGP head at handoff inspection | `a09e4bcda9d668b52ff3212c3813fad30fa7ac10` |
| Context-lab head at handoff inspection | `f323a93ebe1effc7145d1e8a41b2268204f76f5f` |

**Publication correction:** The retained-request link identifies the original committed bytes.\
The [current local copy](direct-peer-context-lab-contract-request.md) has rebased links and a publication note, not changed requirements.

The cover resolves the retained draft's historical "not delivered" status and asks for a separate owner reply.\
No requirement, question, source reference or measurement rule was changed.\
The [handoff checks](direct-peer-context-lab-handoff-checks.json) retain exact placement, local checks and before/after preservation measurements.

---

## Owner response and remaining boundary

The four questions concern retry policy, eligible answers and judge delivery, complete records for AGP-owned acceptance, and enforced limits.\
A useful reply identifies the supported interface/revision and evidence, or the specific unsupported requirement and owner recommendation.

The [earlier admission handoff](../admission-diagnostic-owner-handoff.md), its request and the admission response already in context-lab are separate work.\
That response establishes use of the local incoming channel, not acknowledgment of this direct-peer request.

Next assess a direct-peer owner reply against the frozen requirements when it arrives.\
A newer contract or proposed method amendment requires separate compatibility review; no reply automatically authorizes pack construction or execution.

B51 remains open, with its existing score and build-order position.\
B53 and B6 retain their separate gates, and no AGP or consumer runtime changed.\
No commit, push, provider setup, experiment, model call or new agent was part of this handoff.

---

## Mechanics

A delivery cover carries current placement status; the approved request body and AGP source remain byte-identical.\
The board records the owner-reply dependency and removes the answered delivery-selection question.

---

## Rationale

The maintainer receives the exact approved questions while the audit trail distinguishes authorship, placement and any later owner reply.

---

## Consequence

Treating file placement as owner acceptance or readiness would bypass the unresolved execution contracts and AGP's separate experiment authority.
