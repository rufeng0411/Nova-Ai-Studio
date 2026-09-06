import { describe, expect, it } from "vitest";
import {
  applyModelEventToAssembler,
  assembleAssistantMessage,
  createModelMessageAssemblerState,
} from "./assembleModelMessage.js";
import type { CanonicalModelEvent } from "../protocol/canonical.js";

function assemble(events: CanonicalModelEvent[]) {
  const state = createModelMessageAssemblerState();
  for (const ev of events) applyModelEventToAssembler(state, ev);
  return assembleAssistantMessage(state);
}

const writeCall = (wasRepaired: boolean): CanonicalModelEvent => ({
  type: "tool_call_end",
  toolCall: { id: "c1", name: "write_file", input: { file_path: "report.html", content: "<h1>纵横 G700</h1>" } },
  wasRepaired,
});

// These two assertions pin the contract the salvage fix relies on: AgentLoop only blocks tool calls
// into the max_output recovery loop (line ~1725) when `hasRepairedToolCalls` is set, which is derived
// solely from `tool_call_end.wasRepaired`. A salvaged write MUST emit wasRepaired:false so the loop
// EXECUTES it (writes the file) instead of re-entering the retry loop with zero files.
describe("assembleAssistantMessage — wasRepaired → hasRepairedToolCalls contract", () => {
  it("a salvaged write (wasRepaired:false) does NOT mark hasRepairedToolCalls → loop executes it", () => {
    const assembled = assemble([
      { type: "message_start", role: "assistant" },
      writeCall(false),
      { type: "message_end", finishReason: "length" },
    ]);
    expect(assembled.hasRepairedToolCalls).toBeFalsy();
    expect(assembled.toolCalls).toHaveLength(1);
    expect(assembled.toolCalls[0]!.name).toBe("write_file");
  });

  it("a non-salvaged repaired write (wasRepaired:true) marks hasRepairedToolCalls → loop blocks it", () => {
    const assembled = assemble([
      { type: "message_start", role: "assistant" },
      writeCall(true),
      { type: "message_end", finishReason: "length" },
    ]);
    expect(assembled.hasRepairedToolCalls).toBe(true);
    expect(assembled.toolCalls).toHaveLength(1);
  });
});
