/**
 * PD-SAAS-FORK: task stage budget observe (shadow). Never abort write_file; never change AgentLoop arbitration.
 */
import { DEFAULT_TOOL_WATCHDOG_CONFIG } from "../../agent/loop/toolWatchdog.js";
import { recordStabilityEvent } from "../../telemetry/stabilityEvents.js";
import { isTaskStageBudgetMode } from "./stabilityFlags.js";

export type TaskStageId =
  | "vap_discover"
  | "web_search"
  | "write_file"
  | "generate_image"
  | "generate_video"
  | "validate"
  | "deliverable_repair"
  | "official_media"
  | "other_tool";

export type TaskStageObserveResult = {
  overrun: boolean;
  retryHot: boolean;
  intendedAction: "none" | "skip_to_next_ladder" | "reuse_repair_circuit" | "pause_snapshot_refresh";
};

const REPAIR_OVERRUN_MS = 180_000;
const stageStartedAt = new Map<string, number>();

function deadlineForStage(stage: TaskStageId): number {
  switch (stage) {
    case "vap_discover":
    case "web_search":
    case "official_media":
      return 90_000;
    case "write_file":
      return 30_000;
    case "generate_image":
      return 180_000;
    case "generate_video":
      return 240_000;
    case "deliverable_repair":
      return REPAIR_OVERRUN_MS;
    case "validate":
    case "other_tool":
      return DEFAULT_TOOL_WATCHDOG_CONFIG.defaultDeadlineMs;
    default: {
      const exhaustive: never = stage;
      return exhaustive;
    }
  }
}

export function mapToolNameToStage(toolName: string): TaskStageId {
  const name = String(toolName ?? "").toLowerCase();
  if (
    name.includes("discover_visual")
    || name.includes("prepare_visual")
    || name.includes("resolve_session_visual")
    || name.includes("fetch_media_asset")
    || name.includes("fetch_page_images")
  ) {
    return "vap_discover";
  }
  if (name.includes("official") || name.includes("official_media")) {
    return "official_media";
  }
  if (
    name.includes("web_search")
    || name.includes("web_fetch")
    || name.includes("browser")
    || name.includes("geo_api")
  ) {
    return "web_search";
  }
  if (name.includes("write_file") || name.includes("edit_file") || name.includes("str_replace")) {
    return "write_file";
  }
  if (name.includes("generate_image") || name.includes("compose_images")) {
    return "generate_image";
  }
  if (
    name.includes("generate_video")
    || name.includes("render_html_video")
    || name.includes("render_hyperframes")
  ) {
    return "generate_video";
  }
  if (name.includes("validate") || name.includes("acceptance")) {
    return "validate";
  }
  if (name.includes("deliverable_repair")) {
    return "deliverable_repair";
  }
  return "other_tool";
}

function resolveIntendedAction(input: {
  stage: TaskStageId;
  overrun: boolean;
  retryHot: boolean;
}): TaskStageObserveResult["intendedAction"] {
  if (input.overrun && (input.stage === "vap_discover" || input.stage === "web_search" || input.stage === "official_media")) {
    return "skip_to_next_ladder";
  }
  if (input.overrun && input.stage === "deliverable_repair") {
    return "reuse_repair_circuit";
  }
  if (input.retryHot) {
    return "pause_snapshot_refresh";
  }
  return "none";
}

export function observeTaskStage(input: {
  sessionId: string;
  stage: TaskStageId;
  elapsedMs: number;
  retryCount: number;
  verifiedNet: number;
}): TaskStageObserveResult {
  try {
    const mode = isTaskStageBudgetMode();
    const none: TaskStageObserveResult = {
      overrun: false,
      retryHot: false,
      intendedAction: "none",
    };
    if (mode === "off") return none;

    const clockKey = `${input.sessionId}:${input.stage}`;
    if (!stageStartedAt.has(clockKey)) {
      stageStartedAt.set(clockKey, Date.now());
    }
    const elapsedMs = input.elapsedMs > 0
      ? input.elapsedMs
      : Date.now() - (stageStartedAt.get(clockKey) ?? Date.now());
    const deadlineMs = deadlineForStage(input.stage);
    const overrun = elapsedMs > deadlineMs
      && (input.stage !== "deliverable_repair" || input.verifiedNet <= 0);
    const retryHot = input.retryCount >= 3 && input.verifiedNet <= 0;
    const intendedAction = resolveIntendedAction({
      stage: input.stage,
      overrun,
      retryHot,
    });

    if (overrun) {
      recordStabilityEvent({
        event: "task_stage_overrun",
        sessionId: input.sessionId,
        reason: input.stage,
        detail: {
          stage: input.stage,
          elapsedMs,
          deadlineMs,
          retryCount: input.retryCount,
          verifiedNet: input.verifiedNet,
          intendedAction,
          mode,
        },
      });
    }
    if (retryHot) {
      recordStabilityEvent({
        event: "task_stage_retry_hot",
        sessionId: input.sessionId,
        reason: input.stage,
        detail: {
          stage: input.stage,
          elapsedMs,
          retryCount: input.retryCount,
          verifiedNet: input.verifiedNet,
          intendedAction,
          mode,
        },
      });
    }

    return { overrun, retryHot, intendedAction };
  } catch {
    return { overrun: false, retryHot: false, intendedAction: "none" };
  }
}

export function resetTaskStageBudgetClocksForTests(): void {
  stageStartedAt.clear();
}
