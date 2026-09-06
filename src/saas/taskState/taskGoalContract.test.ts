import { afterEach, describe, expect, it } from "vitest";

import { buildTaskGoalContract } from "./taskGoalContract.js";
import {
  CASE_12FC6055,
  CASE_HTML_DOCX_PDF,
  CASE_PDF_SOURCE_NOTES,
  CASE_TRUE_PPT,
  CASE_WEEKLY_PPT,
} from "../deliverables/goalKindSanitize.js";

describe("taskGoalContract", () => {
  it("requires real pptx when the latest user goal asks for editable PPT", () => {
    const contract = buildTaskGoalContract({
      userGoal: "请根据资料生成一份 12 页可编辑 PPT，做完告诉我文件在哪",
      capabilitySlug: "anth-pptx",
      majorCategory: "office",
    });

    expect(contract.goalVersion).toBe(1);
    expect(contract.expectedKinds).toContain("pptx");
    expect(contract.minCount).toBe(12);
    expect(contract.qualityChecks).toContain("valid_binary");
  });

  it("uses the latest changed goal as primary while keeping prior goal as superseded context", () => {
    const contract = buildTaskGoalContract({
      userGoal: "不要 PPT 了，改成一份 Word 报告",
      previousContract: buildTaskGoalContract({
        userGoal: "做一份 PPT",
      }),
    });

    expect(contract.goalVersion).toBe(2);
    expect(contract.expectedKinds).toEqual(["docx"]);
    expect(contract.supersedes?.expectedKinds).toEqual(["pptx"]);
  });

  it("adds required multi-file artifacts only when profile and goal both match", () => {
    const storyboard = buildTaskGoalContract({
      userGoal: "生成连续性分镜包，包含 bible、镜头卡和交接矩阵",
      capabilitySlug: "ad-storyboard-seedance",
      profileId: "storyboard",
    });
    const plainMarkdown = buildTaskGoalContract({
      userGoal: "写一份普通分镜思路 markdown",
      profileId: "storyboard",
    });

    expect(storyboard.requiredFiles).toEqual([
      "continuity_bible.md",
      "shot_cards.md",
      "handoff_design_matrix.md",
    ]);
    expect(plainMarkdown.requiredFiles).toEqual([]);
  });

  it("treats brand GEO full-case platform count as required files, not HTML page count", () => {
    const contract = buildTaskGoalContract({
      userGoal: [
        "帮【雷蛇灵刃笔记本】做品牌 GEO 全案，按阶段一次执行。",
        "pd-geo：关键词 + 至少 3 个平台成稿 + optimized.md。",
        "mkt-schema：schema.jsonld。",
        "od-data-report：visibility-report.html。",
      ].join("\n"),
      capabilitySlug: "pd-geo",
      profileId: "geo",
    });

    expect(contract.expectedKinds).toEqual([]);
    expect(contract.minCount).toBeUndefined();
    expect(contract.requiredFiles).toEqual(expect.arrayContaining([
      "keywords-research.md",
      "platform-drafts>=3",
      "optimized.md",
      "schema.jsonld",
      "citability-report.md",
      "visibility-report.html",
    ]));
  });

  it("binds Nova PNG slide decks to minCount and slide-manifest profile", () => {
    const contract = buildTaskGoalContract({
      userGoal: "用「Nova-美学幻灯」把参考附件做成 8 页 16:9 雷蛇风格配图 PNG 幻灯",
      capabilitySlug: "nova-ppt-aesthetic-slides",
    });

    expect(contract.expectedKinds).toEqual([]);
    expect(contract.minCount).toBe(8);
    expect(contract.profileId).toBe("nova-slide-deck");
    expect(contract.requiredFiles).toContain("slide-manifest.json");
  });

  it("keeps explicit html docx pdf report outputs as parallel required kinds", () => {
    const contract = buildTaskGoalContract({
      userGoal: "我需要一个带有雷蛇风格和好看先进图表的html版本报告，并同时输出docx和pdf版本",
      capabilitySlug: "od-user-research",
      majorCategory: "office",
    });

    expect(contract.expectedKinds).toEqual(["html", "docx", "pdf"]);
  });

  it("does not infer docx just because an explicit html request mentions report content", () => {
    const contract = buildTaskGoalContract({
      userGoal: "帮我把上述报告做成动态可视化HTML",
      capabilitySlug: "competitive-intelligence-summary",
      majorCategory: "marketing",
    });

    expect(contract.expectedKinds).toEqual(["html"]);
  });

  it("nova research hub try prompts expect markdown deliverable", () => {
    const industry = buildTaskGoalContract({
      userGoal: "用「Nova-行业市场」写【冷泡茶】市场研究报告：规模、产业链、PEST/SWOT 与进入建议。",
      capabilitySlug: "nova-research-industry-market",
    });
    expect(industry.expectedKinds).toEqual(["markdown"]);

    const competitor = buildTaskGoalContract({
      userGoal: "用「Nova-竞品对标」对【冷泡茶品类】做竞品全量对标：竞品清单、维度对比与突围策略。",
      capabilitySlug: "nova-research-competitor",
    });
    expect(competitor.expectedKinds).toEqual(["markdown"]);
  });

  it("does not force docx from a generic 报告 goal (lead/research markdown reports stay format-flexible)", () => {
    // Regression: a real acquisition-leads run stalled because the word 「报告」
    // forced expectedKinds=["docx"], so acceptance kept reporting a missing *.docx
    // and the engine looped forever trying to fabricate a Word file the user never asked for.
    const leads = buildTaskGoalContract({
      userGoal: "用「Nova-智能获客」帮我找潜在客户：【大陆地区世界杯周边产品】，输出整理好的线索表格报告。",
      capabilitySlug: "nova-customer-acquisition-leads",
      majorCategory: "marketing",
    });
    expect(leads.expectedKinds).not.toContain("docx");
    expect(leads.expectedKinds).toEqual(["markdown"]);

    const competitor = buildTaskGoalContract({
      userGoal: "用「Nova-竞品对标」对【世界杯】做竞品全量对标：竞品清单、维度对比与突围策略。",
      capabilitySlug: "nova-research-competitor",
      majorCategory: "marketing",
    });
    expect(competitor.expectedKinds).not.toContain("docx");
    expect(competitor.expectedKinds).toEqual(["markdown"]);
  });

  it("still honors an explicit Word/docx report request", () => {
    const contract = buildTaskGoalContract({
      userGoal: "把这份资料整理成一份 Word 报告交给我",
      majorCategory: "office",
    });
    expect(contract.expectedKinds).toEqual(["docx"]);
  });

  it("requires outline markdown, html screens, and video for a three-step demo video task", () => {
    const contract = buildTaskGoalContract({
      userGoal: [
        "帮我把【世界杯2026挪威主题】做成一支能直接发的演示视频，三步连着做，每步把文件存到 artifacts/ 并告诉我路径：",
        "先查清楚这个主题的要点，写一份 8-12 节的结构化大纲。",
        "按大纲做一套深色现代风的动效网页演示，每节一屏。",
        "把演示页按每屏 4-6 秒渲染成横版 1080p 视频。",
      ].join("\n"),
      capabilitySlug: "html-video",
      majorCategory: "creative",
    });

    expect(contract.expectedKinds).toEqual(["markdown", "video", "html"]);
    expect(contract.minCount).toBe(8);
    expect(contract.kindCounts).toEqual([{ kind: "html", min: 8 }]);
  });

  it("does not emit kind-scoped counts for single-kind tasks", () => {
    const contract = buildTaskGoalContract({
      userGoal: "请根据资料生成一份 12 页可编辑 PPT",
      capabilitySlug: "anth-pptx",
    });
    expect(contract.expectedKinds).toEqual(["pptx"]);
    expect(contract.minCount).toBe(12);
    expect(contract.kindCounts ?? []).toEqual([]);
  });

  it("requires mp4 extension when the user explicitly asks for MP4 video", () => {
    const contract = buildTaskGoalContract({
      userGoal: "用 HTML 代码做视频，导出一支 18 秒 MP4 视频",
      capabilitySlug: "html-video",
    });

    expect(contract.expectedKinds).toEqual(["video"]);
    expect(contract.requiredFiles).toContain("*.mp4");
  });

  it("parses maxTurnsHint from Chinese turn-budget phrases", () => {
    expect(buildTaskGoalContract({ userGoal: "3 轮内完成这份报告" }).maxTurnsHint).toBe(3);
    expect(buildTaskGoalContract({ userGoal: "within 5 turns finish the deck" }).maxTurnsHint).toBe(5);
    expect(buildTaskGoalContract({ userGoal: "最多 12 步搞定" }).maxTurnsHint).toBe(12);
    expect(buildTaskGoalContract({ userGoal: "做一份普通报告" }).maxTurnsHint).toBeUndefined();
  });

  it("clamps maxTurnsHint to a reasonable ceiling", () => {
    expect(buildTaskGoalContract({ userGoal: "999 轮内完成" }).maxTurnsHint).toBe(50);
  });

  it("extracts completionAssertions from labeled lines only", () => {
    const contract = buildTaskGoalContract({
      userGoal: [
        "帮我做一份竞品报告",
        "完成条件：必须包含三家竞品对比",
        "要求：给出可执行的突围策略",
        "确保：结论部分不超过 500 字",
      ].join("\n"),
    });
    expect(contract.completionAssertions).toEqual([
      "必须包含三家竞品对比",
      "给出可执行的突围策略",
      "结论部分不超过 500 字",
    ]);
  });

  it("ignores completionAssertions when no labeled lines are present", () => {
    expect(buildTaskGoalContract({ userGoal: "随便聊聊" }).completionAssertions).toBeUndefined();
  });
});

