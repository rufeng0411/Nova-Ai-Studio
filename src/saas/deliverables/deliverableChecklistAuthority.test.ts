import { describe, expect, it, beforeEach } from "vitest";
import {
  buildProfileAuthoritySdmSlots,
  buildWritingStyleDistillSlots,
  detectChecklistAuthorityTemplateId,
  extractDeliverableChecklistSection,
  hasSeparateWorkflowAndChecklist,
  isBrandGeoFullCaseGoal,
  parseMustDeliverClause,
  parseNumberedLinesToSlots,
  resolveAuthoritativeSdmSlots,
  resolveChecklistAuthoritySlots,
  resolveNumberedParseScope,
  shouldPreferProfileSdmSlots,
  stripNegatedDeliverableMentions,
} from "./deliverableChecklistAuthority.js";
import { sanitizePollutedPathHints } from "./deliverablePathHintSanitize.js";
import { CASE_0731_FAIL_C_NIKE_IP } from "../../../tests/fixtures/four-line-0731-nike-ip-gap.js";
import { SAAS_GROWTH_FULL_SDM_GOAL } from "../../../tests/fixtures/saas-growth-full-sdm-goal.js";
import { parseNumberedDeliverableList } from "../taskState/sessionDeliverableManifest.js";
import { mergeNumberedSlotsWithProfile } from "../taskState/mergeNumberedSlotsWithProfile.js";
import {
  WUYUTAI_GEO_COMPETITOR_GOAL,
  WUYUTAI_GEO_KEYWORD_GOAL,
  WUYUTAI_GEO_SERP_GOAL,
  WUYUTAI_INDUSTRY_GEO_GOAL,
  WUYUTAI_MKT_AI_SEO_GOAL,
} from "../../../tests/fixtures/wuyutai-0713-five-case-goals.js";

const GEO_BRAND_GOAL = [
  "帮雷蛇做品牌 GEO 全案，按阶段一次执行。",
  "1. geo-aeo-audit 审计清单。",
  "2. pd-geo：关键词 + 至少 3 个平台成稿 + optimized.md。",
  "3. geo-content-optimizer：优化 optimized.md。",
  "4. mkt-schema：schema.jsonld。",
  "5. geo-citability：引用评分报告。",
  "6. od-data-report：visibility-report.html。",
  "7. 可选：小红书草稿。",
  "",
  "标准成果清单：",
  "1. geo 全套文件",
  "2. schema.jsonld",
  "3. 可选草稿编号",
].join("\n");

