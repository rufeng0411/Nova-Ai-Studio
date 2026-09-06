#!/usr/bin/env node
/** PD-SAAS-FORK: UDC R11 full gate */
import { spawnSync } from "node:child_process";

const steps = [
  ["export", "npm", ["run", "test:deliverable-triple-unify:export"]],
  ["0709-live", "npm", ["run", "test:goal-loop:0709-live"]],
  ["sdm-unit", "npm", ["run", "test:sdm:unit"]],
  ["rog-phase8-2", "npm", ["run", "test:rog-phase8-2:unit"]],
  ["0708-batch", "npm", ["run", "test:goal-loop:0708-batch"]],
];

let failed = 0;
for (const [name, cmd, args] of steps) {
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: true });
  if ((result.status ?? 1) !== 0) {
    console.error(`[deliverable-triple-unify] FAIL: ${name}`);
    failed += 1;
  } else {
    console.log(`[deliverable-triple-unify] PASS: ${name}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
