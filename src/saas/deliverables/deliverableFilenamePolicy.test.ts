import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  applyDeliverableChineseFilenamePolicy,
  buildDeliverableNamingPromptLinesZh,
  isEnglishBasenameRequired,
  resolveSuggestedBasename,
  titleToChineseBasename,
} from "./deliverableFilenamePolicy.js";

describe("deliverableFilenamePolicy", () => {
  const prev = process.env.PILOTDECK_DELIVERABLE_CN_FILENAME_DEFAULT;

  beforeEach(() => {
    process.env.PILOTDECK_DELIVERABLE_CN_FILENAME_DEFAULT = "1";
  });

  afterEach(() => {
    if (prev == null) delete process.env.PILOTDECK_DELIVERABLE_CN_FILENAME_DEFAULT;
    else process.env.PILOTDECK_DELIVERABLE_CN_FILENAME_DEFAULT = prev;
  });

  it("keeps toolchain-required English basenames", () => {
    expect(isEnglishBasenameRequired({ basename: "slide-01.png", profileId: "nova-slide-deck" })).toBe(true);
    expect(isEnglishBasenameRequired({ basename: "index.html" })).toBe(true);
    expect(isEnglishBasenameRequired({ basename: "schema.jsonld", profileId: "geo" })).toBe(true);
  });

  it("derives Chinese basename from display label for generic markdown fallback", () => {
    const suggested = resolveSuggestedBasename(
      { id: "slot_1", label: "markdown", kind: "markdown", pathHint: "brief.md" },
      { displayLabel: "吴裕泰 GEO 快检报告" },
    );
    expect(suggested).toBe("吴裕泰 GEO 快检报告.md");
  });

  it("rewrites generic English fallback slots to Chinese while preserving alias", () => {
    const next = applyDeliverableChineseFilenamePolicy(
      [{ id: "slot_1", label: "markdown", kind: "markdown", pathHint: "brief.md" }],
      { displayLabel: "小罐茶上市全案策略" },
    );
    expect(next[0]?.pathHint).toBe("小罐茶上市全案策略.md");
    expect(next[0]?.pathHints).toEqual(["小罐茶上市全案策略.md", "brief.md"]);
  });

  it("does not rewrite nova slide png basename", () => {
    const next = applyDeliverableChineseFilenamePolicy(
      [{ id: "slide_1", label: "封面", kind: "png", pathHint: "slide-01.png" }],
      { displayLabel: "ROG 竞品调研幻灯", profileId: "nova-slide-deck" },
    );
    expect(next[0]?.pathHint).toBe("slide-01.png");
  });

  it("builds Chinese naming prompt lines for task-artifact-dir", () => {
    const lines = buildDeliverableNamingPromptLinesZh({
      displayLabel: "鸣镝 G700 品牌传播方案",
    });
    expect(lines.join("\n")).toContain("中文文件名");
    expect(lines.join("\n")).toContain("鸣镝 G700 品牌传播方案.md");
  });

  it("titleToChineseBasename strips illegal characters", () => {
    expect(titleToChineseBasename('方案: 「测试」/报告', ".md")).toBe("方案 「测试」报告.md");
  });

  it("titleToChineseBasename does not double-append extension", () => {
    expect(titleToChineseBasename("marketing-deliverable.md", ".md")).toBe("marketing-deliverable.md");
  });

  it("does not rewrite must-deliver report.html using the whole goal as title", () => {
    const next = applyDeliverableChineseFilenamePolicy(
      [{
        id: "must_deliver_1_report_html",
        label: "report.html",
        kind: "html",
        pathHint: "report.html",
        pathHints: ["report.html"],
      }],
      {
        displayLabel: "根据附件生成一份 HTML 摘要，须交付：report.html，直接开始做。",
        userGoal: "根据附件生成一份 HTML 摘要，须交付：report.html，直接开始做。",
        profileId: "html",
      },
    );
    expect(next[0]?.pathHint).toBe("report.html");
    expect(next[0]?.pathHint).not.toMatch(/根据附件|须交付|直接开始做/);
  });

  it("naming prompt locks 须交付 脚本.md and forbids title filenames", () => {
    const lines = buildDeliverableNamingPromptLinesZh({
      displayLabel: "写一个短视频口播脚本，主题：智能手表开箱 30 秒。",
      userGoal: [
        "写一个短视频口播脚本，主题：智能手表开箱 30 秒。",
        "须交付：脚本.md",
        "不要做成视频。",
      ].join("\n"),
      lockedBasenames: ["脚本.md"],
      profileId: "script-md",
    });
    const text = lines.join("\n");
    expect(text).toContain("脚本.md");
    expect(text).toMatch(/原样|必须/);
    expect(text).not.toContain("智能手表开箱 30 秒.md");
  });
});
