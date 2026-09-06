#!/usr/bin/env node
/**
 * Smoke: export_document fixtures → PDF + DOCX + PPTX (+ XLSX when exceljs present).
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = path.join(REPO_ROOT, "artifacts", "document-export-fixtures");
const OUT_DIR = path.join(REPO_ROOT, "artifacts", "document-export-smoke");

function fail(message) {
  console.error(`[document-export-smoke] FAIL: ${message}`);
  process.exit(1);
}

function runExport(format, sourceRel, outName) {
  const source = path.join(FIXTURES, sourceRel);
  const output = path.join(OUT_DIR, outName);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const script = `
import { routeExportDocument } from './dist/src/saas/document-export/router.js';
import { closePlaywrightPool } from './dist/src/saas/document-export/playwrightPool.js';
import { resolveDocumentExportConfig } from './dist/src/pilot/config/resolveDocumentToolConfig.js';

process.env.PILOTDECK_EXPORT_CLOSE_POOL = '1';
const result = await routeExportDocument({
  sourceAbsolutePath: ${JSON.stringify(source)},
  sourcePath: ${JSON.stringify(`artifacts/document-export-fixtures/${sourceRel}`)},
  workspaceRoot: ${JSON.stringify(REPO_ROOT)},
  outputFormat: ${JSON.stringify(format)},
  outputAbsolutePath: ${JSON.stringify(output)},
  ctx: {
    cwd: ${JSON.stringify(REPO_ROOT)},
    env: process.env,
    documentExport: resolveDocumentExportConfig(undefined, process.env),
  },
});
console.log(JSON.stringify(result));
await closePlaywrightPool();
`;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: 180000,
  });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    fail(`export ${format} from ${sourceRel}`);
  }
  if (!fs.existsSync(output)) {
    fail(`missing output ${output}`);
  }
  const size = fs.statSync(output).size;
  if (size < 200) {
    fail(`${outName} too small (${size} bytes)`);
  }
  console.log(`[document-export-smoke] OK ${format} → ${outName} (${size} bytes)`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const genFixtures = spawnSync(process.execPath, [path.join(REPO_ROOT, "scripts", "generate-document-export-fixtures.mjs")], {
  cwd: REPO_ROOT,
  encoding: "utf8",
});
if (genFixtures.status !== 0) {
  console.error(genFixtures.stderr || genFixtures.stdout);
  fail("generate-document-export-fixtures failed");
}

if (!fs.existsSync(path.join(REPO_ROOT, "dist", "src", "saas", "document-export", "router.js"))) {
  const build = spawnSync("npm", ["run", "build"], { cwd: REPO_ROOT, encoding: "utf8", shell: true });
  if (build.status !== 0) {
    console.error(build.stderr || build.stdout);
    fail("npm run build failed");
  }
}

runExport("pdf", "sample-report.md", "report.pdf");
runExport("docx", "sample-report.md", "report.docx");
runExport("pptx", "sample-report.md", "report.pptx");
runExport("pdf", "sample-simple.html", "page.pdf");
runExport("pptx", "sample-simple.html", "page.pptx");
runExport("xlsx", "sample-simple.html", "table.xlsx");
runExport("xlsx", "sample-table.csv", "table-from-csv.xlsx");
runExport("pdf", "sample-table.csv", "table-from-csv.pdf");

console.log("[document-export-smoke] all checks passed");
