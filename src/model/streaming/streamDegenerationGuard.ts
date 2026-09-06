// PD-SAAS-FORK (P1-C2, flag-gated, HIGH RISK): streaming-layer degeneration detector.
//
// A stateful detector fed the model's text deltas AS THEY STREAM. It trips when the output enters
// runaway repetition so the stream can be stopped early and cleanly instead of burning tokens on
// garbage. Three independent shapes are detected:
//   - line_repeat:  the same substantial line repeated many times in a row
//   - phrase_repeat: a short phrase looped without newlines (e.g. "循环循环循环…")
//   - block_repeat: a multi-line BLOCK cycled verbatim (A/B/C…A/B/C…) — the classic markdown-table
//                   restart loop where neighbouring lines differ so line_repeat never trips.
//
// HIGH PRECISION by design — a missed detection just wastes some tokens (recoverable), but a false
// positive would truncate a GOOD long answer. So thresholds are deliberately high and the detector
// only ever trips on extreme, unambiguous repetition. It is pure/deterministic for unit testing; the
// caller (streamModel) only acts on a trip when PILOTDECK_STREAM_DEGENERATION is ON (default OFF).

export type StreamDegenerationReason = "line_repeat" | "phrase_repeat" | "block_repeat";

export type StreamDegenerationVerdict = {
  degenerated: boolean;
  reason?: StreamDegenerationReason;
  sample?: string;
};

export type StreamDegenerationConfig = {
  /** Consecutive identical substantial lines required to trip. */
  minConsecutiveLines: number;
  /** A line shorter than this (after whitespace collapse) is ignored (won't trip / won't reset). */
  minUnitLength: number;
  /** A short phrase repeated >= this many times at the tail trips phrase_repeat. */
  phraseRepeatCount: number;
  /** Max phrase length considered for phrase-loop detection. */
  phraseMaxLen: number;
  /** Min total length of the repeated region (period * count) before phrase_repeat trips. */
  phraseMinRegionLen: number;
  /** Cap on the retained tail buffer (bounds memory on very long streams). */
  maxScanChars: number;
  /** A multi-line block (2..blockCycleMaxLines) cycled >= this many times trips block_repeat. */
  blockCycleMinCycles: number;
  /** Max block size (in lines) considered for block-cycle detection. */
  blockCycleMaxLines: number;
  /** A candidate block's collapsed joined length must reach this, else it's too small to flag. */
  blockCycleMinBlockChars: number;
};

export const DEFAULT_STREAM_DEGENERATION_CONFIG: StreamDegenerationConfig = {
  minConsecutiveLines: 6,
  minUnitLength: 20,
  phraseRepeatCount: 20,
  phraseMaxLen: 40,
  phraseMinRegionLen: 80,
  maxScanChars: 8_000,
  blockCycleMinCycles: 4,
  blockCycleMaxLines: 12,
  blockCycleMinBlockChars: 24,
};

export function resolveStreamDegenerationConfig(
  env: Record<string, string | undefined> = process.env,
): StreamDegenerationConfig {
  return {
    ...DEFAULT_STREAM_DEGENERATION_CONFIG,
    minConsecutiveLines: positiveInt(
      env.PILOTDECK_STREAM_DEGEN_MIN_LINES,
      DEFAULT_STREAM_DEGENERATION_CONFIG.minConsecutiveLines,
    ),
    phraseRepeatCount: positiveInt(
      env.PILOTDECK_STREAM_DEGEN_PHRASE_COUNT,
      DEFAULT_STREAM_DEGENERATION_CONFIG.phraseRepeatCount,
    ),
    blockCycleMinCycles: positiveInt(
      env.PILOTDECK_STREAM_DEGEN_BLOCK_CYCLES,
      DEFAULT_STREAM_DEGENERATION_CONFIG.blockCycleMinCycles,
    ),
  };
}

