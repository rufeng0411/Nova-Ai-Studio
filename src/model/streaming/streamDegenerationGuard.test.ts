import { describe, expect, it } from "vitest";
import {
  DEFAULT_STREAM_DEGENERATION_CONFIG,
  createStreamDegenerationDetector,
  resolveStreamDegenerationConfig,
} from "./streamDegenerationGuard.js";

describe("createStreamDegenerationDetector - line repeats", () => {
  it("trips when the same substantial line streams many times", () => {
    const detector = createStreamDegenerationDetector();
    const line = "这是一段被反复输出的足够长的退化文字内容。\n";
    let verdict = detector.verdict;
    for (let i = 0; i < 8; i += 1) {
      verdict = detector.push(line);
    }
    expect(verdict.degenerated).toBe(true);
    expect(verdict.reason).toBe("line_repeat");
  });

  it("does NOT trip on a few repeats (high precision)", () => {
    const detector = createStreamDegenerationDetector();
    const line = "这是一段足够长的正常内容，只重复了少数几次。\n";
    let verdict = detector.verdict;
    for (let i = 0; i < 3; i += 1) {
      verdict = detector.push(line);
    }
    expect(verdict.degenerated).toBe(false);
  });

  it("does NOT trip on varied long lines", () => {
    const detector = createStreamDegenerationDetector();
    let verdict = detector.verdict;
    for (let i = 0; i < 20; i += 1) {
      verdict = detector.push(`第 ${i} 段内容各不相同，描述了不同的要点与结论说明。\n`);
    }
    expect(verdict.degenerated).toBe(false);
  });

  it("ignores short lines (does not count toward a repeat run)", () => {
    const detector = createStreamDegenerationDetector();
    let verdict = detector.verdict;
    for (let i = 0; i < 20; i += 1) {
      verdict = detector.push("- ok\n");
    }
    expect(verdict.degenerated).toBe(false);
  });

  it("handles deltas split across chunk boundaries", () => {
    const detector = createStreamDegenerationDetector();
    const line = "跨分片传输的足够长的重复退化文字内容片段。";
    let verdict = detector.verdict;
    for (let i = 0; i < 8; i += 1) {
      detector.push(line.slice(0, 5));
      verdict = detector.push(`${line.slice(5)}\n`);
    }
    expect(verdict.degenerated).toBe(true);
  });
});

describe("createStreamDegenerationDetector - phrase loops", () => {
  it("trips on a short phrase looped without newlines", () => {
    const detector = createStreamDegenerationDetector();
    const verdict = detector.push("循环".repeat(60));
    expect(verdict.degenerated).toBe(true);
    expect(verdict.reason).toBe("phrase_repeat");
  });

  it("does NOT trip on punctuation-only floods (no letters)", () => {
    const detector = createStreamDegenerationDetector();
    const verdict = detector.push("．".repeat(200));
    expect(verdict.degenerated).toBe(false);
  });
});

describe("createStreamDegenerationDetector - block cycles", () => {
  // The markdown-table restart loop seen in the field: a multi-line block cycled verbatim where
  // neighbouring lines differ, so the per-line consecutive run (line_repeat) never builds up.
  const tableBlock =
    "🚙 核心产品信息\n车型 纵横G700顶火鸣镝版\n厂商指导价 39.99万 起\n官方指导价 42.99万\n";

  it("trips when a multi-line table block cycles >= 4 times verbatim", () => {
    const detector = createStreamDegenerationDetector();
    let verdict = detector.verdict;
    for (let i = 0; i < 5; i += 1) {
      verdict = detector.push(tableBlock);
    }
    expect(verdict.degenerated).toBe(true);
    expect(verdict.reason).toBe("block_repeat");
    expect(verdict.sample).toContain("核心产品信息");
  });

  it("does NOT trip on only 3 block cycles (high precision)", () => {
    const detector = createStreamDegenerationDetector();
    let verdict = detector.verdict;
    for (let i = 0; i < 3; i += 1) {
      verdict = detector.push(tableBlock);
    }
    expect(verdict.degenerated).toBe(false);
  });

  it("does NOT trip on varied multi-line blocks (real content differs each time)", () => {
    const detector = createStreamDegenerationDetector();
    let verdict = detector.verdict;
    for (let i = 0; i < 8; i += 1) {
      verdict = detector.push(
        `第${i}季度 核心指标说明\n营收 ${i * 100}万元\n增长率 ${i * 3}%\n毛利率 ${40 + i}%\n`,
      );
    }
    expect(verdict.degenerated).toBe(false);
  });

  it("detects a block cycle split across chunk boundaries", () => {
    const detector = createStreamDegenerationDetector();
    const stream = tableBlock.repeat(5);
    let verdict = detector.verdict;
    for (let i = 0; i < stream.length; i += 7) {
      verdict = detector.push(stream.slice(i, i + 7));
    }
    expect(verdict.degenerated).toBe(true);
    expect(verdict.reason).toBe("block_repeat");
  });

  it("resolveStreamDegenerationConfig reads the block-cycle tunable", () => {
    const cfg = resolveStreamDegenerationConfig({ PILOTDECK_STREAM_DEGEN_BLOCK_CYCLES: "6" });
    expect(cfg.blockCycleMinCycles).toBe(6);
    expect(cfg.blockCycleMaxLines).toBe(DEFAULT_STREAM_DEGENERATION_CONFIG.blockCycleMaxLines);
  });
});

describe("createStreamDegenerationDetector - stickiness & config", () => {
  it("verdict is sticky once tripped", () => {
    const detector = createStreamDegenerationDetector();
    const line = "稳定地反复输出的足够长的退化内容行文本。\n";
    for (let i = 0; i < 8; i += 1) detector.push(line);
    expect(detector.push("后续任何内容都不再改变结论").degenerated).toBe(true);
  });

  it("resolveStreamDegenerationConfig reads tunables and keeps defaults", () => {
    const cfg = resolveStreamDegenerationConfig({ PILOTDECK_STREAM_DEGEN_MIN_LINES: "10" });
    expect(cfg.minConsecutiveLines).toBe(10);
    expect(cfg.phraseRepeatCount).toBe(DEFAULT_STREAM_DEGENERATION_CONFIG.phraseRepeatCount);
  });
});
