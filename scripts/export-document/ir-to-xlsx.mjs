#!/usr/bin/env node
/** Document IR JSON → XLSX via exceljs */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';

const args = process.argv.slice(2);
function readArg(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const irPath = readArg('--ir');
const output = readArg('--output');
if (!irPath || !output) {
  console.error('Usage: ir-to-xlsx.mjs --ir <ir.json> --output <file.xlsx>');
  process.exit(1);
}

const ir = JSON.parse(readFileSync(path.resolve(irPath), 'utf8'));
const workbook = new ExcelJS.Workbook();
let sheetIndex = 0;

function nextSheet(name) {
  sheetIndex += 1;
  const title = name.slice(0, 31) || `Sheet${sheetIndex}`;
  return workbook.addWorksheet(title);
}

let sheet = nextSheet(ir.title || 'Data');
let rowPtr = 1;

for (const block of ir.blocks || []) {
  if (block.type === 'heading') {
    sheet.getRow(rowPtr).values = [block.text];
    rowPtr += 1;
  } else if (block.type === 'paragraph') {
    sheet.getRow(rowPtr).values = [block.text];
    rowPtr += 1;
  } else if (block.type === 'table') {
    if (rowPtr > 1) {
      sheet = nextSheet(block.headers?.[0] || 'Table');
      rowPtr = 1;
    }
    sheet.addRow(block.headers || []);
    for (const row of block.rows || []) {
      sheet.addRow(row);
    }
    rowPtr = sheet.rowCount + 2;
  } else if (block.type === 'pageBreak') {
    sheet = nextSheet('Continued');
    rowPtr = 1;
  }
}

if (workbook.worksheets.length === 0) {
  workbook.addWorksheet('Data').addRow(['(empty)']);
}

const outPath = path.resolve(output);
await workbook.xlsx.writeFile(outPath);
console.log(outPath);
