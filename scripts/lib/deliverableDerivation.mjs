/**
 * PD-SAAS-FORK: 权威源 → 派生格式策略（脚本侧）
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bindingsForSlug, loadGeoDualReportManifest } from './geoDualReport.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'config', 'deliverable-derivation.manifest.json');

let cached = null;

export function loadDeliverableDerivationManifest() {
  if (cached) return cached;
  if (!existsSync(MANIFEST_PATH)) {
    return { globalRule: {}, exceptions: [], domainManifests: {} };
  }
  cached = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  return cached;
}

/** Hub「试一下」：禁止 read_skill */
export const GEO_CANONICAL_DERIVED_HUB_ZH =
  'GEO 报告/分析类：须先 write_file 完成同名 .md 并 read_file 确认，再生成同名 .html；禁止未写 MD 先写 HTML。';

/** 流程模板 / 执行绑定：可含 read_skill */
export const GEO_CANONICAL_DERIVED_EXEC_ZH =
  'GEO 报告/分析类：先 write_file 完成同名 .md 并 read_file 确认，再 read_skill geo-dual-report 读 MD 生成同名 .html；监测类先 monitor-report.md 再 read_skill geo-monitor-report。';

export const CANONICAL_DERIVED_HUB_ZH =
  '同一报告若含 .md 与 .html/.pdf/.docx 等：须先 write_file 完成 .md 并 read_file 确认，再生成派生格式；禁止未写 MD 先写 HTML。';

export const CANONICAL_DERIVED_EXEC_ZH =
  'For md+html/pdf/docx pairs: write_file the .md first, read_file to confirm, then derive other formats; never deliver HTML-only without the md source.';

/**
 * @param {string} slug
 * @param {string} [majorCategory]
 */
export function slugHasCanonicalDerivedPair(slug, majorCategory) {
  const bindings = bindingsForSlug(slug);
  if (bindings.length > 0) return true;
  if (majorCategory === 'geo' || slug.startsWith('geo-') || slug === 'pd-geo') return true;
  return false;
}

/**
 * @param {string} text
 * @param {string} slug
 * @param {string} [majorCategory]
 * @param {{ hub?: boolean }} [options]
 */
export function appendCanonicalDerivedInstruction(text, slug, majorCategory, options = {}) {
  const hub = Boolean(options.hub);
  let out = String(text ?? '').trim();
  if (!out) return out;
  if (/先.*\.md|权威源|未写 MD|read_file 确认/.test(out)) return out;

  const geoLine = hub ? GEO_CANONICAL_DERIVED_HUB_ZH : GEO_CANONICAL_DERIVED_EXEC_ZH;
  const genericLine = hub ? CANONICAL_DERIVED_HUB_ZH : CANONICAL_DERIVED_EXEC_ZH;

  if (slugHasCanonicalDerivedPair(slug, majorCategory)) {
    out += `\n${geoLine}`;
    return out;
  }

  const deliverables = resolveDeliverablesHint(slug);
  if (deliverables.hasMd && deliverables.hasDerived) {
    out += `\n${genericLine}`;
  }
  return out;
}

/**
 * @param {string} slug
 */
function resolveDeliverablesHint(slug) {
  const bindings = bindingsForSlug(slug);
  const hasMd = bindings.some((b) => b.md?.endsWith('.md'));
  const hasDerived = bindings.some((b) => b.html?.endsWith('.html'));
  return { hasMd, hasDerived };
}

export function geoDualReportBindingsCount() {
  return (loadGeoDualReportManifest().bindings || []).length;
}
