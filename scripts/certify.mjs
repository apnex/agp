import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");
const replace = process.argv.includes("--replace");
const unknown = process.argv.slice(2).filter(
  (value) => value !== "--dry-run" && value !== "--replace",
);
if (unknown.length > 0) {
  throw new Error(`unsupported option: ${unknown.join(", ")}`);
}

const trace = await json("docs/design/agp-uniform-node/traceability.json");
const sourceRevision = trace.sourceRevision;
if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(sourceRevision)) {
  throw new Error("trace sourceRevision is not artifact-path safe");
}

const evidenceSchema = await json(
  "docs/design/agp-uniform-node/verification-evidence.schema.json",
);
const certificateSchema = await json(
  "docs/design/agp-uniform-node/artifact-certificate.schema.json",
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addSchema(evidenceSchema);
const validateEvidence = ajv.getSchema(evidenceSchema.$id);
const validateCertificate = ajv.compile(certificateSchema);
if (validateEvidence === undefined) {
  throw new Error("verification evidence validator was not registered");
}

const findings = await loadFindings();
const catalogPath = "schemas/agp-v1.schema-catalog.json";
const catalogDigest = await digestFile(catalogPath);
const environment = Object.freeze({
  node: process.version,
  platform: os.platform(),
  architecture: os.arch(),
});

const packageTests = await collectTests([
  "packages/protocol/test",
  "packages/transport/test",
  "packages/binding-websocket/test",
  "packages/transport-loopback/test",
  "packages/core/test",
  "packages/transport-node-ws/test",
  "packages/node/test",
  "packages/management-http/test",
]);
const cliTests = await collectTests(["cli/test"]);
const rootTests = await collectTests(["test"]);
const protocolContract = packageTests.filter(
  (file) => file.startsWith("packages/protocol/test/contract/"),
);
const protocolUnit = packageTests.filter(
  (file) => file.startsWith("packages/protocol/test/unit/"),
);
const coreUnit = packageTests.filter(
  (file) => file.startsWith("packages/core/test/unit/"),
);
const transportTests = packageTests.filter(
  (file) => file.startsWith("packages/transport/test/"),
);
const bindingTests = packageTests.filter(
  (file) => file.startsWith("packages/binding-websocket/test/"),
);
const loopbackTests = packageTests.filter(
  (file) => file.startsWith("packages/transport-loopback/test/"),
);
const webSocketAdapterTests = packageTests.filter(
  (file) => file.startsWith("packages/transport-node-ws/test/"),
);
const nodeTests = packageTests.filter(
  (file) => file.startsWith("packages/node/test/"),
);
const managementTests = packageTests.filter(
  (file) => file.startsWith("packages/management-http/test/"),
);
const conformance = rootTests.filter(
  (file) => file.startsWith("test/conformance/"),
);
const integration = rootTests.filter(
  (file) => file.startsWith("test/integration/"),
);
const topology = rootTests.filter(
  (file) => file.startsWith("test/topology/"),
);
const resilience = rootTests.filter(
  (file) => file.startsWith("test/resilience/"),
);
const e2e = rootTests.filter(
  (file) => file.startsWith("test/e2e/"),
);

const ax0Files = pick(conformance, [
  "design-link-integrity.test.js",
  "design-mrc.test.js",
  "design-vocabulary.test.js",
  "no-legacy-surface.test.js",
  "review-finding-closure.test.js",
  "traceability-graph.test.js",
  "verification-evidence-contract.test.js",
]);
const ax1Files = [
  ...protocolContract,
  ...transportTests,
  ...bindingTests,
  ...loopbackTests,
  ...webSocketAdapterTests,
  ...pick(conformance, [
    "event-schema-catalog.test.js",
    "public-node-consumer.test.js",
    "schema-catalog-composition.test.js",
    "schema-generation-isolation.test.js",
    "transport-sovereignty.test.js",
  ]),
];
const ax2Files = [
  ...protocolUnit,
  ...pick(conformance, ["semantic-rule-registry.test.js"]),
];
const ax3Files = coreUnit.filter((file) =>
  /\/(?:adjacency-retry-suppression|peer-fsm-[^/]+|session-pair-scope)\.test\.js$/u
    .test(file)
);
const ax4Files = coreUnit.filter((file) =>
  /\/(?:export-|rib-|route-)[^/]+\.test\.js$/u.test(file)
);
const ax6Files = [
  ...coreUnit.filter((file) => /\/operations-[^/]+\.test\.js$/u.test(file)),
  ...managementTests,
  ...cliTests,
  ...pick(rootTests, [
    "operations-frozen-parity.test.js",
    "operations-live-time-bounds.test.js",
  ]),
];
const allTests = [...packageTests, ...cliTests, ...rootTests].sort();

const gates = [
  gate("AX0", ax0Files, [
    npm("run", "test:architecture"),
    nodeTestsCommand(ax0Files),
  ]),
  gate("AX1", ax1Files, [
    npm("run", "build"),
    npm("run", "schemas:check"),
    nodeTestsCommand(ax1Files),
  ]),
  gate("AX2", ax2Files, [nodeTestsCommand(ax2Files)]),
  gate("AX3", ax3Files, [nodeTestsCommand(ax3Files)]),
  gate("AX4", ax4Files, [nodeTestsCommand(ax4Files)]),
  gate("AX5", nodeTests, [
    npm("test", "--workspace", "@agp/node"),
  ]),
  gate("AX6", ax6Files, [
    npm("test", "--workspace", "@agp/management-http"),
    npm("run", "test:cli"),
    nodeTestsCommand([
      ...coreUnit.filter(
        (file) => /\/operations-[^/]+\.test\.js$/u.test(file),
      ),
      ...pick(rootTests, [
        "operations-frozen-parity.test.js",
        "operations-live-time-bounds.test.js",
      ]),
    ]),
  ]),
  gate("AX7", [...integration, ...topology, ...e2e], [
    npm("run", "test:integration"),
    npm("run", "test:topology"),
    npm("run", "test:e2e"),
  ]),
  gate("AX8", allTests, [
    npm("run", "test:resilience"),
    npm("test"),
  ]),
];

for (const definition of gates) {
  if (definition.testFiles.length === 0) {
    throw new Error(`${definition.gate} resolved no test files`);
  }
}
await assertProcessCleanup();

if (dryRun) {
  for (const definition of gates) {
    process.stdout.write(
      `${definition.gate}: ${definition.testFiles.length} files; `
        + `${definition.commands.map(({ display }) => display).join(" && ")}\n`,
    );
  }
  process.stdout.write(
    `Certification dry-run PASS: ${gates.length} gates, `
      + `${findings.length} closed findings, no artifacts written.\n`,
  );
  process.exit(0);
}

const verificationRoot = path.join(root, "artifacts/verification");
const finalRoot = path.join(verificationRoot, sourceRevision);
const stageRoot = path.join(
  verificationRoot,
  `.staging-${sourceRevision}-${process.pid}`,
);
if (await exists(finalRoot)) {
  if (!replace) {
    throw new Error(
      `${path.relative(root, finalRoot)} already exists; use --replace deliberately`,
    );
  }
  await rm(finalRoot, { recursive: true, force: true });
}
await rm(stageRoot, { recursive: true, force: true });
await mkdir(stageRoot, { recursive: true });

const lowerDigests = [];
const gateEvidence = [];
try {
  for (const definition of gates) {
    const startedAt = new Date().toISOString();
    process.stdout.write(`\n=== ${definition.gate} ===\n`);
    for (const command of definition.commands) {
      await run(command);
    }
    if (definition.gate === "AX7" || definition.gate === "AX8") {
      await assertProcessCleanup();
    }
    const completedAt = new Date().toISOString();
    const manifest = {
      schemaVersion: "agp.verification/v1",
      gate: definition.gate,
      status: "PASS",
      claimScope: "agp-artifact",
      axiomEvidence: axiomEvidence(definition.gate),
      sourceRevision,
      lowerGateDigests: [...lowerDigests],
      schemaCatalogDigest: catalogDigest,
      commands: definition.commands.map(({ display }) => display),
      testFiles: await testEvidence(definition.testFiles),
      deterministicSeeds: [
        "committed deterministic IDs, named barriers, and zero-jitter schedules",
      ],
      environment,
      startedAt,
      completedAt,
      cleanup: "PASS",
      findings: findingIdsThrough(definition.gate),
      subgates: definition.gate === "AX1"
        ? ["AX1-P", "AX1-T", "AX1-B", "AX1-L", "AX1-D"]
          .map((id) => ({ id, status: "PASS" }))
        : [],
    };
    assertValid(validateEvidence, manifest, `${definition.gate} evidence`);
    const document = `${JSON.stringify(manifest, null, 2)}\n`;
    const filename = `${definition.gate}.json`;
    await writeFile(path.join(stageRoot, filename), document, "utf8");
    const sha256 = digest(document);
    lowerDigests.push(sha256);
    gateEvidence.push({ gate: definition.gate, path: filename, sha256 });
  }

  await assertProcessCleanup();
  const issuedAt = new Date().toISOString();
  const certificate = {
    schemaVersion: "agp.verification-certificate/v1",
    title: "AGP ARTIFACT — SANDBOX VERIFIED",
    status: "PASS",
    scope: "AGP artifact sandbox",
    sourceRevision,
    issuedAt,
    artifactRoot: `artifacts/verification/${sourceRevision}`,
    schemaCatalogDigest: catalogDigest,
    evidenceDigest: digest(
      gateEvidence.map(({ gate, sha256 }) => `${gate}:${sha256}`).join("\n"),
    ),
    gateEvidence,
    claims: {
      A9: "sandbox-derived partial evidence",
      A14: "finding-lifecycle subset evidence",
      A0: "lineage context only; not certified",
    },
    environment,
    findings: findings.map(({ id }) => id).sort(),
    cleanup: "PASS",
  };
  assertValid(validateCertificate, certificate, "artifact certificate");
  await writeFile(
    path.join(stageRoot, "AGP-ARTIFACT-CERTIFICATE.json"),
    `${JSON.stringify(certificate, null, 2)}\n`,
    "utf8",
  );
  await rename(stageRoot, finalRoot);
  process.stdout.write(
    `\nAGP ARTIFACT — SANDBOX VERIFIED\n`
      + `${path.relative(root, finalRoot)}\n`,
  );
} catch (error) {
  await rm(stageRoot, { recursive: true, force: true });
  throw error;
}

function gate(gateName, testFiles, commands) {
  return Object.freeze({
    gate: gateName,
    testFiles: [...new Set(testFiles)].sort(),
    commands,
  });
}

function npm(...args) {
  return Object.freeze({
    executable: "npm",
    args,
    display: `npm ${args.map(shellWord).join(" ")}`,
  });
}

function nodeTestsCommand(files) {
  const ordered = [...new Set(files)].sort();
  return Object.freeze({
    executable: process.execPath,
    args: ["--test", "--test-concurrency=1", ...ordered],
    display: `node --test --test-concurrency=1 ${ordered.map(shellWord).join(" ")}`,
  });
}

function shellWord(value) {
  return /^[A-Za-z0-9_@./:=+-]+$/u.test(value)
    ? value
    : `'${value.replaceAll("'", "'\\''")}'`;
}

async function run(command) {
  process.stdout.write(`$ ${command.display}\n`);
  await new Promise((resolve, reject) => {
    const child = spawn(command.executable, command.args, {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "test" },
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal !== null) {
        reject(new Error(`${command.display} terminated by ${signal}`));
      } else if (code !== 0) {
        reject(new Error(`${command.display} exited ${code ?? "unknown"}`));
      } else {
        resolve();
      }
    });
  });
}

