import { describe, expect, it } from "vitest";
import {
  buildWorldcupCampaignSdmSlots,
  isBrandCampaignFullCaseGoal,
  isCampaignFullCaseGoal,
} from "../deliverables/campaignDeliverableCompleteness.js";
import {
  attachSessionTaskDirectoryToManifest,
  compileSessionDeliverableManifest,
  extractUserGoalFromTaskResume,
  parseNumberedDeliverableList,
  sanitizeSessionGoalAnchor,
  updateSessionManifestOnUserMessage,
  buildExpectedManifestFromSdm,
  computeSdmProgress,
  reconcileSlotsWithVerifiedPaths,
  type SessionDeliverableManifest,
} from "./sessionDeliverableManifest.js";
import {
  CASE_12FC6055,
  CASE_STICKY_ZHIHU,
  CASE_TRUE_PPT,
  CASE_WEEKLY_PPT,
} from "../deliverables/goalKindSanitize.js";
import {
  WUYUTAI_GEO_KEYWORD_GOAL,
  WUYUTAI_GEO_SERP_GOAL,
  WUYUTAI_TASK_RESUME_WRAP,
} from "../../../tests/fixtures/wuyutai-0713-five-case-goals.js";

describe("sessionDeliverableManifest", () => {
  it("parses numbered deliverable list", () => {
    const goal = `1. 调研报告 markdown
2. 策划 HTML
3. 主视觉海报`;
    const slots = parseNumberedDeliverableList(goal);
    expect(slots).toHaveLength(3);
    expect(slots[0]?.label).toContain("调研");
    expect(slots[0]?.status).toBe("active");
    expect(slots[1]?.status).toBe("pending");
  });

  it("extracts pathHint from numbered labels (竞品 brief 2 步)", () => {
    const goal = [
      "1. competitive-brief.md 竞品简报",
      "2. sentiment-notes.md 口碑要点",
    ].join("\n");
    const slots = parseNumberedDeliverableList(goal);
    expect(slots).toHaveLength(2);
    expect(slots[0]?.pathHint).toBe("competitive-brief.md");
    expect(slots[1]?.pathHint).toBe("sentiment-notes.md");
  });

  it("builds campaign 8 slots for worldcup goals", () => {
    const slots = buildWorldcupCampaignSdmSlots();
    expect(slots).toHaveLength(8);
    expect(slots[0]?.id).toBe("stage_research");
    expect(slots[4]?.id).toBe("stage_website");
  });

  it("compiles brand-campaign-full manifest with 6 slots (no website)", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const goal = `品牌传播 campaign 全案 一次规划
标准成果清单：
1. 调研 .md
2. brief .docx
3. 海报
4. 社媒包
5. 草稿编号
6. 监测模板`;
    expect(isBrandCampaignFullCaseGoal(goal)).toBe(true);
    const manifest = compileSessionDeliverableManifest({ userGoal: goal });
    expect(manifest?.slots).toHaveLength(7);
    expect(manifest?.slots.some((slot) => slot.id === "universal_data_sources")).toBe(true);
    expect(manifest?.slots.some((slot) => slot.id === "stage_website")).toBe(false);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("detects campaign full case goal", () => {
    expect(isCampaignFullCaseGoal("世界杯 campaign 全案 调研 策划 brief")).toBe(true);
  });

  it("compiles manifest from numbered goal when flag on", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const manifest = compileSessionDeliverableManifest({
      userGoal: "1. 报告 md\n2. HTML 落地页",
    });
    expect(manifest?.slots.length).toBeGreaterThanOrEqual(2);
    expect(manifest?.manifestVersion).toBe(1);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("applies add mutation", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const base = compileSessionDeliverableManifest({
      userGoal: "生成 HTML 落地页并输出 index.html",
    });
    expect(base).toBeTruthy();
    const next = updateSessionManifestOnUserMessage({
      userText: "再加一个 PDF 版",
      previousManifest: base!,
      turnId: "t2",
    });
    expect(next?.manifestVersion).toBe(2);
    expect(next?.slots.some((s) => s.kind === "pdf")).toBe(true);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("compiles manifest from profile basename groups when capability slug set", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const manifest = compileSessionDeliverableManifest({
      userGoal: "试一下",
      capabilitySlug: "nova-ppt-aesthetic-slides",
      majorCategory: "creation",
    });
    expect(manifest?.slots.length).toBeGreaterThan(0);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("reconcileSlotsWithVerifiedPaths removes template slot without verified_* expansion when baseline locked (0708-10)", () => {
    const manifest = {
      manifestVersion: 1,
      goalVersion: 1,
      sessionGoalAnchor: "付费投放",
      capabilitySlug: "mkt-ads",
      profileId: "mkt_ads",
      baselineLocked: true,
      slots: [
        {
          id: "required_markdown_1",
          label: "模板",
          kind: "markdown" as const,
          pathHint: "skills/mkt-ads/references/ad-copy-templates.md",
          required: true,
          status: "active" as const,
        },
      ],
    };
    const { manifest: next, changed } = reconcileSlotsWithVerifiedPaths(manifest, [
      "artifacts/ads-plan.md",
      "artifacts/channel-matrix.md",
    ]);
    expect(changed).toBe(true);
    expect(next.manifestVersion).toBe(2);
    expect(next.slots.some((slot) => slot.status !== "removed" && slot.pathHint?.includes("ad-copy-templates"))).toBe(false);
    expect(next.slots.some((slot) => slot.id.startsWith("verified_"))).toBe(false);
    expect(next.slots.filter((slot) => slot.status !== "removed").length).toBe(0);
  });

  it("locked geo baseline does not add verified_* slots for extra files", () => {
    const manifest = {
      manifestVersion: 1,
      goalVersion: 1,
      sessionGoalAnchor: "雷蛇 GEO",
      profileId: "geo",
      slots: [
        {
          id: "profile_geo_1",
          label: "审计清单",
          kind: "markdown" as const,
          pathHint: "geo-aeo-audit-checklist.md",
          pathHints: ["geo-aeo-audit-checklist.md", "audit-checklist.md"],
          required: true,
          status: "active" as const,
        },
        {
          id: "profile_geo_2",
          label: "关键词",
          kind: "markdown" as const,
          pathHint: "keywords-research.md",
          pathHints: ["keywords-research.md", "keywords.md"],
          required: true,
          status: "pending" as const,
        },
      ],
    };
    const { manifest: next, changed } = reconcileSlotsWithVerifiedPaths(manifest, [
      "artifacts/razer-blade/audit-checklist.md",
      "artifacts/razer-blade/keywords.md",
      "artifacts/razer-blade/unexpected-extra.md",
    ]);
    expect(changed).toBe(true);
    expect(next.slots.filter((slot) => slot.status !== "removed")).toHaveLength(2);
    expect(next.slots.filter((slot) => slot.status === "done")).toHaveLength(2);
    expect(next.slots.some((slot) => slot.id.startsWith("verified_"))).toBe(false);
  });

  it("37319c0a: reconcile removes phantom added_ HTML when md deliverable verified", () => {
    const manifest = {
      manifestVersion: 3,
      goalVersion: 3,
      sessionGoalAnchor: "用「投放创意」帮我：【吴裕泰】须交付：marketing-deliverable.md。写入系统分配任务目录。",
      capabilitySlug: "mkt-ads",
      baselineLocked: true,
      slots: [
        {
          id: "must_deliver_1_marketing_deliverable_md",
          label: "marketing-deliverable.md",
          kind: "markdown" as const,
          pathHint: "marketing-deliverable.md",
          required: true,
          status: "done" as const,
          resolvedPath: "artifacts/task-20260729-2cb97aa8/marketing-deliverable.md",
        },
        {
          id: "added_3_1785280998832_0",
          label: "HTML 综合报告",
          kind: "html" as const,
          pathHint: "index.html",
          required: true,
          status: "pending" as const,
        },
        {
          id: "added_4_1785281023310_0",
          label: "HTML 综合报告",
          kind: "html" as const,
          pathHint: "index.html",
          required: true,
          status: "pending" as const,
        },
      ],
    };
    const { manifest: next, changed } = reconcileSlotsWithVerifiedPaths(manifest, [
      "artifacts/task-20260729-2cb97aa8/marketing-deliverable.md",
      "artifacts/task-20260729-2cb97aa8/data-sources.md",
    ]);
    expect(changed).toBe(true);
    expect(next.slots.filter((s) => s.status !== "removed" && s.kind === "html")).toHaveLength(0);
    expect(next.slots.filter((s) => s.status === "done")).toHaveLength(1);
  });

  it("builds expected manifest rows from SDM", () => {
    const manifest = {
      manifestVersion: 1,
      goalVersion: 1,
      sessionGoalAnchor: "test",
      slots: [{ id: "a", label: "报告", kind: "markdown" as const, required: true }],
    };
    const rows = buildExpectedManifestFromSdm(manifest);
    expect(rows[0]?.id).toBe("a");
    expect(rows[0]?.label).toBe("报告");
  });

  it("computes SDM progress", () => {
    const manifest = {
      manifestVersion: 1,
      goalVersion: 1,
      sessionGoalAnchor: "test",
      slots: [
        { id: "a", label: "A", required: true, pathHint: "report.md", status: "done" as const },
        { id: "b", label: "B", required: true, pathHint: "page.html" },
      ],
    };
    const progress = computeSdmProgress(manifest, ["artifacts/demo/report.md"]);
    expect(progress.total).toBe(2);
    expect(progress.done).toBeGreaterThanOrEqual(1);
  });

  it("computeSdmProgress matches kind-only html slot without pathHint", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const manifest = {
      manifestVersion: 1,
      goalVersion: 1,
      sessionGoalAnchor: "brand site",
      slots: [
        { id: "required_html_1", label: "html", kind: "html" as const, required: true, pathHint: "index.html" },
        { id: "required_markdown_1", label: "markdown", kind: "markdown" as const, required: true, pathHint: "brief.md" },
      ],
    };
    const progress = computeSdmProgress(manifest, [
      "artifacts/modric/index.html",
      "artifacts/modric/brand-brief.md",
    ]);
    expect(progress.total).toBe(2);
    expect(progress.done).toBe(2);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("compiles geo brand-full manifest with profile slots (not 10 workflow steps)", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const goal = [
      "帮雷蛇做品牌 GEO 全案，七步一次执行",
      "1. geo-aeo-audit 审计",
      "2. pd-geo 关键词与成稿",
      "3. optimizer",
      "4. schema",
      "5. citability",
      "6. visibility-report.html",
      "7. 可选草稿",
      "",
      "标准成果清单：",
      "1. geo 全套",
      "2. schema.jsonld",
      "3. 可选草稿",
    ].join("\n");
    const manifest = compileSessionDeliverableManifest({
      userGoal: goal,
      capabilitySlug: "pd-geo",
    });
    expect(manifest?.profileId).toBe("geo");
    expect(manifest?.slots.length).toBeGreaterThanOrEqual(6);
    expect(manifest?.slots.length).toBeLessThanOrEqual(8);
    expect(manifest?.slots.some((slot) => slot.count === 3)).toBe(true);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("a51fa91d: nova-customer-acquisition-leads freezes leads-report (+ manifest)", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const goal = "查一下北京【人工智能外包】潜在客户，整理成线索表报告，直接开始做。";
    const manifest = compileSessionDeliverableManifest({
      userGoal: goal,
      capabilitySlug: "nova-customer-acquisition-leads",
      majorCategory: "marketing",
    });
    expect(manifest?.profileId).toBe("acquisition_leads");
    const hints = (manifest?.slots ?? []).map((s) => s.pathHint);
    expect(hints).toContain("leads-report.md");
    expect(hints).toContain("acquisition-manifest.json");
    expect(hints).toContain("data-sources.md");
    expect(hints.some((h) => /query-expansion/i.test(h ?? ""))).toBe(false);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("fd7c166c: open-design website freezes to index.html (not downloads images)", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const manifest = compileSessionDeliverableManifest({
      userGoal: "做个关于雷蛇的网站。使用 Open Design 设计系统 material。写入系统分配任务目录，跳过模板问卷。",
      capabilitySlug: "open-design",
    });
    expect(manifest?.profileId).toBe("design");
    const required = (manifest?.slots ?? []).filter((s) => s.required && s.status !== "removed");
    expect(required.some((s) => /index\.html/i.test(s.pathHint ?? ""))).toBe(true);
    expect(required.every((s) => !/downloads|img-/i.test(s.pathHint ?? ""))).toBe(true);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("compiles research-report authority slots for formal 调研+Word goals (178fa162 RCA)", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    process.env.PILOTDECK_CHECKLIST_AUTHORITY_TEMPLATES = "1";
    const goal = "围绕【人工智能企业 SaaS】做正式调研报告：检索→综述 md→图表→Word，三步一口气做完，报路径。";
    const manifest = compileSessionDeliverableManifest({
      userGoal: goal,
      capabilitySlug: "fin-equity-research-report",
    });
    expect(manifest?.profileId).toBe("research");
    expect(manifest?.slots.map((s) => s.pathHint)).toEqual([
      "01-sources-and-synthesis.md",
      "03-report-body.md",
      "report.docx",
      "data-sources.md",
    ]);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
    delete process.env.PILOTDECK_CHECKLIST_AUTHORITY_TEMPLATES;
  });

  it("flag off returns null (bit-identical degrade)", () => {
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
    const manifest = compileSessionDeliverableManifest({
      userGoal: "1. 报告 md\n2. HTML 落地页",
    });
    expect(manifest).toBeNull();
  });

  it("compiles from explicit filename hint when flag on", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const manifest = compileSessionDeliverableManifest({
      userGoal: "写 markdown 报告并输出 report.md",
    });
    expect(manifest).toBeTruthy();
    expect(manifest!.slots.length).toBeGreaterThan(0);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("normalizes pathHints to basename on compile", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const manifest = compileSessionDeliverableManifest({
      userGoal: "1. artifacts/geo/wuyutai/keywords.md 关键词\n2. visibility-report.html",
    });
    expect(manifest?.slots[0]?.pathHint).toBe("keywords.md");
    expect(manifest?.slots[1]?.pathHint).toBe("visibility-report.html");
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("anchors bare pathHints onto STDA task root", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const base = compileSessionDeliverableManifest({
      userGoal: "1. keywords.md\n2. visibility-report.html",
    })!;
    const patched = attachSessionTaskDirectoryToManifest(base, {
      taskArtifactDir: "artifacts/task-20260710-a1b2c3d4",
      taskDirKey: "20260710-a1b2c3d4",
      goalVersion: 1,
    });
    expect(patched?.slots[0]?.pathHint).toBe("artifacts/task-20260710-a1b2c3d4/keywords.md");
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("attachSessionTaskDirectoryToManifest binds STDA root", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const base = compileSessionDeliverableManifest({
      userGoal: "1. keywords.md\n2. visibility-report.html",
    })!;
    const patched = attachSessionTaskDirectoryToManifest(base, {
      taskArtifactDir: "artifacts/task-20260710-a1b2c3d4",
      taskDirKey: "20260710-a1b2c3d4",
      goalVersion: 1,
    });
    expect(patched).toMatchObject({
      taskArtifactDir: "artifacts/task-20260710-a1b2c3d4",
      taskDirKey: "20260710-a1b2c3d4",
    });
    expect(attachSessionTaskDirectoryToManifest(patched!, {
      taskArtifactDir: "artifacts/task-20260710-a1b2c3d4",
      taskDirKey: "20260710-a1b2c3d4",
    })).toBeNull();
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("attachSessionTaskDirectoryToManifest re-anchors cross-task pathHints (Razer/FIFA RCA)", () => {
    const razerDir = "artifacts/task-20260728-a1b2c3d4";
    const fifaDir = "artifacts/task-20260728-41dd1371";
    const base: SessionDeliverableManifest = {
      manifestVersion: 1,
      goalVersion: 1,
      sessionGoalAnchor: "雷蛇2026",
      slots: [
        {
          id: "bento",
          label: "deck.bento.html",
          pathHint: `${fifaDir}/deck.bento.html`,
          resolvedPath: `${fifaDir}/deck.bento.html`,
          required: true,
          status: "done",
          kind: "bento",
        },
      ],
    };
    const patched = attachSessionTaskDirectoryToManifest(base, {
      taskArtifactDir: razerDir,
      taskDirKey: "20260728-a1b2c3d4",
      goalVersion: 1,
    });
    expect(patched?.slots[0]?.pathHint).toBe(`${razerDir}/deck.bento.html`);
    expect(patched?.slots[0]?.resolvedPath).toBe(`${razerDir}/deck.bento.html`);
  });

  describe("0713 吴裕泰 — compile + anchor", () => {
    it("compiles geo-serp from must-deliver clause", () => {
      process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
      const manifest = compileSessionDeliverableManifest({
        userGoal: WUYUTAI_GEO_SERP_GOAL,
        capabilitySlug: "geo-serp-analysis",
      });
      expect(manifest?.profileId).toBe("geo_serp");
      expect(manifest?.slots.map((s) => s.pathHint)).toEqual([
        "serp-analysis.md",
        "serp-analysis.html",
        "data-sources.md",
      ]);
      delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
    });

    it("compiles geo-keyword without index.html/docx fallback", () => {
      process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
      const manifest = compileSessionDeliverableManifest({
        userGoal: WUYUTAI_GEO_KEYWORD_GOAL,
        capabilitySlug: "geo-keyword-research",
      });
      expect(manifest?.slots.map((s) => s.pathHint)).toEqual([
        "keywords.md",
        "keywords.html",
        "data-sources.md",
      ]);
      expect(manifest?.slots.some((s) => s.pathHint === "index.html")).toBe(false);
      delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
    });

    it("sanitizeSessionGoalAnchor extracts user_goal from task-resume", () => {
      const anchor = sanitizeSessionGoalAnchor(WUYUTAI_TASK_RESUME_WRAP);
      expect(anchor).toContain("serp-analysis.md");
      expect(anchor).not.toContain("<task-resume");
      expect(extractUserGoalFromTaskResume(WUYUTAI_TASK_RESUME_WRAP)).toContain("吴裕泰");
    });

    it("reconcile marks e3f7-style task dir paths done", () => {
      const manifest = {
        manifestVersion: 1,
        goalVersion: 1,
        sessionGoalAnchor: "competitor",
        taskArtifactDir: "artifacts/task-20260713-wyt01",
        slots: [
          { id: "s1", label: "geo-competitor-report.md", pathHint: "geo-competitor-report.md", required: true, status: "active" as const, kind: "markdown" as const },
          { id: "s2", label: "geo-competitor-report.html", pathHint: "geo-competitor-report.html", required: true, status: "pending" as const, kind: "html" as const },
          { id: "s3", label: "competitor-visibility.md", pathHint: "competitor-visibility.md", required: true, status: "pending" as const, kind: "markdown" as const },
          { id: "s4", label: "competitor-visibility.html", pathHint: "competitor-visibility.html", required: true, status: "pending" as const, kind: "html" as const },
        ],
      };
      const verified = [
        "artifacts/task-20260713-wyt01/geo-competitor-report.md",
        "artifacts/task-20260713-wyt01/geo-competitor-report.html",
        "artifacts/task-20260713-wyt01/competitor-visibility.md",
        "artifacts/task-20260713-wyt01/competitor-visibility.html",
      ];
      const { manifest: next, changed } = reconcileSlotsWithVerifiedPaths(manifest, verified);
      expect(changed).toBe(true);
      expect(next.slots.filter((s) => s.status === "done")).toHaveLength(4);
    });

    it("reconcile does not bind deck.bento.html from another task dir (Razer/FIFA RCA)", () => {
      const razerDir = "artifacts/task-20260728-a1b2c3d4";
      const fifaDir = "artifacts/task-20260728-41dd1371";
      const manifest = {
        manifestVersion: 1,
        goalVersion: 1,
        sessionGoalAnchor: "雷蛇2026新品介绍",
        taskArtifactDir: razerDir,
        slots: [
          {
            id: "required_bento_1",
            label: "Nova 可编辑演示稿",
            pathHint: "deck.bento.html",
            required: true,
            status: "active" as const,
            kind: "bento" as const,
          },
        ],
      };
      const verified = [
        `${razerDir}/deck.bento.html`,
        `${fifaDir}/deck.bento.html`,
      ];
      const { manifest: next } = reconcileSlotsWithVerifiedPaths(manifest, verified);
      const bentoSlot = next.slots.find((s) => s.kind === "bento");
      expect(bentoSlot?.resolvedPath).toBe(`${razerDir}/deck.bento.html`);
      expect(bentoSlot?.pathHint).not.toContain("41dd1371");
    });
  });

  it("0731: heal research lite — shadow marks only; enforce replaces toxic slots", () => {
    const goal =
      "用「Nova-行业市场」写报告。须交付：industry-market-report.md。\n写入系统分配任务目录。";
    const toxic: SessionDeliverableManifest = {
      manifestVersion: 1,
      goalVersion: 1,
      sessionGoalAnchor: goal,
      capabilitySlug: "nova-research-industry-market",
      baselineLocked: true,
      slots: [
        {
          id: "authority_research-report_1",
          label: "01",
          kind: "markdown",
          pathHint: "01-sources-and-synthesis.md",
          required: true,
          status: "pending",
        },
        {
          id: "authority_research-report_2",
          label: "03",
          kind: "markdown",
          pathHint: "03-report-body.md",
          required: true,
          status: "pending",
        },
        {
          id: "authority_research-report_3",
          label: "docx",
          kind: "docx",
          pathHint: "report.docx",
          required: true,
          status: "pending",
        },
        {
          id: "universal_data_sources",
          label: "data-sources",
          kind: "markdown",
          pathHint: "data-sources.md",
          required: false,
          status: "pending",
        },
      ],
    };
    const verified = ["artifacts/task-x/industry-market-report.md"];

    const prev = process.env.PILOTDECK_SDM_HEAL_RESEARCH_LITE;
    process.env.PILOTDECK_SDM_HEAL_RESEARCH_LITE = "shadow";
    try {
      const { manifest: shadowed } = reconcileSlotsWithVerifiedPaths(toxic, verified);
      expect(shadowed.healResearchLiteApplied).toBe(true);
      expect(shadowed.slots.some((s) => s.id === "authority_research-report_3")).toBe(true);
    } finally {
      process.env.PILOTDECK_SDM_HEAL_RESEARCH_LITE = "enforce";
    }
    try {
      const { manifest: enforced } = reconcileSlotsWithVerifiedPaths(
        { ...toxic, healResearchLiteApplied: false },
        verified,
      );
      expect(enforced.healResearchLiteApplied).toBe(true);
      expect(enforced.slots.some((s) => /industry-market-report/i.test(s.pathHint ?? ""))).toBe(true);
      expect(enforced.slots.some((s) => s.id === "authority_research-report_3")).toBe(false);
      expect(enforced.slots.some((s) => s.id === "universal_data_sources")).toBe(true);
    } finally {
      if (prev == null) delete process.env.PILOTDECK_SDM_HEAL_RESEARCH_LITE;
      else process.env.PILOTDECK_SDM_HEAL_RESEARCH_LITE = prev;
    }
  });

  it("viral-article-generator compiles viral_article_pack four slots not matrix/flywheel", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    process.env.PILOTDECK_CHECKLIST_AUTHORITY_TEMPLATES = "1";
    const goal = [
      "用「爆款长文生成」为【AI 编程工具】写一篇公众号气质长文（自动选风）。",
      "须交付：article-brief.md、article.md、quotes.md、channel-plan.md。",
      "写入系统分配任务目录。",
    ].join("\n");
    const manifest = compileSessionDeliverableManifest({
      userGoal: goal,
      capabilitySlug: "viral-article-generator",
    });
    expect(manifest?.profileId).toBe("viral_article_pack");
    const hints = (manifest?.slots ?? [])
      .filter((s) => s.status !== "removed" && s.id !== "universal_data_sources")
      .map((s) => s.pathHint);
    expect(hints).toEqual([
      "article-brief.md",
      "article.md",
      "quotes.md",
      "channel-plan.md",
    ]);
    expect(hints).not.toContain("zhihu.md");
    expect(hints).not.toContain("01-topics.md");
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("expensive intent: 2 ADDs pptx; ？ keeps named files", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    process.env.PILOTDECK_EXPENSIVE_INTENT_CLARIFY = "enforce";
    const dual = [
      "帮我做知乎选题和一篇长文，主题：企业级 Agent 落地。",
      "须交付：01-topics.md、02-longform.md。",
      "另外做成一份PPT。",
      "写入系统分配任务目录。",
    ].join("\n");
    const base = compileSessionDeliverableManifest({ userGoal: dual, turnId: "t-ei-base" });
    expect(base?.profileId).not.toBe("ppt");
    const keep = updateSessionManifestOnUserMessage({
      userText: "？",
      previousManifest: base!,
      turnId: "t-ei-q",
      pendingFingerprint: "expensive_intent:ppt_vs_named_files",
    });
    expect(keep?.profileId).not.toBe("ppt");
    expect(keep?.expensiveIntentHandled).toBe(true);
    expect(keep?.expensiveIntentChosen).toBe("keep_must_deliver");
    expect(keep?.sessionGoalAnchor).toMatch(/做成一份PPT/);
    const switched = updateSessionManifestOnUserMessage({
      userText: "2",
      previousManifest: base!,
      turnId: "t-ei-2",
      pendingFingerprint: "expensive_intent:ppt_vs_named_files",
    });
    expect(switched?.slots.some((slot) => slot.kind === "pptx" || /\.pptx$/i.test(String(slot.pathHint ?? "")))).toBe(true);
    expect(switched?.slots.some((slot) => /01-topics\.md$/i.test(String(slot.pathHint ?? "")))).toBe(true);
    expect(switched?.sessionGoalAnchor).toBe(base?.sessionGoalAnchor);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
    delete process.env.PILOTDECK_EXPENSIVE_INTENT_CLARIFY;
  });

  it("CASE_12FC6055 enforce does not compile report.pdf or presentation.pptx slots", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    process.env.PILOTDECK_KIND_MENTION_SANITIZE = "enforce";
    const manifest = compileSessionDeliverableManifest({ userGoal: CASE_12FC6055, turnId: "km-12fc" });
    const hints = (manifest?.slots ?? []).flatMap((slot) => [
      slot.pathHint ?? "",
      ...(slot.pathHints ?? []),
      slot.id,
    ]);
    expect(hints.some((hint) => /report\.pdf|presentation\.pptx|required_pdf_|required_pptx_/i.test(hint))).toBe(false);
    expect(hints.some((hint) => /01-topics\.md/i.test(hint))).toBe(false);
    expect(manifest?.sessionGoalAnchor ?? CASE_12FC6055).toMatch(/知乎/);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
    delete process.env.PILOTDECK_KIND_MENTION_SANITIZE;
  });

  it("true PPT kind-fallback slots keep presentation.pptx in pathHints", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    process.env.PILOTDECK_KIND_MENTION_SANITIZE = "enforce";
    const weekly = compileSessionDeliverableManifest({ userGoal: CASE_WEEKLY_PPT, turnId: "km-weekly" });
    const weeklyHints = (weekly?.slots ?? []).flatMap((slot) => [slot.pathHint ?? "", ...(slot.pathHints ?? [])]);
    expect(weeklyHints.some((hint) => /presentation\.pptx$/i.test(hint))).toBe(true);
    const truePpt = compileSessionDeliverableManifest({
      userGoal: CASE_TRUE_PPT,
      capabilitySlug: "anth-pptx",
      turnId: "km-true",
    });
    const pptSlot = truePpt?.slots.find((slot) => slot.kind === "pptx" || /\.pptx$/i.test(String(slot.pathHint ?? "")));
    expect(pptSlot).toBeTruthy();
    const pptHints = [pptSlot?.pathHint ?? "", ...(pptSlot?.pathHints ?? [])];
    expect(pptHints.some((hint) => /presentation\.pptx$/i.test(hint))).toBe(true);
    const sticky = compileSessionDeliverableManifest({ userGoal: CASE_STICKY_ZHIHU, turnId: "km-zhihu" });
    const stickyHints = (sticky?.slots ?? []).flatMap((slot) => [slot.pathHint ?? "", ...(slot.pathHints ?? [])]);
    expect(stickyHints.some((hint) => /01-topics\.md$/i.test(hint))).toBe(true);
    expect(stickyHints.some((hint) => /presentation\.pptx$/i.test(hint))).toBe(false);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
    delete process.env.PILOTDECK_KIND_MENTION_SANITIZE;
  });
});
