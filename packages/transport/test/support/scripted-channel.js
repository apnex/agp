export function createScriptedPair() {
  const leftInbox = [];
  const rightInbox = [];
  const left = createChannel(leftInbox, rightInbox);
  const right = createChannel(rightInbox, leftInbox);
  return {
    left,
    right,
    async close() {
      left.abort({ kind: "forced-stop", code: "TEST_END" });
      right.abort({ kind: "forced-stop", code: "TEST_END" });
    },
  };
}

export function createTerminalChannel() {
  return createChannel([], []);
}

function createChannel(inbox, peerInbox) {
  let terminal;
  return {
    peerEvidence: Object.freeze({
      locality: "process-local",
      protection: "none",
      authentication: Object.freeze({ kind: "none" }),
    }),
    async send(packet) {
      peerInbox.push({
        kind: "packet",
        packet: { bytes: Uint8Array.from(packet.bytes) },
      });
    },
    async read() {
      const item = inbox.shift();
      if (item !== undefined) return item;
      if (terminal !== undefined) {
        return { kind: "terminal", terminal };
      }
      throw new Error("scripted channel has no item");
    },
    async close(intent) {
      terminal ??= Object.freeze({
        origin: "local",
        kind: "graceful",
        diagnostic: Object.freeze({ code: intent.code }),
      });
      return terminal;
    },
    abort(intent) {
      terminal ??= Object.freeze({
        origin: "local",
        kind: "aborted",
        diagnostic: Object.freeze({ code: intent.code }),
      });
    },
  };
}
