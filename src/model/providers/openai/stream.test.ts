import { describe, expect, it } from "vitest";
import { createOpenAIStreamState, normalizeOpenAIStreamEvent } from "./stream.js";
import { ModelProviderError } from "../../protocol/errors.js";
import type { CanonicalModelEvent } from "../../protocol/canonical.js";

const GTM_LINE = "✅ 全车原厂背书，免去年检烦恼，全车原厂质保（非副厂拼装），免去年检烦恼。";

/** JSON-escape a content string and build a TRUNCATED (unterminated) write_file arguments buffer. */
function truncatedWriteArgs(content: string): string {
  const body = content.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
  // No closing quote/brace → invalid JSON → jsonrepair path → wasRepaired=true.
  return `{"file_path":"out.html","content":"${body}`;
}

function toolCallChunk(args: string): unknown {
  return {
    choices: [
      {
        delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "write_file", arguments: args } }] },
      },
    ],
  };
}

function lengthFinishChunk(): unknown {
  return { choices: [{ finish_reason: "length", delta: {} }] };
}

function findToolCallEnd(events: CanonicalModelEvent[]): Extract<CanonicalModelEvent, { type: "tool_call_end" }> | undefined {
  return events.find((e): e is Extract<CanonicalModelEvent, { type: "tool_call_end" }> => e.type === "tool_call_end");
}

describe("openai finishToolCalls — degenerate write salvage (flag ON)", () => {
  it("salvages a clean prefix from a truncated repeated write_file instead of discarding", () => {
    const clean = "<!DOCTYPE html>\n<html><body>\n<h1>纵横 G700 顶火鸣镝版</h1>\n";
    const content = clean + Array(12).fill(GTM_LINE).join("\n");
    const state = createOpenAIStreamState({ salvageDegenerateWrites: true });
    normalizeOpenAIStreamEvent(toolCallChunk(truncatedWriteArgs(content)), state);
    const events = normalizeOpenAIStreamEvent(lengthFinishChunk(), state);

    const end = findToolCallEnd(events);
    expect(end).toBeDefined();
    expect(end!.toolCall.name).toBe("write_file");
    // wasRepaired MUST be false so the agent loop executes (writes) the salvaged call instead of
    // blocking it as repaired-but-truncated (which would re-enter the retry loop → zero files).
    expect(end!.wasRepaired).toBe(false);
    const input = end!.toolCall.input as { content: string };
    expect(input.content).toContain("纵横 G700");
    // exactly one surviving copy of the runaway line (the rest trimmed)
    expect(input.content.split(GTM_LINE).length - 1).toBe(1);
    expect(input.content).toContain("自动截断");
  });
});

describe("openai finishToolCalls — discard behavior preserved (flag OFF)", () => {
  it("throws max_output_reached for a truncated repaired write (no salvage)", () => {
    const clean = "<!DOCTYPE html>\n<html><body>\n<h1>纵横 G700</h1>\n";
    const content = clean + Array(12).fill(GTM_LINE).join("\n");
    const state = createOpenAIStreamState(); // salvage OFF by default
    normalizeOpenAIStreamEvent(toolCallChunk(truncatedWriteArgs(content)), state);
    expect(() => normalizeOpenAIStreamEvent(lengthFinishChunk(), state)).toThrow(ModelProviderError);
  });
});

describe("openai finishToolCalls — legitimately large (no repetition) still retries", () => {
  it("throws (no salvage) when a truncated write has no runaway repetition even with flag ON", () => {
    // Unique, non-repeating long content — legitimately large, should retry with more tokens.
    const lines: string[] = [];
    for (let i = 0; i < 40; i += 1) {
      lines.push(`<section id="s${i}"><h2>章节 ${i}</h2><p>这是第 ${i} 节的独特正文内容描述片段。</p></section>`);
    }
    const content = "<!DOCTYPE html>\n<html><body>\n" + lines.join("\n");
    const state = createOpenAIStreamState({ salvageDegenerateWrites: true });
    normalizeOpenAIStreamEvent(toolCallChunk(truncatedWriteArgs(content)), state);
    expect(() => normalizeOpenAIStreamEvent(lengthFinishChunk(), state)).toThrow(ModelProviderError);
  });
});

describe("openai finishToolCalls — non-truncated happy path unaffected", () => {
  it("emits a normal tool_call_end for a complete write even with flag ON", () => {
    const args = JSON.stringify({ file_path: "out.html", content: "<h1>ok</h1>" });
    const state = createOpenAIStreamState({ salvageDegenerateWrites: true });
    normalizeOpenAIStreamEvent(toolCallChunk(args), state);
    const events = normalizeOpenAIStreamEvent({ choices: [{ finish_reason: "tool_calls", delta: {} }] }, state);
    const end = findToolCallEnd(events);
    expect(end).toBeDefined();
    expect((end!.toolCall.input as { content: string }).content).toBe("<h1>ok</h1>");
    expect(end!.wasRepaired).toBeFalsy();
  });
});
