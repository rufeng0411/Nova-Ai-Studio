#!/usr/bin/env node
/** Generate minimal fixtures for document-import smoke tests. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(REPO, "artifacts", "document-import-fixtures");
fs.mkdirSync(OUT, { recursive: true });

fs.writeFileSync(
  path.join(OUT, "sample.md"),
  "# Import Smoke\n\nThis is a text fixture for document-import smoke.\n\nParagraph two with enough characters to pass charCount checks when converted.\n",
);

const xlsxScript = `
import ExcelJS from 'exceljs';
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet('Sheet1');
ws.addRow(['Name', 'Value']);
ws.addRow(['Alpha', '1']);
ws.addRow(['Beta', '2']);
await wb.xlsx.writeFile(${JSON.stringify(path.join(OUT, "sample.xlsx"))});
`;
spawnSync(process.execPath, ["--input-type=module", "-e", xlsxScript], { cwd: REPO, stdio: "inherit" });

const docxScript = `
import fs from 'node:fs';
const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
fs.writeFileSync(${JSON.stringify(path.join(OUT, "corrupt.docx"))}, zipHeader);
`;
spawnSync(process.execPath, ["--input-type=module", "-e", docxScript], { cwd: REPO, stdio: "inherit" });

console.log(`[generate-document-import-fixtures] wrote ${OUT}`);
