import { describe, expect, it } from "vitest";
import type { CanonicalMessage } from "../../model/protocol/canonical.js";
import {
  COMPACTION_MARKER,
  DEFAULT_TOOL_RESULT_COMPACTION_CONFIG,
  compactToolResults,
  resolveToolResultCompactionConfig,
} from "./toolResultCompaction.js";

function toolResultMessage(text: string, toolCallId = "t1"): CanonicalMessage {
  return {
    role: "user",
    content: [{ type: "tool_result", toolCallId, content: [{ type: "text", text }] }],
  };
}

function textMessage(role: "user" | "assistant", text: string): CanonicalMessage {
  return { role, content: [{ type: "text", text }] };
}

const SMALL_WINDOW = { recencyWindow: 2, minBlockChars: 100, headChars: 40 };

describe("compactToolResults", () => {
  it("is a no-op when there are fewer messages than the recency window", () => {
    const messages = [toolResultMessage("x".repeat(5000))];
    const result = compactToolResults(messages, SMALL_WINDOW);
    expect(result.compactedBlocks).toBe(0);
    expect(result.messages[0]).toBe(messages[0]);
  });

  it("folds an old, large tool_result and preserves the head + marker", () => {
    const big = `PATH=/a/b/report.md\n${"内容".repeat(2000)}`;
    const messages = [
      toolResultMessage(big),
      textMessage("assistant", "thinking"),
      textMessage("user", "next"),
      textMessage("assistant", "more"),
    ];
    const result = compactToolResults(messages, SMALL_WINDOW);
    expect(result.compactedBlocks).toBe(1);
    expect(result.savedChars).toBeGreaterThan(0);
    const block = result.messages[0]!.content[0];
    expect(block.type).toBe("tool_result");
    if (block.type === "tool_result") {
      const text = block.content[0]!;
      expect(text.type).toBe("text");
      if (text.type === "text") {
        expect(text.text).toContain("PATH=/a/b/report.md");
        expect(text.text).toContain(COMPACTION_MARKER);
        expect(text.text.length).toBeLessThan(big.length);
      }
    }
  });

  it("never touches messages inside the recency window", () => {
    const big = "y".repeat(5000);
    const messages = [
      textMessage("user", "old"),
      toolResultMessage(big), // index 1 -> within last 2 (recencyWindow=2) -> untouched
      textMessage("assistant", "recent"),
    ];
    const result = compactToolResults(messages, SMALL_WINDOW);
    expect(result.compactedBlocks).toBe(0);
  });

  it("does not compact small tool_results", () => {
    const messages = [
      toolResultMessage("short result"),
      textMessage("user", "a"),
      textMessage("assistant", "b"),
    ];
    expect(compactToolResults(messages, SMALL_WINDOW).compactedBlocks).toBe(0);
  });

  it("is idempotent (already-compacted blocks are skipped)", () => {
    const big = `head\n${"内容".repeat(2000)}`;
    const messages = [
      toolResultMessage(big),
      textMessage("user", "a"),
      textMessage("assistant", "b"),
    ];
    const once = compactToolResults(messages, SMALL_WINDOW);
    const twice = compactToolResults(once.messages, SMALL_WINDOW);
    expect(twice.compactedBlocks).toBe(0);
  });

  it("preserves SMALL non-text blocks (e.g. images) while folding the text", () => {
    const big = "z".repeat(5000);
    const messages: CanonicalMessage[] = [
      {
        role: "user",
        content: [{
          type: "tool_result",
          toolCallId: "t1",
          content: [
            { type: "text", text: big },
            { type: "image", source: "base64", data: "AAAA", mimeType: "image/png" },
          ],
        }],
      },
      textMessage("user", "a"),
      textMessage("assistant", "b"),
    ];
    const result = compactToolResults(messages, SMALL_WINDOW);
    expect(result.compactedBlocks).toBe(1);
    const block = result.messages[0]!.content[0];
    if (block.type === "tool_result") {
      expect(block.content.some((b) => b.type === "image")).toBe(true);
    }
  });

  // RC2 regression: a generated hero image (huge base64) must NOT survive verbatim into OLD context,
  // or it re-inflates the request every turn until the provider call dies with "fetch failed".
  it("folds an OLD oversized base64 image and keeps the saved path text", () => {
    const hugeData = "/9j/4AAQ".repeat(5000); // ~40k chars of base64 >> maxBinaryDataChars
    const messages: CanonicalMessage[] = [
      {
        role: "user",
        content: [{
          type: "tool_result",
          toolCallId: "t1",
          content: [
            { type: "text", text: "Generated image saved to artifacts/hero-g700.png." },
            { type: "image", source: "base64", data: hugeData, mimeType: "image/png" },
          ],
        }],
      },
      textMessage("user", "a"),
      textMessage("assistant", "b"),
    ];
    const result = compactToolResults(messages, {
      ...SMALL_WINDOW,
      headChars: 400,
      maxBinaryDataChars: 20_000,
    });
    expect(result.compactedBlocks).toBe(1);
    expect(result.savedChars).toBeGreaterThan(30_000);
    const block = result.messages[0]!.content[0];
    if (block.type === "tool_result") {
      expect(block.content.some((b) => b.type === "image")).toBe(false);
      const text = block.content[0]!;
      expect(text.type).toBe("text");
      if (text.type === "text") {
        expect(text.text).toContain("artifacts/hero-g700.png");
        expect(text.text).toContain(COMPACTION_MARKER);
      }
    }
  });

  it("folds an OLD image-only tool_result (no sibling text) into a marker", () => {
    const hugeData = "ABCD".repeat(8000); // 32k chars
    const messages: CanonicalMessage[] = [
      {
        role: "user",
        content: [{
          type: "tool_result",
          toolCallId: "t1",
          content: [{ type: "image", source: "base64", data: hugeData, mimeType: "image/png" }],
        }],
      },
      textMessage("user", "a"),
      textMessage("assistant", "b"),
    ];
    const result = compactToolResults(messages, { ...SMALL_WINDOW, maxBinaryDataChars: 20_000 });
    expect(result.compactedBlocks).toBe(1);
    const block = result.messages[0]!.content[0];
    if (block.type === "tool_result") {
      expect(block.content.some((b) => b.type === "image")).toBe(false);
      expect(block.content[0]!.type).toBe("text");
    }
  });

  it("does NOT fold a RECENT oversized base64 image (recency window protects it)", () => {
    const hugeData = "/9j/4AAQ".repeat(5000);
    const messages: CanonicalMessage[] = [
      textMessage("user", "old"),
      {
        role: "user", // index 1 -> within last 2 (recencyWindow=2) -> untouched
        content: [{
          type: "tool_result",
          toolCallId: "t1",
          content: [{ type: "image", source: "base64", data: hugeData, mimeType: "image/png" }],
        }],
      },
      textMessage("assistant", "recent"),
    ];
    const result = compactToolResults(messages, { ...SMALL_WINDOW, maxBinaryDataChars: 20_000 });
    expect(result.compactedBlocks).toBe(0);
  });
});

describe("resolveToolResultCompactionConfig", () => {
  it("uses defaults when env is empty", () => {
    expect(resolveToolResultCompactionConfig({})).toEqual(DEFAULT_TOOL_RESULT_COMPACTION_CONFIG);
  });

  it("reads tunables from env", () => {
    const cfg = resolveToolResultCompactionConfig({
      PILOTDECK_COMPACT_RECENCY: "4",
      PILOTDECK_COMPACT_MIN_CHARS: "500",
      PILOTDECK_COMPACT_HEAD_CHARS: "100",
      PILOTDECK_COMPACT_MAX_BINARY_CHARS: "9999",
    });
    expect(cfg).toEqual({
      recencyWindow: 4,
      minBlockChars: 500,
      headChars: 100,
      maxBinaryDataChars: 9999,
    });
  });
});
