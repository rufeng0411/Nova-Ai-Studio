#!/usr/bin/env node
/**
 * PD-SAAS-FORK: gate — audit hub prompts + try-prompt quality (semantic_dir).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("node", ["scripts/audit-hub-directory-prompts.mjs"]);

try {
  const { assertTryPromptQuality } = await import("./lib/capabilityTryPrompts.mjs");
  assertTryPromptQuality();
  console.log("[check-task-dir-prompts] try-prompt quality OK");
} catch (error) {
  console.error("[check-task-dir-prompts] try-prompt quality failed:", error);
  process.exit(1);
}
