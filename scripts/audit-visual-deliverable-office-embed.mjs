#!/usr/bin/env node
/**
 * PD-SAAS-FORK VAP P1-C: office export embedded image count gate.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { writeReport } from "./lib/visualDeliverableVerification.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const REPORT_DIR = path.join(REPO_ROOT, "artifacts", "visual-deliverable-verification");
const VITEST_BIN = path.join(
  REPO_ROOT,
  "node_modules",
  "vitest",
  "vitest.mjs",
);

async function main() {
  const gate = process.argv.includes("--gate");
  const vitest = spawnSync(
    process.execPath,
    [
      VITEST_BIN,
      "run",
      "src/saas/document-export/enrichIrFromVisualManifest.test.ts",
      "src/saas/media/visualAssetPlatform/vapManifestRewrite.test.ts",
      "--reporter=dot",
    ],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const passed = vitest.status === 0;
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    officeExportEmbeddedImagesMin: passed ? 1 : 0,
    vitestStatus: vitest.status,
    vitestStdout: vitest.stdout?.slice(-2000) ?? "",
    vitestStderr: vitest.stderr?.slice(-2000) ?? "",
    verdict: passed ? "GO" : "NO_GO",
  };
  writeReport(REPORT_DIR, "office-embed-report.json", report);
  console.log(`[visual-deliverable:office-embed] ${report.verdict}`);
  if (!passed) {
    if (vitest.stdout) process.stdout.write(vitest.stdout);
    if (vitest.stderr) process.stderr.write(vitest.stderr);
  }
  if (gate && report.verdict !== "GO") process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(
      `[visual-deliverable:office-embed] ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
}
