// PD-SAAS-FORK (ROG M5): detect repeated repair gaps and fast-stop infinite loops.
const REPAIR_STREAK_LIMIT = 2;

export type RepairStreakState = {
  lastNormalizedGap: string | null;
  streak: number;
};

export function normalizeRepairGapKey(
  missing: string[],
  broken: string[],
  sdmGapKey?: string,
): string {
  const sdm = String(sdmGapKey ?? "").trim();
  if (sdm) return `sdm:${sdm}`;
  const parts = [...missing, ...broken]
    .map((p) => String(p ?? "").trim().replace(/\\/g, "/").toLowerCase())
    .filter(Boolean)
    .sort();
  const pathKey = parts.join("|");
  return pathKey;
}

export function buildSdmGapKey(
  slotIds: string[],
): string {
  return [...slotIds].sort().join("|");
}

export function advanceRepairStreak(
  state: RepairStreakState,
  missing: string[],
  broken: string[],
  sdmGapKey?: string,
): RepairStreakState {
  const key = normalizeRepairGapKey(missing, broken, sdmGapKey);
  if (!key) {
    return { lastNormalizedGap: null, streak: 0 };
  }
  if (key === state.lastNormalizedGap) {
    return { lastNormalizedGap: key, streak: state.streak + 1 };
  }
  return { lastNormalizedGap: key, streak: 1 };
}

export function shouldFastStopRepairLoop(streak: number): boolean {
  return streak >= REPAIR_STREAK_LIMIT;
}

export function buildRepairFastStopContinuePrompt(input: {
  verifiedCount: number;
  totalHint: number;
  reason?: string;
}): string {
  const { verifiedCount, totalHint, reason } = input;
  const envNote = reason ?? "部分步骤因 API 或环境限制未能完成";
  return [
    `已交付 ${verifiedCount}/${totalHint} 项成果。`,
    `${envNote}，请勿再创建时间戳或数字命名的占位 md。`,
    "在正文说明剩余缺口与已用降级方案，并列出 artifacts/ 下真实可打开的文件路径。",
  ].join("");
}
