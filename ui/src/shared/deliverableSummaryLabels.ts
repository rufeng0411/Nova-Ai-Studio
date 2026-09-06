// PD-SAAS-FORK: infer human-readable deliverable names for summary table
import type { DeliverableKind } from './artifactPaths';
import { getArtifactFileName, normalizeArtifactPath } from './artifactPaths';

/** 表头：名称/标题列（文档标题，如「审计清单」） */
const NAME_COLUMN_HEADERS = ['说明', '名称', '标题', '描述', '成果', '交付物', '内容', '阶段', '模块', '格式'];
/** 表头：文件/路径列（真实文件名） */
const FILE_COLUMN_HEADERS = ['文件', '路径', '文件路径', '文件名', '文件链接'];

/** pd-geo 与常见交付物标准标题（对齐 skills/pd-geo/references/pilotdeck-setup.md） */
const KNOWN_BASENAME_LABELS: Record<string, string> = {
  'audit-checklist': '审计清单',
  'audit-checklist.md': '审计清单',
  'aeo-audit': 'AEO 审计',
  'aeo-audit.md': 'AEO 审计',
  'keywords': '关键词与验证问句',
  'keywords.md': '关键词与验证问句',
  'optimized': '优化主稿',
  'optimized.md': '优化主稿',
  'optimized.docx': '优化稿 Word 版',
  'schema.jsonld': '结构化数据',
  'score-estimate': '评分评估',
  'score-estimate.md': '评分评估',
  'score.json': '工具评分',
  'verify-report.json': '提及验证报告',
  'verification-plan': '验证计划',
  'verification-plan.md': '验证计划',
  'report': '摘要报告',
  'report.md': '摘要报告',
  'visibility-report.html': '可见度周报',
  'index.html': '主页面',
  'index.htm': '主页面',
  'slide-manifest.json': '幻灯清单',
  'report.html': '报告网页',
  'report.pdf': '报告 PDF',
  'report.docx': '报告 Word',
};

const GEO_BRAND_PREFIX_BASENAMES = new Set([
  'report',
  'report.md',
  'report.html',
  'visibility-report.html',
]);

function normalizeLookupKey(pathOrName: string): string {
  const normalized = normalizeArtifactPath(pathOrName).replace(/^\/+/, '');
  return normalized.toLowerCase();
}

function basenameKey(pathOrName: string): string {
  return getArtifactFileName(normalizeArtifactPath(pathOrName)).toLowerCase();
}

