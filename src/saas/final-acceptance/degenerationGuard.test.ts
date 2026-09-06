import { describe, expect, it } from "vitest";
import {
  DEFAULT_DEGENERATION_CONFIG,
  detectContentDegeneration,
  resolveDegenerationConfig,
} from "./degenerationGuard.js";

describe("detectContentDegeneration — true positives", () => {
  it("flags a table row repeated past the consecutive threshold", () => {
    const row = "| 北京市朝阳区某某科技有限公司 | 人工智能 | 2021 | 已认证 |";
    const text = [
      "| 公司名称 | 行业 | 成立年份 | 状态 |",
      "| --- | --- | --- | --- |",
      ...Array.from({ length: 8 }, () => row),
    ].join("\n");
    const verdict = detectContentDegeneration(text);
    expect(verdict.degenerate).toBe(true);
    expect(verdict.reason).toBe("table_row_repeat");
    expect(verdict.runLength).toBeGreaterThanOrEqual(DEFAULT_DEGENERATION_CONFIG.minConsecutiveTableRows);
  });

  it("flags a substantial paragraph repeated consecutively", () => {
    const para = "本季度公司在人工智能领域取得了显著突破并完成了多项关键技术指标的验证工作。";
    const verdict = detectContentDegeneration(Array.from({ length: 6 }, () => para).join("\n\n"));
    expect(verdict.degenerate).toBe(true);
    expect(verdict.reason).toBe("paragraph_repeat");
  });

  it("flags a dominant unit that pervades the document non-consecutively", () => {
    const dominant = "这是一段被模型反复复读的足够长的占位说明文字用于触发主导单元判定逻辑。";
    // Interleave a UNIQUE substantial filler after each dominant so no consecutive run reaches the
    // paragraph threshold — this isolates the non-consecutive "dominant share" detector.
    const units: string[] = [];
    for (let i = 0; i < 14; i += 1) {
      units.push(dominant);
      units.push(`第${i}段为互不相同的真实正文内容用于填充统计样本并确保长度足够不被过滤编号${i}。`);
    }
    // Remove a few fillers so the dominant share clears 50% (14 dominant / 24 total).
    const trimmed = units.filter((_, idx) => !(idx % 2 === 1 && idx > 19));
    const verdict = detectContentDegeneration(trimmed.join("\n\n"));
    expect(verdict.degenerate).toBe(true);
    expect(verdict.reason).toBe("paragraph_repeat");
    expect(verdict.totalRepeats).toBeGreaterThanOrEqual(DEFAULT_DEGENERATION_CONFIG.minTotalDominantRepeats);
  });
});

describe("detectContentDegeneration — false-positive guards", () => {
  it("does not flag a normal varied markdown table", () => {
    const text = [
      "| 公司 | 行业 | 年份 |",
      "| --- | --- | --- |",
      "| 智谱华章科技有限公司 | 大模型 | 2019 |",
      "| 百川智能科技有限公司 | 大模型 | 2023 |",
      "| 月之暗面科技有限公司 | 大模型 | 2023 |",
      "| 深度求索人工智能公司 | 大模型 | 2023 |",
    ].join("\n");
    expect(detectContentDegeneration(text).degenerate).toBe(false);
  });

  it("does not flag normal prose with distinct paragraphs", () => {
    const text = Array.from({ length: 10 }, (_, i) =>
      `第${i + 1}节讨论了一个独立的主题，包含了与其它小节不同的足够长度的论述内容。`,
    ).join("\n\n");
    expect(detectContentDegeneration(text).degenerate).toBe(false);
  });

  it("ignores repetition inside code fences", () => {
    const line = "console.log('the same legitimate repeated line of example code');";
    const text = ["```js", ...Array.from({ length: 12 }, () => line), "```"].join("\n");
    expect(detectContentDegeneration(text).degenerate).toBe(false);
  });

  it("ignores short rows / bullets / separators below the unit length", () => {
    const text = [
      "| A | B |",
      "| - | - |",
      ...Array.from({ length: 10 }, () => "| 是 | 否 |"),
      ...Array.from({ length: 10 }, () => "- 项"),
    ].join("\n");
    expect(detectContentDegeneration(text).degenerate).toBe(false);
  });

  it("returns not-degenerate for empty input", () => {
    expect(detectContentDegeneration("").degenerate).toBe(false);
    expect(detectContentDegeneration("   ").degenerate).toBe(false);
  });

  it("a handful of repeats (below threshold) is allowed", () => {
    const row = "| 这是一行足够长的表格内容用于参与统计判断与计数处理逻辑 | 值 |";
    const text = ["| 列 | 值 |", "| - | - |", row, row, row].join("\n");
    expect(detectContentDegeneration(text).degenerate).toBe(false);
  });
});

describe("resolveDegenerationConfig", () => {
  it("defaults when env unset", () => {
    expect(resolveDegenerationConfig({})).toEqual(DEFAULT_DEGENERATION_CONFIG);
  });

  it("reads positive overrides and ignores invalid", () => {
    const cfg = resolveDegenerationConfig({
      PILOTDECK_DEGEN_MIN_TABLE_ROWS: "3",
      PILOTDECK_DEGEN_MIN_PARAGRAPHS: "-2",
    });
    expect(cfg.minConsecutiveTableRows).toBe(3);
    expect(cfg.minConsecutiveParagraphs).toBe(DEFAULT_DEGENERATION_CONFIG.minConsecutiveParagraphs);
  });
});