async function collectTests(targets) {
  const output = [];
  for (const target of targets) await walk(path.join(root, target), output);
  return output.sort();
}

async function walk(target, output) {
  const entries = await readdir(target, { withFileTypes: true });
  for (const entry of entries) {
    const candidate = path.join(target, entry.name);
    if (entry.isDirectory()) await walk(candidate, output);
    else if (entry.isFile() && entry.name.endsWith(".test.js")) {
      output.push(path.relative(root, candidate));
    }
  }
}

function pick(files, basenames) {
  const requested = new Set(basenames);
  const selected = files.filter((file) => requested.has(path.basename(file)));
  for (const basename of requested) {
    if (!selected.some((file) => path.basename(file) === basename)) {
      throw new Error(`required certification test is missing: ${basename}`);
    }
  }
  return selected;
}

async function testEvidence(files) {
  return Promise.all(files.map(async (relative) => {
    const source = await readFile(path.join(root, relative), "utf8");
    const cases = source.match(
      /^\s*(?:test|it)\s*\(/gmu,
    )?.length ?? 0;
    if (cases < 1) throw new Error(`${relative} has no certifiable test case`);
    return {
      path: relative,
      sha256: digest(source),
      cases,
    };
  }));
}

async function loadFindings() {
  const directory = path.join(root, "artifacts/verification/findings");
  const names = (await readdir(directory))
    .filter((name) => name.endsWith(".json"))
    .sort();
  const values = [];
  for (const name of names) {
    const value = JSON.parse(await readFile(path.join(directory, name), "utf8"));
    for (const field of [
      "id",
      "capturedAt",
      "discoveredAtGate",
      "sourceRevision",
      "observedFault",
      "triageOwner",
      "owningLayer",
      "status",
      "rootCause",
    ]) {
      if (typeof value[field] !== "string" || value[field].length === 0) {
        throw new Error(`${name} lacks finding field ${field}`);
      }
    }
    if (value.sourceRevision !== sourceRevision) {
      throw new Error(`${name} belongs to another source revision`);
    }
    if (value.status === "fixed") {
      for (const field of ["designInvariant", "regressionTest"]) {
        if (typeof value[field] !== "string" || value[field].length === 0) {
          throw new Error(`${name} fixed finding lacks ${field}`);
        }
      }
    } else if (value.status === "explicitly-deferred") {
      for (const field of ["deferralReason", "deferralAuthority"]) {
        if (typeof value[field] !== "string" || value[field].length === 0) {
          throw new Error(`${name} deferred finding lacks ${field}`);
        }
      }
    } else {
      throw new Error(`${name} has release-blocking status ${value.status}`);
    }
    values.push(value);
  }
  return values;
}

function findingIdsThrough(gateName) {
  const ordinal = Number(gateName.slice(2));
  return findings
    .filter(({ discoveredAtGate }) =>
      /^AX[0-8]$/u.test(discoveredAtGate)
      && Number(discoveredAtGate.slice(2)) <= ordinal
    )
    .map(({ id }) => id)
    .sort();
}

function axiomEvidence(gateName) {
  const mechanics = (reference) => ({
    reference,
    scope: "agp-scoped-mechanics",
  });
  const byGate = {
    AX0: [mechanics("A4"), mechanics("A8"), {
      reference: "A14",
      scope: "agp-subset-partial",
    }],
    AX1: [mechanics("A3"), mechanics("A4"), mechanics("A8")],
    AX2: [mechanics("A8")],
    AX3: [mechanics("A8")],
    AX4: [mechanics("A8")],
    AX5: [mechanics("A3"), mechanics("A8")],
    AX6: [mechanics("A4"), mechanics("A8")],
    AX7: [mechanics("A8")],
    AX8: [mechanics("A8"), {
      reference: "A9",
      scope: "sandbox-derived-partial",
    }, {
      reference: "A14",
      scope: "agp-subset-partial",
    }],
  };
  return byGate[gateName];
}

async function assertProcessCleanup() {
  const entries = await readdir("/proc", { withFileTypes: true });
  const targets = [
    "/examples/independent-hub-spokes/node.mjs",
    "/examples/hub-two-spokes.mjs",
    "/examples/loopback-hub-spokes/example.mjs",
    "/test/e2e/support/uniform-node-process.mjs",
  ];
  const leaked = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^\d+$/u.test(entry.name)) continue;
    if (Number(entry.name) === process.pid) continue;
    try {
      const document = await readFile(`/proc/${entry.name}/cmdline`);
      const args = document.toString("utf8").split("\0").filter(Boolean);
      if (args.some((argument) =>
        targets.some((target) => argument.endsWith(target))
      )) {
        leaked.push(`${entry.name}:${args.join(" ")}`);
      }
    } catch {
      // A process may exit between directory enumeration and cmdline read.
    }
  }
  if (leaked.length > 0) {
    throw new Error(`AGP process cleanup failed:\n${leaked.join("\n")}`);
  }
}

async function json(relative) {
  return JSON.parse(await readFile(path.join(root, relative), "utf8"));
}

async function digestFile(relative) {
  return digest(await readFile(path.join(root, relative)));
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertValid(validate, value, label) {
  if (!validate(value)) {
    throw new Error(`${label} is invalid: ${ajv.errorsText(validate.errors)}`);
  }
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}