function collapse(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function hasLetters(text: string): boolean {
  return /[A-Za-z\u4e00-\u9fff0-9]/.test(text);
}

/**
 * Detect whether the tail of `buffer` is a short phrase repeated >= count times. Returns the phrase
 * sample, or null. Scans periods 1..phraseMaxLen and picks the smallest that explains the tail.
 */
function detectTailPhraseRepeat(buffer: string, cfg: StreamDegenerationConfig): string | null {
  const tail = buffer.length > cfg.maxScanChars ? buffer.slice(-cfg.maxScanChars) : buffer;
  const len = tail.length;
  if (len < cfg.phraseMinRegionLen) return null;
  for (let period = 1; period <= cfg.phraseMaxLen; period += 1) {
    const regionLen = period * cfg.phraseRepeatCount;
    if (regionLen > len || regionLen < cfg.phraseMinRegionLen) continue;
    const region = tail.slice(len - regionLen);
    const phrase = region.slice(0, period);
    if (!phrase.trim() || !hasLetters(phrase)) continue;
    let repeated = true;
    for (let offset = period; offset < regionLen; offset += period) {
      if (region.slice(offset, offset + period) !== phrase) {
        repeated = false;
        break;
      }
    }
    if (repeated) return phrase;
  }
  return null;
}

const BLOCK_SEP = "\u0001";

/**
 * Detect whether the tail of `lines` is a multi-line block cycled verbatim (A/B/C…A/B/C…). Catches
 * the markdown-table restart loop that line_repeat misses (neighbouring lines differ, so a per-line
 * consecutive run never builds up). Scans block sizes 2..blockCycleMaxLines and returns the smallest
 * block that explains the tail as >= blockCycleMinCycles exact repeats. Conservative by design.
 */
function detectTailBlockCycle(lines: string[], cfg: StreamDegenerationConfig): string | null {
  const n = lines.length;
  const maxBlock = Math.min(cfg.blockCycleMaxLines, Math.floor(n / cfg.blockCycleMinCycles));
  for (let blockLen = 2; blockLen <= maxBlock; blockLen += 1) {
    const needed = blockLen * cfg.blockCycleMinCycles;
    if (needed > n) break;
    const block = lines.slice(n - blockLen);
    const blockKey = block.join(BLOCK_SEP);
    if (block.join("").replace(/\s+/g, "").length < cfg.blockCycleMinBlockChars) continue;
    if (!hasLetters(blockKey)) continue;
    let cycles = 1;
    for (let c = 1; c < cfg.blockCycleMinCycles; c += 1) {
      const start = n - blockLen * (c + 1);
      const seg = lines.slice(start, start + blockLen).join(BLOCK_SEP);
      if (seg !== blockKey) break;
      cycles += 1;
    }
    if (cycles >= cfg.blockCycleMinCycles) {
      return block.join(" / ");
    }
  }
  return null;
}

export type StreamDegenerationDetector = {
  /** Feed the next text delta. Returns the current verdict (sticky once tripped). */
  push(text: string): StreamDegenerationVerdict;
  readonly verdict: StreamDegenerationVerdict;
};

export function createStreamDegenerationDetector(
  config: Partial<StreamDegenerationConfig> = {},
): StreamDegenerationDetector {
  const cfg = { ...DEFAULT_STREAM_DEGENERATION_CONFIG, ...config };
  let tail = "";
  let lastLine: string | null = null;
  let consecutive = 0;
  let verdict: StreamDegenerationVerdict = { degenerated: false };
  const lineBuffer: string[] = [];
  const blockBufferCap = cfg.blockCycleMaxLines * (cfg.blockCycleMinCycles + 1) + 4;

  return {
    get verdict() {
      return verdict;
    },
    push(text: string): StreamDegenerationVerdict {
      if (verdict.degenerated) return verdict;
      tail += String(text ?? "");

      let newline = tail.indexOf("\n");
      while (newline >= 0) {
        const line = collapse(tail.slice(0, newline));
        tail = tail.slice(newline + 1);
        if (line.length >= cfg.minUnitLength && hasLetters(line)) {
          if (line === lastLine) {
            consecutive += 1;
          } else {
            lastLine = line;
            consecutive = 1;
          }
          if (consecutive >= cfg.minConsecutiveLines) {
            verdict = { degenerated: true, reason: "line_repeat", sample: line.slice(0, 120) };
            return verdict;
          }
        }
        // block_repeat: feed ALL non-empty lines (table cells/headers are short, so they must NOT be
        // filtered here) and look for a verbatim multi-line cycle at the tail.
        if (line) {
          lineBuffer.push(line);
          if (lineBuffer.length > blockBufferCap) {
            lineBuffer.splice(0, lineBuffer.length - blockBufferCap);
          }
          const block = detectTailBlockCycle(lineBuffer, cfg);
          if (block) {
            verdict = { degenerated: true, reason: "block_repeat", sample: block.slice(0, 120) };
            return verdict;
          }
        }
        newline = tail.indexOf("\n");
      }

      const phrase = detectTailPhraseRepeat(tail, cfg);
      if (phrase) {
        verdict = { degenerated: true, reason: "phrase_repeat", sample: phrase.slice(0, 120) };
        return verdict;
      }

      if (tail.length > cfg.maxScanChars) tail = tail.slice(-cfg.maxScanChars);
      return verdict;
    },
  };
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
