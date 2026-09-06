// PD-SAAS-FORK: single-source creative prefer-generate_image intent (resolver / VAP / degrade / binding).

import { compileOfficialMediaRequirement } from "../constraints/officialMediaRequirement.js";
import { isImageApiReady, type MediaRuntimeEnv } from "./mediaRuntimeProbe.js";
import {
  isPreferGenerateImageEnabled,
  resolvePreferGenerateImageMode,
  type PreferGenerateImageMode,
} from "./preferGenerateImageFlags.js";

const CREATIVE_SLUG_PATTERN =
  /^(?:od-poster-hero|od-article-magazine|od-social-carousel|od-image-gen|od-saas-landing|od-waitlist-page|od-blog-post|od-gamified-app|od-deck-swiss|od-social-x-card|open-design)$/i;

const CREATIVE_GOAL_STRONG =
  /(?:海报|封面|主视觉|KV|平面设计|插画|杂志配图|Hero\s*插画|活动长图|真图轮播|竖版海报|分享长图|配图幻灯|AI\s*配图|AI\s*绘图|generate_image|生图|出海报图|做封面图|poster|key\s*-?\s*visual|magazine\s*art|hero\s*image|cover\s*image)/iu;

/** Bare「配图」needs a visual-delivery co-signal. */
const BARE_IMAGE_WORD = /(?:配图|图片|插图|imagery|illustration)/iu;
const VISUAL_DELIVERY_COSIGNAL =
  /(?:html|网页|落地页|landing|海报|封面|主视觉|幻灯|页面|page|carousel|轮播|hero|showcase)/iu;

const EXCLUDE_GOAL =
  /(?:线框|wireframe|OKR|看板|kanban|FAQ|帮助中心|docs-page|文档站|pm-spec|产品规格|不要配图|勿生图|纯排版|禁止生图|不要AI生图|brand-campaign-full)/iu;

const EXCLUDE_SLUG =
  /(?:od-wireframe|od-team-okrs|od-kanban|od-faq|od-docs-page|od-pm-spec|od-meeting-notes|geo-|nova-research)/i;

function isResearchMdOnlyGoal(goal: string): boolean {
  if (!/(?:调研|研究报告|市场研究|nova-research)/iu.test(goal)) return false;
  if (/(?:html|海报|封面|主视觉|生图|配图页)/iu.test(goal)) return false;
  if (/\.html?\b/i.test(goal)) return false;
  return /(?:\.md\b|markdown|须交付)/iu.test(goal) || /研究报告/.test(goal);
}

export function wantsCreativeGenerateImage(goal: string, slug?: string): boolean {
  const g = String(goal ?? "");
  const s = String(slug ?? "").toLowerCase();
  if (CREATIVE_SLUG_PATTERN.test(s)) return true;
  if (CREATIVE_GOAL_STRONG.test(g)) return true;
  if (BARE_IMAGE_WORD.test(g) && VISUAL_DELIVERY_COSIGNAL.test(g)) return true;
  return false;
}

/** Align with mediaStrategyResolver official_fetch short-circuit phrases. */
const OFFICIAL_IMAGE_GOAL =
  /(?:官方(?:渠道)?(?:图片|配图|图像|素材|产品图)|官网(?:图片|配图|素材|产品图)|fetch_page_images)/iu;

export function excludesCreativeGenerateImage(goal: string, slug?: string): boolean {
  const g = String(goal ?? "");
  const s = String(slug ?? "").toLowerCase();
  const official = compileOfficialMediaRequirement(g);
  if (official.officialMediaPolicy !== "none") return true;
  if (official.forbidGenerateImage) return true;
  if (OFFICIAL_IMAGE_GOAL.test(g)) return true;
  if (EXCLUDE_GOAL.test(g)) return true;
  if (EXCLUDE_SLUG.test(s)) return true;
  if (s.includes("brand-campaign") || /品牌全案|campaign\s*全案/iu.test(g)) {
    if (/(?:官网|官图|官方素材|官方产品图)/iu.test(g)) return true;
  }
  if (isResearchMdOnlyGoal(g)) return true;
  if (/^nova-research/i.test(s) && !/(?:html|海报|配图|生图)/iu.test(g)) return true;
  return false;
}

export type CreativePreferGenInput = {
  goal: string;
  slug?: string;
  env?: MediaRuntimeEnv;
};

/**
 * Prefer-generate track is active (shadow|enforce): used to bypass auto-VAP / VAP-first copy.
 * Does NOT require image API readiness (API-not-ready still skips VAP and shows notice).
 */
export function isCreativePreferGenActive(input: CreativePreferGenInput): boolean {
  const env = input.env ?? (typeof process !== "undefined" ? process.env : {});
  if (!isPreferGenerateImageEnabled(env)) return false;
  const goal = String(input.goal ?? "");
  const slug = input.slug;
  if (excludesCreativeGenerateImage(goal, slug)) return false;
  return wantsCreativeGenerateImage(goal, slug);
}

/** Route to generate_image strategy only when API ready. */
export function shouldRouteCreativeGenerateImage(input: CreativePreferGenInput): boolean {
  if (!isCreativePreferGenActive(input)) return false;
  const env = input.env ?? (typeof process !== "undefined" ? process.env : {});
  return isImageApiReady(env);
}

export function creativePreferMode(
  env?: MediaRuntimeEnv,
): PreferGenerateImageMode {
  return resolvePreferGenerateImageMode(env);
}
