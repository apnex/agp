import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const designRoot = path.join(root, "docs/design");

async function design(relative) {
  return readFile(path.join(designRoot, relative), "utf8");
}

test("Given the frozen cross-document vocabulary, when AX0 scans its sovereign owners, then canonical terms and mappings are exact and stale target names are absent", async () => {
  const transport = await design("transport-contract.md");
  const fsm = await design("fsm.md");
  const contracts = await design("contracts.md");
  const operations = await design("operations.md");
  const binding = await design("binding-websocket.md");

  assert.match(transport, /interface TransportChannelPort/u);
  assert.match(transport, /kind: "dial"/u);
  assert.match(transport, /kind: "accept"/u);
  assert.doesNotMatch(transport, /\bTransportConnectionPort\b/u);
  assert.doesNotMatch(transport, /\bsendText\s*\(/u);

  assert.match(fsm, /dial -> outbound/u);
  assert.match(fsm, /accept -> inbound/u);
  assert.match(contracts, /\bPreIdentityControllerSnapshot\b/u);
  assert.match(contracts, /\bConnectionSnapshot\b/u);
  assert.match(operations, /\bconnection\.preidentity-closed\b/u);
  assert.match(operations, /\bsession\.closed\b/u);
  assert.doesNotMatch(contracts, /\bSessionListSnapshot\b/u);
  assert.doesNotMatch(contracts, /\bsession-list\b/u);

  assert.match(binding, /interface WebSocketListenerConfigData/u);
  assert.match(binding, /interface WebSocketTargetConfigData/u);
  assert.doesNotMatch(binding, /receive-limits\.schema\.json/u);
  assert.doesNotMatch(binding, /WebSocketTlsCapability/u);
  assert.doesNotMatch(binding, /WebSocketAuthenticationCapability/u);
});
