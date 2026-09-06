/** PD-SAAS-FORK: 权威源 → 派生格式 — 引擎与 binding prompt 共用文案 */

import geoDualManifest from "../../config/geo-dual-report.manifest.json" with { type: "json" };

type GeoBinding = { slug: string; md: string; html: string };

const geoBindings = (geoDualManifest as { bindings?: GeoBinding[] }).bindings ?? [];
const slugsWithReportPairs = new Set(geoBindings.map((b) => b.slug));

export const CANONICAL_DERIVED_BLOCK_ZH = `派生交付（全局）：同一报告/分析/方案若要求多种格式，须先 write_file 完成权威源（默认结构化 .md），read_file 确认落盘后再生成派生格式（.html / .pdf / .docx / .pptx 等）；派生步骤须读取权威源，禁止未写源文件先交付派生格式。例外：原生即为该格式的交付（如 index.html 落地页、presentation.pptx、图片/视频/JSON 配置）不要求先写 md。`;

export const CANONICAL_DERIVED_BLOCK_EN = `Derived deliverables (global): when one report needs multiple formats, write the canonical source (default structured .md) first, read_file to confirm, then derive html/pdf/docx/pptx from that source; never deliver derived-only without the canonical file. Exceptions: native-format deliverables (index.html landing, presentation.pptx, images/video/json config) need no md first.`;

export const GEO_CANONICAL_DERIVED_HINT =
  "GEO 报告/分析类：先 write_file 完成同名 .md 并 read_file 确认，再 read_skill geo-dual-report 基于该 MD 生成同名 .html；监测类先 monitor-report.md 再 geo-monitor-report。禁止未写 MD 先写 HTML。";

export function slugHasGeoReportDerivation(slug: string, majorCategory?: string): boolean {
  const normalized = slug.trim().toLowerCase();
  if (slugsWithReportPairs.has(normalized)) return true;
  if (majorCategory === "geo" || normalized.startsWith("geo-") || normalized === "pd-geo") {
    return true;
  }
  return false;
}

export function resolveCanonicalDerivedBindingHint(
  slug: string,
  majorCategory?: string,
): string | undefined {
  if (slug === "geo-dual-report") {
    return "须 read_file 同目录源 .md 已存在后再 write_file 派生 .html；禁止凭空写 HTML。";
  }
  if (slug === "geo-monitor-report") {
    return "须先 write_file monitor-report.md，再基于 monitor-data.json + MD 生成 geo-monitor-report.html。";
  }
  if (slugHasGeoReportDerivation(slug, majorCategory)) {
    return GEO_CANONICAL_DERIVED_HINT;
  }
  return undefined;
}
