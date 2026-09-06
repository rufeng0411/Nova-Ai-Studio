import { describe, expect, it } from "vitest";
import {
  buildPptDefaultPageCountDirective,
  buildPptExportDefaultAppendPrompt,
  detectPptExportIntent,
  hubLocksPptRoute,
  PPT_DEFAULT_PAGE_MAX,
  PPT_DEFAULT_PAGE_MIN,
  resolveDefaultPptPageCount,
} from "./pptExportDefaultPolicy.js";

describe("pptExportDefaultPolicy", () => {
  it("routes business/report PPT goals to anth-pptx native editable", () => {
    const intent = detectPptExportIntent("做一份融资路演 PPT，8 页可编辑");
    expect(intent).toMatchObject({
      route: "native_editable",
      preferredSkill: "anth-pptx",
    });
  });

  it("routes Nova aesthetic signals to nova-ppt-aesthetic-slides", () => {
    const intent = detectPptExportIntent("用 Nova 美学幻灯做 6 页杂志风路演");
    expect(intent).toMatchObject({
      route: "nova_aesthetic",
      preferredSkill: "nova-ppt-aesthetic-slides",
    });
  });

  it("routes md→ppt without visual ask to doc_export", () => {
    const intent = detectPptExportIntent("把这份调研报告 md 转成 PPT");
    expect(intent).toMatchObject({
      route: "doc_export",
      preferredSkill: "export_document",
    });
  });

  it("hub nova slug locks aesthetic even if goal is generic", () => {
    expect(hubLocksPptRoute("nova-ppt-aesthetic-slides")).toBe("nova_aesthetic");
    const intent = detectPptExportIntent("做几页幻灯", "nova-ppt-aesthetic-slides");
    expect(intent?.route).toBe("nova_aesthetic");
  });

  it("hub anth-pptx locks native editable", () => {
    const intent = detectPptExportIntent("随便做", "anth-pptx");
    expect(intent).toMatchObject({
      route: "native_editable",
      preferredSkill: "anth-pptx",
    });
  });

  it("df-ppt-generation hub reroutes to native editable anth-pptx", () => {
    const intent = detectPptExportIntent("演示稿 10 页", "df-ppt-generation");
    expect(intent).toMatchObject({
      route: "native_editable",
      preferredSkill: "anth-pptx",
    });
  });

  it("build append includes quality force and preferred skill", () => {
    const append = buildPptExportDefaultAppendPrompt({
      userGoal: "导出一份客户提案 PPTX",
      language: "zh-CN",
    });
    expect(append).toContain("<ppt-export-default-policy>");
    expect(append).toContain("anth-pptx");
    expect(append).toContain("配图阶梯");
    expect(append).toContain("图表");
  });

  it("returns undefined when goal is unrelated", () => {
    expect(detectPptExportIntent("写一篇小红书文案")).toBeNull();
    expect(buildPptExportDefaultAppendPrompt({
      userGoal: "写一篇小红书文案",
    })).toBeUndefined();
  });

  it("auto page count stays within 6–12 and scales with topic richness", () => {
    const short = resolveDefaultPptPageCount("做个PPT");
    const weekly = resolveDefaultPptPageCount(
      "简约周会更新 PPT\n封面：…\n议程：…\n项目进展：…\n关键数据：…\n总结与行动项：…",
    );
    const roadshow = resolveDefaultPptPageCount("融资路演 PPT 商业计划 董事会 竞品 附录 里程碑 OKR");
    expect(short).toBeGreaterThanOrEqual(PPT_DEFAULT_PAGE_MIN);
    expect(short).toBeLessThanOrEqual(PPT_DEFAULT_PAGE_MAX);
    expect(weekly).toBeGreaterThanOrEqual(short);
    expect(roadshow).toBe(12);
    expect(buildPptDefaultPageCountDirective("做个PPT介绍公司")).toContain("禁止再向用户询问页数");
    expect(buildPptDefaultPageCountDirective("做 8 页 PPT")).toBeUndefined();
  });

  it("append includes auto page-count for weekly PPT without 页数", () => {
    const append = buildPptExportDefaultAppendPrompt({
      userGoal: "简约周会更新 PPT，封面议程进展数据总结",
      language: "zh-CN",
    });
    expect(append).toContain("<ppt-default-page-count");
    expect(append).toContain("立即开工");
  });
});
