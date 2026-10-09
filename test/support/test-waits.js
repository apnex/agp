/** Bound a test event wait in milliseconds; callers still own cancellation and cleanup of the work. */
export function waitForTestEvent(pending, description, { timeoutMs = 5_000, signal } = {}) {
  if (typeof description !== "string" || description.trim() === "") {
    throw new TypeError("Test event description must be non-empty");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
    throw new RangeError("Test event timeout must be a positive timer-safe integer");
  }
  let timer;
  let abort;
  const bound = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`Test event timeout: ${description} after ${timeoutMs}ms`);
      error.code = "TEST_EVENT_TIMEOUT";
      reject(error);
    }, timeoutMs);
    abort = () => reject(new Error(`Test event cancelled: ${description}`, { cause: signal.reason }));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
  // Keep the timer referenced: a missing event must fail even with no other handles.
  // Promise.race observes late rejection of the work after the bound has won.
  return Promise.race([pending, bound]).finally(() => {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  });
}

/** Await one matching test event within a total deadline, closing the owned subscription on every exit. */
export async function nextTestEvent(subscription, predicate, description, options) {
  try {
    return await waitForTestEvent((async () => {
      for await (const event of subscription) {
        if (predicate(event)) return event;
      }
      throw new Error(`Test event stream ended: ${description}`);
    })(), description, options);
  } finally {
    subscription.close();
  }
}
