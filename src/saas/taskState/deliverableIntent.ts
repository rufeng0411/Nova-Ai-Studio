// PD-SAAS-FORK: shared deliverable intent detection for SDM compile / goal contract / UI
import type { AcceptanceArtifactKind } from "../deliverables/acceptanceArtifactKind.js";

const EXPLICIT_CHECKLIST_HEADER =
  /标准成果清单|standard\s+deliverables|须交付[：:]/i;

const HTML_REPORT_INTENT =
  /(?:写|做|生成|给我|需要|输出).{0,32}(?:html|HTML|网页).{0,16}(?:报告|清单|分析)/i;

const SINGLE_IMAGE_INTENT =
  /(?:海报|poster|生图|图片|png|jpg|jpeg|webp).{0,24}(?:9\s*[:：]\s*16|16\s*[:：]\s*9|竖版|竖屏)/i;

const PREDICTION_REPORT_INTENT =
  /(?:预测|赔率|胜率|赛前|对阵|vs|VS).{0,32}(?:报告|参考|分析)/i;

const SQUAD_HTML_INTENT =
  /(?:球员|教练|名单).{0,32}(?:html|HTML|网页|可视化)/i;

const GEO_EXPLICIT_INTENT =
  /(?:GEO|AEO|可见度|收录|关键词研究|SERP|geo-aeo|pd-geo|schema\.jsonld|visibility-report)/i;

const SAAS_GROWTH_FULL_GOAL =
  /增长全案|SaaS\s*增长全案|saas-growth-full|market-research\.md.*retrospective-template\.md/is;

/** PD-SAAS-FORK ES9: saas-growth-full template must not bind geo profile slots. */
export function isSaasGrowthFullGoal(userGoal: string, capabilitySlug?: string): boolean {
  const slug = String(capabilitySlug ?? "").trim().toLowerCase();
  const goal = String(userGoal ?? "");
  if (slug === "saas-growth-full" || slug === "mkt-growth") return true;
  return SAAS_GROWTH_FULL_GOAL.test(goal);
}

export function hasExplicitDeliverableChecklist(userGoal: string): boolean {
  return EXPLICIT_CHECKLIST_HEADER.test(String(userGoal ?? ""));
}

export function inferDeliverableIntentKinds(userGoal: string): AcceptanceArtifactKind[] {
  const goal = String(userGoal ?? "").trim();
  if (!goal) return [];
  const kinds = new Set<AcceptanceArtifactKind>();
  if (HTML_REPORT_INTENT.test(goal) || SQUAD_HTML_INTENT.test(goal)) kinds.add("html");
  if (SINGLE_IMAGE_INTENT.test(goal) || /\bimage-generation\b/i.test(goal)) kinds.add("image");
  if (/\.md|markdown|调研|报告/.test(goal) && !kinds.has("html")) kinds.add("markdown");
  if (/\.docx|word|brief/.test(goal)) kinds.add("docx");
  if (/\.pdf/.test(goal)) kinds.add("pdf");
  if (/\.pptx|幻灯/.test(goal)) kinds.add("pptx");
  return [...kinds];
}

/** Football prediction / squad reports must not bind geo-keyword profile. */
export function isNonGeoFootballReportGoal(userGoal: string): boolean {
  const goal = String(userGoal ?? "").trim();
  if (!goal) return false;
  if (PREDICTION_REPORT_INTENT.test(goal)) return true;
  if (SQUAD_HTML_INTENT.test(goal)) return true;
  if (/世界杯|world\s*cup/i.test(goal) && /(?:球员|教练|名单|预测|赔率|对阵)/i.test(goal)) {
    return true;
  }
  return false;
}

export function shouldBindGeoProfileForDeliverableIntent(
  userGoal: string,
  capabilitySlug?: string,
): boolean {
  const slug = String(capabilitySlug ?? "").trim().toLowerCase();
  if (isSaasGrowthFullGoal(userGoal, capabilitySlug)) return false;
  if (slug.startsWith("geo-") || slug === "mkt-ai-seo") return true;
  if (isNonGeoFootballReportGoal(userGoal)) return false;
  const goal = String(userGoal ?? "");
  // PD-SAAS-FORK ES9: 「AI搜索」 alone in growth workflows must not bind geo profile.
  if (/AI\s*搜索/.test(goal) && !GEO_EXPLICIT_INTENT.test(goal.replace(/AI\s*搜索/gi, ""))) {
    return false;
  }
  return GEO_EXPLICIT_INTENT.test(goal);
}

export function isThinkingTextPseudoPath(text: string): boolean {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return true;
  if (/然后考虑是否需要额外生成/i.test(trimmed)) return true;
  if (/\.meta-tag\.go$/i.test(trimmed)) return true;
  if (/^www\.go$/i.test(trimmed)) return true;
  if (!/artifacts\//i.test(trimmed) && !/\.(md|html|pdf|docx|png|jpg|json)$/i.test(trimmed)) {
    return false;
  }
  return false;
}
