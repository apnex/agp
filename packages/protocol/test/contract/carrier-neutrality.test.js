import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import * as protocol from "../../dist/index.js";

async function schemaDocuments(directory, output = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const candidate = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) await schemaDocuments(candidate, output);
    else if (entry.isFile() && entry.name.endsWith(".schema.json")) {
      output.push(await readFile(candidate, "utf8"));
    }
  }
  return output;
}

test("Given the protocol package root and sovereign schema catalog, when carrier neutrality is inspected, then packet outcomes expose no subprotocol native close or frame vocabulary", async () => {
  assert.equal("AGP_V1_SUBPROTOCOL" in protocol, false);
  const invalid = protocol.parseAgpPacket(
    Uint8Array.from([0xc3, 0x28]),
    { receiveLimitBytes: protocol.AGP_V1_LIMITS.defaultReceiveBytes },
  );
  assert.deepEqual(invalid, {
    ok: false,
    reasonCode: "INVALID_UTF8",
    notificationCode: "INVALID_MESSAGE",
  });
  assert.equal("closeCode" in invalid, false);

  const codecSource = await readFile(
    new URL("../../src/codec.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(codecSource, /from\s+["']node:/u);
  const documents = await schemaDocuments(
    new URL("../../src/schemas/v1/", import.meta.url),
  );
  assert.doesNotMatch(
    documents.join("\n"),
    /\b(?:WebSocket|subprotocol|text frame|data frame|close code)\b/iu,
  );
});
