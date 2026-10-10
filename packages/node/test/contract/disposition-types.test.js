import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

test("Given the public node package, when a TypeScript consumer uses disposition methods, then their exact signatures compile and invalid calls are rejected", () => {
  const consumer = fileURLToPath(
    new URL("../fixtures/disposition-consumer.mts", import.meta.url),
  );
  const program = ts.createProgram([consumer], {
    noEmit: true,
    strict: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    types: ["node"],
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(ts.formatDiagnostics(diagnostics, {
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getCanonicalFileName: (fileName) => fileName,
    getNewLine: () => "\n",
  }), "");
});
