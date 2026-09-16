import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const kernel = resolve(root, "../cli");
function run(command, args, extra = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", ...extra });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const kernelEnvironment = { ...process.env, CARGO_TARGET_DIR: resolve(kernel, "target") };
const nativeEnvironment = { ...process.env, CARGO_TARGET_DIR: resolve(root, "rustcli/target") };
run("cargo", ["build", "--locked", "--manifest-path", resolve(kernel, "Cargo.toml"), "--bin", "cli"], { env: kernelEnvironment });
run("cargo", ["build", "--locked", "--manifest-path", "rustcli/Cargo.toml"], { env: nativeEnvironment });
run("cargo", ["clippy", "--locked", "--manifest-path", "rustcli/Cargo.toml", "--all-targets", "--", "-D", "warnings"], { env: nativeEnvironment });
run("cargo", ["fmt", "--manifest-path", "rustcli/Cargo.toml", "--", "--check"]);
run(process.execPath, ["rustcli/scripts/author-specs.mjs"], {
  env: { ...process.env, CLI_KERNEL_BIN: resolve(kernel, "target/debug/cli") },
});
run("npm", ["run", "build"]);
run("npm", ["run", "docs:check"]);
run("npm", ["run", "test:architecture"]);
run(process.execPath, ["scripts/run-tests.mjs", "rustcli/test"], {
  env: { ...process.env, AGP_RUST_CLI: resolve(root, "rustcli/target/debug/agp") },
});
run(process.execPath, ["scripts/run-tests.mjs", "test/e2e"], {
  env: { ...process.env, AGP_TEST_CLI: resolve(root, "rustcli/target/debug/agp") },
});
