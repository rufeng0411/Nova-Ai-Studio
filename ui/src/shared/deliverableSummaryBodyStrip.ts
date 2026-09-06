// PD-SAAS-FORK: remove inline deliverable lists from assistant prose when UI summary table mounts
import type { DeliverableItem } from './collectDeliverables';
import {
  extractDeliverablePathsFromText,
  getArtifactFileName,
  normalizeArtifactPath,
} from './artifactPaths';

const SUMMARY_HEADING_RE = /(?:成果清单|成果汇总|成果文件清单|交付文件汇总|交付文件列表|交付物清单|本回合成果|交付清单|成果列表|文件列表|交付物如下|文件如下|主要文件|产出文件)/;
const FOUR_COLUMN_TABLE_HEADER_RE = /(?:交付物名称|成果名称)\s*[|｜]\s*文件类型\s*[|｜]\s*状态\s*[|｜]\s*(?:文件链接|链接)/;
const SUMMARY_ROW_RE =
  /(?:文件路径|格式|HTML|DOCX|Word|PDF|网页|文档|交付物|文件链接|\.html?\b|\.docx\b|\.pdf\b|\.pptx\b|\.md\b|\.png\b|\.mp4\b)/i;
const DOC_CREATED_LINE_RE = /^(?:[-*•]\s*)?(?:📄|✅|📁|📂)?\s*(?:文档已创建|文档已生成|文件已创建|文件已生成|已写入|已保存至|已导出至)/;
const PATH_LABEL_LINE_RE = /(?:文件路径|交付物路径|成果路径|交付清单|主文件|输出路径|保存路径|📂|📁)\s*[:：]/;
const DELIVERABLE_SECTION_HEADING_RE = /^#{1,4}\s*(?:✅\s*)?(?:交付|成果|文件路径|交付物|产出|文件列表)/;
const MARKDOWN_TABLE_SEPARATOR_RE = /^\|[\s:|\-]+\|?\s*$/;

function norm(path: string): string {
  return normalizeArtifactPath(path).toLowerCase();
}

function pathsReferToSameFile(bodyPath: string, itemPath: string): boolean {
  const a = norm(bodyPath);
  const b = norm(itemPath);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.endsWith(`/${b}`) || b.endsWith(`/${a}`)) return true;
  const aBase = getArtifactFileName(a).toLowerCase();
  const bBase = getArtifactFileName(b).toLowerCase();
  return Boolean(aBase) && aBase === bBase;
}

function lineReferencesKnownDeliverable(line: string, fileItems: DeliverableItem[]): boolean {
  const paths = extractDeliverablePathsFromText(line);
  if (paths.length === 0) return false;
  return paths.every((bodyPath) => fileItems.some((item) => {
    const itemPath = item.resolvedPath || item.apiPath || item.path;
    return pathsReferToSameFile(bodyPath, itemPath);
  }));
}

function collapseBlankLines(text: string): string {
  return String(text || '').replace(/\n{3,}/g, '\n\n').trim();
}

function lineLooksLikeDeliverableSummaryRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (FOUR_COLUMN_TABLE_HEADER_RE.test(trimmed)) return true;
  return SUMMARY_ROW_RE.test(trimmed) || extractDeliverablePathsFromText(trimmed).length > 0;
}

/** Remove markdown pipe tables that list deliverable paths (with or without a heading). */
export function stripMarkdownPipeDeliverableTables(text: string): string {
  const lines = String(text || '').split('\n');
  const kept: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();
    if (!/^\|/.test(trimmed)) {
      kept.push(line);
      index += 1;
      continue;
    }

    const separator = lines[index + 1]?.trim() ?? '';
    if (!MARKDOWN_TABLE_SEPARATOR_RE.test(separator)) {
      kept.push(line);
      index += 1;
      continue;
    }

    let cursor = index + 2;
    let deliverableTable = lineLooksLikeDeliverableSummaryRow(trimmed);
    while (cursor < lines.length && /^\|/.test((lines[cursor] ?? '').trim())) {
      if (lineLooksLikeDeliverableSummaryRow(lines[cursor] ?? '')) {
        deliverableTable = true;
      }
      cursor += 1;
    }

    if (deliverableTable) {
      index = cursor;
      continue;
    }

    kept.push(line);
    index += 1;
  }

  return collapseBlankLines(kept.join('\n'));
}

