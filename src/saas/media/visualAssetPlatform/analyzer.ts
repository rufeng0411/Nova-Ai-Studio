// PD-SAAS-FORK VAP: rule-based visual asset analysis (role + processingTier).

import type {
  AssetRole,
  ProcessingTier,
  SubjectMatch,
  VisualAssetEntry,
  VisualAssetSource,
} from "./types.js";

export type AnalyzeVisualAssetInput = {
  rawPath: string;
  source: VisualAssetSource;
  sourceUrl?: string;
  altText?: string;
  width?: number;
  height?: number;
  subject?: string;
  subjectAliases?: string[];
  capabilitySlug?: string;
  slotId?: string;
  hasAlpha?: boolean;
};

export type AnalyzeVisualAssetResult = {
  role: AssetRole;
  recommendedTier: ProcessingTier;
  needsMatting: boolean;
  subjectMatch: SubjectMatch;
  suggestedRecipes: string[];
};

function textBlob(input: AnalyzeVisualAssetInput): string {
  return [
    input.rawPath,
    input.sourceUrl ?? "",
    input.altText ?? "",
    input.slotId ?? "",
    input.capabilitySlug ?? "",
  ].join(" ").toLowerCase();
}

function matchSubject(input: AnalyzeVisualAssetInput): SubjectMatch {
  const aliases = [
    input.subject ?? "",
    ...(input.subjectAliases ?? []),
  ].map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (aliases.length === 0) return "unknown";
  const blob = textBlob(input);
  if (aliases.some((alias) => blob.includes(alias))) return "high";
  if (input.source === "official_fetch" || input.source === "authority_site") {
    return "medium";
  }
  if (input.source === "generate_image") return "low";
  return "unknown";
}

function inferRole(input: AnalyzeVisualAssetInput): AssetRole {
  const blob = textBlob(input);
  if (/\b(logo|wordmark|brand-mark)\b|标志|商标/u.test(blob)) return "logo";
  if (/\b(chart|diagram|mermaid|graph)\b|图表|数据图/u.test(blob)) {
    return "diagram_chart";
  }
  if (/\b(texture|gradient|background|bg)\b|纹理|背景/u.test(blob)) {
    return "texture_background";
  }
  if (/\b(person|portrait|spokesperson|model)\b|人物|代言|模特/u.test(blob)) {
    return "person_spokesperson";
  }
  if (/\b(lifestyle|scene|road|city|outdoor)\b|场景|路跑|生活/u.test(blob)) {
    return "lifestyle_scene";
  }
  if (/\b(detail|interior|close-?up)\b|内饰|细节/u.test(blob)) {
    return "product_detail";
  }
  if (
    /\b(hero|kv|poster|product|vehicle|car|g700)\b|主视觉|海报|产品|车型/u
      .test(blob)
  ) {
    return "product_hero";
  }
  if (input.width && input.height && input.width >= 1200 && input.height >= 600) {
    return "product_hero";
  }
  return "unknown";
}

function tierForRole(
  role: AssetRole,
  input: AnalyzeVisualAssetInput,
): { tier: ProcessingTier; recipes: string[] } {
  const slug = String(input.capabilitySlug ?? "").toLowerCase();
  const slot = String(input.slotId ?? "").toLowerCase();
  const isGeo = slug.includes("geo") || slug.includes("research");
  const isNova = slug.includes("nova-ppt") || slug.includes("aesthetic");
  const isCampaign = slug.includes("campaign") || slug.includes("brand-campaign");
  const isHtmlDemo = /html|demo|landing|website/u.test(slug + slot);

  if (role === "logo" || role === "diagram_chart" || role === "texture_background") {
    return { tier: "none", recipes: [] };
  }
  if (isGeo) {
    return { tier: "resize_only", recipes: ["report_inline"] };
  }
  if (role === "lifestyle_scene" || (isHtmlDemo && /hero|banner|bg/u.test(slot))) {
    return {
      tier: "crop_fit",
      recipes: isNova ? ["slide_scene_cover"] : ["landing_hero_wide"],
    };
  }
  if (isHtmlDemo && /parallax|layer|product/u.test(slot)) {
    return { tier: "matting_compose", recipes: ["parallax_product_layer"] };
  }
  if (isNova && (role === "product_hero" || /slide|product/u.test(slot))) {
    return { tier: "matting_compose", recipes: ["slide_hero_16x9"] };
  }
  if (isCampaign) {
    if (/square|1x1|1:1/u.test(slot)) {
      return { tier: "matting_compose", recipes: ["social_square_safe"] };
    }
    if (/16x9|16:9|wide/u.test(slot)) {
      return { tier: "matting_compose", recipes: ["social_wide"] };
    }
    if (/3x4|3:4|portrait/u.test(slot)) {
      return { tier: "matting_compose", recipes: ["social_portrait"] };
    }
    return { tier: "matting_compose", recipes: ["poster_portrait_9x16"] };
  }
  if (role === "person_spokesperson") {
    return { tier: "matting_compose", recipes: ["social_square_safe"] };
  }
  if (role === "product_detail") {
    return { tier: "crop_fit", recipes: ["slide_scene_cover"] };
  }
  if (role === "product_hero") {
    return { tier: "crop_fit", recipes: ["landing_hero_wide"] };
  }
  if (input.hasAlpha) {
    return { tier: "none", recipes: [] };
  }
  return { tier: "none", recipes: [] };
}

export function analyzeVisualAsset(
  input: AnalyzeVisualAssetInput,
): AnalyzeVisualAssetResult {
  const role = inferRole(input);
  const subjectMatch = matchSubject(input);
  const { tier, recipes } = tierForRole(role, input);
  // generate_image must never bind as high-confidence official product without review
  const adjustedMatch = input.source === "generate_image" && subjectMatch === "high"
    ? "medium" as const
    : subjectMatch;
  return {
    role,
    recommendedTier: tier,
    needsMatting: tier === "matting_compose",
    subjectMatch: adjustedMatch,
    suggestedRecipes: recipes,
  };
}

export function applyAnalysisToEntry(
  entry: VisualAssetEntry,
  analysis: AnalyzeVisualAssetResult,
): VisualAssetEntry {
  return {
    ...entry,
    role: analysis.role,
    recommendedTier: analysis.recommendedTier,
    needsMatting: analysis.needsMatting,
    subjectMatch: analysis.subjectMatch,
    suggestedRecipes: analysis.suggestedRecipes,
    processingStatus: analysis.recommendedTier === "none"
      ? "skipped"
      : entry.processingStatus === "ok"
        ? "ok"
        : "pending",
    preparedPath: analysis.recommendedTier === "none"
      ? entry.rawPath
      : entry.preparedPath,
  };
}
