/**
 * PD-SAAS-FORK: viral-article-generator 选风铁律（L0 可单测；Agent 以 SKILL.md 为准）。
 */

export type ViralStyleStatus = "full" | "stub";

export type ViralStyleId =
  | "T1-1"
  | "T1-2"
  | "T1-3"
  | "T1-4"
  | "T1-5"
  | "T1-6"
  | "T2-1"
  | "T2-2"
  | "T2-3"
  | "T2-4"
  | "T2-5"
  | "T2-6"
  | "T2-7"
  | "T2-8";

export type ViralStyleScore = {
  id: ViralStyleId;
  label: string;
  status: ViralStyleStatus;
  score: number;
  /** true if any scoring dimension hit ban zone (0) */
  banZone?: boolean;
};

export type ViralStyleResolution =
  | { kind: "auto_full"; mainStyle: ViralStyleId; top3: ViralStyleScore[]; notice?: string }
  | { kind: "named_full"; mainStyle: ViralStyleId; top3: ViralStyleScore[]; notice?: string }
  | {
    kind: "soft_full_low";
    mainStyle: ViralStyleId;
    requestedFull: ViralStyleId;
    top3: ViralStyleScore[];
    notice: string;
  }
  | { kind: "soft_stub"; mainStyle: ViralStyleId; requestedStub: ViralStyleId; top3: ViralStyleScore[]; notice: string }
  | { kind: "hard_mix_refuse"; mainStyle?: undefined; requested: ViralStyleId[]; top3: ViralStyleScore[]; notice: string };

const FULL_STYLES = new Set<ViralStyleId>(["T1-1", "T1-2"]);
const NAMED_FULL_SOFT_THRESHOLD = 30;

const NAME_ALIASES: Array<{ id: ViralStyleId; patterns: RegExp[] }> = [
  { id: "T1-1", patterns: [/半佛/i, /风控老炮/i, /\bT1-1\b/i] },
  { id: "T1-2", patterns: [/兽爷/i, /兽楼处/i, /调查讽刺/i, /\bT1-2\b/i] },
  { id: "T1-3", patterns: [/睡前小声|比比/i, /\bT1-3\b/i] },
  { id: "T1-4", patterns: [/吴晓波/i, /\bT1-4\b/i] },
  { id: "T1-5", patterns: [/饭统/i, /\bT1-5\b/i] },
  { id: "T1-6", patterns: [/刘润/i, /\bT1-6\b/i] },
  { id: "T2-1", patterns: [/一口老炮/i, /\bT2-1\b/i] },
  { id: "T2-2", patterns: [/散人懂四六/i, /\bT2-2\b/i] },
  { id: "T2-3", patterns: [/晚点|远川/i, /\bT2-3\b/i] },
  { id: "T2-4", patterns: [/十点人物|咪蒙/i, /\bT2-4\b/i] },
  { id: "T2-5", patterns: [/宁南山/i, /\bT2-5\b/i] },
  { id: "T2-6", patterns: [/不懂经/i, /\bT2-6\b/i] },
  { id: "T2-7", patterns: [/刀客\s*Doc/i, /\bT2-7\b/i] },
  { id: "T2-8", patterns: [/新经销/i, /\bT2-8\b/i] },
];

export function isViralFullStyle(id: ViralStyleId): boolean {
  return FULL_STYLES.has(id);
}

export function detectNamedViralStyles(goal: string): ViralStyleId[] {
  const text = String(goal ?? "");
  const found: ViralStyleId[] = [];
  for (const entry of NAME_ALIASES) {
    if (entry.patterns.some((re) => re.test(text))) {
      if (!found.includes(entry.id)) found.push(entry.id);
    }
  }
  return found;
}

export function pickHighestFullStyle(scores: ViralStyleScore[]): ViralStyleId | undefined {
  const full = scores
    .filter((s) => s.status === "full")
    .sort((a, b) => b.score - a.score);
  return full[0]?.id;
}

function scoreOf(scores: ViralStyleScore[], id: ViralStyleId): ViralStyleScore | undefined {
  return scores.find((s) => s.id === id);
}

export function resolveViralArticleMainStyle(input: {
  goal: string;
  scores: ViralStyleScore[];
}): ViralStyleResolution {
  const top3 = [...input.scores].sort((a, b) => b.score - a.score).slice(0, 3);
  const named = detectNamedViralStyles(input.goal);
  const nearestFull = pickHighestFullStyle(input.scores) ?? "T1-1";

  if (named.length >= 2) {
    return {
      kind: "hard_mix_refuse",
      requested: named,
      top3,
      notice: "禁止同篇混搭多种风格；请拆成两次任务分别撰写。",
    };
  }

  if (named.length === 1) {
    const id = named[0]!;
    if (isViralFullStyle(id)) {
      const scored = scoreOf(input.scores, id);
      const low = (scored?.score ?? 0) < NAMED_FULL_SOFT_THRESHOLD || scored?.banZone === true;
      if (low && nearestFull !== id) {
        return {
          kind: "soft_full_low",
          mainStyle: nearestFull,
          requestedFull: id,
          top3,
          notice: `点名风格 ${id} 匹配过低或落入禁区，已改用可写气质 ${nearestFull} 仍交付四文件。`,
        };
      }
      return {
        kind: "named_full",
        mainStyle: id,
        top3,
        notice: scored && scored.score < 40
          ? `${id} 匹配 ${scored.score}/60，非最优但仍按点名生成。`
          : undefined,
      };
    }
    return {
      kind: "soft_stub",
      mainStyle: nearestFull,
      requestedStub: id,
      top3,
      notice: `点名风格 ${id} 细则未入库（stub），已改用可写气质 ${nearestFull} 仍交付四文件。`,
    };
  }

  return {
    kind: "auto_full",
    mainStyle: nearestFull,
    top3,
  };
}
