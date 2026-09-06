#!/usr/bin/env node
/**
 * PD-SAAS-FORK: strict stop-on-fail VAP hardening gate (L0→L1→…).
 * Usage: node scripts/run-vap-hardening-strict.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(REPO, "artifacts", "vap-hardening-strict");

function runStep(id, command, args) {
  console.log(`\n=== ${id} ===\n> ${command} ${args.join(" ")}`);
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: REPO,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  const ms = Date.now() - started;
  const status = result.status === 0 ? "PASS" : "FAIL";
  console.log(`[${status}] ${id} (${ms}ms)`);
  return { id, status, ms, exitCode: result.status ?? 1 };
}

const steps = [
  {
    id: "L0-unit",
    command: "npx",
    args: [
      "vitest",
      "run",
      "src/saas/media/visualAssetPlatform/vapOutboundGate.test.ts",
      "src/saas/media/visualAssetPlatform/searchDiscovery.pack.test.ts",
      "src/saas/media/visualAssetPlatform/forceLadder.test.ts",
      "src/saas/media/visualAssetPlatform/visionImageLocate.test.ts",
      "src/saas/media/visualAssetPlatform/vapBindBeforeWrite.placeholder.test.ts",
      "src/saas/media/visualAssetPlatform/crawlerSidecar/client.test.ts",
    ],
  },
  {
    id: "L1-failure-cases",
    command: "node",
    args: ["--import", "tsx", "scripts/run-vap-failure-cases.mjs", "--gate"],
  },
  {
    id: "L1-0802-replay",
    command: "node",
    args: ["--import", "tsx", "scripts/run-vap-0802-replay.mjs", "--gate"],
  },
];

fs.mkdirSync(OUT_DIR, { recursive: true });
const report = { at: new Date().toISOString(), steps: [] };

for (const step of steps) {
  const row = runStep(step.id, step.command, step.args);
  report.steps.push(row);
  if (row.status === "FAIL") {
    fs.writeFileSync(
      path.join(OUT_DIR, "strict-report.json"),
      JSON.stringify(report, null, 2),
    );
    console.error(`\nSTOP: ${step.id} failed — fix before continuing.`);
    process.exit(1);
  }
}

report.verdict = "GO_SHADOW_CANDIDATE";
fs.writeFileSync(
  path.join(OUT_DIR, "strict-report.json"),
  JSON.stringify(report, null, 2),
);
console.log("\nStrict core steps PASS →", path.join(OUT_DIR, "strict-report.json"));
