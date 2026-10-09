import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import test from "node:test";
import { nextTestEvent, waitForTestEvent } from "../support/test-waits.js";

test("Given a test event wait, when its value or rejection arrives, then the result is unchanged and timer and abort listeners are released", async (context) => {
  const controller = new AbortController();
  const clear = context.mock.method(globalThis, "clearTimeout");
  const value = { event: "arrived" };
  assert.equal(await waitForTestEvent(Promise.resolve(value), "arrival", { signal: controller.signal }), value);
  const failure = new Error("source rejection");
  await assert.rejects(waitForTestEvent(Promise.reject(failure), "rejection", { signal: controller.signal }),
    (error) => error === failure);
  assert.equal(clear.mock.callCount(), 2);
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});

test("Given a missing test event, when its deadline expires, then the failure names the event and a late rejection is still observed", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const pending = Promise.withResolvers();
  const controller = new AbortController();
  const waiting = waitForTestEvent(pending.promise, "handler arrival", { timeoutMs: 25, signal: controller.signal });
  const failed = assert.rejects(waiting, { code: "TEST_EVENT_TIMEOUT", message: "Test event timeout: handler arrival after 25ms" });
  context.mock.timers.tick(25);
  await failed;
  pending.reject(new Error("late source error"));
  await Promise.resolve();
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});

test("Given a cancelled test context, when a wait is pending or starts afterwards, then cancellation rejects promptly and detaches listeners", async () => {
  const controller = new AbortController();
  const reason = new Error("parent cancelled");
  const first = waitForTestEvent(new Promise(() => {}), "pending", { signal: controller.signal });
  controller.abort(reason);
  await assert.rejects(first, (error) => error.message === "Test event cancelled: pending" && error.cause === reason);
  await assert.rejects(waitForTestEvent(new Promise(() => {}), "already cancelled", { signal: controller.signal }),
    /Test event cancelled: already cancelled/);
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});

test("Given an invalid test wait bound, when a waiter is requested, then invalid timer values and empty descriptions are rejected", () => {
  for (const timeoutMs of [0, -1, 0.5, NaN, Infinity, 2_147_483_648]) {
    assert.throws(() => waitForTestEvent(Promise.resolve(), "invalid", { timeoutMs }), RangeError);
  }
  assert.throws(() => waitForTestEvent(Promise.resolve(), ""), TypeError);
});

test("Given a test subscription, when a matching event arrives, then the exact event returns and the owned subscription closes", async () => {
  const subscription = testSubscription();
  const value = { kind: "wanted" };
  const pending = nextTestEvent(subscription, (event) => event.kind === "wanted", "wanted event");
  subscription.deliver(value);
  assert.equal(await pending, value);
  assert.equal(subscription.closed, true);
});

test("Given nonmatching test events, when the total deadline expires, then traffic cannot restart the bound and the subscription closes", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const subscription = testSubscription();
  const pending = nextTestEvent(subscription, () => false, "absent matching event", { timeoutMs: 25 });
  const failed = assert.rejects(pending, /Test event timeout: absent matching event after 25ms/);
  for (let index = 0; index < 4; index += 1) {
    context.mock.timers.tick(5);
    subscription.deliver({ kind: "noise" });
    await Promise.resolve();
  }
  context.mock.timers.tick(5);
  await failed;
  assert.equal(subscription.closed, true);
});

test("Given a closed or faulty test event stream, when no matching event can be read, then the error is preserved and cleanup closes the stream", async () => {
  const closed = testSubscription();
  closed.close();
  await assert.rejects(nextTestEvent(closed, () => true, "expected"), /Test event stream ended: expected/);
  const faulty = testSubscription();
  const failure = new Error("predicate failed");
  const waiting = nextTestEvent(faulty, () => { throw failure; }, "predicate");
  faulty.deliver({});
  await assert.rejects(waiting, (error) => error === failure);
  assert.equal(faulty.closed, true);
});

function testSubscription() {
  let pending;
  return {
    closed: false,
    [Symbol.asyncIterator]() { return this; },
    next() {
      if (this.closed) return Promise.resolve({ done: true });
      pending = Promise.withResolvers();
      return pending.promise;
    },
    deliver(value) { pending.resolve({ done: false, value }); },
    close() { this.closed = true; pending?.resolve({ done: true }); },
  };
}
