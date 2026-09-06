/**
 * PD-SAAS-FORK: GEO 分析报告 MD+HTML 双交付 — manifest 与提示词扩展
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'config', 'geo-dual-report.manifest.json');

let cachedManifest = null;

export function loadGeoDualReportManifest() {
  if (cachedManifest) return cachedManifest;
  if (!existsSync(MANIFEST_PATH)) {
    return { bindings: [], reportTypes: {}, excludeMd: [] };
  }
  cachedManifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  return cachedManifest;
}

/** Strip Chinese/full-width parens and ASCII parens annotations from deliverable labels. */
export function stripDeliverableAnnotation(text) {
  return String(text ?? '')
    .trim()
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract basename only (first path token before list separators). */
export function deliverableBasenameOnly(text) {
  const stripped = stripDeliverableAnnotation(text);
  const first = stripped.split(/[、,，;；+＋]/)[0]?.trim() ?? '';
  const mdMatch = first.match(/([^\s/\\]+\.(?:md|markdown|html?|pdf|docx?|pptx?|json(?:ld)?|png|jpe?g|csv|xlsx?|mp4|mp3|svg|txt))\b/i);
  return mdMatch?.[1] ?? first;
}

/** @param {string} mdFilename e.g. keywords.md */
export function htmlPairForMd(mdFilename) {
  const base = deliverableBasenameOnly(mdFilename);
  if (!base.endsWith('.md')) return null;
  return base.replace(/\.md$/i, '.html');
}

/**
 * @param {string} slug
 * @returns {Array<{ md: string; html: string; type: string }>}
 */
export function bindingsForSlug(slug) {
  const manifest = loadGeoDualReportManifest();
  return (manifest.bindings || []).filter((b) => b.slug === slug);
}

/**
 * @param {string} slug
 * @returns {string[]}
 */
export function expandedGeoDeliverables(slug) {
  const bindings = bindingsForSlug(slug);
  if (bindings.length === 0) {
    return ['geo-deliverable.md', 'geo-deliverable.html'];
  }
  const out = [];
  for (const b of bindings) {
    out.push(b.md);
    out.push(b.html);
  }
  return out;
}

/**
 * 将 HUB 交付清单中的 GEO 分析 MD 自动补上 HTML 对
 * @param {string[]} deliverables
 * @param {string} [slug]
 */
export function appendHtmlPairsToDeliverables(deliverables, slug) {
  if (!Array.isArray(deliverables)) return deliverables;
  const manifest = loadGeoDualReportManifest();
  const exclude = new Set((manifest.excludeMd || []).map(String));
  const bindingByMd = new Map();
  for (const b of manifest.bindings || []) {
    if (slug && b.slug !== slug) continue;
    bindingByMd.set(b.md, b.html);
  }

  const result = [];
  const seen = new Set();

  for (const item of deliverables) {
    const rawParts = String(item).split(/[、,，;；+＋]/).map((p) => p.trim()).filter(Boolean);
    for (const rawPart of rawParts.length > 0 ? rawParts : [item]) {
      const basename = deliverableBasenameOnly(rawPart);
      if (!basename || seen.has(basename)) continue;
      result.push(basename);
      seen.add(basename);

      const mdMatch = basename.match(/([a-z0-9][a-z0-9._-]*\.md)/i);
      if (!mdMatch) continue;
      const mdName = mdMatch[1];
      if ([...exclude].some((ex) => mdName.includes(ex) || basename.includes(ex))) continue;

      const htmlName =
        bindingByMd.get(mdName) ||
        htmlPairForMd(mdName);
      if (!htmlName || seen.has(htmlName)) continue;

      result.push(htmlName);
      seen.add(htmlName);
    }
  }

  return result;
}

export const GEO_DUAL_REPORT_SKILL = 'geo-dual-report';

export const GEO_DUAL_REPORT_INSTRUCTION =
  '须先 write_file 完成分析报告 .md 并 read_file 确认落盘，再 read_skill geo-dual-report 读取该 MD 生成同 basename 的 .html（Chart.js、KPI、动效）；禁止未写 MD 先写 HTML。监测类末步仍优先 geo-monitor-report。';
