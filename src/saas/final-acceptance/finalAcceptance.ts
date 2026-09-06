// PD-SAAS-FORK: final-only deliverable acceptance gate.
import {
  countActualUnits,
  evaluateCandidate,
  inferAcceptanceKind,
  type AcceptanceArtifactKind,
  type AcceptanceCandidate,
  type AcceptanceFailure,
} from "../deliverables/acceptanceChecks.js";
import { buildAcceptanceRepairPrompt as buildRepairPrompt } from "./buildAcceptanceRepairPrompt.js";
import {
  createFinalAcceptanceResult,
  type FinalAcceptanceResult,
} from "./finalAcceptanceState.js";
import { buildTaskGoalContract, type TaskGoalContract } from "../taskState/taskGoalContract.js";
import {
  detectContentDegeneration,
  resolveDegenerationConfig,
} from "./degenerationGuard.js";
import {
  detectQualityDefects,
  resolveQualityConfig,
} from "./qualityChecks.js";
import { isDegenerationGuardEnabled, isQualityAcceptEnabled } from "../resilience/stabilityFlags.js";
import { recordStabilityEvent } from "../../telemetry/stabilityEvents.js";

type AcceptancePlan = {
  kinds: AcceptanceArtifactKind[];
  count?: number;
  kindCounts?: { kind: AcceptanceArtifactKind; min: number }[];
  requiredFiles: string[];
};

export type RunFinalAcceptanceInput = {
  userGoal: string;
  assistantText?: string;
  candidates: AcceptanceCandidate[];
  goalContract?: TaskGoalContract;
};

