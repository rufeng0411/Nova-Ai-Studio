import { describe, expect, it } from "vitest";
import { DEFAULT_QUALITY_CONFIG, detectQualityDefects, resolveQualityConfig } from "./qualityChecks.js";

describe("detectQualityDefects - table columns", () => {
  it("flags a markdown table whose body rows diverge from the header column count", () => {
    const md = [
      "# 报告",
      "正文内容足够长，用来避免触发结构空检查的判定逻辑。",
      "",
      "| A | B | C |",
      "| - | - | - |",
      "| 1 | 2 |", // 2 cells vs 3
      "| 4 | 5 |", // 2 cells vs 3
      "| 7 | 8 | 9 |",
    ].join("\n");
    const verdict = detectQualityDefects(md, "markdown");
    expect(verdict.defect).toBe(true);
    expect(verdict.reason).toBe("table_columns");
  });

  it("does NOT flag a single stray row (high precision)", () => {
    const md = [
      "# 报告",
      "正文内容足够长，用来避免触发结构空检查的判定逻辑。",
      "",
      "| A | B | C |",
      "| - | - | - |",
      "| 1 | 2 |", // only ONE diverging row
      "| 7 | 8 | 9 |",
      "| a | b | c |",
    ].join("\n");
    expect(detectQualityDefects(md, "markdown").defect).toBe(false);
  });

  it("does NOT flag a well-formed table", () => {
    const md = [
      "# 报告",
      "正文内容足够长，用来避免触发结构空检查的判定逻辑。",
      "",
      "| 名称 | 地址 | 简介 |",
      "| - | - | - |",
      "| 甲 | 北京 | 介绍甲 |",
      "| 乙 | 上海 | 介绍乙 |",
    ].join("\n");
    expect(detectQualityDefects(md, "markdown").defect).toBe(false);
  });

  it("respects escaped pipes inside cells", () => {
    const md = [
      "# 报告",
      "正文内容足够长，用来避免触发结构空检查的判定逻辑。",
      "",
      "| A | B |",
      "| - | - |",
      "| x \\| y | z |", // escaped pipe -> still 2 cells
      "| p | q |",
    ].join("\n");
    expect(detectQualityDefects(md, "markdown").defect).toBe(false);
  });
});

describe("detectQualityDefects - structured but empty", () => {
  it("flags a doc with headings/tables but almost no prose", () => {
    const md = ["# 标题", "## 小节", "### 更小节"].join("\n");
    const verdict = detectQualityDefects(md, "markdown");
    expect(verdict.defect).toBe(true);
    expect(verdict.reason).toBe("too_short");
  });

  it("does NOT flag a doc with real prose", () => {
    const md = ["# 标题", "这是一段足够长的正文，描述了交付物的实际内容与结论，不应被判定为空壳文档。"].join("\n");
    expect(detectQualityDefects(md, "markdown").defect).toBe(false);
  });

  it("does NOT flag unstructured short text (handled by placeholder check elsewhere)", () => {
    expect(detectQualityDefects("ok", "markdown").defect).toBe(false);
  });
});

describe("detectQualityDefects - guards", () => {
  it("returns no defect for non-text kinds", () => {
    expect(detectQualityDefects("anything", "pptx").defect).toBe(false);
  });

  it("returns no defect for empty input", () => {
    expect(detectQualityDefects("", "markdown").defect).toBe(false);
    expect(detectQualityDefects("   \n  ", "markdown").defect).toBe(false);
  });

  it("applies html too-short check", () => {
    const html = "<html><body><h1>标题</h1><section></section></body></html>";
    expect(detectQualityDefects(html, "html").reason).toBe("too_short");
  });
});

describe("resolveQualityConfig", () => {
  it("uses defaults when env is empty", () => {
    expect(resolveQualityConfig({})).toEqual(DEFAULT_QUALITY_CONFIG);
  });

  it("reads tunable thresholds from env", () => {
    const cfg = resolveQualityConfig({
      PILOTDECK_QUALITY_MIN_DIVERGING_ROWS: "3",
      PILOTDECK_QUALITY_MIN_PROSE_CHARS: "100",
    });
    expect(cfg).toEqual({ minDivergingRows: 3, minProseChars: 100 });
  });
});
