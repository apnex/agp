import assert from "node:assert/strict";
import { access, mkdtemp, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  cliRoot,
  runBash,
} from "../fixtures/process-fixture.js";

const renderer = path.join(cliRoot, "lib/render.sh");

async function findJq() {
  for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
    const candidate = path.join(directory, "jq");
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue through the inherited executable search path.
    }
  }
  throw new Error("jq fixture dependency was not found");
}

test("given an empty projection when rendered without a TTY then stable headers print without ANSI bytes", async () => {
  const result = await runBash(renderer, ["connections.list"], {
    input: "[]\n",
  });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /SESSION_ID/);
  assert.match(result.stdout, /UPTIME/);
  assert.match(result.stdout, /\bTTL\b/);
  assert.match(result.stdout, /LAST_EVENT/);
  assert.doesNotMatch(result.stdout, /\bSINCE\b/);
  assert.doesNotMatch(result.stdout, /LAST_REASON/);
  assert.doesNotMatch(result.stdout, /\u001b/u);
  assert.equal(result.stdout.trim().split("\n").length, 1);
});

test("given column is absent when rows are rendered then deterministic tab-separated fallback remains successful", async (t) => {
  const isolatedPath = await mkdtemp(
    path.join(os.tmpdir(), "agp-cli-render-"),
  );
  t.after(() => rm(isolatedPath, { recursive: true, force: true }));
  await symlink(await findJq(), path.join(isolatedPath, "jq"));
  const input = [
    {
      session_id: "75c4ae",
      remote_node: "leaf.alpha",
      direction: "inbound",
      state: "Established",
      uptime: "01:02:03",
      ttl: "21s",
      last_event: "KeepaliveReceived",
    },
  ];

  const result = await runBash(renderer, ["connections.list"], {
    env: { PATH: isolatedPath, NO_COLOR: "1" },
    input: `${JSON.stringify(input)}\n`,
  });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /SESSION_ID\tREMOTE_NODE/);
  assert.match(result.stdout, /75c4ae\tleaf\.alpha/);
  assert.doesNotMatch(result.stdout, /\u001b/u);
});

test("given hostile remote fields when rendered then terminal controls and embedded row separators cannot escape", async () => {
  const input = [
    {
      selected: ">",
      endpoint: "orders\u001b[2J\nsubmit",
      route_class: "learned",
      learned_kind: "direct",
      next_hop: "spoke\u202e.alpha@75c4ae",
      origin_node: "leaf.alpha",
      path: "leaf.alpha>hub.local",
      eligible: true,
      reason: "ONLY_ELIGIBLE\tfor-now",
    },
  ];
  const result = await runBash(renderer, ["routes.list"], {
    input: `${JSON.stringify(input)}\n`,
  });

  assert.equal(result.code, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /[\u001b\u202e]/u);
  assert.match(result.stdout, /orders \[2J submit/);
  assert.equal(result.stdout.trim().split("\n").length, 2);
});

test("given malformed input or an unlisted projection when rendered then renderer failure uses exit seven", async () => {
  const malformed = await runBash(renderer, ["routes.list"], {
    input: "{}\n",
  });
  const unsupported = await runBash(renderer, ["routes.delete"], {
    input: "[]\n",
  });

  assert.equal(malformed.code, 7);
  assert.equal(unsupported.code, 7);
  assert.equal(malformed.stdout, "");
});
