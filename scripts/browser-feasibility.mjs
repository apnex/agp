import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

// Browser feasibility observations only: no AGP carrier, authentication, or conformance seal.
// Tool modules may be installed outside this workspace; no production dependencies change.
const root = fileURLToPath(new URL("../", import.meta.url));
const esbuildModule = process.env.AGP_ESBUILD_MODULE ?? "esbuild";
const playwrightModule = process.env.AGP_PLAYWRIGHT_MODULE ?? "playwright-core";
const esbuild = await import(esbuildModule);
const { chromium } = await import(playwrightModule);
const report = {
  observedAt: new Date().toISOString(),
  sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  worktree: execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim(),
  node: process.version,
  tools: { esbuild: esbuild.version, esbuildModule, playwrightModule },
  bundles: {},
  csp: [],
  complete: false,
};
const bundles = new Map();
for (const name of ["node", "protocol", "core", "transport"]) {
  try {
    const built = await esbuild.build({
      stdin: { contents: `export * from "@agp/${name}";`, resolveDir: root },
      bundle: true, platform: "browser", format: "esm", target: "es2022",
      write: false, logLevel: "silent",
    });
    const bytes = built.outputFiles[0].contents;
    bundles.set(name, bytes);
    report.bundles[name] = {
      outcome: "built", bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      warnings: built.warnings.map(({ text }) => text),
    };
  } catch (error) {
    if (!Array.isArray(error.errors)) throw error;
    report.bundles[name] = { outcome: "blocked", errors: error.errors.map(({ text, location }) => ({ text, location })) };
  }
}

// This function is served as an ordinary page script, so CSP applies to its work.
async function runBrowserFeasibilityPage() {
  const parameters = new URL(location.href).searchParams;
  // Report through ordinary page networking: automation-side eval can bypass or
  // itself fail CSP, and must not become the instrument for observing CSP imports.
  const publish = async (result) => {
    const response = await fetch(`/result?id=${parameters.get("id")}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });
    if (!response.ok) throw new Error("Browser feasibility: result rejected");
  };
  const name = parameters.get("package");
  if (name !== null) {
    let result;
    try {
      const module = await import(`/bundle/${name}.js`);
      result = { outcome: "loaded", exports: Object.keys(module).length };
    } catch (error) {
      result = { outcome: "blocked", name: error.name, message: error.message };
    }
    await publish(result);
    return;
  }
  const socket = new WebSocket(`ws://${location.host}/packets`, "agp.v1");
  socket.binaryType = "arraybuffer";
  const received = [];
  const closeCodes = {};
  const result = {
    received, closeCodes,
    capabilities: {
      secureContext: isSecureContext,
      randomUUID: typeof crypto.randomUUID,
      getRandomValues: typeof crypto.getRandomValues,
      setImmediate: typeof globalThis.setImmediate,
      pause: typeof socket.pause,
      terminate: typeof socket.terminate,
    },
  };
  socket.onmessage = ({ data }) => {
    if (!(data instanceof ArrayBuffer)) throw new Error("Browser feasibility: non-binary response");
    received.push([...new Uint8Array(data)]);
    if (received.length === 4) socket.close(1000);
  };
  socket.onopen = () => {
    result.protocol = socket.protocol;
    result.extensions = socket.extensions;
    for (const code of [1002, 1003, 1007, 1009, 1011]) {
      try { socket.close(code); closeCodes[code] = "accepted"; }
      catch (error) { closeCodes[code] = error.name; }
    }
    const bytes = new Uint8Array([1, 2, 3]);
    result.sendReturn = typeof socket.send(bytes);
    bytes.fill(99);
    socket.send(new Uint8Array([4, 5]));
    socket.send(new Uint8Array([6]));
  };
  socket.onclose = (event) => {
    result.close = { code: event.code, wasClean: event.wasClean };
    void publish(result);
  };
  socket.onerror = () => { result.error = "WebSocket error"; };
}

let browser;
const observations = new Map();
const server = createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  const bundleName = /^\/bundle\/(node|protocol|core|transport)\.js$/.exec(url.pathname)?.[1];
  if (request.method === "POST" && url.pathname === "/result" && observations.has(url.searchParams.get("id"))) {
    const chunks = [];
    let length = 0;
    request.on("data", (chunk) => {
      length += chunk.length;
      if (length > 65_536) request.destroy();
      else chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        response.writeHead(204);
        response.end();
        observations.get(url.searchParams.get("id"))?.(result);
      } catch {
        response.writeHead(400);
        response.end();
      }
    });
  } else if (bundleName !== undefined && bundles.has(bundleName)) {
    response.writeHead(200, { "Content-Type": "text/javascript" });
    response.end(bundles.get(bundleName));
  } else if (url.pathname === "/probe.js") {
    response.writeHead(200, { "Content-Type": "text/javascript" });
    response.end(`(${runBrowserFeasibilityPage.toString()})();`);
  } else if (["/strict", "/control", "/native"].includes(url.pathname)) {
    const evaluation = url.pathname === "/control" ? " 'unsafe-eval'" : "";
    response.writeHead(200, {
      "Content-Type": "text/html",
      "Content-Security-Policy": `default-src 'none'; script-src 'self'${evaluation}; connect-src 'self' ws://127.0.0.1:${server.address().port}`,
    });
    response.end('<!doctype html><title>Browser feasibility</title><script type="module" src="/probe.js"></script>');
  } else {
    response.writeHead(404);
    response.end();
  }
});
const sockets = new WebSocketServer({
  server, path: "/packets", perMessageDeflate: false, maxPayload: 1024,
  handleProtocols: (protocols) => protocols.has("agp.v1") ? "agp.v1" : false,
});
const serverPackets = [];
sockets.on("connection", (socket) => {
  socket.send(new Uint8Array([9]));
  socket.on("error", (error) => { report.serverError = error.message; });
  socket.on("message", (bytes, binary) => {
    serverPackets.push({ binary, bytes: [...bytes] });
    socket.send(bytes, { binary });
  });
});

