import type { TransportConformanceCase } from "./harness.js";

export const TRANSPORT_CONFORMANCE_CASES = Object.freeze([
  entry("acquisition-cancellation", ["T08", "T12"], [1]),
  entry("early-input-retention", ["T06", "T12"], [2]),
  entry("packet-byte-boundaries", ["T01", "T02", "T05"], [3]),
  entry("packet-order", ["T01", "T03", "T05"], [4]),
  entry("packet-duplicate-freedom", ["T05"], [5]),
  entry("send-acceptance-races", ["T03", "T04", "T08"], [6]),
  entry("outbound-backpressure", ["T06", "T07"], [7]),
  entry("pull-read-cancellation", ["T07", "T08"], [8]),
  entry("receive-bounds", ["T06"], [9]),
  entry("input-rejection-order", ["T09", "T10"], [10]),
  entry("channel-close-races", ["T08", "T09"], [11]),
  entry("terminal-once", ["T09"], [12]),
  entry("terminal-read-stability", ["T09"], [13]),
  entry("listener-capacity-callbacks", ["T11", "T20"], [14]),
  entry("listener-lifecycle", ["T11", "T20"], [15]),
  entry("peer-evidence", ["T14"], [16]),
  entry("binding-before-commit", ["T12"], [17]),
  entry("deadline-response", ["T08"], [18]),
  entry("diagnostic-containment", ["T15", "T20"], [19]),
  entry("carrier-sovereignty", ["T13", "T15", "T17", "T18"], [20]),
  entry("send-snapshot", ["T02", "T03"], [21]),
  entry("terminal-products", ["T09"], [22]),
  entry("operation-error-matrix", ["T08"], [23]),
  entry("reference-resolution", ["T13", "T19"], [24]),
  entry("acquisition-provenance", ["T16"], [24]),
  entry("controller-disposition", ["T21"], [11, 12, 13]),
] satisfies readonly TransportConformanceCase[]);

function entry(
  id: string,
  invariants: readonly string[],
  obligations: readonly number[],
): TransportConformanceCase {
  return Object.freeze({
    id,
    invariants: Object.freeze([...invariants]),
    obligations: Object.freeze([...obligations]),
    description: `Reusable neutral transport case: ${id}.`,
  });
}