function stripConsecutivePathBulletLists(text: string): string {
  const lines = String(text || '').split('\n');
  const kept: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();
    const isPathBullet = /^[-*•]\s+/.test(trimmed)
      && extractDeliverablePathsFromText(trimmed).length > 0;

    if (!isPathBullet) {
      kept.push(line);
      index += 1;
      continue;
    }

    let cursor = index + 1;
    while (cursor < lines.length) {
      const next = (lines[cursor] ?? '').trim();
      if (!next) break;
      if (/^[-*•]\s+/.test(next) && extractDeliverablePathsFromText(next).length > 0) {
        cursor += 1;
        continue;
      }
      break;
    }

    if (cursor - index >= 2) {
      index = cursor;
      continue;
    }

    kept.push(line);
    index += 1;
  }

  return collapseBlankLines(kept.join('\n'));
}

/** Remove markdown/text blocks that mimic the UI deliverable summary table. */
export function stripInlineDeliverableSummaryBlocks(text: string): string {
  const lines = String(text || '').split('\n');
  const kept: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!SUMMARY_HEADING_RE.test(line)) {
      kept.push(line);
      index += 1;
      continue;
    }

    let cursor = index + 1;
    while (cursor < lines.length) {
      const next = lines[cursor] ?? '';
      if (!next.trim()) break;
      if (SUMMARY_HEADING_RE.test(next)) break;
      if (DELIVERABLE_SECTION_HEADING_RE.test(next.trim())) break;
      if (!lineLooksLikeDeliverableSummaryRow(next)) break;
      cursor += 1;
    }
    index = cursor;
  }

  return stripConsecutivePathBulletLists(
    stripMarkdownPipeDeliverableTables(collapseBlankLines(kept.join('\n'))),
  );
}

/**
 * When the canonical DeliverableSummaryTable will render, keep body to conclusions only.
 */
export function stripRedundantDeliverableProseForSummaryTable(
  assistantText: string,
  items: DeliverableItem[],
  options?: { stripPathLabelsWithoutItems?: boolean },
): string {
  const fileItems = items.filter((item) => item.kind !== 'url');
  let result = stripInlineDeliverableSummaryBlocks(assistantText);
  const stripBarePathLabels = options?.stripPathLabelsWithoutItems === true;

  const kept: string[] = [];
  for (const line of result.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      kept.push(line);
      continue;
    }
    if (DOC_CREATED_LINE_RE.test(trimmed)) continue;
    if (DELIVERABLE_SECTION_HEADING_RE.test(trimmed)) continue;
    if (PATH_LABEL_LINE_RE.test(trimmed)) {
      if (stripBarePathLabels || lineReferencesKnownDeliverable(trimmed, fileItems)) continue;
    }
    if (/^\|/.test(trimmed) && lineLooksLikeDeliverableSummaryRow(trimmed)) {
      if (stripBarePathLabels || lineReferencesKnownDeliverable(trimmed, fileItems)) continue;
    }
    if (/^[-*•]\s+/.test(trimmed) && extractDeliverablePathsFromText(trimmed).length > 0) {
      if (stripBarePathLabels || lineReferencesKnownDeliverable(trimmed, fileItems)) continue;
    }
    if (fileItems.length > 0 && trimmed.length <= 240 && lineReferencesKnownDeliverable(trimmed, fileItems)) {
      const withoutPaths = trimmed.replace(/`[^`]+`/g, '').replace(/artifacts\/[^\s`]+/gi, '').trim();
      if (withoutPaths.length <= 48 || /^(?:见|路径|文件|成果|交付)/.test(withoutPaths)) continue;
    }
    kept.push(line);
  }

  return collapseBlankLines(kept.join('\n'));
}