try {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  browser = await chromium.launch({
    headless: true, chromiumSandbox: true, timeout: 15_000,
    ...(process.env.AGP_BROWSER_EXECUTABLE ? { executablePath: process.env.AGP_BROWSER_EXECUTABLE } : {}),
  });
  report.browser = browser.version();
  report.browserExecutable = process.env.AGP_BROWSER_EXECUTABLE ?? "Playwright default";
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  let observationId = 0;
  async function observePage(route) {
    const id = String(++observationId);
    const url = new URL(route, `http://127.0.0.1:${server.address().port}`);
    url.searchParams.set("id", id);
    let timeout;
    const observed = new Promise((resolve, reject) => {
      observations.set(id, resolve);
      timeout = setTimeout(() => reject(new Error(`Browser feasibility: observation timed out: ${route}`)), 10_000);
    });
    try {
      const [, result] = await Promise.all([page.goto(url.href), observed]);
      return result;
    } finally {
      clearTimeout(timeout);
      observations.delete(id);
    }
  }
  report.native = await observePage("/native");
  report.serverPackets = serverPackets;
  assert.equal(report.native.protocol, "agp.v1");
  assert.equal(report.native.extensions, "");
  assert.deepEqual(report.native.received, [[9], [1, 2, 3], [4, 5], [6]]);
  assert.deepEqual(serverPackets, [[1, 2, 3], [4, 5], [6]].map((bytes) => ({ binary: true, bytes })));
  assert.deepEqual(report.native.close, { code: 1000, wasClean: true });
  assert.equal(report.native.error, undefined);
  assert.equal(report.serverError, undefined);
  for (const name of bundles.keys()) {
    for (const policy of ["strict", "control"]) {
      const observed = await observePage(`/${policy}?package=${name}`);
      report.csp.push({ package: name, policy, ...observed });
      if (policy === "control") assert.equal(observed.outcome, "loaded");
    }
  }
  report.pageErrors = pageErrors;
  assert.deepEqual(pageErrors, []);
  report.complete = true;
} catch (error) {
  report.failure = error.message;
  throw error;
} finally {
  await browser?.close();
  for (const socket of sockets.clients) socket.terminate();
  await new Promise((resolve) => sockets.close(resolve));
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  esbuild.stop();
  console.log(JSON.stringify(report, null, 2));
}
