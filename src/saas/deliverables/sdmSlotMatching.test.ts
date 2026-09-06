import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_SLOT_PATTERNS,
  findBestVerifiedPathForSlot,
  kindMatchAllowed,
  pathMatchesKind,
  pathSatisfiesSdmSlot,
  reanchorSdmPathToTaskDir,
  slotSatisfiedByValidation,
} from "./sdmSlotMatching.js";

describe("sdmSlotMatching", () => {
  it("matches kind-only html slot to index.html", () => {
    const slot = { id: "required_html_1", label: "html", kind: "html" };
    expect(pathSatisfiesSdmSlot("artifacts/modric/index.html", slot)).toBe(true);
    expect(slotSatisfiedByValidation(slot, ["artifacts/modric/index.html"])).toBe(true);
  });

  it("matches kind-only markdown slot", () => {
    const slot = { id: "required_markdown_1", label: "markdown", kind: "markdown" };
    expect(pathMatchesKind("artifacts/modric/brand-brief.md", "markdown")).toBe(true);
    expect(slotSatisfiedByValidation(slot, ["artifacts/modric/brand-brief.md"])).toBe(true);
  });

  it("stage_plan_html does not match campaign-brief.docx", () => {
    const slot = { id: "stage_plan_html", label: "Campaign 策划 HTML", kind: "html" };
    expect(pathSatisfiesSdmSlot("artifacts/task-abc/campaign-brief.docx", slot)).toBe(false);
    expect(pathSatisfiesSdmSlot("artifacts/task-abc/campaign-plan.html", slot)).toBe(true);
  });

  it("brand_brief matches docx only", () => {
    const slot = { id: "brand_brief", label: "传播 brief", kind: "docx", pathHint: "campaign-brief.docx" };
    expect(pathSatisfiesSdmSlot("artifacts/task-abc/campaign-brief.docx", slot)).toBe(true);
    expect(pathSatisfiesSdmSlot("artifacts/task-abc/campaign-plan.html", slot)).toBe(false);
  });

  it("matches campaign stage_website pattern", () => {
    const slot = { id: "stage_website", label: "官网", kind: "html", pathHint: "index.html" };
    expect(CAMPAIGN_SLOT_PATTERNS.stage_website.test("artifacts/campaign/index.html")).toBe(true);
    expect(findBestVerifiedPathForSlot(slot, ["artifacts/campaign/index.html"])).toBe(
      "artifacts/campaign/index.html",
    );
  });

  it("ES9 RCA: prefers verified path under task scope when basename matches", () => {
    const slot = {
      id: "slot_2_report_pdf",
      label: "report.pdf",
      kind: "pdf",
      pathHint: "artifacts/task-20260723-fd6c3d5f/report.pdf",
    };
    const used = new Set<string>();
    expect(findBestVerifiedPathForSlot(
      slot,
      [
        "artifacts/task-20260722-1b897c91/report.pdf",
        "artifacts/task-20260723-fd6c3d5f/report.pdf",
      ],
      used,
      "artifacts/task-20260723-fd6c3d5f",
    )).toBe("artifacts/task-20260723-fd6c3d5f/report.pdf");
  });

  it("Fix-6: rejects out-of-scope data-sources.md when task scope is set (LV/GTA6 RCA)", () => {
    const slot = {
      id: "universal_data_sources",
      label: "数据源溯源",
      kind: "markdown",
      pathHint: "data-sources.md",
      pathHints: ["data-sources.md"],
    };
    expect(findBestVerifiedPathForSlot(
      slot,
      [
        "artifacts/research-gta6-trailer-20260725/data-sources.md",
        "artifacts/lv-shanghai-factcheck/data-sources.md",
      ],
      new Set(),
      "artifacts/lv-shanghai-factcheck",
    )).toBe("artifacts/lv-shanghai-factcheck/data-sources.md");
    expect(findBestVerifiedPathForSlot(
      slot,
      ["artifacts/research-gta6-trailer-20260725/data-sources.md"],
      new Set(),
      "artifacts/lv-shanghai-factcheck",
    )).toBeUndefined();
  });

  it("treats done slots as satisfied without paths", () => {
    expect(slotSatisfiedByValidation({ id: "s1", status: "done" }, [])).toBe(true);
  });

  it("matches geo audit checklist basename aliases", () => {
    const templateSlot = {
      id: "required_markdown_1",
      label: "模板",
      kind: "markdown",
      pathHint: "skills/mkt-ads/references/ad-copy-templates.md",
    };
    expect(kindMatchAllowed(templateSlot)).toBe(false);
    expect(pathSatisfiesSdmSlot("artifacts/01-topics.md", templateSlot)).toBe(false);
    expect(pathSatisfiesSdmSlot("artifacts/02-calendar.md", templateSlot)).toBe(false);
    expect(pathSatisfiesSdmSlot("skills/mkt-ads/references/ad-copy-templates.md", templateSlot)).toBe(true);
  });

  it("MOD-07: 1 of 5 slots satisfied by verified path", () => {
    const slots = [
      { id: "s1", label: "品牌发现", kind: "markdown", status: "done" as const },
      { id: "s2", label: "定位", kind: "markdown", pathHint: "positioning.md", status: "active" as const },
      { id: "s3", label: "语气", kind: "markdown", pathHint: "tone.md", status: "active" as const },
      { id: "s4", label: "落地页", kind: "html", pathHint: "index.html", status: "active" as const },
      { id: "s5", label: "SEO", kind: "markdown", pathHint: "seo.md", status: "active" as const },
    ];
    const verified = ["artifacts/modric/discovery.md"];
    const satisfied = slots.filter((slot) => slotSatisfiedByValidation(slot, verified));
    expect(satisfied).toHaveLength(1);
  });

  it("matches profile basename aliases (geo audit checklist)", () => {
    const slot = {
      id: "profile_geo_1",
      label: "geo-aeo-audit-checklist.md",
      kind: "markdown",
      pathHint: "geo-aeo-audit-checklist.md",
      pathHints: ["geo-aeo-audit-checklist.md", "01-audit-checklist.md", "audit-checklist.md"],
    };
    expect(pathSatisfiesSdmSlot("artifacts/razer-blade/audit-checklist.md", slot)).toBe(true);
    expect(pathSatisfiesSdmSlot("artifacts/razer-blade/geo-aeo-audit-checklist.md", slot)).toBe(true);
  });

  it("satisfies 长文×2 when two pillar markdown files exist", () => {
    const slot = { id: "slot_2_长文_2", label: "长文×2", count: 2 };
    const verified = [
      "artifacts/task-20260712-46dd7de7/02-支柱长文A-互动影游的中国时刻.md",
      "artifacts/task-20260712-46dd7de7/02-支柱长文B-当我们在宫廷里做选择时我们在选择什么.md",
    ];
    expect(slotSatisfiedByValidation(slot, verified)).toBe(true);
    expect(pathSatisfiesSdmSlot(verified[0], slot)).toBe(true);
  });

  it("satisfies chart slot with charts-and-data markdown", () => {
    const slot = { id: "slot_2_图表_mermaid_表格", label: "图表（Mermaid/表格）" };
    const verified = ["artifacts/task-20260712-516c9a7c/02-charts-and-data.md"];
    expect(pathSatisfiesSdmSlot(verified[0], slot)).toBe(true);
    expect(slotSatisfiedByValidation(slot, verified)).toBe(true);
  });

  it("satisfies research synthesis slot without stealing chart markdown", () => {
    const researchSlot = { id: "slot_1_调研_md", label: "调研 .md", kind: "markdown" };
    const chartSlot = { id: "slot_2_图表_mermaid_表格", label: "图表（Mermaid/表格）" };
    const verified = [
      "artifacts/task-20260712-516c9a7c/01-sources-and-synthesis.md",
      "artifacts/task-20260712-516c9a7c/02-charts-and-data.md",
    ];
    expect(pathSatisfiesSdmSlot(verified[0], researchSlot)).toBe(true);
    expect(pathSatisfiesSdmSlot(verified[1], researchSlot)).toBe(false);
    expect(pathSatisfiesSdmSlot(verified[1], chartSlot)).toBe(true);
  });

  it("NIO/ES9: semantic html_pair satisfied by scoped index.html", () => {
    const taskDir = "artifacts/task-20260728-a1240c14";
    const slot = {
      id: "html_pair_2",
      label: "带图表 HTML 报告",
      kind: "html",
      pathHint: "带图表 HTML 报告.html",
      pathHints: [
        "带图表 HTML 报告.html",
        "marketing-deliverable.html",
        "report.html",
        "index.html",
      ],
      status: "active" as const,
    };
    const verified = [
      `${taskDir}/marketing-deliverable.md`,
      `${taskDir}/index.html`,
      `${taskDir}/data-sources.md`,
    ];
    expect(slotSatisfiedByValidation(slot, verified, {
      taskArtifactDir: taskDir,
      htmlSlotCount: 1,
    })).toBe(true);
    expect(findBestVerifiedPathForSlot(slot, verified, new Set(), taskDir)).toBe(
      `${taskDir}/index.html`,
    );
  });

  it("legacy brief.md/document.docx slots accept research-report workflow files (178fa162 RCA)", () => {
    const taskDir = "artifacts/task-20260728-3a6eb33f";
    const markdownSlot = {
      id: "required_markdown_1",
      label: "markdown",
      kind: "markdown" as const,
      pathHint: "brief.md",
      status: "active" as const,
    };
    const docxSlot = {
      id: "required_docx_2",
      label: "docx",
      kind: "docx" as const,
      pathHint: "document.docx",
      status: "pending" as const,
    };
    const verified = [
      `${taskDir}/01-sources-and-synthesis.md`,
      `${taskDir}/03-report-body.md`,
      `${taskDir}/report.docx`,
    ];
    expect(slotSatisfiedByValidation(markdownSlot, verified)).toBe(true);
    expect(slotSatisfiedByValidation(docxSlot, verified)).toBe(true);
  });

  it("polluted research-report slots accept product-user-research files (3a785077 RCA)", () => {
    const taskDir = "artifacts/task-20260729-b78c44a4";
    const verified = [
      `${taskDir}/product-user-research.md`,
      `${taskDir}/世界杯周边产品用户研究报告.html`,
    ];
    const slot1 = {
      id: "authority_research-report_1",
      label: "01-sources-and-synthesis.md 调研综述",
      kind: "markdown" as const,
      pathHint: "01-sources-and-synthesis.md",
      status: "active" as const,
    };
    const slot2 = {
      id: "authority_research-report_2",
      label: "03-report-body.md 报告正文与图表",
      kind: "markdown" as const,
      pathHint: "03-report-body.md",
      status: "pending" as const,
    };
    const htmlSlot = {
      id: "added_2_1785280282947_0",
      label: "HTML 版",
      kind: "html" as const,
      pathHint: "index.html",
      status: "pending" as const,
    };
    expect(slotSatisfiedByValidation(slot1, verified, { taskArtifactDir: taskDir })).toBe(true);
    expect(slotSatisfiedByValidation(slot2, verified, { taskArtifactDir: taskDir })).toBe(true);
    expect(slotSatisfiedByValidation(htmlSlot, verified, { taskArtifactDir: taskDir, htmlSlotCount: 1 })).toBe(true);
  });

  it("deck.bento.html: findBestVerifiedPathForSlot rejects cross task-* dirs (Razer/FIFA RCA)", () => {
    const razerDir = "artifacts/task-20260728-a1b2c3d4";
    const fifaDir = "artifacts/task-20260728-41dd1371";
    const slot = {
      id: "required_bento_1",
      label: "Nova 可编辑演示稿",
      kind: "bento" as const,
      pathHint: "deck.bento.html",
      status: "active" as const,
    };
    const verified = [
      `${razerDir}/deck.bento.html`,
      `${fifaDir}/deck.bento.html`,
    ];
    expect(findBestVerifiedPathForSlot(slot, verified, new Set(), razerDir)).toBe(
      `${razerDir}/deck.bento.html`,
    );
    expect(findBestVerifiedPathForSlot(slot, verified, new Set(), fifaDir)).toBe(
      `${fifaDir}/deck.bento.html`,
    );
  });

  it("reanchorSdmPathToTaskDir moves cross-task deck.bento.html onto allocated root", () => {
    expect(
      reanchorSdmPathToTaskDir(
        "artifacts/task-20260728-41dd1371/deck.bento.html",
        "artifacts/task-20260728-a1b2c3d4",
      ),
    ).toBe("artifacts/task-20260728-a1b2c3d4/deck.bento.html");
    expect(reanchorSdmPathToTaskDir("deck.bento.html", "artifacts/task-20260728-a1b2c3d4")).toBe(
      "artifacts/task-20260728-a1b2c3d4/deck.bento.html",
    );
  });

  it("0731: industry/user lite md satisfies polluted research-report slots", () => {
    const taskDir = "artifacts/task-20260731-75a2313f";
    const slot1 = {
      id: "authority_research-report_1",
      label: "01",
      kind: "markdown" as const,
      pathHint: "01-sources-and-synthesis.md",
      status: "active" as const,
    };
    expect(
      slotSatisfiedByValidation(slot1, [`${taskDir}/industry-market-report.md`], {
        taskArtifactDir: taskDir,
      }),
    ).toBe(true);
    expect(
      slotSatisfiedByValidation(slot1, [`${taskDir}/user-research-report.md`], {
        taskArtifactDir: taskDir,
      }),
    ).toBe(true);
  });

  it("0731: writing-style-distill alias accepts wuxiaobo-writing-os.md", () => {
    const slot = {
      id: "authority_writing-style-distill_1",
      label: "深度蒸馏",
      kind: "markdown" as const,
      pathHint: "writing-style-distill.md",
      status: "active" as const,
    };
    expect(
      slotSatisfiedByValidation(slot, ["artifacts/task-x/wuxiaobo-writing-os.md"]),
    ).toBe(true);
  });

  it("0731-fail-B: methodology basename satisfies distill slot", () => {
    const slot = {
      id: "authority_writing-style-distill_1",
      label: "深度蒸馏成稿",
      kind: "markdown" as const,
      pathHint: "writing-style-distill.md",
      status: "active" as const,
    };
    expect(
      slotSatisfiedByValidation(
        slot,
        ["artifacts/task-20260731-e7734d77/notes/xiaomi-crisis-pr-methodology.md"],
      ),
    ).toBe(true);
  });

  it("0731-fail-B: non-distill slot rejects methodology.md", () => {
    const slot = {
      id: "authority_research-report_1",
      label: "调研综述",
      kind: "markdown" as const,
      pathHint: "01-sources-and-synthesis.md",
      status: "active" as const,
    };
    expect(
      slotSatisfiedByValidation(slot, ["artifacts/task-x/foo-methodology.md"]),
    ).toBe(false);
  });

  it("0731-fail-C: verified 内容策略.md+copywriting.md satisfy slots", () => {
    const strategy = {
      id: "slot_1_strategy",
      label: "策略 .md",
      kind: "markdown" as const,
      pathHints: ["01-strategy.md", "content-strategy.md", "内容策略.md", "01-内容策略.md"],
      status: "active" as const,
    };
    const social = {
      id: "slot_3_social",
      label: "社媒包",
      kind: "markdown" as const,
      pathHints: ["03-social-slices.md", "社媒包.md", "copywriting.md"],
      status: "pending" as const,
    };
    const verified = [
      "artifacts/task-x/内容策略.md",
      "artifacts/task-x/copywriting.md",
    ];
    expect(slotSatisfiedByValidation(strategy, verified)).toBe(true);
    expect(slotSatisfiedByValidation(social, verified)).toBe(true);
  });

  it("P0-A: Chinese 用户研究.md satisfies user-research-report.md hint", () => {
    const slot = {
      id: "must_deliver_1",
      label: "用户研究",
      kind: "markdown" as const,
      pathHint: "user-research-report.md",
      pathHints: ["user-research-report.md", "用户研究.md"],
      status: "active" as const,
    };
    expect(slotSatisfiedByValidation(slot, ["artifacts/task-20260815-aaaaaaaa/用户研究.md"])).toBe(true);
  });

  it("P0-A: single html slot accepts Index.html in STDA scope", () => {
    const taskDir = "artifacts/task-20260815-bbbbbbbb";
    const slot = {
      id: "html_pair_1",
      label: "HTML 报告",
      kind: "html" as const,
      pathHint: "index.html",
      pathHints: ["index.html", "report.html"],
      status: "active" as const,
    };
    expect(slotSatisfiedByValidation(slot, [`${taskDir}/Index.html`], {
      taskArtifactDir: taskDir,
      htmlSlotCount: 1,
    })).toBe(true);
  });

  it("P0-A: dual html slots reject cross-claim of sibling html", () => {
    const taskDir = "artifacts/task-20260815-cccccccc";
    const reportSlot = {
      id: "html_pair_report",
      label: "报告 HTML",
      kind: "html" as const,
      pathHint: "report.html",
      pathHints: ["report.html"],
      status: "active" as const,
    };
    const landingSlot = {
      id: "html_pair_landing",
      label: "落地页 HTML",
      kind: "html" as const,
      pathHint: "landing.html",
      pathHints: ["landing.html"],
      status: "pending" as const,
    };
    const onlyReport = [`${taskDir}/report.html`];
    expect(slotSatisfiedByValidation(reportSlot, onlyReport, {
      taskArtifactDir: taskDir,
      htmlSlotCount: 2,
    })).toBe(true);
    expect(slotSatisfiedByValidation(landingSlot, onlyReport, {
      taskArtifactDir: taskDir,
      htmlSlotCount: 2,
    })).toBe(false);
  });

  it("0731: research docx fuzzy accepts 调研报告.docx, rejects press-release.docx", () => {
    const prev = process.env.PILOTDECK_RESEARCH_DOCX_BASENAME_FUZZY;
    process.env.PILOTDECK_RESEARCH_DOCX_BASENAME_FUZZY = "shadow";
    try {
      const docxSlot = {
        id: "authority_research-report_3",
        label: "Word",
        kind: "docx" as const,
        pathHint: "report.docx",
        pathHints: ["report.docx", "document.docx"],
        status: "pending" as const,
      };
      const taskDir = "artifacts/task-20260731-a0676b9c";
      expect(
        slotSatisfiedByValidation(docxSlot, [`${taskDir}/人工智能agent调研报告.docx`]),
      ).toBe(true);
      expect(
        slotSatisfiedByValidation(docxSlot, [`${taskDir}/press-release.docx`]),
      ).toBe(false);
    } finally {
      if (prev == null) delete process.env.PILOTDECK_RESEARCH_DOCX_BASENAME_FUZZY;
      else process.env.PILOTDECK_RESEARCH_DOCX_BASENAME_FUZZY = prev;
    }
  });
});
