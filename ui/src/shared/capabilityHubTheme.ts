/** 能力中心唯一主题源：营销飞轮 1–6、教育学段、五大类的配色与图标（全页与模板弹层共用） */
/** 去彩原则：图标容器统一中性 bg-muted 底、仅 glyph 着类目色；彩色只用于状态点、激活环与小面积标签 */

import type { LucideIcon } from 'lucide-react';
import {
  Megaphone,
  Briefcase,
  Palette,
  Code2,
  GraduationCap,
  Search,
  Lightbulb,
  Sparkles,
  Send,
  Rocket,
  BarChart3,
  Layers,
  Brain,
  Radar,
  Radio,
  Landmark,
  Scale,
} from 'lucide-react';
import { EDUCATION_BAND_ORDER, capabilityMatchesEducationBand } from './educationBands.js';

export { EDUCATION_BAND_ORDER, capabilityMatchesEducationBand };

/** 营销品牌监测飞轮（1–6） */
export const MARKETING_FLYWHEEL_ORDER = [
  'research',
  'strategy',
  'create',
  'activate',
  'distribute',
  'measure',
] as const;

/** PD-SAAS-FORK: GEO 独立 Tab 专业六段 */
export const GEO_FLYWHEEL_ORDER = [
  'geo_baseline',
  'geo_strategy',
  'geo_citability',
  'geo_technical',
  'geo_distribution',
  'geo_monitor',
] as const;

/** PD-SAAS-FORK: 媒体 Tab L2 赛道 */
export const MEDIA_LANE_ORDER = ['media_ooh', 'media_digital'] as const;

export const MEDIA_WORKFLOW_ORDER = {
  media_ooh: ['ooh_brief', 'ooh_strategy', 'ooh_planning', 'ooh_creative', 'ooh_traffic', 'ooh_measure'] as const,
  media_digital: ['dig_brief', 'dig_plan', 'dig_setup', 'dig_creative', 'dig_launch', 'dig_optimize', 'dig_report'] as const,
};

export const MEDIA_STAGE_ID = 'media' as const;

/** @deprecated 请用 MARKETING_FLYWHEEL_ORDER；保留别名避免遗漏引用 */
export const FLYWHEEL_ORDER = MARKETING_FLYWHEEL_ORDER;

export type EducationBandId = (typeof EDUCATION_BAND_ORDER)[number];

export const DEFAULT_EDUCATION_BAND: EducationBandId = 'preschool';

/** 与营销飞轮分开的独立教育阶段 */
export const EDUCATION_STAGE_ID = 'education' as const;

/** 脑爆大类阶段 */
export const BRAINSTORMING_STAGE_ID = 'brainstorming' as const;

/** 金融大类阶段 */
export const FINANCE_STAGE_ID = 'finance' as const;

/** PD-SAAS-FORK: 企业合规大类阶段 */
export const ENTERPRISE_COMPLIANCE_STAGE_ID = 'enterprise_compliance' as const;

export type HubMajorCategory =
  | 'marketing'
  | 'media'
  | 'geo'
  | 'finance'
  | 'enterprise_compliance'
  | 'office'
  | 'creation'
  | 'development'
  | 'brainstorming'
  | 'education';

export type HubVisualTheme = {
  /** 上下文条 / 标签底色 */
  badge: string;
  /** 卡片左色条 */
  accent: string;
  /** 圆点 / 进度指示 */
  dot: string;
  /** 卡片图标容器（中性底 + 类目色图标） */
  icon: string;
  /** 激活态外环 */
  ring: string;
};

function theme(
  badge: string,
  accent: string,
  dot: string,
  icon: string,
  ring: string,
): HubVisualTheme {
  return { badge, accent, dot, icon, ring };
}

