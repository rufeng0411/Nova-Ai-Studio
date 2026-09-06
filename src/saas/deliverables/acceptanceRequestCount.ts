// PD-SAAS-FORK: browser-safe deliverable count parsing from user goal text.
export function extractRequestedCount(text: string): number | undefined {
  const normalized = String(text || "");
  const rangeMatch = normalized.match(/(\d{1,3})\s*(?:-|–|—|~|～|至|到)\s*(\d{1,3})\s*(?:页|屏|个|份|张|篇|节|章节|阶段|pages?|slides?|sections?|screens?)/i);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max >= min) return min;
  }
  const digitMatch = normalized.match(/(?:做|生成|输出|制作|创建|create|generate)?\s*(\d{1,3})\s*(?:页|屏|个|份|张|篇|节|章节|阶段|pages?|slides?|sections?|screens?)/i);
  if (digitMatch) {
    const count = Number(digitMatch[1]);
    if (!Number.isFinite(count) || count < 1) return undefined;
    return count;
  }
  const chineseMatch = normalized.match(/([一二三四五六七八九十百两]{1,4})\s*(?:页|个|份|张|篇|章节|阶段)/);
  if (!chineseMatch) return undefined;
  const count = parseChineseCount(chineseMatch[1]);
  if (!Number.isFinite(count) || count < 1) return undefined;
  return count;
}

function parseChineseCount(value: string): number {
  const digits: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  if (value === "十") return 10;
  const hundred = value.match(/^([一二三四五六七八九两])?百([一二三四五六七八九两])?([一二三四五六七八九两])?$/);
  if (hundred) {
    return (digits[hundred[1] ?? "一"] * 100)
      + (hundred[2] ? digits[hundred[2]] * 10 : 0)
      + (hundred[3] ? digits[hundred[3]] : 0);
  }
  const ten = value.match(/^([一二三四五六七八九两])?十([一二三四五六七八九两])?$/);
  if (ten) {
    return (digits[ten[1] ?? "一"] * 10) + (ten[2] ? digits[ten[2]] : 0);
  }
  if (value.length === 1) return digits[value] ?? Number.NaN;
  return Number.NaN;
}
