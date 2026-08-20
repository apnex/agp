import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  cliRoot,
  createJsonServer,
  readJsonFixture,
  runBash,
} from "../fixtures/process-fixture.js";

const dispatcher = path.join(cliRoot, "agpctl");

test("given help missing and unsupported commands when dispatched then only the allowlisted grammar receives success", async () => {
  const help = await runBash(dispatcher, ["--help"]);
  const missing = await runBash(dispatcher);
  const unsupported = await runBash(dispatcher, ["routes.delete"]);

  assert.equal(help.code, 0);
  assert.match(help.stderr, /^usage: agpctl /u);
  assert.match(help.stderr, /connections[.]list/);
  assert.equal(missing.code, 2);
  assert.equal(unsupported.code, 2);
  assert.match(unsupported.stderr, /unsupported command/);
});

test("given environment and explicit loopback URLs when dispatching JSON and table modes then both consume the selected document", async (t) => {
  const connections = await readJsonFixture("connections-cases.json");
  const routes = await readJsonFixture("routes-empty.json");
  const server = await createJsonServer((request) => ({
    body: request.url === "/v1/routes" ? routes : connections,
  }));
  t.after(() => server.close());

  const json = await runBash(dispatcher, ["connections.list", "--json"], {
    env: { AGP_MANAGEMENT_URL: server.url },
  });
  const table = await runBash(dispatcher, [
    "routes.list",
    "--url",
    `${server.url}/`,
  ]);

  assert.equal(json.code, 0, json.stderr);
  assert.deepEqual(JSON.parse(json.stdout), connections);
  assert.equal(table.code, 0, table.stderr);
  assert.match(table.stdout, /SELECTED/);
  assert.match(table.stdout, /ENDPOINT/);
  assert.deepEqual(
    server.requests.map(({ method, url }) => [method, url]),
    [
      ["GET", "/v1/connections"],
      ["GET", "/v1/routes"],
    ],
  );
});

test("given hostile URL and option strings when parsed then no shell text executes and usage fails closed", async () => {
  const cases = [
    ["connections.list", "--url", "http://127.0.0.1:1;printf owned"],
    ["connections.list", "--url", "http://127.0.0.1:1\n--next"],
    ["connections.list", "--url"],
    ["connections.list", "--json", "--json"],
    ["connections.list", "--template", "/tmp/owned"],
  ];
  for (const args of cases) {
    const result = await runBash(dispatcher, args, {
      env: { AGP_MANAGEMENT_URL: "" },
    });
    assert.equal(result.code, 2, args.join(" "));
    assert.doesNotMatch(result.stdout, /owned/);
  }
});

test("given the MVP shell sources when statically inspected then dispatch has no dynamic code state files or mutation verbs", async () => {
  const relativeFiles = [
    "agpctl",
    "cmd.connections.list.sh",
    "cmd.routes.list.sh",
    "lib/command.sh",
    "lib/http.sh",
    "lib/render.sh",
    "drv/drv.connections.list.sh",
    "drv/drv.routes.list.sh",
  ];
  const source = (
    await Promise.all(
      relativeFiles.map((name) => readFile(path.join(cliRoot, name), "utf8")),
    )
  ).join("\n");

  assert.doesNotMatch(source, /\beval\b/);
  assert.doesNotMatch(source, /\b(?:mktemp|AGP_CONTEXT|context[.]json)\b/);
  assert.doesNotMatch(source, /curl[\s\S]{0,300}--request/);
  assert.doesNotMatch(source, /\b(?:POST|PUT|PATCH|DELETE)\b/);
  const sourcedFiles = source
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("source "));
  assert.ok(sourcedFiles.length > 0);
  assert.ok(
    sourcedFiles.every((line) =>
      /^source "\$\{AGP_CLI_ROOT\}\/(?:lib\/)?[a-z.]+[.]sh"$/u.test(line),
    ),
  );
});
