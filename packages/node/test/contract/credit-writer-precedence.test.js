import assert from "node:assert/strict";
import test from "node:test";
import { SessionWriter } from "../../dist/index.js";
import { fakeConnection } from "../support/fakes.js";

// Owns: what the writer may and may not put on the wire while the peer has no
// room for the head of its queue.
//
// `withdrawal-writer-order` owns the ordering that epoch closure depends on
// and never reaches a bound. This file owns the exception credit introduces,
// which is the only case where a task leaves the queue out of order.

const encoder = new TextEncoder();

function creditedWriter({ packets }) {
  const transport = fakeConnection();
  let allowance = packets;
  let wake = () => {};
  const writer = new SessionWriter(transport.connection, {
    maximumQueuedDataMessages: 64,
    maximumQueuedDataBytes: 1_048_576,
    maximumQueuedControlMessages: 64,
  });
  writer.useCredit({
    canSendData: () => allowance > 0,
    recordDataSent: () => {
      allowance -= 1;
    },
    whenCreditAdvances: (signal) =>
      new Promise((resolve) => {
        wake = resolve;
        signal.addEventListener("abort", () => resolve(), { once: true });
      }),
  });
  return {
    writer,
    transport,
    grant(more) {
      allowance += more;
      wake();
    },
  };
}

function admitData(writer, label, epoch = "source@1") {
  return writer.admitData({
    packet: encoder.encode(label),
    encodedBytes: label.length,
    epoch,
  });
}

async function settle() {
  for (let turn = 0; turn < 8; turn += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

test("Given data beyond what the peer granted, when the writer pumps, then it stops at the grant rather than writing past it", async () => {
  const { writer, transport } = creditedWriter({ packets: 2 });

  for (const label of ["d1", "d2", "d3", "d4"]) admitData(writer, label);
  await settle();

  assert.deepEqual(
    transport.writes,
    ["d1", "d2"],
    "the writer must stop at the grant",
  );
});

test("Given a queue stalled on credit, when the peer raises its ceiling, then the held data resumes in its original order", async () => {
  const { writer, transport, grant } = creditedWriter({ packets: 2 });

  for (const label of ["d1", "d2", "d3", "d4"]) admitData(writer, label);
  await settle();
  grant(2);
  await settle();

  assert.deepEqual(
    transport.writes,
    ["d1", "d2", "d3", "d4"],
    "credit paces data without reordering it",
  );
});

test("Given a queue stalled on credit, when control is enqueued behind the held data, then control reaches the wire without waiting for the grant", async () => {
  const { writer, transport } = creditedWriter({ packets: 1 });

  admitData(writer, "d1");
  admitData(writer, "d2");
  await settle();
  void writer.enqueueControl(encoder.encode("ack"), 3).catch(() => undefined);
  await settle();

  // Without this the grant itself is unreachable: the message that would clear
  // the stall is a control message, and it would be queued behind the stall.
  assert.deepEqual(
    transport.writes,
    ["d1", "ack"],
    "control must pass data the peer has no room for",
  );
});

test("Given a queue stalled on credit, when a route snapshot sits behind the held data, then the snapshot waits and only control passes", async () => {
  const { writer, transport, grant } = creditedWriter({ packets: 1 });

  admitData(writer, "d1");
  admitData(writer, "d2");
  await settle();
  void writer.enqueueRouteSnapshot(encoder.encode("withdraw"), 8, ["source@1"])
    .catch(() => undefined);
  void writer.enqueueControl(encoder.encode("ack"), 3).catch(() => undefined);
  await settle();

  assert.deepEqual(
    transport.writes,
    ["d1", "ack"],
    "a withdrawal must not overtake the data admitted under its epoch",
  );

  grant(4);
  await settle();
  assert.deepEqual(
    transport.writes,
    ["d1", "ack", "d2", "withdraw"],
    "the withdrawal lands after the data it withdraws",
  );
});

test("Given a writer stalled on credit, when it is stopped, then the stall releases and every held task settles", async () => {
  const { writer } = creditedWriter({ packets: 1 });

  admitData(writer, "d1");
  const held = admitData(writer, "d2");
  assert.deepEqual(held, { accepted: true });
  await settle();

  const discarded = writer.stop("test teardown");
  await settle();

  assert.ok(discarded >= 1, "the held task must be discarded rather than left");
  await assert.rejects(
    writer.enqueueControl(encoder.encode("late"), 4),
    "a stopped writer accepts nothing further",
  );
});