export async function runFinalAcceptance(
  input: RunFinalAcceptanceInput,
): Promise<FinalAcceptanceResult> {
  const expectedPlan = input.goalContract
    ? expectedPlanFromGoalContract(input.goalContract)
    : expectedPlanFromGoal(input.userGoal);
  const expected = {
    kind: expectedPlan.kinds[0],
    count: expectedPlan.count,
  };
  const failures: AcceptanceFailure[] = [];
  const verifiedPaths: string[] = [];
  const missingPaths: string[] = [];
  const brokenPaths: string[] = [];

  const candidates = input.candidates
    .map((candidate) => ({
      ...candidate,
      kind: candidate.kind ?? inferAcceptanceKind(candidate.path),
    }));

  let maxActualCount = 0;
  let maxExpectedKindCount = 0;
  let verifiedExpectedKindCount = 0;
  for (const candidate of candidates) {
    const candidateFailures = evaluateCandidate(candidate);
    if (candidateFailures.length > 0) {
      failures.push(...candidateFailures);
      if (candidate.exists) brokenPaths.push(candidate.path);
      else missingPaths.push(candidate.path);
      continue;
    }
    // PD-SAAS-FORK (P0-4, flag-gated): a structurally-valid file can still be degenerate
    // (model stuck repeating a table row / paragraph). Treat as broken -> directed rewrite.
    const degenerationFailure = detectDegenerationFailure(candidate);
    if (degenerationFailure) {
      failures.push(degenerationFailure);
      brokenPaths.push(candidate.path);
      continue;
    }
    // PD-SAAS-FORK (P1-D, flag-gated): soft quality defects (inconsistent table columns / a
    // structured doc with almost no prose) -> needs_repair, but the file stays soft-displayed.
    const qualityFailure = detectQualityFailure(candidate);
    if (qualityFailure) {
      failures.push(qualityFailure);
      brokenPaths.push(candidate.path);
      continue;
    }
    verifiedPaths.push(candidate.path);
    const actualUnits = countActualUnits(candidate) ?? 1;
    maxActualCount = Math.max(maxActualCount, actualUnits);
    if (expectedPlan.kinds.length === 0 || expectedPlan.kinds.includes(candidate.kind)) {
      verifiedExpectedKindCount += 1;
      maxExpectedKindCount = Math.max(maxExpectedKindCount, actualUnits);
    }
  }

  for (const kind of expectedPlan.kinds) {
    if (candidates.some((candidate) => candidate.kind === kind && verifiedPaths.includes(candidate.path))) {
      continue;
    }
    const missing = `*${extensionForKind(kind)}`;
    missingPaths.push(missing);
    failures.push({
      reason: "missing",
      message: `缺少用户要求的 ${kind} 成果。`,
      expected: kind,
    });
    if (candidates.length > 0) {
      failures.push({
        reason: "type_mismatch",
        message: `已有成果类型不完整，仍缺少用户要求的 ${kind}。`,
        expected: kind,
        actual: [...new Set(candidates.map((candidate) => candidate.kind).filter(Boolean))].join(", ") || "unknown",
      });
    }
  }

  for (const requiredFile of expectedPlan.requiredFiles) {
    if (requiredFileSatisfied(requiredFile, verifiedPaths)) {
      continue;
    }
    if (!missingPaths.includes(requiredFile)) missingPaths.push(requiredFile);
    failures.push({
      reason: "missing",
      message: `缺少用户要求的成果文件 ${requiredFile}。`,
      expected: requiredFile,
    });
  }

  const actualCountForExpected = expectedPlan.kinds.length > 0 ? maxExpectedKindCount : maxActualCount;
  if (expectedPlan.kindCounts?.length) {
    // PD-SAAS-FORK: count per kind so a high screen count cannot mask a missing
    // or short second kind in multi-kind deliverables.
    for (const kindCount of expectedPlan.kindCounts) {
      const verifiedOfKind = candidates.filter(
        (candidate) => candidate.kind === kindCount.kind && verifiedPaths.includes(candidate.path),
      );
      if (verifiedOfKind.length === 0) continue;
      const actual = isPageUnitKind(kindCount.kind)
        ? Math.max(...verifiedOfKind.map((candidate) => countActualUnits(candidate) ?? 1))
        : verifiedOfKind.length;
      if (actual < kindCount.min) {
        failures.push({
          reason: "count_insufficient",
          message: `${kindCount.kind} 类成果当前只有 ${actual} 个/页，还缺 ${kindCount.min - actual} 个/页。`,
          expected: kindCount.min,
          actual,
        });
      }
    }
  } else if (expected.count && verifiedExpectedKindCount > 0 && actualCountForExpected < expected.count) {
    failures.push({
      reason: "count_insufficient",
      message: `当前只有 ${actualCountForExpected} 个/页，还缺 ${expected.count - actualCountForExpected} 个/页。`,
      expected: expected.count,
      actual: actualCountForExpected,
    });
  }

  const status = failures.length > 0 ? "needs_repair" : "passed";
  const result = createFinalAcceptanceResult({
    status,
    expected,
    expectedManifest: buildExpectedManifest(expectedPlan, input.goalContract),
    verifiedPaths,
    missingPaths: [...new Set(missingPaths)],
    brokenPaths: [...new Set(brokenPaths)],
    failures,
    continuePrompt: buildContinuePrompt({
      userGoal: input.userGoal,
      expectedCount: expectedPlan.count,
      actualCount: actualCountForExpected || undefined,
      failures,
      verifiedPaths,
      brokenPaths,
      missingPaths,
    }),
  });
  return result;
}

// PD-SAAS-FORK (P0-4): scan a verified .md/.html candidate for generation degeneration.
// Returns a failure (so the deliverable goes needs_repair) or null. Only .md/.html with text;
// binary kinds and the no-content path are skipped. Gated OFF by default in production.
function detectDegenerationFailure(candidate: {
  path: string;
  kind?: AcceptanceArtifactKind;
  textPreview?: string;
}): AcceptanceFailure | null {
  if (!isDegenerationGuardEnabled()) return null;
  if (candidate.kind !== "markdown" && candidate.kind !== "html") return null;
  const text = candidate.textPreview ?? "";
  if (!text.trim()) return null;
  const verdict = detectContentDegeneration(text, resolveDegenerationConfig());
  if (!verdict.degenerate) return null;
  recordStabilityEvent({
    event: "degeneration_detected",
    reason: verdict.reason,
    detail: {
      ...(verdict.runLength ? { runLength: verdict.runLength } : {}),
      ...(verdict.totalRepeats ? { totalRepeats: verdict.totalRepeats } : {}),
    },
  });
  return {
    reason: "degenerate",
    message: `${candidate.path} 出现重复退化（同一${
      verdict.reason === "table_row_repeat" ? "表格行" : "段落"
    }被反复输出），请重写为不重复的有效内容。`,
    path: candidate.path,
  };
}