describe("taskGoalContract kind-mention sanitize", () => {
  const previous = process.env.PILOTDECK_KIND_MENTION_SANITIZE;

  afterEach(() => {
    if (previous === undefined) delete process.env.PILOTDECK_KIND_MENTION_SANITIZE;
    else process.env.PILOTDECK_KIND_MENTION_SANITIZE = previous;
  });

  it("CASE_12FC6055 enforce drops phantom pdf/pptx kinds", () => {
    process.env.PILOTDECK_KIND_MENTION_SANITIZE = "enforce";
    const contract = buildTaskGoalContract({ userGoal: CASE_12FC6055 });
    expect(contract.expectedKinds).not.toContain("pdf");
    expect(contract.expectedKinds).not.toContain("pptx");
  });

  it("CASE_12FC6055 off keeps legacy office kinds (rollback baseline)", () => {
    delete process.env.PILOTDECK_KIND_MENTION_SANITIZE;
    const contract = buildTaskGoalContract({ userGoal: CASE_12FC6055 });
    expect(contract.expectedKinds).toEqual(expect.arrayContaining(["pdf", "pptx"]));
  });

  it("CASE_12FC6055 shadow keeps legacy office kinds", () => {
    process.env.PILOTDECK_KIND_MENTION_SANITIZE = "shadow";
    const contract = buildTaskGoalContract({ userGoal: CASE_12FC6055 });
    expect(contract.expectedKinds).toEqual(expect.arrayContaining(["pdf", "pptx"]));
  });

  it("does not compile pdf from a source-PDF note under enforce", () => {
    process.env.PILOTDECK_KIND_MENTION_SANITIZE = "enforce";
    const contract = buildTaskGoalContract({ userGoal: CASE_PDF_SOURCE_NOTES });
    expect(contract.expectedKinds).not.toContain("pdf");
  });

  it("keeps true PPT, weekly pptx, and html+docx+pdf under enforce", () => {
    process.env.PILOTDECK_KIND_MENTION_SANITIZE = "enforce";
    expect(buildTaskGoalContract({
      userGoal: CASE_TRUE_PPT,
      capabilitySlug: "anth-pptx",
    }).expectedKinds).toContain("pptx");
    expect(buildTaskGoalContract({ userGoal: CASE_WEEKLY_PPT }).expectedKinds).toContain("pptx");
    expect(buildTaskGoalContract({
      userGoal: CASE_HTML_DOCX_PDF,
      capabilitySlug: "od-user-research",
    }).expectedKinds).toEqual(["html", "docx", "pdf"]);
  });
});
