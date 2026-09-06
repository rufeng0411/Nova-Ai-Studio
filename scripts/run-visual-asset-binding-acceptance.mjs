#!/usr/bin/env node
/**
 * PD-SAAS-FORK VAP: visual binding acceptance gate.
 * Usage: node --import tsx scripts/run-visual-asset-binding-acceptance.mjs [--gate]
 */

import { spawnSync } from "node:child_process";

const gate = process.argv.includes("--gate");

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx", ["vitest", "run", "tests/saas/deliverable-visual-binding-audit.test.ts"]);
run("npx", ["vitest", "run", "src/saas/taskState/detectGoalMutation.test.ts"]);

if (gate) {
  console.log("[visual-asset-binding:acceptance] gate PASS");
}
