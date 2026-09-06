// PD-SAAS-FORK: strip tool-call serialization fragments that occasionally leak
// into assistant text (e.g. `</parameter> </function>`, `<parameter=old_string>`).
// These are internal protocol artifacts and must never be shown to the user.

import { stripEnglishProcessNarration } from './englishProcessNarration.js';

export type StripLeakedMarkupOptions = {
  /** When true (default), drop English-only model process narration in assistant bubbles. */
  localeIsZh?: boolean;
};

const LEAK_TAG_PATTERN =
  /<\/?(?:function|parameter|invoke|antml:invoke|antml:parameter|function_calls|function_results|fnr|tool_call|tool_use)\b[^>]*>|<(?:function|parameter)=[^>]*>?/i;

const FENCE_PATTERN = /^\s*(?:```|~~~)/;
const POSSIBLE_UNFENCED_CODE_LEAK_PATTERN =
  /CONTINUE HERE|<\/(?:style|head|body|html|script|think)>|<!doctype\s+html|<html\b|<body\b|position\s*:|\bnav\s*\{|^[ \t]*[.#][\w-]+\s*\{/im;
const UNFENCED_CSS_BLOCK_START_RE = /^\s*[.#][\w-]+\s*\{\s*$/;

function isLikelyUnfencedCodeLeakLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/CONTINUE HERE/i.test(trimmed)) return true;
  if (/^<\/think>$/i.test(trimmed)) return true;
  const hasDocumentTags =
    /<\/(?:style|head|body|html|script|think)>|<!doctype\s+html|<html\b|<head\b|<body\b/i.test(trimmed);
  const hasCssDensity =
    /[{}]/.test(trimmed)
    && (trimmed.match(/;/g)?.length ?? 0) >= 3
    && /(?:position|display|width|height|background|transform|transition|z-index)\s*:/i.test(trimmed);
  return trimmed.length > 100 && (hasDocumentTags || hasCssDensity);
}

/**
 * Drop lines that contain leaked tool-call markup. Lines inside fenced code
 * blocks are preserved — legitimate code samples may discuss these tags.
 * When `localeIsZh` is true, also strips English-only model process narration.
 */
export function stripLeakedToolCallMarkup(text: string, options?: StripLeakedMarkupOptions): string {
  const localeIsZh = options?.localeIsZh === true;
  const source = stripTaskResumeMarkup(String(text || ''));
  if (!LEAK_TAG_PATTERN.test(source) && !POSSIBLE_UNFENCED_CODE_LEAK_PATTERN.test(source)) {
    return stripEnglishProcessNarration(
      deduplicateDocCreatedLines(deduplicateRepeatedDeliverableSummaryBlocks(source)),
      localeIsZh,
    );
  }

  const lines = source.split('\n');
  const kept: string[] = [];
  let inFence = false;
  let inUnfencedCssBlock = false;
  let dropped = false;

  for (const line of lines) {
    if (FENCE_PATTERN.test(line)) {
      inFence = !inFence;
      kept.push(line);
      continue;
    }
    if (!inFence && inUnfencedCssBlock) {
      dropped = true;
      if (line.trim() === '}') {
        inUnfencedCssBlock = false;
      }
      continue;
    }
    if (!inFence && UNFENCED_CSS_BLOCK_START_RE.test(line)) {
      dropped = true;
      inUnfencedCssBlock = true;
      continue;
    }
    if (!inFence && (LEAK_TAG_PATTERN.test(line) || isLikelyUnfencedCodeLeakLine(line))) {
      dropped = true;
      continue;
    }
    kept.push(line);
  }

  if (!dropped) {
    return stripEnglishProcessNarration(
      deduplicateDocCreatedLines(deduplicateRepeatedDeliverableSummaryBlocks(stripTrailingLeakedToolTags(source))),
      localeIsZh,
    );
  }
  return stripEnglishProcessNarration(
    deduplicateDocCreatedLines(
      deduplicateRepeatedDeliverableSummaryBlocks(
        stripTrailingLeakedToolTags(kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()),
      ),
    ),
    localeIsZh,
  );
}

const DELIVERABLE_SUMMARY_HEADING_RE = /(?:成果清单|成果汇总|交付文件汇总|交付文件列表|交付物清单|文件路径)/;
const DELIVERABLE_SUMMARY_ROW_RE =
  /(?:文件路径|格式|HTML|DOCX|Word|PDF|网页|文档|\.html?\b|\.docx\b|\.pdf\b|\.pptx\b|\.md\b|\.png\b)/i;
const DOC_CREATED_LINE_RE = /^(?:📄|✅)?\s*文档(?:已创建|已生成)/;

function deduplicateDocCreatedLines(text: string): string {
  const lines = String(text || '').split('\n');
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const line of lines) {
    if (!DOC_CREATED_LINE_RE.test(line.trim())) {
      kept.push(line);
      continue;
    }
    const pathMatch = line.match(/(?:artifacts\/[^\s`]+|[\w.-]+\.(?:md|html|docx|pdf|pptx|png|jpe?g))/i);
    const fingerprint = (pathMatch?.[0] || line).replace(/\s+/g, ' ').trim().toLowerCase();
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    kept.push(line);
  }
  return kept.join('\n');
}

function normalizeDeliverableSummaryFingerprint(lines: string[]): string {
  return lines
    .join('\n')
    .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function deduplicateRepeatedDeliverableSummaryBlocks(text: string): string {
  const lines = String(text || '').split('\n');
  const kept: string[] = [];
  const seen = new Set<string>();
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!DELIVERABLE_SUMMARY_HEADING_RE.test(line)) {
      kept.push(line);
      index += 1;
      continue;
    }

    const block = [line];
    let cursor = index + 1;
    while (cursor < lines.length) {
      const next = lines[cursor] ?? '';
      if (!next.trim()) break;
      if (DELIVERABLE_SUMMARY_HEADING_RE.test(next)) break;
      if (!DELIVERABLE_SUMMARY_ROW_RE.test(next)) break;
      block.push(next);
      cursor += 1;
    }

    const fingerprint = normalizeDeliverableSummaryFingerprint(block);
    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      kept.push(...block);
    }
    index = cursor;
  }

  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Trailing `</parameter>` / `</function>` often leak after truncated tool calls. */
function stripTrailingLeakedToolTags(text: string): string {
  return String(text || '')
    .replace(/(?:\n|^)\s*<\/?(?:function|parameter|invoke|tool_use|tool_call)\b[^>\n]*>\s*$/gi, '')
    .trim();
}

const TASK_RESUME_BLOCK_RE = /<task-resume\b[\s\S]*?<\/task-resume>/gi;
const TASK_RESUME_OPEN_RE = /<task-resume\b/i;

/** PD-SAAS-FORK (Goal Loop P2 H1): strip infra task-resume XML from user-visible text. */
export function stripTaskResumeMarkup(text: string): string {
  return String(text || '')
    .replace(TASK_RESUME_BLOCK_RE, '')
    .replace(/<\/?task-resume\b[^>]*>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function containsTaskResumeMarkup(text: string): boolean {
  return TASK_RESUME_OPEN_RE.test(String(text || ''));
}
