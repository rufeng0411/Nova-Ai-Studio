import { describe, expect, it } from "vitest";
import { detectGoalMutation } from "./detectGoalMutation.js";
import { compileSessionDeliverableManifest, updateSessionManifestOnUserMessage } from "./sessionDeliverableManifest.js";

describe("detectGoalMutation", () => {
  it("detects md to pdf replace", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const manifest = compileSessionDeliverableManifest({
      userGoal: "写 markdown 报告并输出 report.md",
    });
    expect(manifest).toBeTruthy();
    const result = detectGoalMutation({
      userText: "把 Markdown 转成 PDF",
      manifest: manifest!,
    });
    expect(result.mutated).toBe(true);
    expect(result.action).toBe("replace");
    expect(result.toKind).toBe("pdf");
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("detects remove word", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const manifest = compileSessionDeliverableManifest({
      userGoal: "输出 Word 文档 docx",
    });
    const result = detectGoalMutation({
      userText: "不要 Word 了",
      manifest: manifest!,
    });
    expect(result.mutated).toBe(true);
    expect(result.action).toBe("remove");
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it('detects implicit HTML add (给我配色高级，带图表的HTML)', () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const manifest = compileSessionDeliverableManifest({
      userGoal: "写 markdown 调研报告 jl3-world-opinion-deep-dive.md",
    });
    const result = detectGoalMutation({
      userText: "给我配色高级，带图表的HTML",
      manifest: manifest!,
    });
    expect(result.mutated).toBe(true);
    expect(result.action).toBe("add");
    expect(result.addKind).toBe("html");
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it('detects 改为 HTML as add (ROG 0613)', () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const manifest = compileSessionDeliverableManifest({
      userGoal: "写 markdown 报告并输出 report.md",
    });
    const result = detectGoalMutation({
      userText: "改为 HTML",
      manifest: manifest!,
    });
    expect(result.mutated).toBe(true);
    expect(result.action).toBe("add");
    expect(result.addKind).toBe("html");
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it('detects ES9 battlecard follow-up HTML report add', () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const manifest = compileSessionDeliverableManifest({
      userGoal: "intel.md battlecard.md talk-track.md",
    });
    const result = detectGoalMutation({
      userText: "出一个综合的html版本报告",
      manifest: manifest!,
    });
    expect(result.mutated).toBe(true);
    expect(result.action).toBe("add");
    expect(result.addKind).toBe("html");
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it('detects 改成 PDF 就好 as replace', () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const manifest = compileSessionDeliverableManifest({
      userGoal: "写 markdown 报告并输出 report.md",
    });
    const result = detectGoalMutation({
      userText: "改成 PDF 就好",
      manifest: manifest!,
    });
    expect(result.mutated).toBe(true);
    expect(result.action).toBe("replace");
    expect(result.toKind).toBe("pdf");
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it('detects 只要 HTML as replace markdown to html', () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const manifest = compileSessionDeliverableManifest({
      userGoal: "写 markdown 报告并输出 report.md",
    });
    const result = detectGoalMutation({
      userText: "只要 HTML",
      manifest: manifest!,
    });
    expect(result.mutated).toBe(true);
    expect(result.action).toBe("replace");
    expect(result.fromKind).toBe("markdown");
    expect(result.toKind).toBe("html");
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("detects GEO platform cancel (不用做了)", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const manifest = compileSessionDeliverableManifest({
      userGoal: "GEO 行业调查，含小红书知乎公众号成稿",
      capabilitySlug: "pd-geo",
      majorCategory: "marketing",
    });
    const result = detectGoalMutation({
      userText: "小红书、知乎、公众号不用做了，增加行业操作手册白皮书",
      manifest: manifest!,
    });
    expect(result.mutated).toBe(true);
    expect(result.action).toBe("remove");
    expect(result.targetSlotId).toBe("profile_geo_platform");
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("detects multi HTML report add (three reports)", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const manifest = compileSessionDeliverableManifest({
      userGoal: "GEO 深度调查报告",
    });
    const result = detectGoalMutation({
      userText: "把三个报告都做成专业图表 HTML：深度洞察、行业全景、操作手册",
      manifest: manifest!,
    });
    expect(result.mutated).toBe(true);
    expect(result.action).toBe("add");
    expect(result.addSlots?.length).toBe(3);
    expect(result.addSlots?.[0]?.addPathHint).toMatch(/^report-1-.+\.html$/);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("detects operation manual markdown add", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const manifest = compileSessionDeliverableManifest({
      userGoal: "GEO 行业调查",
    });
    const result = detectGoalMutation({
      userText: "增加 GEO 操作手册白皮书",
      manifest: manifest!,
    });
    expect(result.mutated).toBe(true);
    expect(result.action).toBe("add");
    expect(result.addKind).toBe("markdown");
    expect(result.addPathHints).toContain("geo-operation-manual.md");
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });
});

describe("updateSessionManifestOnUserMessage — 改为 HTML add", () => {
  it("accumulates html slot after markdown report (ROG 0613)", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const base = compileSessionDeliverableManifest({
      userGoal: "写 markdown 报告并输出 report.md",
    });
    expect(base).toBeTruthy();
    const next = updateSessionManifestOnUserMessage({
      userText: "改为 HTML",
      previousManifest: base!,
      turnId: "t2",
    });
    expect(next?.manifestVersion).toBe(2);
    const active = next!.slots.filter((s) => s.status !== "removed");
    expect(active.length).toBeGreaterThanOrEqual(2);
    expect(active.some((s) => s.kind === "markdown")).toBe(true);
    expect(active.some((s) => s.kind === "html")).toBe(true);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });
});

describe("detectGoalMutation — quality-only bounded extension", () => {
  it("bumps goalVersion for a quality-only additive requirement", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const base = compileSessionDeliverableManifest({
      userGoal: "制作鸣镝 G700 报告并输出 report.md",
      turnId: "turn-1",
    });
    expect(base).toBeTruthy();

    const mutation = detectGoalMutation({
      userText: "另外增加要求：禁止 AI 生图，其他成果不变",
      manifest: base!,
    });
    const next = updateSessionManifestOnUserMessage({
      userText: "另外增加要求：禁止 AI 生图，其他成果不变",
      previousManifest: base!,
      turnId: "turn-2",
    });

    expect(mutation).toMatchObject({
      mutated: true,
      action: "add",
      qualityOnly: true,
    });
    expect(next?.goalVersion).toBe(base!.goalVersion + 1);
    expect(next?.slots).toEqual(base!.slots);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("bumps goalVersion for official-media replacement without changing frozen slots", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const base = compileSessionDeliverableManifest({
      userGoal: "制作鸣镝 G700 报告并输出 report.md",
      turnId: "turn-1",
    });
    expect(base).toBeTruthy();

    const mutation = detectGoalMutation({
      userText: "配图改为只用品牌官方素材，禁止 AI 生图，其他成果不变",
      manifest: base!,
    });
    const next = updateSessionManifestOnUserMessage({
      userText: "配图改为只用品牌官方素材，禁止 AI 生图，其他成果不变",
      previousManifest: base!,
      turnId: "turn-2",
    });

    expect(mutation).toMatchObject({
      mutated: true,
      action: "replace",
      qualityOnly: true,
    });
    expect(next?.goalVersion).toBe(base!.goalVersion + 1);
    expect(next?.manifestVersion).toBe(base!.manifestVersion + 1);
    expect(next?.slots).toEqual(base!.slots);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("bumps once for an exact page-count replacement", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const base = compileSessionDeliverableManifest({
      userGoal: "制作鸣镝 G700 幻灯并输出 presentation.pptx",
      turnId: "turn-1",
    });
    expect(base).toBeTruthy();

    const next = updateSessionManifestOnUserMessage({
      userText: "页数改为 8 页，其他要求不变",
      previousManifest: base!,
      turnId: "turn-2",
    });

    expect(next?.goalVersion).toBe(base!.goalVersion + 1);
    expect(next?.slots).toEqual(base!.slots);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it.each([
    "继续",
    "<task-resume>继续完成上一目标</task-resume>",
    "正在从上次步骤继续…",
    "<project-memory>上一任务需要 20 页</project-memory>\n继续",
  ])("does not mutate frozen quality for continuation/recovery text: %s", (userText) => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const base = compileSessionDeliverableManifest({
      userGoal: "制作 6 页鸣镝 G700 幻灯",
      turnId: "turn-1",
    });
    expect(base).toBeTruthy();

    const mutation = detectGoalMutation({ userText, manifest: base! });
    expect(mutation.mutated).toBe(false);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("detects deliverable quality complaint without spurious HTML/PDF add slots", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const base = compileSessionDeliverableManifest({
      userGoal: "蔚来 ES9 调研报告，须交付 PDF、Word、PPT、Markdown",
      turnId: "turn-1",
    });
    expect(base).toBeTruthy();
    const userText = "1、PDF，word报告中的配图无法显示，也没有图表，\n2、PPT没有格式和配图，就是一个白板？？！";
    const mutation = detectGoalMutation({ userText, manifest: base! });
    expect(mutation).toMatchObject({
      mutated: true,
      qualityOnly: true,
      visualCorrection: true,
    });
    expect(mutation.action).not.toBe("add");
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("prunes phantom accumulated slots when user reports deliverable list cross-talk", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const base = compileSessionDeliverableManifest({
      userGoal: "DeepSeek 竞品对标，须交付 competitor-benchmark-report.md",
      turnId: "turn-1",
    });
    expect(base).toBeTruthy();
    const manifest = {
      ...base!,
      slots: [
        ...base!.slots,
        {
          id: "accumulated-artifacts-task-index-html",
          label: "index.html",
          kind: "html" as const,
          pathHint: "index.html",
          required: true,
          status: "active" as const,
        },
        {
          id: "added_2_123",
          label: "extra.docx",
          kind: "docx" as const,
          pathHint: "extra.docx",
          required: true,
          status: "active" as const,
        },
      ],
    };
    const updated = updateSessionManifestOnUserMessage({
      userText: "成果清单串台了，这些 png 和 docx 不是我要求的",
      previousManifest: manifest,
      turnId: "turn-2",
    });
    expect(updated).toBeTruthy();
    const active = updated!.slots.filter((s) => s.status !== "removed");
    expect(active.some((s) => s.id.startsWith("accumulated-"))).toBe(false);
    expect(active.some((s) => s.id.startsWith("added_"))).toBe(false);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("NIO/ES9: does not add phantom HTML slot when baseline already has html_pair", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const manifest = {
      manifestVersion: 1,
      goalVersion: 1,
      sessionGoalAnchor: "蔚来 ES9 投放创意",
      baselineLocked: true,
      compiledAtTurnId: "turn-1",
      slots: [
        {
          id: "must_deliver_1_marketing_deliverable_md",
          label: "marketing-deliverable.md",
          kind: "markdown" as const,
          pathHint: "marketing-deliverable.md",
          required: true,
          status: "done" as const,
        },
        {
          id: "html_pair_2",
          label: "带图表 HTML 报告",
          kind: "html" as const,
          pathHint: "带图表 HTML 报告.html",
          pathHints: ["带图表 HTML 报告.html", "report.html"],
          required: true,
          status: "active" as const,
        },
        {
          id: "universal_data_sources",
          label: "数据源溯源",
          kind: "markdown" as const,
          pathHint: "data-sources.md",
          required: true,
          status: "active" as const,
        },
      ],
    };
    const userText = "须交付：marketing-deliverable.md，以及带图表和地图的 html 版本";
    const mutation = detectGoalMutation({ userText, manifest });
    expect(mutation.mutated).toBe(false);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("37319c0a: does not add phantom HTML when anchor is marketing-deliverable.md only", () => {
    const manifest = {
      manifestVersion: 1,
      goalVersion: 1,
      sessionGoalAnchor: "用「投放创意」帮我：【吴裕泰】须交付：marketing-deliverable.md。写入系统分配任务目录。",
      baselineLocked: true,
      slots: [
        {
          id: "must_deliver_1_marketing_deliverable_md",
          label: "marketing-deliverable.md",
          kind: "markdown" as const,
          pathHint: "marketing-deliverable.md",
          required: true,
          status: "done" as const,
        },
      ],
    };
    const mutation = detectGoalMutation({
      userText: "接下来生成 HTML 综合报告版本",
      manifest,
    });
    expect(mutation.mutated).toBe(false);
  });

  it("37319c0a: does not add duplicate added_ HTML slot", () => {
    const manifest = {
      manifestVersion: 2,
      goalVersion: 2,
      sessionGoalAnchor: "须交付：marketing-deliverable.md",
      baselineLocked: true,
      slots: [
        {
          id: "must_deliver_1_marketing_deliverable_md",
          label: "marketing-deliverable.md",
          kind: "markdown" as const,
          pathHint: "marketing-deliverable.md",
          required: true,
          status: "done" as const,
        },
        {
          id: "added_3_123",
          label: "HTML 综合报告",
          kind: "html" as const,
          pathHint: "index.html",
          required: true,
          status: "pending" as const,
        },
      ],
    };
    const mutation = detectGoalMutation({
      userText: "综合 HTML 网页版报告",
      manifest,
    });
    expect(mutation.mutated).toBe(false);
  });

  it("0731: lite research blocks silent html ADD under enforce", () => {
    const prev = process.env.PILOTDECK_BLOCK_SILENT_RESEARCH_ADD;
    process.env.PILOTDECK_BLOCK_SILENT_RESEARCH_ADD = "enforce";
    try {
      const manifest = {
        manifestVersion: 1,
        goalVersion: 1,
        sessionGoalAnchor:
          "用「Nova-行业市场」写报告。须交付：industry-market-report.md。",
        capabilitySlug: "nova-research-industry-market",
        baselineLocked: true,
        slots: [
          {
            id: "must_deliver_1",
            label: "industry-market-report.md",
            kind: "markdown" as const,
            pathHint: "industry-market-report.md",
            required: true,
            status: "done" as const,
          },
        ],
      };
      const silent = detectGoalMutation({
        userText: "顺便做了个 html 预览",
        manifest,
      });
      expect(silent.mutated).toBe(false);
      const explicit = detectGoalMutation({
        userText: "再出一个综合 html 版",
        manifest,
      });
      expect(explicit.mutated).toBe(true);
      expect(explicit.action).toBe("add");
      expect(explicit.addKind).toBe("html");
    } finally {
      if (prev == null) delete process.env.PILOTDECK_BLOCK_SILENT_RESEARCH_ADD;
      else process.env.PILOTDECK_BLOCK_SILENT_RESEARCH_ADD = prev;
    }
  });
});
