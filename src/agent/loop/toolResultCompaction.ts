// PD-SAAS-FORK (P2-E, flag-gated): in-turn tool-result context compaction.
//
// On long turns the transcript fills with large tool_result bodies (file reads, web fetches, search
// dumps) AND large inline binary (base64 images from generate_image / fetch_page_images, PDFs). Most
// are only relevant briefly. This pass replaces the TEXT of OLD, large tool_result blocks with a
// short head + a marker noting the body was folded, and ALSO folds OLD oversized base64 image/PDF
// data blocks into a marker (the saved file path lives in the sibling text, so the model loses no
// information it can't re-read). This is what stops a single generated hero image (hundreds of KB of
// base64) from being re-sent every turn and ballooning the request until the provider call fails with
// a raw "fetch failed".
//
// Pure & deterministic (immutable: only changed messages/blocks are cloned). It runs ALONGSIDE, and
// never replaces, the existing whole-message auto-compaction. Recent messages (the recency window)
// are NEVER touched, so live multimodal reasoning keeps its images; only stale, oversized binary is
// folded. Small images / url images are preserved verbatim. Idempotent via an embedded marker.

import type {
  CanonicalContentBlock,
  CanonicalMessage,
  CanonicalToolResultContentBlock,
} from "../../model/protocol/canonical.js";

/** Stable sentinel so a previously-compacted block is never compacted twice. */
export const COMPACTION_MARKER = "\u27e6ctx-compacted\u27e7";

export type ToolResultCompactionConfig = {
  /** Number of most-recent messages that are never compacted. */
  recencyWindow: number;
  /** Only compact a tool_result whose combined text exceeds this many chars. */
  minBlockChars: number;
  /** How many chars of the head to keep (usually contains the path / first lines). */
  headChars: number;
  /** An OLD base64 image/PDF block whose data exceeds this many chars is folded into a marker. */
  maxBinaryDataChars: number;
};

export const DEFAULT_TOOL_RESULT_COMPACTION_CONFIG: ToolResultCompactionConfig = {
  recencyWindow: 8,
  minBlockChars: 2_000,
  headChars: 400,
  maxBinaryDataChars: 20_000,
};

export function resolveToolResultCompactionConfig(
  env: Record<string, string | undefined> = process.env,
): ToolResultCompactionConfig {
  return {
    recencyWindow: positiveInt(env.PILOTDECK_COMPACT_RECENCY, DEFAULT_TOOL_RESULT_COMPACTION_CONFIG.recencyWindow),
    minBlockChars: positiveInt(env.PILOTDECK_COMPACT_MIN_CHARS, DEFAULT_TOOL_RESULT_COMPACTION_CONFIG.minBlockChars),
    headChars: positiveInt(env.PILOTDECK_COMPACT_HEAD_CHARS, DEFAULT_TOOL_RESULT_COMPACTION_CONFIG.headChars),
    maxBinaryDataChars: positiveInt(
      env.PILOTDECK_COMPACT_MAX_BINARY_CHARS,
      DEFAULT_TOOL_RESULT_COMPACTION_CONFIG.maxBinaryDataChars,
    ),
  };
}

export type CompactionResult = {
  messages: CanonicalMessage[];
  compactedBlocks: number;
  savedChars: number;
};

function textLengthOf(blocks: CanonicalToolResultContentBlock[]): number {
  return blocks.reduce((sum, block) => (block.type === "text" ? sum + block.text.length : sum), 0);
}

/** Total base64 bytes carried inline by image/pdf blocks (url-sourced blocks carry no payload). */
function binaryDataLengthOf(blocks: CanonicalToolResultContentBlock[]): number {
  return blocks.reduce((sum, block) => {
    if ((block.type === "image" || block.type === "pdf") && block.source === "base64") {
      return sum + (typeof block.data === "string" ? block.data.length : 0);
    }
    return sum;
  }, 0);
}

