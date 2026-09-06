// PD-SAAS-FORK: map file extension to import kind
import path from "node:path";
import type { ImportKind } from "./types.js";

const DOCX_EXT = new Set([".docx", ".doc"]);
const XLSX_EXT = new Set([".xlsx", ".xls"]);
const PPTX_EXT = new Set([".pptx", ".ppt"]);
const CSV_EXT = new Set([".csv", ".tsv"]);

export function detectImportKind(filePath: string): ImportKind {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (DOCX_EXT.has(ext)) return "docx";
  if (XLSX_EXT.has(ext)) return "xlsx";
  if (PPTX_EXT.has(ext)) return "pptx";
  if (CSV_EXT.has(ext)) return "csv";
  return "unknown";
}

export function isOfficeImportKind(kind: ImportKind): boolean {
  return kind === "docx" || kind === "xlsx" || kind === "pptx" || kind === "csv";
}

export function maxBytesForKind(
  kind: ImportKind,
  limits: { pdf: number; office: number },
): number {
  return kind === "pdf" ? limits.pdf : limits.office;
}