/** 营销飞轮阶段主题：冷色渐变 teal → sky → indigo → violet → slate → zinc */
export const STAGE_THEME: Record<string, HubVisualTheme> = {
  education: theme(
    'bg-amber-500/[0.08] text-amber-700 dark:text-amber-300',
    'border-l-amber-500/60',
    'bg-amber-500',
    'bg-muted text-amber-600 dark:text-amber-400',
    'ring-amber-400/25',
  ),
  research: theme(
    'bg-teal-500/[0.08] text-teal-700 dark:text-teal-300',
    'border-l-teal-500/60',
    'bg-teal-500',
    'bg-muted text-teal-600 dark:text-teal-400',
    'ring-teal-400/25',
  ),
  strategy: theme(
    'bg-sky-500/[0.08] text-sky-700 dark:text-sky-300',
    'border-l-sky-500/60',
    'bg-sky-500',
    'bg-muted text-sky-600 dark:text-sky-400',
    'ring-sky-400/25',
  ),
  create: theme(
    'bg-indigo-500/[0.08] text-indigo-700 dark:text-indigo-300',
    'border-l-indigo-500/60',
    'bg-indigo-500',
    'bg-muted text-indigo-600 dark:text-indigo-400',
    'ring-indigo-400/25',
  ),
  activate: theme(
    'bg-violet-500/[0.08] text-violet-700 dark:text-violet-300',
    'border-l-violet-500/60',
    'bg-violet-500',
    'bg-muted text-violet-600 dark:text-violet-400',
    'ring-violet-400/25',
  ),
  distribute: theme(
    'bg-slate-500/[0.08] text-slate-700 dark:text-slate-300',
    'border-l-slate-500/60',
    'bg-slate-500',
    'bg-muted text-slate-600 dark:text-slate-400',
    'ring-slate-400/25',
  ),
  measure: theme(
    'bg-zinc-500/[0.08] text-zinc-700 dark:text-zinc-300',
    'border-l-zinc-500/60',
    'bg-zinc-500',
    'bg-muted text-zinc-600 dark:text-zinc-400',
    'ring-zinc-400/25',
  ),
  geo_baseline: theme(
    'bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-300',
    'border-l-emerald-500/60',
    'bg-emerald-500',
    'bg-muted text-emerald-600 dark:text-emerald-400',
    'ring-emerald-400/25',
  ),
  geo_strategy: theme(
    'bg-teal-500/[0.08] text-teal-700 dark:text-teal-300',
    'border-l-teal-500/60',
    'bg-teal-500',
    'bg-muted text-teal-600 dark:text-teal-400',
    'ring-teal-400/25',
  ),
  geo_citability: theme(
    'bg-sky-500/[0.08] text-sky-700 dark:text-sky-300',
    'border-l-sky-500/60',
    'bg-sky-500',
    'bg-muted text-sky-600 dark:text-sky-400',
    'ring-sky-400/25',
  ),
  geo_technical: theme(
    'bg-indigo-500/[0.08] text-indigo-700 dark:text-indigo-300',
    'border-l-indigo-500/60',
    'bg-indigo-500',
    'bg-muted text-indigo-600 dark:text-indigo-400',
    'ring-indigo-400/25',
  ),
  geo_distribution: theme(
    'bg-violet-500/[0.08] text-violet-700 dark:text-violet-300',
    'border-l-violet-500/60',
    'bg-violet-500',
    'bg-muted text-violet-600 dark:text-violet-400',
    'ring-violet-400/25',
  ),
  geo_monitor: theme(
    'bg-cyan-500/[0.08] text-cyan-700 dark:text-cyan-300',
    'border-l-cyan-500/60',
    'bg-cyan-500',
    'bg-muted text-cyan-600 dark:text-cyan-400',
    'ring-cyan-400/25',
  ),
  media_ooh: theme(
    'bg-orange-500/[0.08] text-orange-700 dark:text-orange-300',
    'border-l-orange-500/60',
    'bg-orange-500',
    'bg-muted text-orange-600 dark:text-orange-400',
    'ring-orange-400/25',
  ),
  media_digital: theme(
    'bg-blue-500/[0.08] text-blue-700 dark:text-blue-300',
    'border-l-blue-500/60',
    'bg-blue-500',
    'bg-muted text-blue-600 dark:text-blue-400',
    'ring-blue-400/25',
  ),
  brainstorming: theme(
    'bg-orange-500/[0.08] text-orange-700 dark:text-orange-300',
    'border-l-orange-500/60',
    'bg-orange-500',
    'bg-muted text-orange-600 dark:text-orange-400',
    'ring-orange-400/25',
  ),
  uncategorized: theme(
    'bg-muted text-muted-foreground',
    'border-l-border',
    'bg-muted-foreground',
    'bg-muted text-muted-foreground',
    'ring-ring/20',
  ),
};

export function themeForStage(stageId: string): HubVisualTheme {
  return STAGE_THEME[stageId] ?? STAGE_THEME.uncategorized;
}

