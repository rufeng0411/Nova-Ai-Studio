// PD-SAAS-FORK: fast-stop hung tool loops (e.g. render_html_video) with UserActionRequired
import type { PilotDeckToolResult } from "../../tool/index.js";

export const REPEATED_TOOL_FAST_STOP_THRESHOLD = 3;

const FAST_STOP_TOOLS = new Set([
  "render_html_video",
  "render_hyperframes",
  "generate_video",
]);

export type RepeatedToolFailureState = {
  lastToolName: string | null;
  consecutiveFailures: number;
};

export function createRepeatedToolFailureState(): RepeatedToolFailureState {
  return { lastToolName: null, consecutiveFailures: 0 };
}

export function isRepeatedToolFastStopTarget(toolName: string): boolean {
  return FAST_STOP_TOOLS.has(toolName);
}

export function advanceRepeatedToolFailureState(
  state: RepeatedToolFailureState,
  results: PilotDeckToolResult[],
): RepeatedToolFailureState {
  const failed = results.filter((result): result is Extract<PilotDeckToolResult, { type: "error" }> => (
    result.type === "error"
  ));
  if (failed.length === 0) {
    return { lastToolName: null, consecutiveFailures: 0 };
  }
  const toolName = failed[0]?.toolName ?? null;
  if (!toolName || !isRepeatedToolFastStopTarget(toolName)) {
    return { lastToolName: toolName, consecutiveFailures: 0 };
  }
  const allSameTool = failed.every((result) => result.toolName === toolName);
  if (!allSameTool) {
    return { lastToolName: toolName, consecutiveFailures: 1 };
  }
  const next = state.lastToolName === toolName ? state.consecutiveFailures + 1 : 1;
  return { lastToolName: toolName, consecutiveFailures: next };
}

export function shouldFastStopRepeatedToolFailure(state: RepeatedToolFailureState): boolean {
  if (!state.lastToolName || !isRepeatedToolFastStopTarget(state.lastToolName)) {
    return false;
  }
  return state.consecutiveFailures >= REPEATED_TOOL_FAST_STOP_THRESHOLD;
}

export function buildRepeatedToolFastStopMessage(toolName: string): string {
  if (toolName === "render_html_video") {
    return "render_html_video failed repeatedly. Video API may be unavailable or misconfigured. "
      + "Configure video generation credentials or use generate_video if available.";
  }
  if (toolName === "render_hyperframes") {
    return "render_hyperframes failed repeatedly. Check ffmpeg, HyperFrames CLI (hyperframes doctor), "
      + "and composition lint/validate errors in hf-project/.";
  }
  return `${toolName} failed repeatedly. Check API credentials, quota, or try an alternate delivery path.`;
}
