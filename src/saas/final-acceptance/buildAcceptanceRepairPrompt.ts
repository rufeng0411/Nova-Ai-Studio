// PD-SAAS-FORK: focused repair prompt when final deliverable acceptance fails.
import type { FinalAcceptanceResult } from "./finalAcceptanceState.js";
import { filterRepairEligiblePaths } from "../deliverables/repairEligiblePath.js";

export function buildAcceptanceRepairPrompt(input: {
  userGoal: string;
  result: FinalAcceptanceResult;
}): string {
  // PD-SAAS-FORK: collapse the missing + type_mismatch lines for the same
  // expected kind into one, so a single gap (e.g. "缺 pdf") is not listed twice
  // in the repair prompt. result.failures stays intact for the engine and tests;
  // this dedupe is presentation-only.
  const seenExpectedKind = new Set<string>();
  const failures = input.result.failures
    .filter((failure) => {
      if (
        (failure.reason === "missing" || failure.reason === "type_mismatch")
        && failure.expected
      ) {
        const key = String(failure.expected);
        if (seenExpectedKind.has(key)) return false;
        seenExpectedKind.add(key);
      }
      return true;
    })
    .map((failure) => `- ${failure.message}`)
    .join("\n");
  const missingPaths = filterRepairEligiblePaths(input.result.missingPaths);
  const brokenPaths = filterRepairEligiblePaths(input.result.brokenPaths);
  const verified = input.result.verifiedPaths.length > 0
    ? input.result.verifiedPaths.map((p) => `- ${p}`).join("\n")
    : "- 暂无已通过验收的最终成果";
  const broken = brokenPaths.length > 0
    ? brokenPaths.map((p: string) => `- ${p}`).join("\n")
    : "- 无";
  const missing = missingPaths.length > 0
    ? missingPaths.map((p: string) => `- ${p}`).join("\n")
    : "- 无";

  return [
    "最终交付验收未通过。不要询问用户，不要重做已通过的部分，请直接按缺口继续补齐或修复。",
    "",
    `原始用户目标：${input.userGoal || "未提供"}`,
    "",
    "已通过验收的成果：",
    verified,
    "",
    "缺失成果：",
    missing,
    "",
    "损坏或不合格成果：",
    broken,
    "",
    "验收失败原因：",
    failures || "- 未列出",
    "",
    "下一步要求：",
    input.result.continuePrompt || "继续补齐缺失成果，并确保最终文件可打开、数量足够、类型正确。",
  ].join("\n");
}