// PD-SAAS-FORK (P1-D): scan a verified .md/.html candidate for soft quality defects (table column
// inconsistency / structured-but-empty). Returns a failure (needs_repair) or null. Gated OFF by
// default; never hard-hides the file (it stays soft-displayed while repair runs).
function detectQualityFailure(candidate: {
  path: string;
  kind?: AcceptanceArtifactKind;
  textPreview?: string;
}): AcceptanceFailure | null {
  if (!isQualityAcceptEnabled()) return null;
  if (candidate.kind !== "markdown" && candidate.kind !== "html") return null;
  const text = candidate.textPreview ?? "";
  if (!text.trim()) return null;
  const verdict = detectQualityDefects(text, candidate.kind, resolveQualityConfig());
  if (!verdict.defect) return null;
  recordStabilityEvent({
    event: "quality_defect_detected",
    reason: verdict.reason,
    ...(verdict.detail ? { detail: verdict.detail } : {}),
  });
  return {
    reason: "low_quality",
    message: verdict.reason === "table_columns"
      ? `${candidate.path} 的表格列数不一致（部分行与表头列数不符），请修正为整齐的表格。`
      : `${candidate.path} 结构齐全但正文几乎为空，请补充实际内容。`,
    path: candidate.path,
  };
}

function expectedPlanFromGoalContract(contract: TaskGoalContract): AcceptancePlan {
  // PD-SAAS-FORK: Nova PNG decks verify page count via checkNovaImageSlideDeck, not
  // generic candidate cardinality (manifest.json alone would false-fail minCount).
  const isNovaSlideDeck = contract.profileId === "nova-slide-deck";
  return {
    kinds: contract.expectedKinds.filter((kind): kind is AcceptancePlan["kinds"][number] => Boolean(kind)),
    count: isNovaSlideDeck ? undefined : contract.minCount,
    kindCounts: isNovaSlideDeck ? undefined : contract.kindCounts,
    requiredFiles: isNovaSlideDeck ? [] : [...contract.requiredFiles],
  };
}

// PD-SAAS-FORK: the no-contract fallback compiles a contract too, so the engine
// and any direct caller share one inference path instead of a divergent second.
function expectedPlanFromGoal(userGoal: string): AcceptancePlan {
  return expectedPlanFromGoalContract(buildTaskGoalContract({ userGoal }));
}

function buildExpectedManifest(
  expected: AcceptancePlan,
  contract?: TaskGoalContract,
): FinalAcceptanceResult["expectedManifest"] {
  const requiredFileRows = expected.requiredFiles.map((filePath) => ({
    id: `required_file:${filePath}`,
    required: true,
  }));
  if (contract?.profileId === "nova-slide-deck" && contract.minCount) {
    return [
      {
        id: "required_png",
        kind: "image",
        count: contract.minCount,
        required: true,
      },
      ...requiredFileRows,
    ];
  }
  if (expected.kinds.length === 0 && !expected.count) return requiredFileRows;
  if (expected.kinds.length === 0) {
    return [{
      id: "required_count",
      count: expected.count,
      required: true,
    }, ...requiredFileRows];
  }
  return [...expected.kinds.map((kind) => ({
    id: `required_${kind}`,
    kind,
    count: expected.count,
    required: true,
  })), ...requiredFileRows];
}

export function buildAcceptanceRepairPrompt(input: {
  userGoal: string;
  result: FinalAcceptanceResult;
}): string {
  return buildRepairPrompt(input);
}

