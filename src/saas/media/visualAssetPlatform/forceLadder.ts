// PD-SAAS-FORK VAP: engine-forced phase_a after repeated fetch failures (F06).

import { runVisualAssetOrchestrator } from "./orchestrator.js";
import type { VisualAssetPlan } from "./types.js";

const failCounts = new Map<string, number>();

export function isVapForceLadderEnabled(): boolean {
  const raw = (process.env.PILOTDECK_VAP_FORCE_LADDER ?? "1").trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  return true;
}

export function noteVisualFetchFailure(sessionId: string): number {
  const key = sessionId || "unknown";
  const next = (failCounts.get(key) ?? 0) + 1;
  failCounts.set(key, next);
  return next;
}

export function resetVisualFetchFailures(sessionId: string): void {
  failCounts.delete(sessionId || "unknown");
}

export function resetForceLadderStateForTests(): void {
  failCounts.clear();
}

export function shouldForceVisualLadder(sessionId: string, threshold = 2): boolean {
  if (!isVapForceLadderEnabled()) return false;
  return (failCounts.get(sessionId || "unknown") ?? 0) >= threshold;
}

export async function runForcedVisualLadder(input: {
  workspaceRoot: string;
  sessionId: string;
  taskArtifactDir: string;
  userGoal: string;
  goalVersion?: number;
  capabilitySlug?: string;
  language?: "zh-CN" | "en";
}): Promise<VisualAssetPlan | null> {
  if (!shouldForceVisualLadder(input.sessionId)) return null;
  try {
    const plan = await runVisualAssetOrchestrator({
      workspaceRoot: input.workspaceRoot,
      sessionId: input.sessionId,
      taskArtifactDir: input.taskArtifactDir,
      userGoal: input.userGoal,
      goalVersion: input.goalVersion,
      capabilitySlug: input.capabilitySlug,
      phase: "phase_a",
      language: input.language ?? "zh-CN",
    });
    resetVisualFetchFailures(input.sessionId);
    return plan;
  } catch {
    return null;
  }
}

/** Budget: 60s when goal has http(s) URL or official intent; else env/28000. */
export function resolveVapOrchestratorBudgetMs(userGoal: string): number {
  const envRaw = process.env.PILOTDECK_VAP_ORCHESTRATOR_BUDGET_MS?.trim();
  const envMs = envRaw ? Number.parseInt(envRaw, 10) : Number.NaN;
  const hasUrl = /https?:\/\//iu.test(userGoal);
  const official = /官网|官方|official|bfgoodrich|产品图/iu.test(userGoal);
  if (hasUrl || official) {
    if (Number.isFinite(envMs) && envMs >= 60_000) return envMs;
    return 60_000;
  }
  if (Number.isFinite(envMs) && envMs > 0) return envMs;
  return 28_000;
}
