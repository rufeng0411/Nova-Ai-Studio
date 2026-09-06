import { describe, expect, it } from "vitest";
import {
  detectResearchReportTurn,
  detectContentFlywheelTurn,
  detectContentMatrixTurn,
  detectBattlecardFullTurn,
  detectGeoBrandFullTurn,
  detectProductLaunchFullTurn,
  buildResearchReportExecutionPrompt,
  buildContentFlywheelExecutionPrompt,
  buildContentMatrixExecutionPrompt,
  resolveProcessTemplateAppendFromMessages,
  isLiteMustDeliverMdOnlyGoal,
} from "./processTemplateExecutionPrompt.js";
import { hasExplicitLiteMustDeliverOverride } from "./deliverables/deliverableChecklistAuthority.js";

describe("processTemplateExecutionPrompt", () => {
  it("detects research-report template phrasing", () => {
    const prompt =
      "帮我就【北京地区企业人工智能业务转型研究】做一份正式调研报告，3 步一次做完：深度调研、图表、Word 报告";
    expect(detectResearchReportTurn(prompt)).toBe(true);
  });

  it("detects beijing AI transformation topic", () => {
    expect(
      detectResearchReportTurn("北京地区企业人工智能业务转型研究，要调研报告和 docx"),
    ).toBe(true);
  });

  it("detects competitor-benchmark and lead-gen research tasks (worldcup regression)", () => {
    // Regression: these two real tasks got the generic mobile-mockup recovery copy and
    // looped on read_file because the detector did not recognize them as research.
    expect(
      detectResearchReportTurn(
        "用「Nova-竞品对标」对【世界杯】做竞品全量对标：竞品清单、维度对比与突围策略。",
      ),
    ).toBe(true);
    expect(
      detectResearchReportTurn(
        "用「Nova-智能获客」帮我找潜在客户：【大陆地区世界杯周边产品】，输出整理好的线索表格报告。",
      ),
    ).toBe(true);
    expect(detectResearchReportTurn("competitor benchmark for the world cup")).toBe(true);
    expect(detectResearchReportTurn("lead generation list for merchandise vendors")).toBe(true);
    // These research tasks must NOT be misrouted to the content-flywheel path.
    expect(detectContentFlywheelTurn("用「Nova-竞品对标」对【世界杯】做竞品全量对标")).toBe(false);
  });

  it("detects nova industry market hub try prompt", () => {
    const prompt =
      "用「Nova-行业市场」写【冷泡茶】市场研究报告：规模、产业链、PEST/SWOT 与进入建议。";
    expect(detectResearchReportTurn(prompt)).toBe(true);
    const append = resolveProcessTemplateAppendFromMessages(
      [{ role: "user", content: prompt }],
      "zh-CN",
    );
    expect(append).toContain("research-report-execution");
  });

  it("b665c75c: 须交付 md-only skips research-report 01/03/docx execution pack", () => {
    const prompt =
      "用「Nova-行业市场」写【冷泡茶】市场研究报告：规模、产业链、PEST/SWOT 与进入建议。须交付：industry-market-report.md。\n写入系统分配任务目录。";
    expect(detectResearchReportTurn(prompt)).toBe(true);
    const append = resolveProcessTemplateAppendFromMessages(
      [{ role: "user", content: prompt }],
      "zh-CN",
    );
    expect(append).toBeUndefined();
  });

  it("detects content marketing flywheel", () => {
    expect(
      detectContentFlywheelTurn("帮我围绕纵横 G700 做一轮内容营销，3 步一次做完"),
    ).toBe(true);
  });

  it("prefers research over content when both keywords appear", () => {
    expect(
      detectContentFlywheelTurn("内容营销调研报告 docx"),
    ).toBe(false);
    expect(detectResearchReportTurn("内容营销调研报告 docx")).toBe(true);
  });

  it("does not treat Nova product user research as generic research-report", () => {
    const goal = "用「Nova-产品用研」为【世界杯周边】写产品用户研究报告，须交付：product-user-research.md，以及 带图HTML版本。";
    expect(detectResearchReportTurn(goal)).toBe(false);
  });

  it("detects content matrix / one-article multi-platform", () => {
    expect(
      detectContentMatrixTurn("帮我写一篇关于 ROG 油条的多平台内容矩阵，一文多发五平台"),
    ).toBe(true);
    expect(detectContentMatrixTurn("research report docx")).toBe(false);
  });

  it("builds content matrix execution block", () => {
    expect(buildContentMatrixExecutionPrompt("zh-CN")).toContain("content-matrix-execution");
    expect(buildContentMatrixExecutionPrompt("zh-CN")).toContain("02-platforms");
    expect(buildContentMatrixExecutionPrompt("zh-CN")).toContain("并行 write_file");
  });

  it("builds geo brand full execution block with browser ban and first-write pathHint", () => {
    const append = resolveProcessTemplateAppendFromMessages(
      [{ role: "user", content: "帮【www.novapage.online】做品牌 GEO 全案，按阶段一次执行" }],
      "zh-CN",
    );
    expect(append).toContain("geo-brand-full-execution");
    expect(append).toContain("geo-aeo-audit-checklist.md");
    expect(append).toContain("禁止");
    expect(append).toMatch(/browser_navigate|Playwright/);
  });

  it("resolves matrix append from user message", () => {
    const append = resolveProcessTemplateAppendFromMessages(
      [{ role: "user", content: "一文多发 五平台 内容矩阵 ROG" }],
      "zh-CN",
    );
    expect(append).toContain("content-matrix-execution");
  });

  it("builds zh execution blocks", () => {
    expect(buildResearchReportExecutionPrompt("zh-CN")).toContain("export_document");
    expect(buildContentFlywheelExecutionPrompt("zh-CN")).toContain("03-social-slices.md");
  });

  it("resolves append from latest user message", () => {
    const append = resolveProcessTemplateAppendFromMessages(
      [{ role: "user", content: "内容营销 3 步 选题 长文 社媒" }],
      "zh-CN",
    );
    expect(append).toContain("content-flywheel-execution");
  });

  it("detects battlecard full pack", () => {
    expect(
      detectBattlecardFullTurn("为【我方产品 vs 竞品】做销售 Battlecard 全链路，三步一次做完"),
    ).toBe(true);
  });

  it("detects geo brand full case", () => {
    expect(
      detectGeoBrandFullTurn("帮【品牌名】做品牌 GEO 全案，按阶段一次执行，存 artifacts/geo/"),
    ).toBe(true);
  });

  it("detects product launch full case", () => {
    expect(
      detectProductLaunchFullTurn("帮我为【雷蛇 Pro click V2】做一套上市全案，按阶段一次性规划并执行"),
    ).toBe(true);
    const append = resolveProcessTemplateAppendFromMessages(
      [{ role: "user", content: "帮我为【雷蛇 Pro click V2】做一套上市全案，按阶段一次性规划并执行" }],
      "zh-CN",
    );
    expect(append).toContain("product-launch-execution");
    expect(append).toMatch(/resolve_session_visual_assets|配图流水线/);
  });

  it("resolves battlecard append from user message", () => {
    const append = resolveProcessTemplateAppendFromMessages(
      [{ role: "user", content: "销售 Battlecard 全链路 intel.md battlecard talk-track" }],
      "zh-CN",
    );
    expect(append).toContain("battlecard-full-execution");
  });

  it("0731: isLiteMustDeliverMdOnlyGoal ≡ hasExplicitLiteMustDeliverOverride", () => {
    const samples = [
      "用「Nova-行业市场」写报告。须交付：industry-market-report.md。\n写入系统分配任务目录。",
      "须交付：user-research-report.md。写入系统分配任务目录。",
      "正式调研：检索→综述→Word。须交付：01-sources-and-synthesis.md、03-report-body.md、report.docx。",
      "随便聊聊风格，不要文件。",
    ];
    for (const goal of samples) {
      expect(isLiteMustDeliverMdOnlyGoal(goal)).toBe(hasExplicitLiteMustDeliverOverride(goal));
    }
  });
});
