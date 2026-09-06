// PD-SAAS-FORK: detect repeated hard failures for same tool+input in one turn

import type { PilotDeckToolResult } from "../../tool/index.js";
import { contentToText } from "../../tool/protocol/result.js";

function stableInputKey(result: PilotDeckToolResult): string {
  if (result.type === "success") return "";
  const text = result.content.map((c) => contentToText(c)).join("\n");
  return text.slice(0, 500);
}

export class ToolFailureRepeatTracker {
  private readonly counts = new Map<string, number>();

  private keyFor(result: PilotDeckToolResult): string | null {
    if (result.type === "success") return null;
    const inputKey = stableInputKey(result);
    return `${result.toolName}:${inputKey}`;
  }

  /** Returns repeat key when same tool+input failed ≥2 times. */
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