/** 五大类主题（办公/创作/开发用大类色，营销与教育沿用阶段色） */
export const MAJOR_CATEGORY_THEME: Record<string, HubVisualTheme> = {
  marketing: STAGE_THEME.research,
  media: theme(
    'bg-blue-500/[0.08] text-blue-700 dark:text-blue-300',
    'border-l-blue-500/60',
    'bg-blue-500',
    'bg-muted text-blue-600 dark:text-blue-400',
    'ring-blue-400/25',
  ),
  geo: theme(
    'bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-300',
    'border-l-emerald-500/60',
    'bg-emerald-500',
    'bg-muted text-emerald-600 dark:text-emerald-400',
    'ring-emerald-400/25',
  ),
  finance: theme(
    'bg-lime-500/[0.08] text-lime-800 dark:text-lime-300',
    'border-l-lime-500/60',
    'bg-lime-600',
    'bg-muted text-lime-700 dark:text-lime-400',
    'ring-lime-400/25',
  ),
  enterprise_compliance: theme(
    'bg-indigo-500/[0.08] text-indigo-800 dark:text-indigo-300',
    'border-l-indigo-500/60',
    'bg-indigo-600',
    'bg-muted text-indigo-700 dark:text-indigo-400',
    'ring-indigo-400/25',
  ),
  office: theme(
    'bg-stone-500/[0.08] text-stone-700 dark:text-stone-300',
    'border-l-stone-500/60',
    'bg-stone-500',
    'bg-muted text-stone-600 dark:text-stone-400',
    'ring-stone-400/25',
  ),
  creation: theme(
    'bg-fuchsia-500/[0.08] text-fuchsia-700 dark:text-fuchsia-300',
    'border-l-fuchsia-500/60',
    'bg-fuchsia-500',
    'bg-muted text-fuchsia-600 dark:text-fuchsia-400',
    'ring-fuchsia-400/25',
  ),
  development: theme(
    'bg-cyan-500/[0.08] text-cyan-700 dark:text-cyan-300',
    'border-l-cyan-500/60',
    'bg-cyan-500',
    'bg-muted text-cyan-600 dark:text-cyan-400',
    'ring-cyan-400/25',
  ),
  education: STAGE_THEME.education,
  brainstorming: STAGE_THEME.brainstorming,
};

export function themeForMajorCategory(categoryId: string): HubVisualTheme {
  return MAJOR_CATEGORY_THEME[categoryId] ?? STAGE_THEME.uncategorized;
}

/** 教育学段主题（含学术研究 academic_research） */
export const EDUCATION_BAND_THEME: Record<EducationBandId, HubVisualTheme> = {
  preschool: theme(
    'bg-rose-500/[0.08] text-rose-700 dark:text-rose-300',
    'border-l-rose-500/60',
    'bg-rose-500',
    'bg-muted text-rose-600 dark:text-rose-400',
    'ring-rose-400/25',
  ),
  primary: theme(
    'bg-amber-500/[0.08] text-amber-700 dark:text-amber-300',
    'border-l-amber-500/60',
    'bg-amber-500',
    'bg-muted text-amber-600 dark:text-amber-400',
    'ring-amber-400/25',
  ),
  junior: theme(
    'bg-sky-500/[0.08] text-sky-700 dark:text-sky-300',
    'border-l-sky-500/60',
    'bg-sky-500',
    'bg-muted text-sky-600 dark:text-sky-400',
    'ring-sky-400/25',
  ),
  senior: theme(
    'bg-violet-500/[0.08] text-violet-700 dark:text-violet-300',
    'border-l-violet-500/60',
    'bg-violet-500',
    'bg-muted text-violet-600 dark:text-violet-400',
    'ring-violet-400/25',
  ),
  general: theme(
    'bg-slate-500/[0.08] text-slate-700 dark:text-slate-300',
    'border-l-slate-500/60',
    'bg-slate-500',
    'bg-muted text-slate-600 dark:text-slate-400',
    'ring-slate-400/25',
  ),
  academic_research: theme(
    'bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-300',
    'border-l-emerald-500/60',
    'bg-emerald-500',
    'bg-muted text-emerald-600 dark:text-emerald-400',
    'ring-emerald-400/25',
  ),
};

export function themeForEducationBand(bandId: string): HubVisualTheme {
  return EDUCATION_BAND_THEME[bandId as EducationBandId] ?? EDUCATION_BAND_THEME.primary;
}

