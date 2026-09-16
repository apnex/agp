import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runNative, streamNative } from "./support/native-process.js";

function connectionResponse() {
  return { apiVersion: "agp.management/v1", kind: "ConnectionList", meta: { nodeId: "node.operator", instanceId: "instance.operator", capturedAt: "2026-09-16T00:00:00Z", revision: "0" }, items: [] };
}

test("given a configured native operator shell, when contexts shortcuts help and saved sessions are used, then domain verbs stay direct and exported observations grant no endpoint authority", async (context) => {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push([request.method, request.url]);
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(connectionResponse()));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const scratch = await mkdtemp(join(tmpdir(), "agp-native-shell-"));
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(scratch, { recursive: true, force: true });
  });
  const help = await runNative(["--help"]);
  for (const word of ["connections/", "show", "up=:up", "?=:help"]) assert.ok(help.stdout.includes(word));
  assert.ok((await runNative(["help", "connections", "show"])).stdout.includes("show [connected:json-http-get-v1]"));
  const session = join(scratch, "session.json");
  const transfer = join(scratch, "interface.json");
  const shell = await streamNative(["--events", "--url", url, "--session", session], `connections\n?\nshow\nls\nup\nroutes\ntop\ntree\n:export ${transfer}\nexit\n`, { PATH: "" });
  assert.equal(shell.code, 0, shell.stderr);
  const events = shell.stdout.trim().split("\n").map((line) => JSON.parse(line));
  assert.ok(events.every((event) => event.status === "ok"));
  assert.match(events[0].result.help_text, /agp \/ connections/);
  assert.match(events[1].result.help_text, /show/);
  assert.equal(events[2].result.invocation.operation_id, "agp.connections.show");
  assert.equal(events[3].result.invocation.operation_id, "agp.connections.ls");
  assert.deepEqual(requests, [["GET", "/v1/connections"], ["GET", "/v1/connections"]]);
  const saved = await readFile(transfer, "utf8");
  assert.ok(saved.includes("json-http-get-v1"));
  assert.ok(!saved.includes(url));
  const resumed = await streamNative(["--events", "--session", session], ":render connections\nconnections\nshow\nexit\n", { PATH: "" });
  assert.equal(resumed.code, 2);
  assert.match(resumed.stderr, /CAPABILITY_NOT_GRANTED/);
  const historical = JSON.parse(resumed.stdout.split("\n")[0]);
  assert.equal(historical.result.historical, true);
  assert.equal(requests.length, 2);
  const environment = await runNative(["connections.list", "--json"], { AGP_MANAGEMENT_URL: url });
  assert.deepEqual(JSON.parse(environment.stdout), connectionResponse());
  const override = await runNative(["connections", "show", "--json", "--url", `${url}/`], { AGP_MANAGEMENT_URL: "http://invalid:9" });
  assert.deepEqual(JSON.parse(override.stdout), connectionResponse());
});

test("given invalid endpoints and management responses, when native verbs execute, then usage transport status contract and presentation failures remain distinguishable", async (context) => {
  let status = 200;
  let document = JSON.stringify(connectionResponse());
  let requests = 0;
  const server = createServer((request, response) => {
    requests++;
    response.statusCode = status;
    response.setHeader("Location", "http://127.0.0.1:1/redirect");
    response.end(document);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const failed = async (args, code) => {
    await assert.rejects(runNative(args), (error) => {
      assert.equal(error.code, code, error.stderr);
      assert.equal(error.stdout, "");
      return true;
    });
  };
  await failed(["connections.list"], 2);
  await failed(["connections.list", "--url", "http://localhost:80"], 2);
  await failed(["connections.list", "--url", url, "--json", "--json"], 2);
  assert.equal(requests, 0);
  for (const code of [301, 302, 404, 500]) {
    status = code;
    await failed(["connections.list", "--url", url, "--json"], 5);
  }
  status = 200;
  for (const body of ["malformed", JSON.stringify({ ...connectionResponse(), kind: "RouteTable" }), JSON.stringify({ ...connectionResponse(), meta: {} }), JSON.stringify({ ...connectionResponse(), items: false })]) {
    document = body;
    await failed(["connections.list", "--url", url, "--json"], 6);
  }
  document = JSON.stringify(connectionResponse());
  await failed(["connections.list", "--url", url, "--view", "health"], 7);
  assert.equal(requests, 9);
});

test("given an HTTP peer that never completes its body, when a native read reaches its total deadline, then it fails as transport without printing partial JSON", async (context) => {
  let requests = 0;
  const server = createServer((request, response) => {
    requests++;
    response.writeHead(200, { "Content-Length": "100" });
    response.write("{");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  const before = performance.now();
  await assert.rejects(runNative(["connections.list", "--json", "--url", url]), (error) => {
    assert.equal(error.code, 4, error.stderr);
    assert.equal(error.stdout, "");
    assert.match(error.stderr, /HTTP_TRANSPORT_FAILED/);
    return true;
  });
  const elapsed = performance.now() - before;
  assert.equal(requests, 1);
  assert.ok(elapsed >= 6500 && elapsed < 11000, `deadline elapsed ${elapsed}ms`);
});
