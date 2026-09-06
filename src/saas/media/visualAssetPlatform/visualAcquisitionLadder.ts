// PD-SAAS-FORK VAP: multi-tier visual acquisition ladder — try all safe channels before placeholder.



export type AcquisitionTierId =

  | "official_direct"

  | "official_roots"

  | "authority_industry"

  | "portal_general"

  | "search_engine_web"

  | "search_engine_image"

  | "html_image_extract"

  | "page_screenshot";



export type AcquisitionAttempt = {

  tier: AcquisitionTierId;

  method: string;

  target: string;

  ok: boolean;

  detail?: string;

  at: string;

};



/**

 * Ordered tiers — must exhaust before placeholder / user failure message.

 * Priority: official → industry authority → portals → search engines → extract → screenshot.

 */

export const ACQUISITION_TIER_ORDER: readonly AcquisitionTierId[] = [

  "official_direct",

  "official_roots",

  "authority_industry",

  "portal_general",

  "search_engine_web",

  "search_engine_image",

  "html_image_extract",

  "page_screenshot",

] as const;



const TIER_LABEL_ZH: Record<AcquisitionTierId, string> = {

  official_direct: "用户指定官网 URL 直抓",

  official_roots: "品牌官网根域扫描",

  authority_industry: "行业权威站（汽车之家/懂车帝/易车等）",

  portal_general: "综合门户/垂直站",

  search_engine_web: "网页搜索引擎（博查/Bing 等）定位权威页",

  search_engine_image: "图片搜索引擎（Bing Images 等）直取候选图",

  html_image_extract: "页面 HTML 候选图提取+本地化",

  page_screenshot: "页面视口截图兜底（Playwright）",

};



export function recordAcquisitionAttempt(

  attempts: AcquisitionAttempt[],

  input: Omit<AcquisitionAttempt, "at">,

): void {

  attempts.push({ ...input, at: new Date().toISOString() });

}



/** PD-SAAS-FORK ES9 P1-D: cap total acquisition attempts (default aligns with MEDIA_DEGRADE_AFTER×tiers). */
export function resolveVapAcquisitionCap(): number {
  const raw = process.env.PILOTDECK_VAP_ACQUISITION_CAP?.trim();
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const degradeRaw = process.env.PILOTDECK_MEDIA_DEGRADE_AFTER?.trim();
  const perResource = degradeRaw ? Number.parseInt(degradeRaw, 10) : 2;
  const perResourceSafe = Number.isFinite(perResource) && perResource > 0 ? perResource : 2;
  return perResourceSafe * ACQUISITION_TIER_ORDER.length;
}



export function isAcquisitionCapReached(attempts: AcquisitionAttempt[]): boolean {
  return attempts.length >= resolveVapAcquisitionCap();
}



export function tiersAttempted(attempts: AcquisitionAttempt[]): Set<AcquisitionTierId> {

  return new Set(attempts.map((item) => item.tier));

}



export function isAcquisitionLadderExhausted(

  attempts: AcquisitionAttempt[],

  localizedCount: number,

  minRequired = 1,

): boolean {

  if (localizedCount >= minRequired) return false;

  if (isAcquisitionCapReached(attempts)) return true;

  const tried = tiersAttempted(attempts);

  return ACQUISITION_TIER_ORDER.every((tier) => tried.has(tier));

}



export function buildAcquisitionFailureMessage(

  attempts: AcquisitionAttempt[],

  language: "zh-CN" | "en" = "zh-CN",

): string {

  if (language === "en") {

    const summary = ACQUISITION_TIER_ORDER.map((tier) => {

      const rows = attempts.filter((item) => item.tier === tier);

      const status = rows.some((item) => item.ok) ? "partial" : rows.length > 0 ? "failed" : "skipped";

      return `${tier}=${status}`;

    }).join(", ");

    return `All configured acquisition tiers were attempted (${summary}). Disclose the gap in deliverables; do not use generate_image or unlabeled SVG as official product photos.`;

  }

  const lines = ACQUISITION_TIER_ORDER.map((tier) => {

    const rows = attempts.filter((item) => item.tier === tier);

    if (rows.length === 0) return `- ${TIER_LABEL_ZH[tier]}：未执行`;

    const ok = rows.filter((item) => item.ok).length;

    return `- ${TIER_LABEL_ZH[tier]}：已尝试 ${rows.length} 次${ok > 0 ? `（${ok} 次有候选）` : "（均无可用图）"}`;

  });

  return [

    "已按安全策略依次尝试多种配图渠道（含官网、权威站、门户、网页/图片搜索引擎、HTML 提取、视口截图），仍未取得可用素材：",

    ...lines,

    "请在成果中如实说明缺口，禁止用 generate_image 或无名 SVG 冒充官图；可标注「配图待补」。",

  ].join("\n");

}



export function buildAcquisitionStrategyBlock(

  language: "zh-CN" | "en" = "zh-CN",

): string {

  if (language === "en") {

    return `<visual-acquisition-ladder>

When images are required: call resolve_session_visual_assets ONCE — it runs, in order: user official URLs → brand roots → industry authority sites → portals → web search (Bocha/Bing) → image search (Bing Images) → HTML candidate extraction → bounded page screenshot. Only after ALL tiers fail may you disclose acquisition failure. Never use generate_image for official product photos when official_only applies.

</visual-acquisition-ladder>`;

  }

  return `<visual-acquisition-ladder>

需要配图时：优先一次调用 resolve_session_visual_assets，系统将按序自动尝试——① 用户官网 URL ② 品牌根域 ③ 行业权威站 ④ 综合门户 ⑤ 网页搜索引擎（博查/Bing，定位权威页） ⑥ 图片搜索引擎（Bing Images 直取候选图） ⑦ HTML 候选提取并本地化 ⑧ 视口截图兜底。全部渠道安全尝试仍失败时，才可在成果中说明「多次尝试仍无法获取配图」；official_only 任务禁止 generate_image/SVG 冒充官图。

</visual-acquisition-ladder>`;

}

