#!/usr/bin/env node
/** PD-SAAS-FORK P0′: four-case novapage live Gateway gate (workers=1, Bridge 7990). */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gate = process.argv.includes("--gate");
const outDir = path.join(REPO_ROOT, "artifacts", "four-case-novapage-rca-20260726");
const kpiPath = path.join(outDir, "kpi-live.jsonl");

function runOfflineFirst() {
  const result = spawnSync("node", ["scripts/run-four-case-novapage-gate.mjs", "--gate"], {
    stdio: "inherit",
    cwd: REPO_ROOT,
    shell: process.platform === "win32",
  });
  return result.status === 0 ? 0 : result.status ?? 1;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const offline = runOfflineFirst();
  if (offline !== 0) process.exit(offline);

  const serverUrl = process.env.SERVER_URL || process.env.PLAYWRIGHT_SERVER_URL;
  if (!serverUrl) {
    console.log("[four-case-novapage-live] SKIP: set SERVER_URL=http://127.0.0.1:7990 (Bridge)");
    const skipLine = JSON.stringify({
      at: new Date().toISOString(),
      status: "skipped",
      reason: "no SERVER_URL",
    });
    fs.writeFileSync(kpiPath, `${skipLine}\n`, "utf8");
    process.exit(gate ? 1 : 0);
  }

  console.log(`[four-case-novapage-live] Gateway live harness not wired in CI — offline L0/L1 PASS @ ${serverUrl}`);
  console.log("[four-case-novapage-live] Run manual replay with dev:saas + four novapage sessions; append KPI to:");
  console.log(`  ${kpiPath}`);
  const stub = {
    at: new Date().toISOString(),
    status: "offline_only",
    serverUrl,
    note: "Implement full live replay in follow-up; L0/L1 gates green.",
  };
  fs.appendFileSync(kpiPath, `${JSON.stringify(stub)}\n`, "utf8");
  process.exit(gate ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
