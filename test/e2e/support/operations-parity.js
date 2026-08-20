import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const cli = fileURLToPath(new URL("../../../cli/agpctl", import.meta.url));

export const CONNECTION_COLUMNS = Object.freeze([
  "session_id",
  "remote_node",
  "direction",
  "state",
  "uptime",
  "ttl",
  "last_event",
]);

export const ROUTE_COLUMNS = Object.freeze([
  "selected",
  "endpoint",
  "route_class",
  "learned_kind",
  "next_hop",
  "origin_node",
  "path",
  "eligible",
  "reason",
]);

export class ParityIdSource {
  #namespace;
  #counts = new Map();

  constructor(namespace) {
    this.#namespace = namespace;
  }

  next(scope) {
    const count = (this.#counts.get(scope) ?? 0) + 1;
    this.#counts.set(scope, count);
    return scope === "session"
      ? count.toString(16).padStart(6, "0")
      : `${scope}-${this.#namespace}-${count}`;
  }
}

export function asManagementConnections(value) {
  return {
    apiVersion: "agp.management/v1",
    kind: "ConnectionList",
    meta: metaOf(value),
    items: value.items,
  };
}

export function asManagementRoutes(value) {
  return {
    apiVersion: "agp.management/v1",
    kind: "RouteTable",
    meta: metaOf(value),
    candidates: value.candidates,
    selected: value.selected,
  };
}

export async function getManagementJson(baseUrl, resource) {
  const response = await fetch(`${baseUrl}/v1/${resource}`);
  if (!response.ok) {
    throw new Error(`management ${resource} returned HTTP ${response.status}`);
  }
  return response.json();
}

export async function runCliJson(command, baseUrl) {
  const result = await execute(
    cli,
    [command, "--json", "--url", baseUrl],
    {
      env: { ...process.env, NO_COLOR: "1" },
      maxBuffer: 1_048_576,
    },
  );
  return JSON.parse(result.stdout);
}

export async function runCliTable(command, baseUrl) {
  const result = await execute(
    cli,
    [command, "--url", baseUrl],
    {
      env: { ...process.env, NO_COLOR: "1" },
      maxBuffer: 1_048_576,
    },
  );
  return result.stdout;
}

export function parseCliTable(output, columns) {
  const lines = output.trimEnd().split(/\r?\n/);
  const header = lines.shift();
  if (header === undefined) throw new Error("CLI table has no header");
  const labels = columns.map((column) => column.toUpperCase());
  const rows = [];

  if (header.includes("\t")) {
    const actual = header.split("\t");
    if (!sameValues(actual, labels)) throw new Error("CLI table header mismatch");
    for (const line of lines) {
      const values = line.split("\t");
      rows.push(Object.fromEntries(columns.map(
        (column, index) => [column, values[index] ?? ""],
      )));
    }
    return rows;
  }

  const positions = [];
  let cursor = 0;
  for (const label of labels) {
    const position = header.indexOf(label, cursor);
    if (position < 0) throw new Error(`CLI table header omits ${label}`);
    positions.push(position);
    cursor = position + label.length;
  }
  for (const line of lines) {
    rows.push(Object.fromEntries(columns.map((column, index) => {
      const start = positions[index];
      const end = positions[index + 1] ?? line.length;
      return [column, line.slice(start, end).trim()];
    })));
  }
  return rows;
}

export function connectionTableRows(items) {
  return items.map((session) => ({
    session_id: session.sessionId,
    remote_node: session.remoteNodeId ?? "",
    direction: session.direction,
    state: session.state,
    uptime: formatUptime(session.establishedDurationMs, session.state),
    ttl: formatTtl(session.timers),
    last_event: session.lastTransition.event,
  }));
}

export function routeTableRows(routes) {
  const selectedIds = new Set(routes.selected.map((route) => route.routeId));
  return routes.candidates.map((route) => ({
    selected: selectedIds.has(route.routeId) ? ">" : "",
    endpoint: route.endpoint,
    route_class: route.routeClass,
    learned_kind: route.learnedKind ?? "",
    next_hop: formatNextHop(route.nextHop),
    origin_node: route.originNodeId,
    path: route.path.join(">"),
    eligible: String(route.eligible),
    reason: route.selectionReason,
  }));
}

export function withoutLiveConnectionTime(response) {
  const value = structuredClone(response);
  delete value.meta.capturedAt;
  for (const session of value.items) {
    delete session.establishedDurationMs;
    for (const timer of session.timers) delete timer.remainingMs;
  }
  return value;
}

export function establishedDuration(response) {
  const value = response.items[0]?.establishedDurationMs;
  if (!Number.isSafeInteger(value)) {
    throw new Error("Established duration is unavailable");
  }
  return value;
}

export function holdRemaining(response) {
  const hold = response.items[0]?.timers.find(
    (timer) => timer.name === "hold" && timer.state === "armed",
  );
  if (!Number.isSafeInteger(hold?.remainingMs)) {
    throw new Error("armed hold remaining time is unavailable");
  }
  return hold.remainingMs;
}

export function parseUptime(value) {
  const match = /^(\d+):([0-5]\d):([0-5]\d)$/.exec(value);
  if (match === null) throw new Error(`invalid CLI uptime: ${value}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

export function parseTtl(value) {
  const match = /^(\d+)s$/.exec(value);
  if (match === null) throw new Error(`invalid CLI TTL: ${value}`);
  return Number(match[1]);
}

export async function eventuallyAsync(
  probe,
  description,
  timeoutMs = 5_000,
) {
  const deadline = performance.now() + timeoutMs;
  let lastError;
  while (performance.now() < deadline) {
    try {
      const value = await probe();
      if (value !== undefined && value !== false) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(
    `did not observe ${description}`
      + (lastError instanceof Error ? `: ${lastError.message}` : ""),
  );
}

function metaOf(value) {
  return {
    nodeId: value.nodeId,
    instanceId: value.instanceId,
    capturedAt: value.capturedAt,
    revision: value.revision,
  };
}

function sameValues(left, right) {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function formatUptime(durationMs, state) {
  if (state !== "Established" || !Number.isFinite(durationMs)) return "-";
  const total = Math.floor(durationMs / 1_000);
  const hours = Math.floor(total / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatTtl(timers) {
  const hold = timers.find(
    (timer) => timer.name === "hold" && timer.state === "armed",
  );
  if (!Number.isFinite(hold?.remainingMs)) return "-";
  return `${Math.max(0, Math.ceil(hold.remainingMs / 1_000))}s`;
}

function formatNextHop(nextHop) {
  if (nextHop?.kind === "local") return "local";
  if (nextHop?.kind === "session") {
    return `${nextHop.nodeId}@${nextHop.owningSessionId}`;
  }
  return "";
}
