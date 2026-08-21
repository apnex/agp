import { eventually } from "./uniform-topology.js";

// Traffic drivers. A driver decides how messages are offered to a topology; it
// knows nothing about the shape carrying them, which is what lets one profile
// run against any geometry.

/**
 * Fire `count` sends concurrently and settle every one of them.
 *
 * Unlike a stream, no send waits for its predecessor, so admissions compete for
 * the same bounded capacity. The property under test is that each send reaches
 * a definite outcome: a receipt, or a typed rejection. A send that hangs, or a
 * message that is silently dropped after admission, is the failure this looks
 * for.
 */
export async function burstMessages({
  from,
  source,
  destination,
  count,
  deliveries,
  timeoutMs = 30_000,
}) {
  const at = () => deliveries.filter((entry) => entry.endpoint === destination);
  const before = at().length;
  const settled = await Promise.allSettled(
    Array.from(
      { length: count },
      (_, ordinal) => from.send(source, destination, { ordinal }),
    ),
  );
  const admitted = settled.filter(({ status }) => status === "fulfilled");
  const rejected = settled.filter(({ status }) => status === "rejected");
  await eventually(
    () => at().length - before >= admitted.length,
    `${admitted.length} admitted deliveries at ${destination}`,
    timeoutMs,
  );
  return {
    admitted: admitted.map(({ value }) => value),
    rejected: rejected.map(({ reason }) => reason),
    arrived: at().slice(before).map((entry) => entry.payload.ordinal),
  };
}

/**
 * Send `count` messages along one path and wait for all of them.
 *
 * Each payload carries its ordinal so arrival order is checked against send
 * order rather than assumed from arrival count.
 */
export async function streamMessages({
  from,
  source,
  destination,
  count,
  deliveries,
  timeoutMs = 30_000,
}) {
  // Count only this destination. Concurrent streams share one delivery log, so
  // a total-length wait completes on the other direction's traffic and reads a
  // partial sequence as an ordering failure.
  const at = () => deliveries.filter((entry) => entry.endpoint === destination);
  const before = at().length;
  const receipts = [];
  for (let ordinal = 0; ordinal < count; ordinal += 1) {
    receipts.push(await from.send(source, destination, { ordinal }));
  }
  await eventually(
    () => at().length - before >= count,
    `${count} deliveries at ${destination}`,
    timeoutMs,
  );
  const arrived = at().slice(before).map((entry) => entry.payload.ordinal);
  return { receipts, arrived };
}
