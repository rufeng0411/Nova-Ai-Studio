/**
 * PD-SAAS-FORK: Sequential deliverable gate with parallelGroup support (office-export).
 */
import type { SessionDeliverableManifest, SessionDeliverableSlot } from "./sessionDeliverableManifest.js";
import {
  matchPathToCurrentStage,
  shouldEnforceSequentialDeliverables,
} from "./sessionDeliverableManifest.js";
import { pathSatisfiesSdmSlot, normalizeSdmPath } from "../deliverables/sdmSlotMatching.js";
import {
  isParallelOfficeExportEnabled,
  parallelOfficeExportMode,
} from "../resilience/stabilityFlags.js";
import { recordStabilityEvent } from "../../telemetry/stabilityEvents.js";

export type SequentialGateResult = {
  allowed: boolean;
  reason?: string;
  parallelGroup?: string;
  shadowWouldBlock?: boolean;
};

function basename(path: string): string {
  return normalizeSdmPath(path).split("/").pop() ?? path;
}

function slotForPath(
  filePath: string,
  slots: SessionDeliverableSlot[],
): SessionDeliverableSlot | undefined {
  const normalized = normalizeSdmPath(filePath);
  return slots.find(
    (slot) => slot.status !== "removed" && pathSatisfiesSdmSlot(normalized, slot),
  );
}

function sourceMdReady(
  manifest: SessionDeliverableManifest,
  sourceHint: string | undefined,
  verifiedPaths: string[] = [],
): boolean {
  if (!sourceHint) return true;
  const mdSlot = manifest.slots.find(
    (slot) =>
      slot.status !== "removed"
      && (slot.pathHint === sourceHint
        || slot.pathHints?.includes(sourceHint)
        || basename(slot.pathHint ?? "") === basename(sourceHint)),
  );
  if (!mdSlot) return true;
  if (mdSlot.status === "done") return true;
  return verifiedPaths.some((p) => pathSatisfiesSdmSlot(normalizeSdmPath(p), mdSlot));
}

/**
 * Unified gate for write_file / export_document / agent parallel writes.
 */
export function matchPathToSequentialGate(
  filePath: string,
  manifest: SessionDeliverableManifest,
  options: { toolName?: string; verifiedPaths?: string[] } = {},
): SequentialGateResult {
  if (!shouldEnforceSequentialDeliverables(manifest)) {
    return { allowed: true };
  }

  const normalized = normalizeSdmPath(filePath);
  if (/data-sources\.md$/iu.test(normalized)) return { allowed: true };
  if (/visual-asset-manifest\.json$/iu.test(normalized)) return { allowed: true };

  const matchedSlot = slotForPath(filePath, manifest.slots);
  const parallelMode = parallelOfficeExportMode();

  if (
    matchedSlot?.parallelGroup === "office-export"
    && isParallelOfficeExportEnabled()
  ) {
    const sourceHint = matchedSlot.sourcePathHint
      ?? manifest.slots.find((s) => s.kind === "markdown" && s.pathHint?.endsWith(".md"))?.pathHint;
    if (!sourceMdReady(manifest, sourceHint, options.verifiedPaths)) {
      const result: SequentialGateResult = {
        allowed: false,
        reason: `Office export parallel gate: source "${sourceHint ?? "report.md"}" must be written first.`,
        parallelGroup: "office-export",
        shadowWouldBlock: true,
      };
      if (parallelMode === "shadow") {
        recordStabilityEvent({
          event: "sequential_gate_blocked",
          sessionId: manifest.taskArtifactDir,
          reason: result.reason,
          detail: { toolName: options.toolName ?? "unknown" },
        });
        return { ...result, allowed: true, shadowWouldBlock: true };
      }
      return result;
    }

    const currentStageId = manifest.currentStageId
      ?? manifest.slots.find((s) => s.stageId)?.stageId;
    if (matchedSlot.stageId && currentStageId && matchedSlot.stageId !== currentStageId) {
      const result: SequentialGateResult = {
        allowed: false,
        reason: `Office export gate: stage "${matchedSlot.stageId}" not active (current="${currentStageId}").`,
        parallelGroup: "office-export",
        shadowWouldBlock: true,
      };
      if (parallelMode === "enforce") return result;
      if (parallelMode === "shadow") {
        recordStabilityEvent({
          event: "sequential_gate_blocked",
          sessionId: manifest.taskArtifactDir,
          reason: result.reason,
          detail: { toolName: options.toolName ?? "unknown" },
        });
        return { ...result, allowed: true };
      }
    }
    return { allowed: true, parallelGroup: "office-export" };
  }

  const stageGate = matchPathToCurrentStage(filePath, manifest);
  if (!stageGate.allowed && parallelMode === "shadow") {
    recordStabilityEvent({
      event: "sequential_gate_blocked",
      sessionId: manifest.taskArtifactDir,
      reason: stageGate.reason,
      detail: { toolName: options.toolName ?? "unknown" },
    });
    return { allowed: true, reason: stageGate.reason, shadowWouldBlock: true };
  }
  return { allowed: stageGate.allowed, reason: stageGate.reason };
}

export function promptTargetsParallelGroupOnly(
  prompt: string,
  manifest: SessionDeliverableManifest,
  parallelGroup: string,
): boolean {
  const basenames = new Set<string>();
  for (const match of prompt.matchAll(/[\w\u4e00-\u9fff.-]+\.(?:md|html?|docx|pdf|pptx)/giu)) {
    basenames.add(match[0].toLowerCase());
  }
  if (basenames.size < 2) return false;
  const groupSlots = manifest.slots.filter(
    (slot) => slot.status !== "removed" && slot.parallelGroup === parallelGroup,
  );
  if (groupSlots.length < 2) return false;
  for (const name of basenames) {
    const hit = groupSlots.some((slot) => {
      const hints = [...(slot.pathHints ?? []), ...(slot.pathHint ? [slot.pathHint] : [])];
      return hints.some((h) => basename(h).toLowerCase() === name);
    });
    if (!hit) return false;
  }
  return true;
}
