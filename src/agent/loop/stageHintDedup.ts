// PD-SAAS-FORK: per-turn stage hint deduplication within AgentLoop

import type { TurnStageHintKey } from "../turnStageHints.js";

const ONCE_PER_TURN_STAGES = new Set<TurnStageHintKey>([
  "session_prepare",
  "plugin_refresh",
  "mcp_ready",
  "memory_retrieve",
  "router_judge",
  "compact",
]);

export class StageHintDedup {
  private readonly emitted = new Set<string>();

  shouldEmit(stage: TurnStageHintKey): boolean {
    if (!ONCE_PER_TURN_STAGES.has(stage)) return true;
    if (this.emitted.has(stage)) return false;
    this.emitted.add(stage);
    return true;
  }

  reset(): void {
    this.emitted.clear();
  }
}
