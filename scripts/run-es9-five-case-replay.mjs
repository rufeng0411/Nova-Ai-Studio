#!/usr/bin/env node
/** PD-SAAS-FORK ES9: offline five-case SDM/acceptance replay gate */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const filterIdx = args.indexOf("--filter");
const filter = filterIdx >= 0 ? args[filterIdx + 1] : undefined;

const vitestArgs = [
  "vitest",
  "run",
  "tests/es9-three-case-replay.test.ts",
  "tests/saas/assistantCompletionGate.test.ts",
  "tests/saas/validateDeliverablesEngine.progress-alone.test.ts",
  "src/saas/deliverables/deliverableChecklistAuthority.test.ts",
];
if (filter) vitestArgs.push("-t", filter);

const result = spawnSync("npx", vitestArgs, {
  stdio: "inherit",
  shell: process.platform === "win32",
  cwd: REPO_ROOT,
  env: {
    ...process.env,
    PILOTDECK_SESSION_DELIVERABLE_MANIFEST: "1",
    PILOTDECK_CHECKLIST_AUTHORITY_TEMPLATES: "1",
    PILOTDECK_SDM_HTML_REPORT_ALIAS: "1",
    PILOTDECK_RESEARCH_PASSED_GT_STRICT_HTML: "1",
  },
});
process.exit(result.status === 0 ? 0 : 1);