function buildContinuePrompt(input: {
  userGoal: string;
  expectedCount?: number;
  actualCount?: number;
  failures: AcceptanceFailure[];
  verifiedPaths: string[];
  missingPaths: string[];
  brokenPaths: string[];
}): string {
  if (input.failures.length === 0) return "";
  const lines = [
    "请基于本轮已有成果继续制作，不要重复已通过验收的文件。",
  ];
  if (input.expectedCount && typeof input.actualCount === "number" && input.actualCount < input.expectedCount) {
    lines.push(`当前只有 ${input.actualCount} 个/页，还缺 ${input.expectedCount - input.actualCount} 个/页，请继续补齐。`);
  }
  if (input.brokenPaths.length > 0) {
    lines.push(`请修复这些文件：${input.brokenPaths.join("、")}。`);
  }
  if (input.missingPaths.length > 0) {
    lines.push(`请补齐这些成果：${input.missingPaths.join("、")}。`);
  }
  lines.push("最终交付必须能打开、不是白屏/乱码/占位内容，且数量和类型符合用户原始要求。");
  return lines.join("\n");
}

function extensionForKind(kind: string): string {
  switch (kind) {
    case "html":
      return ".html";
    case "pptx":
      return ".pptx";
    case "docx":
      return ".docx";
    case "pdf":
      return ".pdf";
    case "markdown":
      return ".md";
    case "video":
      return ".mp4";
    default:
      return "";
  }
}

function requiredFileSatisfied(requiredFile: string, verifiedPaths: string[]): boolean {
  const required = String(requiredFile ?? "").trim().replace(/\\/g, "/");
  if (!required) return true;
  const platformDraftCount = required.match(/^platform-drafts>=(\d+)$/i);
  if (platformDraftCount) {
    const min = Number(platformDraftCount[1] ?? 0);
    const draftNames = verifiedPaths
      .map((filePath) => String(filePath ?? "").trim().replace(/\\/g, "/").toLowerCase())
      .filter((filePath) => /(?:zhihu|知乎|xiaohongshu|小红书|wechat|微信|weibo|微博|douyin|抖音|article|draft|platform)/i.test(filePath))
      .filter((filePath) => /\.(?:md|markdown|docx|html?|json)$/i.test(filePath));
    return new Set(draftNames).size >= min;
  }
  if (/>=\d+/.test(required)) {
    return false;
  }
  const requiredLower = required.toLowerCase();
  if (/^\*\.[a-z0-9]+$/i.test(requiredLower)) {
    const ext = requiredLower.slice(1);
    return verifiedPaths.some((filePath) => String(filePath ?? "").trim().replace(/\\/g, "/").toLowerCase().endsWith(ext));
  }
  const requiredBase = requiredLower.split("/").pop() ?? requiredLower;
  const acceptableBases = new Set([requiredBase, ...requiredFileAliases(requiredBase)]);
  return verifiedPaths.some((filePath) => {
    const normalized = String(filePath ?? "").trim().replace(/\\/g, "/").toLowerCase();
    const base = normalized.split("/").pop() ?? normalized;
    return normalized === requiredLower
      || normalized.endsWith(`/${requiredLower}`)
      || acceptableBases.has(base);
  });
}

function isPageUnitKind(kind: AcceptanceArtifactKind): boolean {
  return kind === "html" || kind === "pptx" || kind === "pdf";
}

function requiredFileAliases(requiredBase: string): string[] {
  switch (requiredBase) {
    case "geo-aeo-audit-checklist.md":
      return ["audit-checklist.md", "01-audit-checklist.md"];
    case "keywords-research.md":
      return ["keywords.md", "02-keywords.md"];
    case "citability-report.md":
      return ["citability-score-report.md", "05-citability-score-report.md"];
    // PD-SAAS-FORK: storyboard pack now uses skill-authoritative names; keep the
    // legacy hyphenated names working for historical sessions.
    case "continuity_bible.md":
      return ["story-bible.md", "story_bible.md", "continuity-bible.md"];
    case "shot_cards.md":
      return ["shot-cards.md", "shotcards.md"];
    case "handoff_design_matrix.md":
      return ["handoff-matrix.md", "handoff_matrix.md", "handoff-design-matrix.md"];
    default:
      return [];
  }
}
