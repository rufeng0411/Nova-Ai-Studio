// PD-SAAS-FORK (P1-C2, flag-gated, HIGH RISK): salvage a clean prefix from a degenerate file-write.
//
// Weak fast models (e.g. qwen3.6-flash) demonstrably run away into verbatim repetition INSIDE a
// `write_file`/`edit_file` `content` argument (a table row, a "✅ …" line, a multi-line block looped
// dozens of times). The output then hits the max-output token cap and the streamed tool call is
// truncated. The provider normalizer repairs+discards it and the agent loop retries with more tokens,
// which just re-generates the SAME runaway repetition — burning hours and ultimately producing ZERO
// files ("Large file repair failed before any workspace file was created after 5 attempts").
//
// Unlike the streaming guard (which sees JSON-escaped deltas with no real newlines), THIS runs at tool
// finalize time on the already-parsed `content` string — real newlines, so line/block detection is
// reliable. When runaway repetition is found we cut at the FIRST repeat (keeping one clean instance)
// and write THAT file: a shorter-but-valid deliverable the user can open and extend, and the cross-call
// retry loop is broken. Conservative by design: if no clear runaway repetition is found we return the
// content unchanged so the caller keeps its normal (retry-with-more-tokens) behaviour.

import {
  DEFAULT_STREAM_DEGENERATION_CONFIG,
  type StreamDegenerationConfig,
  type StreamDegenerationReason,
} from "./streamDegenerationGuard.js";

export type DegenerateSalvageResult = {
  /** The content to write — the clean prefix when trimmed, else the original. */
  content: string;
  /** True when runaway repetition was found and the tail was cut. */
  trimmed: boolean;
  reason?: StreamDegenerationReason;
  /** Number of characters removed from the tail (0 when not trimmed). */
  removedChars: number;
};

const BLOCK_SEP = "\u0001";
/** Bound the O(n^2) block scan; line-only path still covers very large files. */
const MAX_BLOCK_SCAN_LINES = 4_000;

/** Tools whose truncated/repaired output is salvageable into a clean-prefix file. */
export const FILE_WRITE_TOOL_NAMES = new Set(["write_file", "edit_file"]);

/** Pull the salvageable string field out of a parsed file-write tool input, if present. */
export function readWriteToolContent(input: unknown): string | null {
  if (typeof input !== "object" || input === null) return null;
  const record = input as Record<string, unknown>;
  const value = record.content ?? record.new_string;
  return typeof value === "string" ? value : null;
}

/** Re-attach the salvaged content onto the right field of a file-write tool input. */
export function withSalvagedContent(input: unknown, salvaged: string): unknown {
  if (typeof input !== "object" || input === null) return input;
  const record = { ...(input as Record<string, unknown>) };
  if (typeof record.content === "string") {
    record.content = salvaged;
  } else if (typeof record.new_string === "string") {
    record.new_string = salvaged;
  }
  return record;
}

function collapse(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function hasLetters(text: string): boolean {
  return /[A-Za-z\u4e00-\u9fff0-9]/.test(text);
}

type LineSpan = { text: string; collapsed: string; endsAfter: number };

/** Split into lines, tracking the char offset AFTER each line's trailing `\n` (for clean slicing). */
function splitLinesWithOffsets(content: string): LineSpan[] {
  const parts = content.split("\n");
  const out: LineSpan[] = [];
  let idx = 0;
  for (let i = 0; i < parts.length; i += 1) {
    const text = parts[i] ?? "";
    const hasNewline = i < parts.length - 1;
    const endsAfter = idx + text.length + (hasNewline ? 1 : 0);
    out.push({ text, collapsed: collapse(text), endsAfter });
    idx = endsAfter;
  }
  return out;
}

/** Earliest cut for a run of >= minConsecutiveLines identical substantial lines (keeps one copy). */
function findConsecutiveLineCut(lines: LineSpan[], cfg: StreamDegenerationConfig): number | null {
  let runStart = 0;
  let runValue: string | null = null;
  let count = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const { collapsed } = lines[i];
    const substantial = collapsed.length >= cfg.minUnitLength && hasLetters(collapsed);
    if (substantial && collapsed === runValue) {
      count += 1;
      if (count >= cfg.minConsecutiveLines) {
        return lines[runStart].endsAfter;
      }
    } else {
      runValue = substantial ? collapsed : null;
      runStart = i;
      count = substantial ? 1 : 0;
    }
  }
  return null;
}

/** Earliest cut for a multi-line block cycled verbatim >= blockCycleMinCycles times (keeps one cycle). */
function findBlockCycleCut(lines: LineSpan[], cfg: StreamDegenerationConfig): number | null {
  const n = lines.length;
  if (n > MAX_BLOCK_SCAN_LINES) return null;
  const maxBlock = Math.min(cfg.blockCycleMaxLines, Math.floor(n / cfg.blockCycleMinCycles));
  let earliest: number | null = null;
  for (let blockLen = 2; blockLen <= maxBlock; blockLen += 1) {
    for (let start = 0; start + blockLen * cfg.blockCycleMinCycles <= n; start += 1) {
      const block = lines.slice(start, start + blockLen);
      const blockKey = block.map((l) => l.collapsed).join(BLOCK_SEP);
      if (block.map((l) => l.collapsed).join("").replace(/\s+/g, "").length < cfg.blockCycleMinBlockChars) {
        continue;
      }
      if (!hasLetters(blockKey)) continue;
      let cycles = 1;
      while (start + blockLen * (cycles + 1) <= n) {
        const seg = lines
          .slice(start + blockLen * cycles, start + blockLen * (cycles + 1))
          .map((l) => l.collapsed)
          .join(BLOCK_SEP);
        if (seg !== blockKey) break;
        cycles += 1;
      }
      if (cycles >= cfg.blockCycleMinCycles) {
        const cut = lines[start + blockLen - 1].endsAfter;
        earliest = earliest === null ? cut : Math.min(earliest, cut);
        break;
      }
    }
  }
  return earliest;
}

