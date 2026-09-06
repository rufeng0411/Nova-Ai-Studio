#!/usr/bin/env node
/**
 * PD-SAAS-FORK VAP P3: 8-case visual binding gateway gate.
 * Offline: fixture + unit replay. Live Gateway requires dev:saas (see docs).
 *
 * Usage: node --import tsx scripts/run-visual-binding-live-gateway.mjs [--gate] [--live]
 */

import { spawnSync } from "node:child_process";

const gate = process.argv.includes("--gate");
const live = process.argv.includes("--live");

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("node", ["--import", "tsx", "scripts/run-visual-asset-binding-acceptance.mjs", ...(gate ? ["--gate"] : [])]);
run("node", ["--import", "tsx", "scripts/replay-g700-visual-binding-eight-cases.mjs", ...(gate ? ["--gate"] : [])]);

if (live) {
  console.log("[visual-binding:live:gate] LIVE Gateway replay requires dev:saas + workers=1.");
  console.log("Set PILOTDECK_VISUAL_BINDING_AUDIT=enforce PILOTDECK_VAP_BIND_BEFORE_WRITE=1 and replay G700 eight cases.");
  run("node", ["--import", "tsx", "scripts/run-vap-acquisition-live-matrix.mjs", ...(gate ? ["--gate"] : [])]);
} else if (gate) {
  console.log("[visual-binding:live:gate] offline structural gate PASS (add --live for Gateway matrix)");
}
