// PD-SAAS-FORK (P0-4): deliverable-level generation-degeneration guard.
//
// Detects the classic "model got stuck repeating itself" failure in finished .md/.html text —
// the same substantial table row or paragraph repeated many times. Pure & deterministic so it can
// be unit-tested and tuned by telemetry before thresholds are tightened.
//
// Designed for HIGH PRECISION (few false positives): only flags EXTREME repetition of SUBSTANTIAL
// units (long lines), ignores code fences, table separators, short rows / bullets / headings, and
// legitimate template repetition (a handful of repeats never trips it). When unsure, it returns
// "not degenerate" — a missed detection is recoverable (no repair), a false positive would wrongly
// reject a good deliverable.

export type DegenerationReason = "table_row_repeat" | "paragraph_repeat";

export type DegenerationVerdict = {
  degenerate: boolean;
  reason?: DegenerationReason;
  runLength?: number;
  totalRepeats?: number;
  sample?: string;
};

export type DegenerationConfig = {
  /** Min consecutive identical substantial table rows to flag. */
  minConsecutiveTableRows: number;
  /** Min consecutive identical substantial paragraphs/lines to flag. */
  minConsecutiveParagraphs: number;
  /** Min total occurrences of one dominant unit (non-consecutive) to flag. */
  minTotalDominantRepeats: number;
  /** Dominant unit must also be at least this share of all substantial units. */
  dominantShareThreshold: number;
  /** A unit shorter than this (after whitespace collapse) is ignored (bullets, headings, short cells). */
  minUnitLength: number;
};

export const DEFAULT_DEGENERATION_CONFIG: DegenerationConfig = {
  minConsecutiveTableRows: 6,
  minConsecutiveParagraphs: 5,
  minTotalDominantRepeats: 12,
  dominantShareThreshold: 0.5,
  minUnitLength: 24,
};

export function resolveDegenerationConfig(
  env: Record<string, string | undefined> = process.env,
): DegenerationConfig {
  return {
    minConsecutiveTableRows: positiveInt(
      env.PILOTDECK_DEGEN_MIN_TABLE_ROWS,
      DEFAULT_DEGENERATION_CONFIG.minConsecutiveTableRows,
    ),
    minConsecutiveParagraphs: positiveInt(
      env.PILOTDECK_DEGEN_MIN_PARAGRAPHS,
      DEFAULT_DEGENERATION_CONFIG.minConsecutiveParagraphs,
    ),
    minTotalDominantRepeats: positiveInt(
      env.PILOTDECK_DEGEN_MIN_TOTAL,
      DEFAULT_DEGENERATION_CONFIG.minTotalDominantRepeats,
    ),
    dominantShareThreshold: DEFAULT_DEGENERATION_CONFIG.dominantShareThreshold,
    minUnitLength: positiveInt(
      env.PILOTDECK_DEGEN_MIN_UNIT_LEN,
      DEFAULT_DEGENERATION_CONFIG.minUnitLength,
    ),
  };
}

function stripCodeFences(text: string): string {
  // Remove ``` fenced blocks (legit repetition can live in code) and <script>/<style>.
  return text
    .replace(/```[\s\S]*?```/g, "\n")
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n");
}

function collapse(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function isTableRow(line: string): boolean {
  return /^\|.*\|$/.test(line);
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s:|-]+\|$/.test(line);
}

function isIgnorableLine(line: string): boolean {
  if (!line) return true;
  if (/^#{1,6}\s/.test(line)) return true; // heading
  if (/^[-*+]\s/.test(line) && line.length < 40) return true; // short bullet
  if (/^>\s?/.test(line) && line.length < 40) return true; // short quote
  if (/^[-=_*\s]+$/.test(line)) return true; // hr / divider
  return false;
}

function hasLetters(line: string): boolean {
  return /[A-Za-z\u4e00-\u9fff]/.test(line);
}

/** Longest run of consecutive identical entries + the value, scanning a list of normalized units. */
function longestRun(units: string[]): { runLength: number; value: string } {
  let best = 0;
  let bestValue = "";
  let current = 0;
  let prev: string | null = null;
  for (const unit of units) {
    if (unit === prev) {
      current += 1;
    } else {
      current = 1;
      prev = unit;
    }
    if (current > best) {
      best = current;
      bestValue = unit;
    }
  }
  return { runLength: best, value: bestValue };
}

/** Most frequent unit + its count, over all units (non-consecutive). */
function dominantUnit(units: string[]): { count: number; value: string; total: number } {
  const counts = new Map<string, number>();
  for (const unit of units) counts.set(unit, (counts.get(unit) ?? 0) + 1);
  let bestValue = "";
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestValue = value;
    }
  }
  return { count: bestCount, value: bestValue, total: units.length };
}

export function detectContentDegeneration(
  text: string,
  config: Partial<DegenerationConfig> = {},
): DegenerationVerdict {
  const cfg = { ...DEFAULT_DEGENERATION_CONFIG, ...config };
  const raw = String(text ?? "");
  if (!raw.trim()) return { degenerate: false };

  const lines = stripCodeFences(raw)
    .split(/\r?\n/)
    .map(collapse)
    .filter(Boolean);

  const tableRows: string[] = [];
  const paragraphs: string[] = [];
  for (const line of lines) {
    if (isTableRow(line)) {
      if (isTableSeparator(line)) continue;
      if (collapse(line).length < cfg.minUnitLength) continue;
      tableRows.push(line);
      continue;
    }
    if (isIgnorableLine(line)) continue;
    if (line.length < cfg.minUnitLength) continue;
    if (!hasLetters(line)) continue;
    paragraphs.push(line);
  }

  // 1) Consecutive identical table rows (the strongest degeneration signal).
  const tableRun = longestRun(tableRows);
  if (tableRun.runLength >= cfg.minConsecutiveTableRows) {
    return {
      degenerate: true,
      reason: "table_row_repeat",
      runLength: tableRun.runLength,
      sample: tableRun.value.slice(0, 120),
    };
  }

  // 2) Consecutive identical paragraphs.
  const paragraphRun = longestRun(paragraphs);
  if (paragraphRun.runLength >= cfg.minConsecutiveParagraphs) {
    return {
      degenerate: true,
      reason: "paragraph_repeat",
      runLength: paragraphRun.runLength,
      sample: paragraphRun.value.slice(0, 120),
    };
  }

  // 3) One dominant unit pervades the document (non-consecutive but overwhelming).
  for (const [units, reason] of [
    [tableRows, "table_row_repeat" as const],
    [paragraphs, "paragraph_repeat" as const],
  ] as const) {
    if (units.length < cfg.minTotalDominantRepeats) continue;
    const dominant = dominantUnit(units);
    if (
      dominant.count >= cfg.minTotalDominantRepeats
      && dominant.count / dominant.total >= cfg.dominantShareThreshold
    ) {
      return {
        degenerate: true,
        reason,
        totalRepeats: dominant.count,
        sample: dominant.value.slice(0, 120),
      };
    }
  }

  return { degenerate: false };
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
