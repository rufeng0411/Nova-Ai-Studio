import { describe, expect, it } from "vitest";
import { createAnthropicStreamState, normalizeAnthropicStreamEvent } from "./stream.js";
import type { CanonicalModelEvent } from "../../protocol/canonical.js";

const GTM_LINE = "✅ 全车原厂背书，免去年检烦恼，全车原厂质保（非副厂拼装），免去年检烦恼。";

function truncatedWriteJson(content: string): string {
  const body = content.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
  return `{"file_path":"out.html","content":"${body}`; // unterminated → repaired
}

function feedWriteToolCall(content: string, salvage: boolean): CanonicalModelEvent[] {
  const state = createAnthropicStreamState({ salvageDegenerateWrites: salvage });
  normalizeAnthropicStreamEvent({ type: "message_start", message: {} }, state);
  normalizeAnthropicStreamEvent(
    { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "tu_1", name: "write_file" } },
    state,
  );
  normalizeAnthropicStreamEvent(
    { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: truncatedWriteJson(content) } },
    state,
  );
  return normalizeAnthropicStreamEvent({ type: "content_block_stop", index: 0 }, state);
}

function findToolCallEnd(events: CanonicalModelEvent[]): Extract<CanonicalModelEvent, { type: "tool_call_end" }> | undefined {
  return events.find((e): e is Extract<CanonicalModelEvent, { type: "tool_call_end" }> => e.type === "tool_call_end");
}

describe("anthropic content_block_stop — degenerate write salvage", () => {
  it("salvages a clean prefix from a repaired degenerate write (flag ON) and clears wasRepaired", () => {
    const clean = "<!DOCTYPE html>\n<html><body>\n<h1>纵横 G700 顶火鸣镝版</h1>\n";
    const content = clean + Array(12).fill(GTM_LINE).join("\n");
    const events = feedWriteToolCall(content, true);
    const end = findToolCallEnd(events);
    expect(end).toBeDefined();
    expect(end!.wasRepaired).toBe(false);
    const input = end!.toolCall.input as { content: string };
    expect(input.content).toContain("纵横 G700");
    expect(input.content.split(GTM_LINE).length - 1).toBe(1);
  });

  it("keeps the full repaired content (wasRepaired=true) when flag is OFF", () => {
    const clean = "<!DOCTYPE html>\n<html><body>\n<h1>纵横 G700</h1>\n";
    const content = clean + Array(12).fill(GTM_LINE).join("\n");
    const events = feedWriteToolCall(content, false);
    const end = findToolCallEnd(events);
    expect(end).toBeDefined();
    expect(end!.wasRepaired).toBe(true);
    const input = end!.toolCall.input as { content: string };
    // untrimmed → many copies survive
    expect(input.content.split(GTM_LINE).length - 1).toBeGreaterThan(5);
  });
});
