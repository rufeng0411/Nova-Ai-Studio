// PD-SAAS-FORK: narrow factual-premise guard for recent high-impact M&A claims (P1)

import {
  factualPremiseGuardMode,
  type StabilityTriStateMode,
} from "../resilience/stabilityFlags.js";

export { factualPremiseGuardMode };
export type TriStateMode = StabilityTriStateMode;

export type FactualPremiseKind =
  | "rumor"
  | "prediction"
  | "announced"
  | "signed"
  | "closed"
  | "assumption";

export type FactualPremiseTaskMode = "brainstorm" | "research" | "answer";

export type FactualPremiseAssessment = {
  requiresSource: boolean;
  suggestedKind: FactualPremiseKind;
  taskMode: FactualPremiseTaskMode;
  recent: true;
  highImpact: true;
};

const DEAL_ACTION_PATTERN =
  /(?:收购|并购|购并|兼并|m\s*&\s*a|acquir(?:e|es|ed|ing)|acquisition|merger)/i;
const GROWTH_OR_TECHNICAL_FALSE_POSITIVE =
  /(?:收购用户|用户收购|获客|拉新|acquir(?:e|ing)\s+(?:new\s+)?users?|user\s+acquisition|merge\s+(?:arrays?|objects?|branches?|pull requests?|prs?)|合并(?:数组|对象|分支|代码|PR))/i;
const MAJOR_ORGANIZATION_PATTERN =
  /(?:OpenAI|Anthropic|Google|Alphabet|Meta|Microsoft|Amazon|Apple|NVIDIA|Tesla|ByteDance|Alibaba|Tencent|字节(?:跳动)?|阿里(?:巴巴)?|腾讯|微软|谷歌|亚马逊|苹果|英伟达|特斯拉)/gi;
const HIGH_IMPACT_MARKER =
  /(?:重大|高影响|战略级|百亿|十亿|亿美元|billion|multi-billion|market-moving|行业震动|反垄断)/i;
const RESEARCH_PATTERN =
  /(?:调研|研究|核实|核验|查证|事实|来源|报告|research|investigate|verify|fact[- ]?check|sources?)/i;
const BRAINSTORM_PATTERN =
  /(?:脑暴|头脑风暴|假设|推演|设想|brainstorm|hypothetical|what\s+if|imagine)/i;

function isRecentClaim(text: string): boolean {
  if (
    /(?:近期|最近|今年|本周|今日|今天|刚刚|最新|recent|recently|this year|today|latest|current)/i
      .test(text)
  ) {
    return true;
  }
  const currentYear = new Date().getFullYear();
  const years = [...text.matchAll(/\b(20\d{2})\b/g)]
    .map((match) => Number.parseInt(match[1] ?? "", 10))
    .filter(Number.isFinite);
  return years.some((year) => year >= currentYear - 2 && year <= currentYear + 1);
}

function isHighImpactClaim(text: string): boolean {
  const majorOrganizations = new Set(
    [...text.matchAll(MAJOR_ORGANIZATION_PATTERN)]
      .map((match) => (match[0] ?? "").toLowerCase())
      .filter(Boolean),
  );
  if (majorOrganizations.size >= 2) return true;
  if (majorOrganizations.size === 0) return false;
  return HIGH_IMPACT_MARKER.test(text);
}

function inferTaskMode(text: string): FactualPremiseTaskMode {
  if (BRAINSTORM_PATTERN.test(text)) return "brainstorm";
  if (RESEARCH_PATTERN.test(text)) return "research";
  return "answer";
}

function inferPremiseKind(text: string): FactualPremiseKind {
  if (
    /(?:已交割|完成交割|已完成收购|正式完成|交易完成|closing\s+(?:is\s+)?complete|deal\s+closed|completed\s+(?:its\s+)?acquisition)/i
      .test(text)
  ) {
    return "closed";
  }
  if (
    /(?:签约|签署(?:协议)?|达成(?:最终)?协议|agreement\s+signed|signed\s+(?:a\s+)?(?:definitive\s+)?agreement|definitive\s+agreement)/i
      .test(text)
  ) {
    return "signed";
  }
  if (/(?:宣布|官宣|公告|announced|announcement)/i.test(text)) {
    return "announced";
  }
  if (/(?:预测市场|prediction\s+market|polymarket|kalshi|概率|chance)/i.test(text)) {
    return "prediction";
  }
  if (/(?:传闻|网传|据传|消息称|rumou?r|reportedly|sources?\s+say)/i.test(text)) {
    return "rumor";
  }
  return "assumption";
}

function premiseKindLabel(kind: FactualPremiseKind): string {
  switch (kind) {
    case "rumor":
      return "传闻";
    case "prediction":
      return "预测市场";
    case "announced":
      return "宣布";
    case "signed":
      return "签约";
    case "closed":
      return "已交割";
    case "assumption":
      return "未确认假设";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export function assessFactualPremise(userGoal: string): FactualPremiseAssessment | null {
  const text = String(userGoal ?? "").trim();
  if (
    !text
    || !DEAL_ACTION_PATTERN.test(text)
    || GROWTH_OR_TECHNICAL_FALSE_POSITIVE.test(text)
    || !isRecentClaim(text)
    || !isHighImpactClaim(text)
  ) {
    return null;
  }

  const taskMode = inferTaskMode(text);
  return {
    requiresSource: taskMode !== "brainstorm",
    suggestedKind: inferPremiseKind(text),
    taskMode,
    recent: true,
    highImpact: true,
  };
}

export function buildFactualPremiseSystemAppend(userGoal: string): string | undefined {
  const mode = factualPremiseGuardMode();
  if (mode === "off") return undefined;
  const assessment = assessFactualPremise(userGoal);
  if (!assessment) return undefined;
  const state = premiseKindLabel(assessment.suggestedKind);

  if (assessment.taskMode === "brainstorm") {
    return [
      "以下按假设推演。",
      `将相关收购/并购前提标为「${state}」，不要写成已核实事实。`,
      "无需为纯脑暴调用工具；若用户改为事实结论或调研任务，再核验并引用来源。",
    ].join("\n");
  }

  const modeLabel = mode === "shadow" ? "观察" : "执行";
  if (assessment.taskMode === "research") {
    return [
      `事实前提核验（${modeLabel}）：先核验这项近期高影响收购/并购的状态，当前待核验分类为「${state}」。`,
      "须引用可核对来源，并明确区分传闻、预测市场、宣布、签约与已交割；无法核验时不得写成既成事实。",
    ].join("\n");
  }

  return [
    `近期高影响收购/并购前提当前分类为「${state}」。`,
    "回答时引用可核对来源；若无法核验，须明确按未确认假设说明。",
  ].join("\n");
}
