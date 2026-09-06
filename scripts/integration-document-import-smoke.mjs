#!/usr/bin/env node
/**
 * Smoke: document-import local providers + optional MinerU cloud.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = path.join(REPO, "artifacts", "document-import-fixtures");
const OUT = path.join(REPO, "artifacts", "document-import-smoke");
const REPORT = path.join(OUT, "report.json");

function fail(msg) {
  console.error(`[document-import-smoke] FAIL: ${msg}`);
  process.exit(1);
}

function runImport(sourceRel, kind) {
  const source = path.join(FIXTURES, sourceRel);
  if (!fs.existsSync(source)) return { id: kind, status: "skip", reason: "fixture missing" };
  const script = `
import { routeImportDocument } from './dist/src/saas/document-import/router.js';
import { resolveDocumentImportFromTools } from './dist/src/pilot/config/resolveDocumentImportConfig.js';

const resolved = resolveDocumentImportFromTools(undefined, undefined, process.env);
const result = await routeImportDocument({
  sourceAbsolutePath: ${JSON.stringify(source)},
  sourcePath: ${JSON.stringify(`artifacts/document-import-fixtures/${sourceRel}`)},
  workspaceRoot: ${JSON.stringify(REPO)},
  ctx: {
    workspaceRoot: ${JSON.stringify(REPO)},
    documentImport: resolved.documentImport,
    ocr: resolved.ocr,
    env: process.env,
  },
});
console.log(JSON.stringify(result));
`;
  const started = Date.now();
  const proc = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: REPO,
    encoding: "utf8",
    timeout: 120000,
  });
  if (proc.status !== 0) {
    return { id: kind, status: "fail", error: proc.stderr || proc.stdout, durationMs: Date.now() - started };
  }
  const result = JSON.parse(proc.stdout.trim());
  return {
    id: kind,
    status: result.status,
    providerId: result.providerId,
    charCount: result.charCount,
    durationMs: Date.now() - started,
    outputPreview: (result.text ?? result.reason ?? "").slice(0, 200),
    error: result.reason,
  };
}

fs.mkdirSync(OUT, { recursive: true });
spawnSync(process.execPath, [path.join(REPO, "scripts", "generate-document-import-fixtures.mjs")], {
  cwd: REPO,
  stdio: "inherit",
});

if (!fs.existsSync(path.join(REPO, "dist", "src", "saas", "document-import", "router.js"))) {
  const build = spawnSync("npm", ["run", "build"], { cwd: REPO, encoding: "utf8", shell: true });
  if (build.status !== 0) fail("npm run build failed");
}

const scenarios = [
  runImport("sample.xlsx", "xlsx"),
  runImport("corrupt.docx", "corrupt-docx"),
];

const summary = {
  pass: scenarios.filter((s) => s.status === "ok").length,
  skip: scenarios.filter((s) => s.status === "skipped" || s.status === "skip" || s.status === "insufficient_content").length,
  fail: scenarios.filter((s) => s.status === "fail" || s.status === "failed").length,
};

const report = {
  ok: summary.fail === 0,
  generatedAt: new Date().toISOString(),
  scenarios,
  summary,
  env: {
    node: process.version,
    mineruToken: Boolean(process.env.MINERU_API_TOKEN),
  },
};

fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));

if (process.argv.includes("--write-report")) {
  const mdPath = path.join(REPO, "docs", `document-import-test-report-${new Date().toISOString().slice(0, 10)}.md`);
  const lines = [
    "# Document Import Smoke Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "| Scenario | Status | Provider | Chars | ms |",
    "|----------|--------|----------|-------|-----|",
    ...scenarios.map((s) => `| ${s.id} | ${s.status} | ${s.providerId ?? "-"} | ${s.charCount ?? "-"} | ${s.durationMs ?? "-"} |`),
    "",
    `Summary: pass=${summary.pass} skip=${summary.skip} fail=${summary.fail}`,
  ];
  fs.writeFileSync(mdPath, lines.join("\n"));
  console.log(`[document-import-smoke] markdown → ${mdPath}`);
}
for (const s of scenarios) {
  console.log(`[document-import-smoke] ${s.id}: ${s.status} ${s.providerId ?? ""} ${s.charCount ?? ""}`);
}

if (summary.fail > 0) fail(`${summary.fail} scenario(s) failed`);
if (!scenarios.some((s) => s.id === "xlsx" && s.status === "ok")) {
  fail("xlsx scenario must pass");
}
if (!scenarios.some((s) => s.id === "corrupt-docx" && (s.status === "skipped" || s.status === "fail" || s.status === "insufficient_content"))) {
  fail("corrupt-docx must fail gracefully");
}
console.log(`[document-import-smoke] OK report → ${REPORT}`);
