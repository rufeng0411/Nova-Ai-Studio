#!/usr/bin/env node
/** Smoke: AttachmentResolver office routing (unit-level, no dev server). */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!spawnSync("node", ["-e", "require('fs').accessSync('dist/src/context/attachments/AttachmentResolver.js')"], { cwd: REPO }).status === 0) {
  spawnSync("npm", ["run", "build"], { cwd: REPO, stdio: "inherit", shell: true });
}

const script = `
import { AttachmentResolver } from './dist/src/context/attachments/AttachmentResolver.js';
import { resolveDocumentImportFromTools } from './dist/src/pilot/config/resolveDocumentImportConfig.js';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'artifacts', 'document-import-fixtures');
fs.mkdirSync(dir, { recursive: true });
const md = path.join(dir, 'attach-smoke.md');
fs.writeFileSync(md, '# attach\\n\\nhello attachment resolver smoke text content.\\n');

const resolved = resolveDocumentImportFromTools(undefined, undefined, process.env);
const resolver = new AttachmentResolver({
  workspaceRoot: process.cwd(),
  documentImport: {
    workspaceRoot: process.cwd(),
    documentImport: resolved.documentImport,
    ocr: resolved.ocr,
    env: process.env,
  },
});
const out = await resolver.resolve({ type: 'file', path: md });
if (!out.blocks.some((b) => b.type === 'text' && b.text.includes('hello attachment'))) {
  console.error('expected text block');
  process.exit(1);
}
console.log('OK attachment resolver text');
`;
const proc = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
  cwd: REPO,
  encoding: "utf8",
  timeout: 60000,
});
if (proc.status !== 0) {
  console.error(proc.stderr || proc.stdout);
  process.exit(1);
}
console.log("[document-import-attachment-smoke] PASS");