/**
 * Earliest cut for a no-newline phrase loop ("循环循环循环…"). Finds a small period that tiles the
 * tail, then walks backward to the start of the periodic region and keeps a single instance.
 */
function findPhraseLoopCut(content: string, cfg: StreamDegenerationConfig): number | null {
  const scan = content.length > cfg.maxScanChars ? content.slice(-cfg.maxScanChars) : content;
  const base = content.length - scan.length;
  const len = scan.length;
  if (len < cfg.phraseMinRegionLen) return null;
  for (let period = 1; period <= cfg.phraseMaxLen; period += 1) {
    const regionLen = period * cfg.phraseRepeatCount;
    if (regionLen > len || regionLen < cfg.phraseMinRegionLen) continue;
    const phrase = scan.slice(len - regionLen, len - regionLen + period);
    if (!phrase.trim() || !hasLetters(phrase)) continue;
    let repeated = true;
    for (let offset = period; offset < regionLen; offset += period) {
      if (scan.slice(len - regionLen + offset, len - regionLen + offset + period) !== phrase) {
        repeated = false;
        break;
      }
    }
    if (!repeated) continue;
    // Walk backward to the true start of the periodic region, then keep one instance.
    let startInScan = len - regionLen;
    while (startInScan - period >= 0 && scan.slice(startInScan - period, startInScan) === phrase) {
      startInScan -= period;
    }
    return base + startInScan + period;
  }
  return null;
}

/**
 * Find the earliest char index where runaway repetition begins (keeping one clean instance), with the
 * reason. Returns null when the content shows no clear runaway repetition.
 */
export function findDegenerateCut(
  content: string,
  config: Partial<StreamDegenerationConfig> = {},
): { cutAt: number; reason: StreamDegenerationReason } | null {
  if (typeof content !== "string" || content.length < DEFAULT_STREAM_DEGENERATION_CONFIG.phraseMinRegionLen) {
    return null;
  }
  const cfg = { ...DEFAULT_STREAM_DEGENERATION_CONFIG, ...config };
  const lines = splitLinesWithOffsets(content);

  const candidates: { cutAt: number; reason: StreamDegenerationReason }[] = [];
  const lineCut = findConsecutiveLineCut(lines, cfg);
  if (lineCut !== null) candidates.push({ cutAt: lineCut, reason: "line_repeat" });
  const blockCut = findBlockCycleCut(lines, cfg);
  if (blockCut !== null) candidates.push({ cutAt: blockCut, reason: "block_repeat" });
  const phraseCut = findPhraseLoopCut(content, cfg);
  if (phraseCut !== null) candidates.push({ cutAt: phraseCut, reason: "phrase_repeat" });

  if (candidates.length === 0) return null;
  // Prefer the earliest cut so the salvaged file carries the least repeated garbage.
  candidates.sort((a, b) => a.cutAt - b.cutAt);
  return candidates[0];
}

/**
 * Salvage a clean prefix from possibly-degenerate file-write content. When runaway repetition is found
 * the tail is cut (keeping one clean instance) and a localized marker is appended; otherwise the
 * content is returned unchanged.
 */
export function salvageDegenerateContent(
  content: string,
  config: Partial<StreamDegenerationConfig> = {},
): DegenerateSalvageResult {
  const cut = findDegenerateCut(content, config);
  if (!cut || cut.cutAt <= 0 || cut.cutAt >= content.length) {
    return { content, trimmed: false, removedChars: 0 };
  }
  const prefix = content.slice(0, cut.cutAt);
  const removedChars = content.length - prefix.length;
  const marker = inferTrailingMarker(prefix);
  return {
    content: marker ? `${prefix}${marker}` : prefix,
    trimmed: true,
    reason: cut.reason,
    removedChars,
  };
}

/** Append a comment marker in the file's own comment syntax so the cut is visible but non-breaking. */
function inferTrailingMarker(prefix: string): string {
  const note = "内容因模型重复输出被自动截断，可在后续轮次继续补全";
  const head = prefix.trimStart().slice(0, 200).toLowerCase();
  const ensureNewline = prefix.endsWith("\n") ? "" : "\n";
  if (head.includes("<!doctype") || head.includes("<html") || /<\w+[\s>]/.test(head)) {
    return `${ensureNewline}<!-- ${note} -->\n`;
  }
  if (head.startsWith("{") || head.startsWith("[")) {
    // JSON has no comments; do not risk breaking parse — no marker.
    return "";
  }
  if (head.startsWith("#") || head.includes("\n#") || head.includes("**") || head.includes("](")) {
    return `${ensureNewline}\n<!-- ${note} -->\n`;
  }
  return `${ensureNewline}\n// ${note}\n`;
}
