import { afterEach, describe, expect, it } from "vitest";
import { streamModel, type ModelTransport } from "./streamModel.js";
import { ModelProviderError } from "../protocol/errors.js";
import { DEFAULT_MODEL_CAPABILITIES } from "../protocol/capabilities.js";
import { DEFAULT_MULTIMODAL_CONSTRAINTS } from "../protocol/multimodal.js";
import type { CanonicalModelEvent, CanonicalModelRequest, ModelConfig } from "../protocol/canonical.js";

const GTM_LINE = "✅ 全车原厂背书，免去年检烦恼，全车原厂质保（非副厂拼装），免去年检烦恼。";
const FLAG = "PILOTDECK_STREAM_DEGENERATION";

const CONFIG: ModelConfig = {
  providers: {
    qwen: {
      id: "qwen",
      protocol: "openai",
      url: "https://example.test/v1",
      apiKey: "sk-test",
      headers: {},
      models: {
        "qwen3.6-flash": {
          id: "qwen3.6-flash",
          capabilities: { ...DEFAULT_MODEL_CAPABILITIES, supportsToolUse: true },
          multimodal: DEFAULT_MULTIMODAL_CONSTRAINTS,
        },
      },
    },
  },
};

const REQUEST: CanonicalModelRequest = {
  provider: "qwen",
  model: "qwen3.6-flash",
  messages: [{ role: "user", content: [{ type: "text", text: "写一份 HTML 报告" }] }],
};

/** A fake fetch transport that streams the given OpenAI chunks as SSE then [DONE]. */
function sseTransport(chunks: unknown[]): ModelTransport {
  return (async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
  }) as unknown as ModelTransport;
}

function truncatedWriteArgs(content: string): string {
  const body = content.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
  return `{"file_path":"report.html","content":"${body}`; // unterminated → repaired
}

function degenerateChunks(): unknown[] {
  const clean = "<!DOCTYPE html>\n<html><body>\n<h1>纵横 G700 顶火鸣镝版 GTM</h1>\n";
  const content = clean + Array(14).fill(GTM_LINE).join("\n");
  return [
    {
      choices: [
        {
          delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "write_file", arguments: truncatedWriteArgs(content) } }] },
        },
      ],
    },
    { choices: [{ finish_reason: "length", delta: {} }] },
  ];
}

async function collect(transport: ModelTransport): Promise<CanonicalModelEvent[]> {
  const events: CanonicalModelEvent[] = [];
  for await (const ev of streamModel(REQUEST, CONFIG, { fetch: transport })) {
    events.push(ev);
  }
  return events;
}

afterEach(() => {
  delete process.env[FLAG];
});

describe("streamModel — full pipeline degenerate write salvage", () => {
  it("salvages a degenerate truncated write_file end-to-end when the flag is ON", async () => {
    process.env[FLAG] = "1";
    const events = await collect(sseTransport(degenerateChunks()));

    const end = events.find(
      (e): e is Extract<CanonicalModelEvent, { type: "tool_call_end" }> => e.type === "tool_call_end",
    );
    expect(end).toBeDefined();
    expect(end!.toolCall.name).toBe("write_file");
    expect(end!.wasRepaired).toBe(false);
    const input = end!.toolCall.input as { content: string };
    expect(input.content).toContain("纵横 G700");
    expect(input.content.split(GTM_LINE).length - 1).toBe(1);
    // no error event leaked through
    expect(events.some((e) => e.type === "error")).toBe(false);
  });

  it("throws max_output_reached (discard) when the flag is OFF — production behavior unchanged", async () => {
    delete process.env[FLAG];
    await expect(collect(sseTransport(degenerateChunks()))).rejects.toBeInstanceOf(ModelProviderError);
  });
});
