# AGP admission lifecycle fit response

Status: local draft, not sent.\
From: AGP, to Zorg's issuer, caller-identity and hub-composition owners.

Your [fit reply](../../../zorg/upstream/agp-admission-use-lifecycle-fit-reply.md) answers all six areas against the [reviewed producer proposal](evidence/admission-redemption-review-input.txt), SHA256 `49a57e583eb0fbd6d46933273d376936e8cafc6ae95ec4944750ec2878b82097`.\
We record design-level consumer fit with the safeguards below; this is not AGP ratification or implementation approval.

The shared clock and recording sample, exact lifecycle and provider lookup, finite budgets and host/carrier ownership are compatible with that proposal.\
Your reply requests no additional lifecycle fact or change to its public surface.

## Corrections now reflected in the reply

Your updated reply now cites the [issuer contract](../../../credential-issuer/CONTRACT.md) at `56f3583e4239c99b4248ef536394ec2e0555f4a9` and carries its corrected integration details:

| Detail | Safeguard retained in the updated reply |
|---|---|
| Registration and uncertain failure | Reserve the storage before recording, not only an entry object; preserve the prepared or uncertain use and prevent key reuse if completion becomes uncertain |
| Cleanup | Request termination immediately when needed, but call `finishAdmissionAcquisition()` only after the composition's work and undelivered-channel disposal have settled |
| Allocation authority | Check the current lease allocation and process generation, and resolve only the committed registration for that allocation |
| Duplicate recording and activity | Preserve the original committed registration on duplicate recording; retain issuance, renewal and recorded-redemption activity through compaction |
| Reclamation delay | First valid terminal observation is conservative; an extra single sweep interval is a bound only while sweeps run on time and reads succeed |
| Deadline and spend ownership | The issuer supplies the authorization limit and AGP records the opening deadline; proof alone does not spend a key, while uncertain recording prevents reuse |

The revised sweep-delay wording now matches [producer section 6](../design/admission-use-lifecycle.md#6-issuer-reclamation-and-exact-termination).\
Delayed sweeps or failed observations can extend retention without a finite time bound; unknown state retains the lease, and finite tables refuse further allocation rather than evicting an unresolved use.\
This resolves the timing qualification identified in our initial intake.

The inspected updated reply has SHA256 `2b20c250deea3ade87b1c262008acd8ed560c130303ff87345a286f2d657e18f` and is present with the corrected `D63` at Zorg revision `25b08a58322c01bb0a126822eb6950f02e4cdf9f`.\
No repeated fit study or additional correction to these points is requested.

## Remaining joint work

The proof-capable WebSocket completion and cleanup interface remains separate work, as your area 6 correctly states.\
AGP must still settle fresh-key acquisition, explicit-refusal rearm and concrete credential carriage through a common CLI/browser contract; this fit response selects neither a proof profile nor a browser-specific policy path.

The producer proposal and its independent static review remain unchanged.\
Required documentation assurance, AGP ratification and explicit implementation selection remain open; producer verification precedes consumer migration and production lease-reclamation acceptance.\
Keep existing consumer admission and resource protection until that verified migration is agreed.
