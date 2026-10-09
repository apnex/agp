import { readFile } from "node:fs/promises";

const axes = ["geometry", "transport", "traffic", "routes"];
const unique = (values) => [...new Set(values)].sort();
const matches = (cell, when) => Object.entries(when).every(([axis, values]) => values.includes(cell[axis]));

export async function readMatrixCoverage() {
  return JSON.parse(await readFile(new URL("../docs/design/matrix-coverage.json", import.meta.url), "utf8"));
}

/** Reject silent omissions and misspelled conditions before constructing any topology. */
export function validateMatrixCoverage(model) {
  if (model.schemaVersion !== 1) throw new Error("Unsupported matrix coverage version");
  if (Object.keys(model.dimensions).sort().join() !== [...axes].sort().join()) {
    throw new Error("Matrix coverage must declare exactly four axes");
  }
  for (const [axis, values] of Object.entries(model.dimensions)) {
    if (!Array.isArray(values) || values.length === 0 || unique(values).length !== values.length
      || values.some((value) => typeof value !== "string" || value.length === 0)) {
      throw new Error(`Invalid matrix dimension ${axis}`);
    }
  }
  for (const group of ["rules", "assertions", "exclusions"]) {
    const entries = model[group];
    if (!Array.isArray(entries) || entries.length === 0
      || unique(entries.map(({ id }) => id)).length !== entries.length) {
      throw new Error(`Invalid matrix ${group}`);
    }
    for (const entry of entries) {
      if (!entry.id || !entry.when || typeof entry.when !== "object" || Array.isArray(entry.when)) {
        throw new Error(`Invalid matrix ${group} entry`);
      }
      for (const [axis, values] of Object.entries(entry.when)) {
        if (!axes.includes(axis) || !Array.isArray(values) || values.length === 0
          || values.some((value) => !model.dimensions[axis].includes(value))) {
          throw new Error(`Invalid matrix condition ${entry.id}: ${axis}`);
        }
      }
      if (group === "rules" && (!entry.reason || !entry.source || !Array.isArray(entry.mechanisms)
        || entry.mechanisms.length === 0 || entry.mechanisms.some((id) => !/^M\d{2}$/u.test(id)))) {
        throw new Error(`Invalid matrix mechanism rule ${entry.id}`);
      }
      if (group === "assertions" && !entry.claim) throw new Error(`Missing claim ${entry.id}`);
      if (group === "exclusions" && (!entry.reason || !entry.owner)) throw new Error(`Missing exclusion owner ${entry.id}`);
    }
  }
}

/** Enumerate legal cells and retain the declarations that explain their coverage. */
export function enumerateMatrixCells(model, { geometry = "all", transport = "loopback" } = {}) {
  validateMatrixCoverage(model);
  const values = (axis, requested) => {
    if (requested === "all") return model.dimensions[axis];
    if (!model.dimensions[axis].includes(requested)) throw new Error(`Unknown matrix ${axis}: ${requested}`);
    return [requested];
  };
  const cells = [];
  for (const carrier of values("transport", transport)) {
    for (const shape of values("geometry", geometry)) {
      for (const traffic of model.dimensions.traffic) {
        for (const routes of model.dimensions.routes) {
          const cell = { geometry: shape, transport: carrier, traffic, routes };
          if (model.exclusions.some(({ when }) => matches(cell, when))) continue;
          const rules = model.rules.filter(({ when }) => matches(cell, when));
          const assertions = model.assertions.filter(({ when }) => matches(cell, when)).map(({ id }) => id);
          const mechanisms = unique(rules.flatMap((rule) => rule.mechanisms));
          const coverageKeys = unique([
            ...axes.map((axis) => `dimension:${axis}:${cell[axis]}`),
            ...mechanisms.map((id) => `mechanism:${id}`),
            ...assertions.map((id) => `assertion:${id}`),
          ]);
          cells.push({
            id: `${carrier}/${shape}/${traffic}/${routes}`, ...cell,
            exercisedMechanisms: mechanisms, rules: rules.map(({ id }) => id), assertions, coverageKeys,
          });
        }
      }
    }
  }
  if (cells.length === 0) throw new Error("Matrix selection has no legal cells");
  return cells;
}

export function collectMatrixCoverage(cells) {
  return unique(cells.flatMap(({ coverageKeys }) => coverageKeys));
}

/** Deterministic unweighted set cover, followed by redundant-cell removal; not a global minimum proof. */
export function selectMatrixCover(cells) {
  const remaining = new Set(collectMatrixCoverage(cells));
  const available = [...cells].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  const selected = [];
  while (remaining.size > 0) {
    let best;
    let gain = 0;
    for (const cell of available) {
      const count = cell.coverageKeys.filter((key) => remaining.has(key)).length;
      if (count > gain) { best = cell; gain = count; }
    }
    if (!best) throw new Error("Matrix coverage cannot be satisfied");
    selected.push(best);
    for (const key of best.coverageKeys) remaining.delete(key);
  }
  const target = collectMatrixCoverage(cells);
  for (let index = selected.length - 1; index >= 0; index -= 1) {
    const without = selected.filter((_, position) => index !== position);
    if (collectMatrixCoverage(without).length === target.length) selected.splice(index, 1);
  }
  return selected;
}

/** Resolve actual counts once so the plan and executor cannot disagree about depth or environment overrides. */
export function resolveMatrixParameters(model, { deep = false, env = process.env } = {}) {
  const defaults = model.profiles[deep ? "deep" : "default"];
  const parameters = {};
  for (const name of ["chain", "stream", "burst", "routes"]) {
    const variable = `AGP_DEEPEN_${name.toUpperCase()}`;
    const raw = env[variable];
    const value = raw === undefined ? defaults[name] : Number(raw);
    if (!Number.isSafeInteger(value) || value < 1 || (raw !== undefined && String(value) !== raw.trim())) {
      throw new Error(`${variable} must be a positive safe integer`);
    }
    parameters[name] = value;
  }
  if (parameters.chain < 3) throw new Error("Matrix chain requires at least three nodes");
  return parameters;
}
