// PD-SAAS-FORK (P1-D, flag-gated): soft quality acceptance for finished text deliverables.
//
// Catches two structural quality defects that a model can produce while still emitting a
// "valid-looking" file, beyond the existing empty/placeholder/invalid-html checks:
//   1) inconsistent markdown table columns (body rows whose cell count diverges from the header),
//   2) a structured document (has headings / tables) that is essentially empty of prose.
//
// HIGH PRECISION by design: it only fires on clear defects (>=2 diverging rows; near-zero prose),
// and is SOFT — it marks needs_repair so the existing repair path improves the file. It NEVER
// hard-hides a parseable deliverable. Pure & deterministic for unit testing + telemetry tuning.

export type QualityDefectReason = "table_columns" | "too_short";

export type QualityVerdict = {
  defect: boolean;
  reason?: QualityDefectReason;
  detail?: Record<string, string | number>;
};

export type QualityConfig = {
  /** Min number of body rows whose column count diverges from the header before flagging a table. */
  minDivergingRows: number;
  /** Min visible prose chars for a doc that advertises structure (headings / tables). */
  minProseChars: number;
};

export const DEFAULT_QUALITY_CONFIG: QualityConfig = {
  minDivergingRows: 2,
  minProseChars: 24,
};

export function resolveQualityConfig(
  env: Record<string, string | undefined> = process.env,
): QualityConfig {
  return {
    minDivergingRows: positiveInt(env.PILOTDECK_QUALITY_MIN_DIVERGING_ROWS, DEFAULT_QUALITY_CONFIG.minDivergingRows),
    minProseChars: positiveInt(env.PILOTDECK_QUALITY_MIN_PROSE_CHARS, DEFAULT_QUALITY_CONFIG.minProseChars),
  };
}

function stripCodeFences(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "\n")
    .replace(/`[^`\n]*`/g, " ");
}

function isTableRow(line: string): boolean {
  return /^\|.*\|$/.test(line.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s:|-]+\|$/.test(line.trim());
}

/** Count markdown table cells, ignoring the outer pipes and respecting escaped \| inside cells. */
function countCells(line: string): number {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  // Split on unescaped pipes.
  const cells = trimmed.split(/(?<!\\)\|/);
  return cells.length;
}

/** Detect a markdown table whose body rows diverge from the header column count. */
function detectTableColumnDefect(lines: string[], minDivergingRows: number): QualityVerdict | null {
  let index = 0;
  while (index < lines.length) {
    const header = lines[index]!;
    const separator = lines[index + 1];
    if (isTableRow(header) && separator !== undefined && isTableSeparator(separator)) {
      const headerCols = countCells(header);
      let diverging = 0;
      let bodyRows = 0;
      let row = index + 2;
      for (; row < lines.length && isTableRow(lines[row]!) && !isTableSeparator(lines[row]!); row += 1) {
        bodyRows += 1;
        if (countCells(lines[row]!) !== headerCols) diverging += 1;
      }
      if (bodyRows > 0 && headerCols >= 2 && diverging >= minDivergingRows) {
        return {
          defect: true,
          reason: "table_columns",
          detail: { headerColumns: headerCols, divergingRows: diverging, bodyRows },
        };
      }
      index = row;
      continue;
    }
    index += 1;
  }
  return null;
}

/** Visible prose length after removing markdown / html structural syntax. */
function visibleProseLength(text: string): number {
  const prose = stripCodeFences(text)
    .replace(/<[^>]+>/g, " ") // html tags
    .replace(/^\s*\|.*\|\s*$/gm, " ") // table rows
    .replace(/^#{1,6}\s.*/gm, " ") // headings
    .replace(/^\s*[-*+]\s/gm, " ") // list markers
    .replace(/^\s*>\s?/gm, " ") // quotes
    .replace(/[*_~`#>|=-]/g, " ") // residual markers
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ") // links (drop url, keep nothing — conservative)
    .replace(/\s+/g, " ")
    .trim();
  return prose.length;
}

function hasStructure(text: string): boolean {
  return /^#{1,6}\s/m.test(text)
    || /^\|.*\|$/m.test(text)
    || /<h[1-6][\s>]/i.test(text)
    || /<(?:section|article|table)[\s>]/i.test(text);
}

/**
 * Evaluate one text deliverable for soft quality defects. `kind` should be "markdown" or "html";
 * other kinds return no defect (handled by the binary/format checks elsewhere).
 */
export function detectQualityDefects(
  text: string,
  kind: string,
  config: Partial<QualityConfig> = {},
): QualityVerdict {
  const cfg = { ...DEFAULT_QUALITY_CONFIG, ...config };
  const raw = String(text ?? "");
  if (!raw.trim()) return { defect: false };
  if (kind !== "markdown" && kind !== "html") return { defect: false };

  const lines = raw.split(/\r?\n/);

  if (kind === "markdown") {
    const tableDefect = detectTableColumnDefect(lines, cfg.minDivergingRows);
    if (tableDefect) return tableDefect;
  }

  // Structured-but-empty: advertises headings/tables but carries almost no prose.
  if (hasStructure(raw)) {
    const prose = visibleProseLength(raw);
    if (prose < cfg.minProseChars) {
      return { defect: true, reason: "too_short", detail: { proseChars: prose, minProseChars: cfg.minProseChars } };
    }
  }

  return { defect: false };
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
