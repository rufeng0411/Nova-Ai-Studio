#!/usr/bin/env node
// PD-SAAS-FORK: L2 HyperFrames Gateway live gate (requires dev:saas)
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  return {
    gate: argv.includes("--gate"),
    skipLive: argv.includes("--skip-live"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log("[test:hyperframes:live] running L0 smoke first...");
  const smoke = spawnSync(process.execPath, ["scripts/smoke-hyperframes.mjs"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (smoke.status === 2) {
    console.log("[test:hyperframes:live] SKIP live: ffprobe/hyperframes CLI unavailable");
    process.exit(args.gate ? 1 : 0);
  }
  if (smoke.status !== 0) {
    process.exit(smoke.status ?? 1);
  }

  console.log("[test:hyperframes:live] running L1 unit...");
  const unit = spawnSync(
    process.execPath,
    ["node_modules/vitest/vitest.mjs", "run", "tests/saas/hyperframes-engine.test.ts"],
    { cwd: REPO_ROOT, stdio: "inherit", env: process.env },
  );
  if (unit.status !== 0) process.exit(unit.status ?? 1);

  if (args.skipLive) {
    console.log("[test:hyperframes:live] SKIP Gateway live (--skip-live)");
    process.exit(0);
  }

  const serverUrl = process.env.SERVER_URL || process.env.PLAYWRIGHT_SERVER_URL || "http://127.0.0.1:7990";
  console.log(`[test:hyperframes:live] Gateway live harness against ${serverUrl} — placeholder until harness case wired`);
  if (args.gate) {
    console.error("[test:hyperframes:live] GATE: Gateway live case not yet wired — run manual Hub hf-hyperframes 10s acceptance");
    process.exit(1);
  }
  console.log("[test:hyperframes:live] PASS (L0+L1; live harness pending wiring)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
