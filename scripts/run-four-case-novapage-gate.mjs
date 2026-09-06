#!/usr/bin/env node
/** PD-SAAS-FORK P0′: offline four-case novapage SDM/unit gate */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gate = process.argv.includes("--gate");

const vitestArgs = [
  "vitest",
  "run",
  "tests/saas/four-case-novapage-p0prime.test.ts",
  "tests/saas/shouldBlockDeliverableSubagent.test.ts",
  "tests/saas/officeExtensionStrict.test.ts",
];

const result = spawnSync("npx", vitestArgs, {
  stdio: "inherit",
  shell: process.platform === "win32",
  cwd: REPO_ROOT,
  env: {
    ...process.env,
    PILOTDECK_SESSION_DELIVERABLE_MANIFEST: "1",
    PILOTDECK_CHECKLIST_AUTHORITY_TEMPLATES: "1",
    PILOTDECK_BLOCK_DELIVERABLE_SUBAGENT: "1",
    PILOTDECK_OFFICE_EXTENSION_STRICT: "shadow",
  },
});

const code = result.status === 0 ? 0 : result.status ?? 1;
if (code === 0) {
  console.log("[four-case-novapage] offline gate PASS");
} else if (gate) {
  console.error("[four-case-novapage] offline gate FAIL");
}
process.exit(code);