function extractGeoBrandFromPath(path: string): string | null {
  const normalized = normalizeArtifactPath(path).replace(/\\/g, '/');
  const match = normalized.match(/(?:^|\/)artifacts\/geo\/([^/]+)\//i);
  return match?.[1]?.trim() || null;
}

function maybeApplyGeoBrandPrefix(path: string, title: string): string {
  const brand = extractGeoBrandFromPath(path);
  if (!brand || title.includes(brand)) return title;
  const base = basenameKey(path);
  if (!GEO_BRAND_PREFIX_BASENAMES.has(base)) return title;
  return `${brand}${title}`;
}

function isWeakDocumentTitle(label: string): boolean {
  const trimmed = String(label ?? '').trim();
  if (!trimmed) return true;
  if (/^\d+\.?$/.test(trimmed)) return true;
  if (/^[①②③④⑤⑥⑦⑧⑨⑩]$/.test(trimmed)) return true;
  if (/^(?:markdown|html|word|json|pdf|ppt|excel|csv|png|jpe?g|mp4)$/i.test(trimmed)) return true;
  return false;
}

function isLikelyDocumentTitle(label: string): boolean {
  const trimmed = String(label ?? '').trim();
  if (!trimmed || isWeakDocumentTitle(trimmed)) return false;
  if (/\.(?:html?|md|pdf|docx?|pptx|png|jpe?g|csv|json(?:ld)?)$/i.test(trimmed)) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  if (/^\/(?:artifacts|geo)\//i.test(trimmed)) return false;
  return true;
}

function registerLabel(
  map: Map<string, string>,
  pathOrName: string,
  label: string,
): void {
  const trimmedLabel = String(label ?? '').trim();
  const trimmedPath = String(pathOrName ?? '').trim();
  if (!trimmedLabel || !trimmedPath) return;
  if (!isLikelyDocumentTitle(trimmedLabel)) return;
  map.set(normalizeLookupKey(trimmedPath), trimmedLabel);
  map.set(basenameKey(trimmedPath), trimmedLabel);
}

/** 优先匹配更长表头 token；同列多命中时取得分最高的一列 */
function headerIndex(headers: string[], candidates: string[]): number {
  const sorted = [...candidates].sort((a, b) => b.length - a.length);
  let bestIdx = -1;
  let bestScore = -1;
  headers.forEach((header, idx) => {
    for (const candidate of sorted) {
      if (header === candidate || header.includes(candidate)) {
        if (candidate.length > bestScore) {
          bestScore = candidate.length;
          bestIdx = idx;
        }
        break;
      }
    }
  });
  return bestIdx;
}

function parseMarkdownTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return null;
  const cells = trimmed
    .split('|')
    .map((cell) => cell.trim())
    .filter((cell, index, arr) => !(index === 0 && cell === '') && !(index === arr.length - 1 && cell === ''));
  if (cells.length < 2) return null;
  return cells;
}

function parseTabRow(line: string): string[] | null {
  if (!line.includes('\t')) return null;
  const cells = line.split('\t').map((cell) => cell.trim()).filter(Boolean);
  return cells.length >= 2 ? cells : null;
}

function parseInlineDeliverableLabels(text: string, map: Map<string, string>): void {
  const source = String(text ?? '');

  for (const match of source.matchAll(/([^\s/\\|`'"<>]+\.[a-z0-9]{2,5})\s*[（(]([^）)\n]{2,40})[）)]/gi)) {
    registerLabel(map, match[1] ?? '', match[2] ?? '');
  }

  for (const match of source.matchAll(/([\u4e00-\u9fff][\u4e00-\u9fff\w\s·—-]{0,24}?)\s*[：:→›>]\s*[`'"]?([^\s`'"<>]+\.[a-z0-9]{2,5})[`'"]?/g)) {
    registerLabel(map, match[2] ?? '', match[1] ?? '');
  }

  for (const match of source.matchAll(/[`'"]([^\s`'"]+\.[a-z0-9]{2,5})[`'"]\s*[—\-–|｜]\s*([\u4e00-\u9fff][^\n|]{2,40})/g)) {
    registerLabel(map, match[1] ?? '', match[2] ?? '');
  }

  for (const match of source.matchAll(/\*\*([^*]{2,40})\*\*[^`\n]{0,80}?[`'"]?([^\s`'"<>]+\.[a-z0-9]{2,5})/g)) {
    registerLabel(map, match[2] ?? '', match[1] ?? '');
  }
}

export function parseDeliverableLabelsFromAssistantText(text: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = String(text ?? '').split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const markdownCells = parseMarkdownTableRow(lines[index] ?? '');
    const cells = markdownCells ?? parseTabRow(lines[index] ?? '');
    if (!cells) continue;

    const nameIdx = headerIndex(cells, NAME_COLUMN_HEADERS);
    const fileIdx = headerIndex(cells, FILE_COLUMN_HEADERS);
    if (nameIdx >= 0 && fileIdx >= 0 && nameIdx !== fileIdx) {
      for (let row = index + 1; row < lines.length; row += 1) {
        const rowCells = parseMarkdownTableRow(lines[row] ?? '') ?? parseTabRow(lines[row] ?? '');
        if (!rowCells) break;
        if (rowCells.every((cell) => /^:?-{2,}:?$/.test(cell))) continue;
        const label = rowCells[nameIdx] ?? '';
        const fileRef = rowCells[fileIdx] ?? '';
        registerLabel(map, fileRef, label);
      }
      continue;
    }

    if (cells.length >= 2 && !cells.some((cell) => NAME_COLUMN_HEADERS.concat(FILE_COLUMN_HEADERS).some((h) => cell.includes(h)))) {
      const [first, second] = cells;
      if (/\.[a-z0-9]{2,5}$/i.test(second) || second.includes('/')) {
        registerLabel(map, second, first);
      } else if (/\.[a-z0-9]{2,5}$/i.test(first) || first.includes('/')) {
        registerLabel(map, first, second);
      }
    }
  }

  parseInlineDeliverableLabels(text, map);
  return map;
}

function kindFallbackLabel(kind: DeliverableKind, fileName: string): string {
  switch (kind) {
    case 'html':
      return '网页';
    case 'pdf':
      return 'PDF';
    case 'document':
      return fileName.endsWith('.docx') || fileName.endsWith('.doc') ? 'Word 文档' : 'Markdown 文稿';
    case 'presentation':
      return '演示文稿';
    case 'spreadsheet':
      return '表格';
    case 'image':
      return '图片';
    case 'video':
      return '视频';
    case 'design_canvas':
      return '设计画布';
    default:
      return '交付文件';
  }
}

function fallbackNameFromFileName(fileName: string, kind: DeliverableKind, fullPath: string): string {
  const base = fileName.replace(/\.[^.]+$/, '');
  const stripped = base.replace(/^\d+[-_.\s]*/, '').trim();
  const known = KNOWN_BASENAME_LABELS[fileName.toLowerCase()] ?? KNOWN_BASENAME_LABELS[stripped.toLowerCase()];
  if (known) return maybeApplyGeoBrandPrefix(fullPath, known);
  if (/[\u4e00-\u9fff]/.test(stripped)) return maybeApplyGeoBrandPrefix(fullPath, stripped);
  if (stripped && stripped !== base) {
    const words = stripped.replace(/[-_]+/g, ' ').trim();
    if (words) return words;
  }
  return maybeApplyGeoBrandPrefix(fullPath, kindFallbackLabel(kind, fileName));
}

export type ResolveDeliverableDisplayNameOptions = {
  /** When set (SDM slot label), never override from assistant-text label map. */
  manifestLabel?: string;
  /** When true, skip parsing assistant text labels entirely. */
  preferManifestLabel?: boolean;
};

export function resolveDeliverableDisplayName(
  path: string,
  kind: DeliverableKind,
  labelMap: Map<string, string>,
  options?: ResolveDeliverableDisplayNameOptions,
): string {
  const manifestLabel = String(options?.manifestLabel ?? "").trim();
  if (manifestLabel && !isWeakDocumentTitle(manifestLabel)) {
    return maybeApplyGeoBrandPrefix(normalizeArtifactPath(path), manifestLabel);
  }
  if (options?.preferManifestLabel) {
    const normalized = normalizeArtifactPath(path);
    const fileName = getArtifactFileName(normalized) || normalized;
    return fallbackNameFromFileName(fileName, kind, normalized);
  }
  const normalized = normalizeArtifactPath(path);
  const fileName = getArtifactFileName(normalized) || normalized;
  const fromMap = labelMap.get(normalizeLookupKey(normalized))
    ?? labelMap.get(basenameKey(normalized));
  if (fromMap && !isWeakDocumentTitle(fromMap)) {
    return maybeApplyGeoBrandPrefix(normalized, fromMap);
  }
  return fallbackNameFromFileName(fileName, kind, normalized);
}

export function formatDeliverableLinkPath(path: string): string {
  const normalized = normalizeArtifactPath(path).replace(/\\/g, '/');
  if (!normalized) return '';
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}