describe("deliverableChecklistAuthority", () => {
  it("parses only checklist section when workflow steps precede it", () => {
    expect(hasSeparateWorkflowAndChecklist(GEO_BRAND_GOAL)).toBe(true);
    const scope = resolveNumberedParseScope(GEO_BRAND_GOAL);
    const slots = parseNumberedLinesToSlots(scope);
    expect(slots).toHaveLength(3);
    expect(slots[0]?.label).toContain("geo");
  });

  it("parseNumberedDeliverableList ignores workflow steps when checklist exists", () => {
    const slots = parseNumberedDeliverableList(GEO_BRAND_GOAL);
    expect(slots).toHaveLength(3);
  });

  it("prefers geo profile slots for brand GEO full case", () => {
    expect(isBrandGeoFullCaseGoal(GEO_BRAND_GOAL)).toBe(true);
    expect(shouldPreferProfileSdmSlots({
      profileId: "geo",
      userGoal: GEO_BRAND_GOAL,
      capabilitySlug: "pd-geo",
    })).toBe(true);
    const slots = resolveAuthoritativeSdmSlots({
      userGoal: GEO_BRAND_GOAL,
      capabilitySlug: "pd-geo",
      profileId: "geo",
      parseNumberedList: parseNumberedDeliverableList,
      mergeWithProfile: mergeNumberedSlotsWithProfile,
    });
    expect(slots.length).toBeGreaterThanOrEqual(6);
    expect(slots.some((slot) => slot.pathHint?.includes("visibility-report.html"))).toBe(true);
    expect(slots.some((slot) => slot.count === 3)).toBe(true);
  });

  it("buildProfileAuthoritySdmSlots for geo includes platform draft slot", () => {
    const slots = buildProfileAuthoritySdmSlots("geo");
    expect(slots.some((slot) => slot.id === "profile_geo_platform" && slot.count === 3)).toBe(true);
  });

  it("extractDeliverableChecklistSection returns tail after header", () => {
    const section = extractDeliverableChecklistSection(GEO_BRAND_GOAL);
    expect(section).toContain("标准成果清单");
    expect(section).not.toContain("geo-aeo-audit 审计清单");
  });

  it("stripNegatedDeliverableMentions removes PPT absence complaints but keeps real PPT goals", () => {
    const stripped = stripNegatedDeliverableMentions(
      "须交付：01-topics.md、02-longform.md。这两个内容在 PPT 里没有展示。",
    );
    expect(stripped).not.toMatch(/PPT/i);
    expect(stripped).toMatch(/01-topics\.md/);
    expect(stripNegatedDeliverableMentions("做一份周会PPT，须交付 presentation.pptx")).toMatch(/PPT/i);
    expect(stripNegatedDeliverableMentions("不要配图、不要 Word/PPT。须交付：report.html")).not.toMatch(/PPT/i);
  });

  it("parses 长文×2 with markdown kind and longform path hints", () => {
    const goal = [
      "标准成果清单：",
      "1. 策略 .md",
      "2. 长文×2",
      "3. 社媒包",
    ].join("\n");
    const slots = parseNumberedLinesToSlots(goal);
    const longform = slots.find((slot) => slot.label.includes("长文"));
    expect(longform?.count).toBe(2);
    expect(longform?.kind).toBe("markdown");
    expect(longform?.pathHints).toEqual(["02-支柱长文A", "02-支柱长文B"]);
  });

  it("parses research checklist with chart and synthesis path hints", () => {
    const goal = [
      "标准成果清单：",
      "1. 调研 .md",
      "2. 图表（Mermaid/表格）",
      "3. export_document 导出 .docx",
    ].join("\n");
    const slots = parseNumberedLinesToSlots(goal);
    expect(slots).toHaveLength(3);
    expect(slots[0]?.pathHints).toContain("01-sources-and-synthesis");
    expect(slots[1]?.pathHints).toContain("02-charts-and-data");
    expect(slots[1]?.kind).toBeUndefined();
    expect(slots[2]?.pathHints).toContain("04-report.docx");
  });

  describe("0713 吴裕泰五案 — 须交付：枚举", () => {
    it("geo-serp try prompt → serp-analysis.md/html slots", () => {
      const slots = parseMustDeliverClause(WUYUTAI_GEO_SERP_GOAL);
      expect(slots.map((s) => s.pathHint)).toEqual(["serp-analysis.md", "serp-analysis.html"]);
    });

    it("geo-keyword try prompt → keywords.md/html slots", () => {
      const slots = parseMustDeliverClause(WUYUTAI_GEO_KEYWORD_GOAL);
      expect(slots.map((s) => s.pathHint)).toEqual(["keywords.md", "keywords.html"]);
    });

    it("resolveAuthoritativeSdmSlots prefers must-deliver over geo full profile", () => {
      const slots = resolveAuthoritativeSdmSlots({
        userGoal: WUYUTAI_GEO_KEYWORD_GOAL,
        capabilitySlug: "geo-keyword-research",
        profileId: "geo",
        parseNumberedList: parseNumberedDeliverableList,
        mergeWithProfile: mergeNumberedSlotsWithProfile,
      });
      expect(slots.map((s) => s.pathHint)).toEqual(["keywords.md", "keywords.html"]);
    });

    it("open industry GEO research does not expand to geo 7-slot profile", () => {
      const slots = resolveAuthoritativeSdmSlots({
        userGoal: WUYUTAI_INDUSTRY_GEO_GOAL,
        profileId: "geo",
        parseNumberedList: parseNumberedDeliverableList,
        mergeWithProfile: mergeNumberedSlotsWithProfile,
      });
      expect(slots.some((slot) => slot.id === "profile_geo_platform")).toBe(false);
      expect(slots.length).toBeLessThan(6);
    });

    it("numbered checklist still wins for competitor analysis", () => {
      const slots = resolveAuthoritativeSdmSlots({
        userGoal: WUYUTAI_GEO_COMPETITOR_GOAL,
        capabilitySlug: "geo-competitor-analysis",
        profileId: "geo_competitor",
        parseNumberedList: parseNumberedDeliverableList,
        mergeWithProfile: mergeNumberedSlotsWithProfile,
      });
      expect(slots).toHaveLength(4);
      expect(slots[0]?.pathHint).toBe("geo-competitor-report.md");
    });

    it("mkt-ai-seo numbered + must-deliver align", () => {
      const slots = resolveAuthoritativeSdmSlots({
        userGoal: WUYUTAI_MKT_AI_SEO_GOAL,
        capabilitySlug: "mkt-ai-seo",
        profileId: "geo_visibility_audit",
        parseNumberedList: parseNumberedDeliverableList,
        mergeWithProfile: mergeNumberedSlotsWithProfile,
      });
      expect(slots).toHaveLength(4);
      expect(slots.map((s) => s.pathHint)).toContain("audit-checklist.md");
    });
  });

  describe("ES9 saas-growth-full — authority checklist wins over geo profile", () => {
    it("resolveChecklistAuthoritySlots returns 8 growth files", () => {
      const slots = resolveChecklistAuthoritySlots("saas-growth-full");
      expect(slots).toHaveLength(8);
      expect(slots.map((s) => s.pathHint)).toContain("market-research.md");
      expect(slots.map((s) => s.pathHint)).toContain("retrospective-template.md");
    });

    it("resolveAuthoritativeSdmSlots uses 8 growth slots not geo 7-slot profile", () => {
      const slots = resolveAuthoritativeSdmSlots({
        userGoal: SAAS_GROWTH_FULL_SDM_GOAL,
        capabilitySlug: "saas-growth-full",
        profileId: "geo",
        parseNumberedList: parseNumberedDeliverableList,
        mergeWithProfile: mergeNumberedSlotsWithProfile,
      });
      expect(slots).toHaveLength(8);
      expect(slots.some((slot) => slot.id.startsWith("profile_geo"))).toBe(false);
      expect(slots.map((s) => s.pathHint)).toEqual([
        "market-research.md",
        "positioning-pricing.md",
        "landing.html",
        "programmatic-seo-template.html",
        "geo-keywords.md",
        "email-sequence.md",
        "ads-plan.md",
        "retrospective-template.md",
      ]);
    });

    it("shouldPreferProfileSdmSlots is false when numbered checklist has 8 basenames", () => {
      expect(shouldPreferProfileSdmSlots({
        profileId: "geo",
        capabilitySlug: "saas-growth-full",
        userGoal: SAAS_GROWTH_FULL_SDM_GOAL,
      })).toBe(false);
    });

    it("94a83d43: Open Design launch-context + glued prose does not triplicate 8→24 slots", () => {
      const polluted = [
        SAAS_GROWTH_FULL_SDM_GOAL.replace(
          "8. retrospective-template.md",
          "8. retrospective-template.md。使用 Open Design 设计系统 `linear-app`（Linear）。必须先 read_skill open-design，写入系统分配任务目录，跳过模板问卷。",
        ),
        "",
        "[Files attached by user and available for reading in the project:]",
        "- Nova.html: [local-path-redacted]",
        "",
        '<launch-context capability="open-design">',
        "  <selections>",
        '    <field key="brief" value="' + SAAS_GROWTH_FULL_SDM_GOAL.replace(/"/g, "&quot;") + '"/>',
        "  </selections>",
        "</launch-context>",
      ].join("\n");

      const slots = resolveAuthoritativeSdmSlots({
        userGoal: polluted,
        capabilitySlug: "open-design",
        profileId: "design",
        parseNumberedList: parseNumberedDeliverableList,
        mergeWithProfile: mergeNumberedSlotsWithProfile,
      });
      expect(slots).toHaveLength(8);
      expect(slots.map((s) => s.pathHint)).toEqual([
        "market-research.md",
        "positioning-pricing.md",
        "landing.html",
        "programmatic-seo-template.html",
        "geo-keywords.md",
        "email-sequence.md",
        "ads-plan.md",
        "retrospective-template.md",
      ]);
      expect(slots.every((s) => !/Open Design|使用/i.test(s.pathHint ?? ""))).toBe(true);
    });
  });

  describe("ES9 product user research — MD+HTML dual deliverable", () => {
    const PRODUCT_RESEARCH_GOAL = [
      "须交付：product-user-research.md、带图表和风格的 HTML 报告",
      "写入系统分配任务目录",
    ].join("");

    it("parseMustDeliverClause compiles md + html with pathHints", () => {
      const slots = parseMustDeliverClause(PRODUCT_RESEARCH_GOAL);
      expect(slots.map((s) => s.pathHint)).toEqual([
        "product-user-research.md",
        "product-user-research.html",
      ]);
    });

    it("resolveAuthoritativeSdmSlots returns two frozen slots for nova research", () => {
      const slots = resolveAuthoritativeSdmSlots({
        userGoal: PRODUCT_RESEARCH_GOAL,
        capabilitySlug: "nova-research-product-user",
        parseNumberedList: parseNumberedDeliverableList,
        mergeWithProfile: mergeNumberedSlotsWithProfile,
      });
      expect(slots).toHaveLength(2);
      expect(slots[1]?.pathHint).toBe("product-user-research.html");
    });

    it("world cup product user research does not bind research-report template (3a785077 RCA)", () => {
      const goal = "用「Nova-产品用研」为【世界杯周边】写产品用户研究报告，按固定八章展开。须交付：product-user-research.md，以及 带图HTML版本。写入系统分配任务目录。";
      expect(parseMustDeliverClause(goal).map((s) => s.pathHint)).toEqual([
        "product-user-research.md",
        "product-user-research.html",
      ]);
      const slots = resolveAuthoritativeSdmSlots({
        userGoal: goal,
        capabilitySlug: "nova-research-product-user",
        parseNumberedList: parseNumberedDeliverableList,
        mergeWithProfile: mergeNumberedSlotsWithProfile,
      });
      expect(slots.map((s) => s.pathHint)).toEqual([
        "product-user-research.md",
        "product-user-research.html",
      ]);
    });
  });

  describe("ES9 geo-fast-check-hub — authority template", () => {
    beforeEach(() => {
      process.env.PILOTDECK_CHECKLIST_AUTHORITY_TEMPLATES = "1";
    });

    it("detectChecklistAuthorityTemplateId matches geo fast check goals", async () => {
      const { detectChecklistAuthorityTemplateId } = await import("./deliverableChecklistAuthority.js");
      expect(detectChecklistAuthorityTemplateId(
        "GEO 快检 keywords optimized report.html",
        "mkt-ai-seo",
      )).toBe("geo-fast-check-hub");
    });

    it("resolveChecklistAuthoritySlots returns 4 geo fast check files", () => {
      const slots = resolveChecklistAuthoritySlots("geo-fast-check-hub");
      expect(slots).toHaveLength(4);
      expect(slots.map((s) => s.pathHint)).toEqual([
        "audit-checklist.md",
        "keywords.md",
        "optimized.md",
        "report.html",
      ]);
      expect(slots[3]?.pathHints).toContain("index.html");
    });

    it("detectChecklistAuthorityTemplateId matches natural-language 快检三件套 without geo slug", async () => {
      const { detectChecklistAuthorityTemplateId } = await import("./deliverableChecklistAuthority.js");
      expect(detectChecklistAuthorityTemplateId(
        "对【雷蛇 Pro Click V2】官网产品页做 GEO 快检+关键词表+优化清单，写入系统分配任务目录。",
      )).toBe("geo-fast-check-hub");
    });

    it("detectChecklistAuthorityTemplateId matches formal research-report goals", async () => {
      const { detectChecklistAuthorityTemplateId, resolveChecklistAuthoritySlots } = await import("./deliverableChecklistAuthority.js");
      const goal = "围绕【人工智能企业 SaaS】做正式调研报告：检索→综述 md→图表→Word，三步一口气做完，报路径。";
      expect(detectChecklistAuthorityTemplateId(goal)).toBe("research-report");
      const slots = resolveChecklistAuthoritySlots("research-report");
      expect(slots.map((s) => s.pathHint)).toEqual([
        "01-sources-and-synthesis.md",
        "03-report-body.md",
        "report.docx",
      ]);
      expect(slots[2]?.pathHints).toContain("document.docx");
    });

    it("b665c75c: 须交付 single md wins over research-report pack (no docx)", () => {
      const goal =
        "用「Nova-行业市场」写【人工智能企业级agent行业】市场研究报告：规模、产业链、PEST/SWOT 与进入建议。须交付：industry-market-report.md。\n写入系统分配任务目录。";
      expect(detectChecklistAuthorityTemplateId(goal, "nova-research-industry-market")).toBeUndefined();
      const slots = resolveAuthoritativeSdmSlots({
        userGoal: goal,
        capabilitySlug: "nova-research-industry-market",
        profileId: "research",
        parseNumberedList: parseNumberedDeliverableList,
        mergeWithProfile: mergeNumberedSlotsWithProfile,
      });
      expect(slots.map((s) => s.pathHint)).toEqual(["industry-market-report.md"]);
    });

    it("cba2558f: Nova-用户研究 须交付 md only — no 01/03/docx", () => {
      const goal =
        "参考分析附件内容，用「Nova-用户研究」做八段式用户研究：画像、场景、痛点与决策因素。须交付：user-research-report.md。\n写入系统分配任务目录。";
      expect(detectChecklistAuthorityTemplateId(goal, "nova-research-user-general")).toBeUndefined();
      const slots = resolveAuthoritativeSdmSlots({
        userGoal: goal,
        capabilitySlug: "nova-research-user-general",
        profileId: "research",
        parseNumberedList: parseNumberedDeliverableList,
        mergeWithProfile: mergeNumberedSlotsWithProfile,
      });
      expect(slots.map((s) => s.pathHint)).toEqual(["user-research-report.md"]);
    });

    it("stripBindingConstraintBlockFromGoal removes HF constraint numbered lines", async () => {
      const { stripBindingConstraintBlockFromGoal, parseNumberedLinesToSlots } = await import("./deliverableChecklistAuthority.js");
      const goal = [
        "须交付：promo.mp4",
        "【硬性约束】",
        "1. 禁止 DeepSeek Gateway",
        "2. render_hyperframes()",
      ].join("\n");
      const stripped = stripBindingConstraintBlockFromGoal(goal);
      const slots = parseNumberedLinesToSlots(stripped);
      expect(slots.every((s) => !/DeepSeek|render_hyperframes/i.test(s.label ?? ""))).toBe(true);
    });

    it("a0676b9c: enrichResearchReportAuthoritySlots pathHints mutually exclusive", () => {
      const slots = resolveChecklistAuthoritySlots("research-report");
      const md1 = slots.find((s) => s.id.endsWith("_1"));
      const md2 = slots.find((s) => s.id.endsWith("_2"));
      const docx = slots.find((s) => s.id.endsWith("_3"));
      const set1 = new Set(md1?.pathHints ?? []);
      const set2 = new Set(md2?.pathHints ?? []);
      expect([...set1].some((h) => set2.has(h))).toBe(false);
      expect(set1.has("03-report-body.md")).toBe(false);
      expect(set2.has("01-sources-and-synthesis.md")).toBe(false);
      expect(docx?.pathHints).toContain("document.docx");
      expect(docx?.pathHints?.some((h) => /\.md$/i.test(h))).toBe(false);
    });

    it("0731: empty slug + Hub 须交付 still single md (no research-report)", () => {
      const goal =
        "用「Nova-行业市场」写【人工智能企业级agent行业】市场研究报告。须交付：industry-market-report.md。\n写入系统分配任务目录。";
      expect(detectChecklistAuthorityTemplateId(goal, "")).toBeUndefined();
      const slots = resolveAuthoritativeSdmSlots({
        userGoal: goal,
        capabilitySlug: "",
        parseNumberedList: parseNumberedDeliverableList,
        mergeWithProfile: mergeNumberedSlotsWithProfile,
      });
      expect(slots.map((s) => s.pathHint)).toEqual(["industry-market-report.md"]);
    });

    it("0731: distill compiles single md when DISTILL_SDM on", () => {
      const prev = process.env.PILOTDECK_DISTILL_SDM;
      process.env.PILOTDECK_DISTILL_SDM = "shadow";
      try {
        const goal =
          "请深度蒸馏【吴晓波】完整写作底层逻辑：精准复刻此人专属语感、口头禅、句式长短节奏。";
        const slots = resolveAuthoritativeSdmSlots({
          userGoal: goal,
          parseNumberedList: parseNumberedDeliverableList,
          mergeWithProfile: mergeNumberedSlotsWithProfile,
        });
        expect(slots.length).toBe(1);
        expect(slots[0]?.kind).toBe("markdown");
        expect(slots[0]?.pathHints?.some((h) => /蒸馏|distill/i.test(h))).toBe(true);
        expect(slots.some((s) => /\.docx$/i.test(s.pathHint ?? ""))).toBe(false);
      } finally {
        if (prev == null) delete process.env.PILOTDECK_DISTILL_SDM;
        else process.env.PILOTDECK_DISTILL_SDM = prev;
      }
    });

    it("0731: style-only copy without 深度蒸馏 does not bind distill", () => {
      const prev = process.env.PILOTDECK_DISTILL_SDM;
      process.env.PILOTDECK_DISTILL_SDM = "enforce";
      try {
        const goal = "请仅风格复刻吴晓波的口头禅，在对话里示范两段即可。";
        const slots = resolveAuthoritativeSdmSlots({
          userGoal: goal,
          parseNumberedList: parseNumberedDeliverableList,
          mergeWithProfile: mergeNumberedSlotsWithProfile,
        });
        expect(slots.some((s) => /writing-style-distill|蒸馏/i.test(s.id + (s.pathHint ?? "")))).toBe(false);
      } finally {
        if (prev == null) delete process.env.PILOTDECK_DISTILL_SDM;
        else process.env.PILOTDECK_DISTILL_SDM = prev;
      }
    });
  });

  describe("ES9 content-ip-launch — pathHints for strategy slot", () => {
    it("numbered 策略 .md gets pathHints not kind-only", () => {
      const goal = [
        "标准成果清单：",
        "1. 策略 .md",
        "2. newsletter .md",
      ].join("\n");
      const slots = parseNumberedLinesToSlots(goal);
      expect(slots[0]?.pathHints?.length).toBeGreaterThan(0);
    });
  });

  describe("0731-fail distill / IP pathHints", () => {
    it("0731-fail-B: non-wuxiaobo distill pathHints exclude wuxiaobo-writing-os.md", () => {
      const slots = buildWritingStyleDistillSlots(
        "请深度蒸馏【小米近两年的危机公关方法论】完整写作底层逻辑。",
      );
      const hints = slots[0]?.pathHints ?? [];
      expect(hints.some((h) => /methodology/i.test(h))).toBe(true);
      expect(hints).not.toContain("wuxiaobo-writing-os.md");
    });

    it("0731-fail-B: wuxiaobo subject keeps legacy pathHint", () => {
      const slots = buildWritingStyleDistillSlots(
        "请深度蒸馏【吴晓波】完整写作底层逻辑：精准复刻此人专属语感。",
      );
      expect(slots[0]?.pathHints).toContain("wuxiaobo-writing-os.md");
    });

    it("0731-fail-C: 策略/社媒 hints include 内容策略.md and copywriting.md", () => {
      const slots = sanitizePollutedPathHints(
        parseNumberedLinesToSlots(CASE_0731_FAIL_C_NIKE_IP.goal),
      );
      const strategy = slots.find((s) => /策略/i.test(s.label ?? ""));
      const social = slots.find((s) => /社媒/i.test(s.label ?? ""));
      expect(strategy?.pathHints).toEqual(
        expect.arrayContaining(["内容策略.md", "01-内容策略.md", "01-strategy.md", "strategy.md"]),
      );
      expect(social?.pathHints).toEqual(
        expect.arrayContaining(["copywriting.md", "社媒包.md", "03-social-slices.md", "copy-matrix.md"]),
      );
      expect(strategy?.pathHint === "策略 .md" || strategy?.pathHints?.includes("策略 .md")).toBe(false);
    });
  });

  describe("viral-article-pack authority", () => {
    beforeEach(() => {
      process.env.PILOTDECK_CHECKLIST_AUTHORITY_TEMPLATES = "1";
      process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    });

    it("slug viral-article-generator → viral-article-pack before matrix", () => {
      expect(detectChecklistAuthorityTemplateId(
        "写一篇深度长文关于 AI，含长文与选题",
        "viral-article-generator",
      )).toBe("viral-article-pack");
      expect(detectChecklistAuthorityTemplateId(
        "一文多发 humanize 五平台",
        "humanizer",
      )).toBe("one-article-matrix");
    });

    it("resolveChecklistAuthoritySlots returns 4 files with zh aliases", () => {
      const slots = resolveChecklistAuthoritySlots("viral-article-pack");
      expect(slots).toHaveLength(4);
      expect(slots.map((s) => s.pathHint)).toEqual([
        "article-brief.md",
        "article.md",
        "quotes.md",
        "channel-plan.md",
      ]);
      expect(slots[1]?.pathHints).toContain("爆款母稿.md");
    });

    it("Hub try must-deliver compiles four slots not matrix seven", () => {
      const goal = [
        "用「爆款长文生成」为【AI 编程工具】写一篇公众号气质长文。",
        "须交付：article-brief.md、article.md、quotes.md、channel-plan.md。",
        "写入系统分配任务目录。",
      ].join("\n");
      const slots = resolveAuthoritativeSdmSlots({
        userGoal: goal,
        capabilitySlug: "viral-article-generator",
        profileId: "viral_article_pack",
        parseNumberedList: parseNumberedDeliverableList,
        mergeWithProfile: mergeNumberedSlotsWithProfile,
      });
      const basenames = slots.map((s) => s.pathHint).filter(Boolean);
      expect(basenames).toEqual([
        "article-brief.md",
        "article.md",
        "quotes.md",
        "channel-plan.md",
      ]);
      expect(basenames).not.toContain("zhihu.md");
      expect(basenames).not.toContain("01-topics.md");
    });
  });

  it("negated HTML/视频 does not compile explicit dual slots", () => {
    const goal = [
      "写一个短视频口播脚本，主题：智能手表开箱 30 秒。",
      "须交付：脚本.md",
      "不要做成视频，不要 mp4，不要 HTML 录屏。",
      "直接开始做，写入系统分配任务目录。",
    ].join("\n");
    const slots = resolveAuthoritativeSdmSlots({
      userGoal: goal,
      profileId: "script-md",
      parseNumberedList: parseNumberedDeliverableList,
    });
    expect(slots.some((slot) => slot.id === "explicit_html_report")).toBe(false);
    expect(slots.some((slot) => slot.id === "explicit_video_clip")).toBe(false);
    expect(slots.some((slot) => /脚本\.md$/i.test(slot.pathHint ?? ""))).toBe(true);
  });

  it("positive HTML 报告 + 20 秒视频 still compiles dual slots", () => {
    const goal = "产出带图表 HTML 报告，并生成 20 秒 Remotion 视频";
    const slots = resolveAuthoritativeSdmSlots({
      userGoal: goal,
      parseNumberedList: parseNumberedDeliverableList,
    });
    expect(slots.some((slot) => slot.id === "explicit_html_report")).toBe(true);
    expect(slots.some((slot) => slot.id === "explicit_video_clip")).toBe(true);
  });
});
