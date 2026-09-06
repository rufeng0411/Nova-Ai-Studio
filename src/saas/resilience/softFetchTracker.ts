// PD-SAAS-FORK: detect repeated soft failures for same query/URL in one turn

import type { PilotDeckToolResult } from "../../tool/index.js";
import { isSoftFailedToolResult } from "../../agent/loop/toolFailureRecovery.js";

export class SoftFetchRepeatTracker {
  private readonly counts = new Map<string, number>();

  private keyFor(result: PilotDeckToolResult): string | null {
    if (!isSoftFailedToolResult(result)) return null;
    const data = result.type === "success" ? result.data : undefined;
    const fromData = data && typeof data === "object"
      ? (data as { sourceUrl?: string; url?: string; query?: string })
      : undefined;
    const url = fromData?.sourceUrl || fromData?.url || "";
    const query = fromData?.query || "";
    const reason = typeof result.metadata?.reason === "string" ? result.metadata.reason : "";
    const target = url || query || reason;
    if (!target) return `${result.toolName}:unknown`;
    return `${result.toolName}:${target}`;
  }

  record(results: PilotDeckToolResult[]): string | null {
    for (const result of results) {
      const key = this.keyFor(result);
      if (!key) continue;
      const next = (this.counts.get(key) ?? 0) + 1;
      this.counts.set(key, next);
      if (next >= 2) return key;
    }
    return null;
  }

  hasRepeat(): boolean {
    for (const count of this.counts.values()) {
      if (count >= 2) return true;
    }
    return false;
  }
}
