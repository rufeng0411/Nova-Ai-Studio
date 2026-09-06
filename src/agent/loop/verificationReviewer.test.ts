import { describe, expect, it, vi } from "vitest";
import {
  parseVerificationReply,
  runVerificationReview,
  type VerificationReviewerCallModel,
} from "./verificationReviewer.js";

describe("parseVerificationReply", () => {
  it("treats the agreed pass marker as a pass", () => {
    const result = parseVerificationReply("校验通过");
    expect(result.verdict).toBe("pass");
    expect(result.outcome).toBe("model_pass");
    expect(result.reasons).toEqual([]);
  });

  it("treats an English pass phrase as a pass", () => {
    expect(parseVerificationReply("All checks passed.").verdict).toBe("pass");
  });

  it("flags needs_repair and extracts problem lines", () => {
    const result = parseVerificationReply([
      "发现以下问题：",
      "1. 缺失 report.docx",
      "2. 结论部分为占位文本",
    ].join("\n"));
    expect(result.verdict).toBe("needs_repair");
    expect(result.outcome).toBe("model_needs_repair");
    expect(result.reasons).toContain("缺失 report.docx");
    expect(result.reasons).toContain("结论部分为占位文本");
  });

  it("honors a strict JSON verdict when present", () => {
    const pass = parseVerificationReply('{"verdict":"pass","reasons":[]}');
    expect(pass.verdict).toBe("pass");
    const repair = parseVerificationReply('前缀文本 {"verdict":"needs_repair","reasons":["少了一页"]} 后缀');
    expect(repair.verdict).toBe("needs_repair");
    expect(repair.reasons).toEqual(["少了一页"]);
  });

  it("fails open to pass on an empty reply", () => {
    const result = parseVerificationReply("   ");
    expect(result.verdict).toBe("pass");
    expect(result.outcome).toBe("fail_open_empty");
  });

  it("biases ambiguous replies to pass (observe-only)", () => {
    const result = parseVerificationReply("我看了一下，整体还行，没什么特别要说的。");
    expect(result.verdict).toBe("pass");
    expect(result.outcome).toBe("fail_open_parse");
  });
});

describe("runVerificationReview", () => {
  const directive = "请校验成果";

  it("returns the parsed model verdict on success", async () => {
    const callModel: VerificationReviewerCallModel = vi.fn(async () => "校验通过");
    const result = await runVerificationReview({ directive, callModel });
    expect(result.verdict).toBe("pass");
    expect(callModel).toHaveBeenCalledOnce();
  });

  it("returns needs_repair when the model lists problems", async () => {
    const callModel: VerificationReviewerCallModel = async () => "1. 缺失 deck.pptx";
    const result = await runVerificationReview({ directive, callModel });
    expect(result.verdict).toBe("needs_repair");
    expect(result.reasons).toContain("缺失 deck.pptx");
  });

  it("fails open to pass when the model call throws", async () => {
    const callModel: VerificationReviewerCallModel = async () => {
      throw new Error("model exploded");
    };
    const result = await runVerificationReview({ directive, callModel });
    expect(result.verdict).toBe("pass");
    expect(result.outcome).toBe("fail_open_error");
  });

  it("fails open to pass when the model call exceeds the timeout", async () => {
    const callModel: VerificationReviewerCallModel = () =>
      new Promise((resolve) => setTimeout(() => resolve("校验通过"), 50));
    const result = await runVerificationReview({ directive, callModel, timeoutMs: 1000 });
    // timeoutMs is clamped to a 1s floor; the 50ms model resolves first -> pass via model.
    expect(result.verdict).toBe("pass");
  });

  it("fails open to pass on a true timeout overrun", async () => {
    vi.useFakeTimers();
    try {
      const callModel: VerificationReviewerCallModel = () =>
        new Promise((resolve) => setTimeout(() => resolve("1. 缺失文件"), 60_000));
      const promise = runVerificationReview({ directive, callModel, timeoutMs: 1000 });
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;
      expect(result.verdict).toBe("pass");
      expect(result.outcome).toBe("fail_open_timeout");
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails open to pass on an empty directive without calling the model", async () => {
    const callModel = vi.fn(async () => "校验通过");
    const result = await runVerificationReview({ directive: "   ", callModel });
    expect(result.outcome).toBe("fail_open_empty");
    expect(callModel).not.toHaveBeenCalled();
  });
});