function isFoldableBinary(
  block: CanonicalToolResultContentBlock,
  cfg: ToolResultCompactionConfig,
): boolean {
  return (
    (block.type === "image" || block.type === "pdf")
    && block.source === "base64"
    && typeof block.data === "string"
    && block.data.length > cfg.maxBinaryDataChars
  );
}

function alreadyCompacted(blocks: CanonicalToolResultContentBlock[]): boolean {
  return blocks.some((block) => block.type === "text" && block.text.includes(COMPACTION_MARKER));
}

function buildCompactedContent(
  blocks: CanonicalToolResultContentBlock[],
  cfg: ToolResultCompactionConfig,
): { content: CanonicalToolResultContentBlock[]; saved: number } {
  const textBlocks = blocks.filter((block): block is Extract<CanonicalToolResultContentBlock, { type: "text" }> => block.type === "text");
  const combined = textBlocks.map((block) => block.text).join("\n");
  const head = combined.slice(0, cfg.headChars).trimEnd();
  const foldedTextChars = Math.max(0, combined.length - head.length);

  // Keep small / url binary blocks verbatim; fold OLD oversized base64 image/PDF data away (the path
  // already lives in the sibling text, so nothing the model needs to re-read is lost).
  const keptNonText: CanonicalToolResultContentBlock[] = [];
  let foldedBinaryBytes = 0;
  let foldedBinaryCount = 0;
  for (const block of blocks) {
    if (block.type === "text") continue;
    if (isFoldableBinary(block, cfg)) {
      foldedBinaryBytes += block.data.length;
      foldedBinaryCount += 1;
      continue;
    }
    keptNonText.push(block);
  }

  const notes: string[] = [];
  if (foldedTextChars > 0) notes.push(`已折叠约 ${foldedTextChars} 字`);
  if (foldedBinaryCount > 0) notes.push(`已折叠 ${foldedBinaryCount} 个大体积附件（图片/PDF 字节）`);
  const marker = notes.length
    ? `${COMPACTION_MARKER} ${notes.join("、")}以节省上下文；如需完整内容，请重新读取对应文件或重跑该工具。`
    : "";
  const summaryText = head ? (marker ? `${head}\n${marker}` : head) : marker;

  const content: CanonicalToolResultContentBlock[] = [];
  if (summaryText) content.push({ type: "text", text: summaryText });
  content.push(...keptNonText);
  const saved = Math.max(0, combined.length - summaryText.length) + foldedBinaryBytes;
  return { content, saved };
}

/**
 * Compact old, large tool_result text bodies. Returns a new messages array (sharing unchanged
 * message references) plus how much was saved. No-op when there is nothing old / large enough.
 */
export function compactToolResults(
  messages: readonly CanonicalMessage[],
  config: Partial<ToolResultCompactionConfig> = {},
): CompactionResult {
  const cfg = { ...DEFAULT_TOOL_RESULT_COMPACTION_CONFIG, ...config };
  if (messages.length <= cfg.recencyWindow) {
    return { messages: [...messages], compactedBlocks: 0, savedChars: 0 };
  }
  const cutoff = messages.length - cfg.recencyWindow;
  let compactedBlocks = 0;
  let savedChars = 0;

  const next = messages.map((message, index) => {
    if (index >= cutoff) return message;
    let changed = false;
    const content: CanonicalContentBlock[] = message.content.map((block) => {
      if (block.type !== "tool_result") return block;
      if (alreadyCompacted(block.content)) return block;
      const overText = textLengthOf(block.content) > cfg.minBlockChars;
      const overBinary = binaryDataLengthOf(block.content) > cfg.maxBinaryDataChars;
      if (!overText && !overBinary) return block;
      const { content: compacted, saved } = buildCompactedContent(block.content, cfg);
      compactedBlocks += 1;
      savedChars += saved;
      changed = true;
      return { ...block, content: compacted };
    });
    return changed ? { ...message, content } : message;
  });

  return { messages: next, compactedBlocks, savedChars };
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
