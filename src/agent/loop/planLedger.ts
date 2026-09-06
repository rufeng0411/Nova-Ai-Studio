// PD-SAAS-FORK (P1-A, flag-gated): engine plan ledger.
//
// Derives an ordered, human-readable step list from the task goal contract (one step per required
// deliverable file, plus per-kind count / presence steps) and computes which steps are done vs
// remaining given the set of verified deliverable paths.
//
// Pure + side-effect free so it is trivially testable. The loop only CONSUMES it for telemetry +
// repair-prompt enrichment, never to extend / block a turn — so enabling the flag cannot change
// control flow on its own (it can only make the engine's repair hint more specific).

import type { AcceptanceArtifactKind } from "../../saas/deliverables/acceptanceChecks.js";
import type { TaskGoalContract, TaskGoalKindCount } from "../../saas/taskState/taskGoalContract.js";

export type PlanStepKind = "file" | "count" | "presence";

export type PlanStep = {
  id: string;
  /** Short label used to enrich the repair hint (working language = Chinese). */
  label: string;
  kind: PlanStepKind;
  /** file -> required basename; count/presence -> artifact kind name. */
  target: string;
  /** count steps only: the required minimum. */
  min?: number;
};

export type PlanStepStatus = PlanStep & { done: boolean };

export type PlanLedgerSnapshot = {
  total: number;
  done: number;
  remaining: PlanStep[];
  steps: PlanStepStatus[];
  nextStep?: PlanStep;
  complete: boolean;
};

const KIND_EXTENSIONS: Partial<Record<AcceptanceArtifactKind, string[]>> = {
  html: [".html", ".htm"],
  pptx: [".pptx"],
  docx: [".docx"],
  pdf: [".pdf"],
  markdown: [".md", ".markdown"],
  spreadsheet: [".csv", ".xlsx"],
  image: [".png", ".jpg", ".jpeg", ".webp", ".gif"],
  video: [".mp4", ".webm", ".mov"],
};

const PAGE_UNIT_KINDS: AcceptanceArtifactKind[] = ["html", "pptx", "pdf"];

function isArtifactKind(token: string): token is AcceptanceArtifactKind {
  return Object.prototype.hasOwnProperty.call(KIND_EXTENSIONS, token);
}

/** Strip a "platform-drafts>=N" style token down to its base label. */
function normalizeRequiredToken(token: string): string {
  const match = String(token).match(/^(.*?)>=\d+$/);
  return (match ? match[1] : String(token)).trim();
}

/**
 * Derive the ordered step list. Order: explicit required files first (contract order), then per-kind
 * count steps, then any expected kind that is not yet covered by a file/count step.
 */
export function derivePlanSteps(contract: TaskGoalContract): PlanStep[] {
  const steps: PlanStep[] = [];
  const seen = new Set<string>();

  for (const raw of contract.requiredFiles ?? []) {
    const base = normalizeRequiredToken(raw);
    if (!base) continue;
    const id = `file:${base.toLowerCase()}`;
    if (seen.has(id)) continue;
    seen.add(id);
    steps.push({ id, label: `产出 ${base}`, kind: "file", target: base });
  }

  const kindCounts: TaskGoalKindCount[] = contract.kindCounts ?? [];
  for (const count of kindCounts) {
    const id = `count:${count.kind}`;
    if (seen.has(id)) continue;
    seen.add(id);
    steps.push({ id, label: `产出 ${count.min} 个 ${count.kind}`, kind: "count", target: count.kind, min: count.min });
  }

  for (const kind of contract.expectedKinds ?? []) {
    if (kindCounts.some((count) => count.kind === kind)) continue;
    // A single global minCount applies to the primary page-unit kind when there is no kindCounts list.
    const applyMin = !kindCounts.length && Boolean(contract.minCount) && PAGE_UNIT_KINDS.includes(kind);
    const id = applyMin ? `count:${kind}` : `presence:${kind}`;
    if (seen.has(id)) continue;
    seen.add(id);
    if (applyMin) {
      steps.push({ id, label: `产出 ${contract.minCount} 个 ${kind}`, kind: "count", target: kind, min: contract.minCount });
    } else {
      steps.push({ id, label: `产出 ${kind} 交付物`, kind: "presence", target: kind });
    }
  }

  return steps;
}

function basenameOf(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const last = normalized.slice(normalized.lastIndexOf("/") + 1);
  return last.toLowerCase();
}

function countKindMatches(kind: string, lowerPaths: string[]): number {
  if (!isArtifactKind(kind)) return 0;
  const exts = KIND_EXTENSIONS[kind] ?? [];
  return lowerPaths.filter((filePath) => exts.some((ext) => filePath.endsWith(ext))).length;
}

function isStepDone(step: PlanStep, lowerPaths: string[], lowerBasenames: string[]): boolean {
  if (step.kind === "count") {
    return countKindMatches(step.target, lowerPaths) >= (step.min ?? 1);
  }
  if (step.kind === "presence") {
    return countKindMatches(step.target, lowerPaths) >= 1;
  }
  // file step: the target is a required basename. Match by basename containment so e.g.
  // "slide-manifest.json" matches "artifacts/slides-x/slide-manifest.json".
  const target = step.target.toLowerCase();
  if (isArtifactKind(target)) return countKindMatches(target, lowerPaths) >= 1;
  return lowerBasenames.some((base) => base === target || base.includes(target))
    || lowerPaths.some((filePath) => filePath.includes(target));
}

/** Evaluate which steps are satisfied by the verified deliverable paths. */
export function evaluatePlanProgress(steps: PlanStep[], verifiedPaths: readonly string[]): PlanLedgerSnapshot {
  const lowerPaths = verifiedPaths.map((filePath) => String(filePath).toLowerCase());
  const lowerBasenames = lowerPaths.map(basenameOf);
  const statuses: PlanStepStatus[] = steps.map((step) => ({
    ...step,
    done: isStepDone(step, lowerPaths, lowerBasenames),
  }));
  const remaining = statuses.filter((status) => !status.done);
  return {
    total: statuses.length,
    done: statuses.length - remaining.length,
    remaining: remaining.map(({ done: _done, ...step }) => step),
    steps: statuses,
    nextStep: remaining.length > 0 ? (({ done: _done, ...step }) => step)(remaining[0]!) : undefined,
    complete: statuses.length > 0 && remaining.length === 0,
  };
}

/** Convenience: derive + evaluate in one call. */
export function buildPlanLedger(contract: TaskGoalContract, verifiedPaths: readonly string[]): PlanLedgerSnapshot {
  return evaluatePlanProgress(derivePlanSteps(contract), verifiedPaths);
}

/** Compact, single-line repair hint, e.g. "计划进度 2/5，下一步：产出 slide-manifest.json"。 */
export function formatPlanLedgerHint(snapshot: PlanLedgerSnapshot): string | undefined {
  if (snapshot.total === 0) return undefined;
  const head = `计划进度 ${snapshot.done}/${snapshot.total}`;
  if (snapshot.complete || !snapshot.nextStep) return head;
  const remainingLabels = snapshot.remaining.slice(0, 3).map((step) => step.label).join("；");
  return `${head}，下一步：${snapshot.nextStep.label}${snapshot.remaining.length > 1 ? `（剩余：${remainingLabels}）` : ""}`;
}