/** 营销飞轮各阶段图标 */
export const STAGE_ICONS: Record<string, LucideIcon> = {
  research: Search,
  strategy: Lightbulb,
  create: Sparkles,
  activate: Send,
  distribute: Rocket,
  measure: BarChart3,
  geo_baseline: Search,
  geo_strategy: Lightbulb,
  geo_citability: Sparkles,
  geo_technical: Layers,
  geo_distribution: Rocket,
  geo_monitor: Radar,
  education: GraduationCap,
  uncategorized: Layers,
};

/** 五大类图标 */
export const MAJOR_CATEGORY_ICONS: Record<string, LucideIcon> = {
  marketing: Megaphone,
  media: Radio,
  geo: Radar,
  finance: Landmark,
  enterprise_compliance: Scale,
  office: Briefcase,
  creation: Palette,
  development: Code2,
  education: GraduationCap,
  brainstorming: Brain,
};

export function isMarketingStage(stageId: string): boolean {
  return (MARKETING_FLYWHEEL_ORDER as readonly string[]).includes(stageId);
}

export function isGeoStage(stageId: string): boolean {
  return (GEO_FLYWHEEL_ORDER as readonly string[]).includes(stageId);
}

export function isMediaWorkflowStep(stageId: string): boolean {
  return (MEDIA_WORKFLOW_ORDER.media_ooh as readonly string[]).includes(stageId)
    || (MEDIA_WORKFLOW_ORDER.media_digital as readonly string[]).includes(stageId);
}

export function stageToCategory(stageId: string): HubMajorCategory {
  if (isMediaWorkflowStep(stageId)) return 'media';
  if (isGeoStage(stageId)) return 'geo';
  if (stageId === EDUCATION_STAGE_ID) return 'education';
  if (stageId === BRAINSTORMING_STAGE_ID) return 'brainstorming';
  if (stageId === FINANCE_STAGE_ID) return 'finance';
  if (stageId === ENTERPRISE_COMPLIANCE_STAGE_ID) return 'enterprise_compliance';
  return 'marketing';
}

export function defaultStageForCategory(category: HubMajorCategory): string {
  if (category === 'media') return MEDIA_WORKFLOW_ORDER.media_digital[0];
  if (category === 'geo') return GEO_FLYWHEEL_ORDER[0];
  if (category === 'education') return EDUCATION_STAGE_ID;
  if (category === 'brainstorming') return BRAINSTORMING_STAGE_ID;
  if (category === 'finance') return FINANCE_STAGE_ID;
  if (category === 'enterprise_compliance') return ENTERPRISE_COMPLIANCE_STAGE_ID;
  return MARKETING_FLYWHEEL_ORDER[0];
}

type CapabilityThemeInput = {
  stage?: string;
  major_category?: string;
  geo_stage?: string;
};

/** 卡片主题：营销阶段优先按阶段色，其余按大类色 */
export function themeForCapability(item: CapabilityThemeInput): HubVisualTheme {
  if (item.geo_stage && isGeoStage(item.geo_stage)) return themeForStage(item.geo_stage);
  if (item.major_category === 'geo') return themeForMajorCategory('geo');
  if (item.stage && isMarketingStage(item.stage)) return themeForStage(item.stage);
  if (item.stage === EDUCATION_STAGE_ID || item.major_category === 'education') {
    return STAGE_THEME.education;
  }
  if (item.stage === BRAINSTORMING_STAGE_ID || item.major_category === 'brainstorming') {
    return STAGE_THEME.brainstorming;
  }
  if (item.stage === FINANCE_STAGE_ID || item.major_category === 'finance') {
    return themeForMajorCategory('finance');
  }
  if (
    item.stage === ENTERPRISE_COMPLIANCE_STAGE_ID
    || item.major_category === 'enterprise_compliance'
  ) {
    return themeForMajorCategory('enterprise_compliance');
  }
  if (item.major_category) return themeForMajorCategory(item.major_category);
  if (item.stage) return themeForStage(item.stage);
  return STAGE_THEME.uncategorized;
}

/** 卡片图标：营销阶段优先按阶段图标，其余按大类图标 */
export function iconForCapability(item: CapabilityThemeInput): LucideIcon {
  if (item.stage && STAGE_ICONS[item.stage]) return STAGE_ICONS[item.stage];
  if (item.major_category && MAJOR_CATEGORY_ICONS[item.major_category]) {
    return MAJOR_CATEGORY_ICONS[item.major_category];
  }
  return Layers;
}
