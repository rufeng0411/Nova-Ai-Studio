// PD-SAAS-FORK: CSV/TSV/XLSX → Document IR tables
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentIr } from "./types.js";

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function detectDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/)[0] ?? "";
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return tabs > commas ? "\t" : ",";
}

async function parseDelimitedFile(
  relative: string,
  content: string,
  delimiter?: string,
): Promise<DocumentIr> {
  const delim = delimiter ?? detectDelimiter(content);
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { sourcePath: relative, sourceKind: "spreadsheet", blocks: [] };
  }
  const rows = lines.map((l) => parseCsvLine(l, delim));
  const headers = rows[0] ?? [];
  const dataRows = rows.slice(1);
  return {
    sourcePath: relative,
    sourceKind: "spreadsheet",
    title: path.basename(relative, path.extname(relative)),
    blocks: [{ type: "table", headers, rows: dataRows }],
  };
}

async function parseXlsxFile(relative: string, absolutePath: string): Promise<DocumentIr> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(absolutePath);
  const blocks: DocumentIr["blocks"] = [];
  for (const sheet of workbook.worksheets) {
    if (!sheet || sheet.rowCount === 0) continue;
    blocks.push({ type: "heading", level: 2, text: sheet.name });
    const rows: string[][] = [];
    sheet.eachRow((row) => {
      const values = (row.values as unknown[]) ?? [];
      const cells = values.slice(1).map((v) => (v == null ? "" : String(v)));
      if (cells.some((c) => c.trim())) rows.push(cells);
    });
    if (rows.length === 0) continue;
    const headers = rows[0] ?? [];
    const dataRows = rows.slice(1);
    blocks.push({ type: "table", headers, rows: dataRows });
  }
  return {
    sourcePath: relative,
    sourceKind: "spreadsheet",
    title: path.basename(relative, path.extname(relative)),
    blocks,
  };
}

export async function parseSpreadsheetToIr(
  sourceAbsolutePath: string,
  workspaceRoot: string,
): Promise<DocumentIr> {
  const relative = path.relative(workspaceRoot, sourceAbsolutePath).split(path.sep).join("/");
  const ext = path.extname(sourceAbsolutePath).toLowerCase();
  if (ext === ".xlsx" || ext === ".xls") {
    return parseXlsxFile(relative, sourceAbsolutePath);
  }
  const content = await readFile(sourceAbsolutePath, "utf8");
  const delimiter = ext === ".tsv" ? "\t" : undefined;
  return parseDelimitedFile(relative, content, delimiter);
}
