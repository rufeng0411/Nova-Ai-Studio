import { describe, expect, it, beforeEach } from "vitest";



import { SAAS_GROWTH_FULL_SDM_GOAL } from "./fixtures/saas-growth-full-sdm-goal";

import { ES9_PRODUCT_RESEARCH_HTML_GOAL } from "./fixtures/es9-product-research-html-case";

import { ES9_FOUR_FORMAT_VAP_GOAL } from "./fixtures/es9-four-format-vap-case";

import {
  detectClarificationNeeded,
  isOfficeDeliverablePackGoal,
} from "../src/saas/clarificationGate";

import { ES9_GEO_FAST_CHECK_GOAL } from "./fixtures/es9-geo-fast-check-goal";

import { ES9_PRODUCT_LAUNCH_GOAL } from "./fixtures/es9-product-launch-goal";

import { ES9_CONTENT_IP_LAUNCH_GOAL } from "./fixtures/es9-content-ip-launch-goal";

import {

  compileSessionDeliverableManifest,

} from "../src/saas/taskState/sessionDeliverableManifest";

import {

  detectChecklistAuthorityTemplateId,

  resolveAuthoritativeSdmSlots,

} from "../src/saas/deliverables/deliverableChecklistAuthority";

import { resolvePipelineValidationSettled } from "../ui/src/shared/resolvePipelineValidationSettled";

import { slotSatisfiedByValidation } from "../src/saas/deliverables/sdmSlotMatching.js";



export const ES9_FIVE_CASES = [

  {

    id: "case1-saas-growth-full",

    goal: SAAS_GROWTH_FULL_SDM_GOAL,

    expectSlotCount: 8,

    expectProfileNotGeo: true,

  },

  {

    id: "case2-product-research-html",

    goal: ES9_PRODUCT_RESEARCH_HTML_GOAL,

    expectSlotCount: 2,

    expectHtmlBasename: "product-user-research.html",

  },

  {

    id: "case3-four-format-vap",

    goal: ES9_FOUR_FORMAT_VAP_GOAL,

    expectSettledWhenPassed: true,

  },

  {

    id: "case4-geo-fast-check",

    goal: ES9_GEO_FAST_CHECK_GOAL,

    capabilitySlug: "mkt-ai-seo",

    expectTemplateId: "geo-fast-check-hub",

    expectSlotCount: 4,

  },

  {

    id: "case5-product-launch",

    goal: ES9_PRODUCT_LAUNCH_GOAL,

    capabilitySlug: "product-launch-full",

    expectTemplateId: "product-launch-full",

    expectProfileNotSocialMatrix: true,

  },

  {

    id: "case6-content-ip",

    goal: ES9_CONTENT_IP_LAUNCH_GOAL,

    capabilitySlug: "content-ip-launch",

    expectTemplateId: "content-ip-launch",

    expectStrategyPathHints: true,

  },

] as const;



describe("es9 five-case replay fixtures", () => {

  beforeEach(() => {

    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";

    process.env.PILOTDECK_SDM_PARSE_MUST_DELIVER = "1";

    process.env.PILOTDECK_CHECKLIST_AUTHORITY_TEMPLATES = "1";

    process.env.PILOTDECK_SDM_HTML_REPORT_ALIAS = "1";

  });



  it("Case1 compiles 8 non-geo slots for saas-growth-full", () => {

    const slots = resolveAuthoritativeSdmSlots({

      userGoal: SAAS_GROWTH_FULL_SDM_GOAL,

      capabilitySlug: "saas-growth-full",

    });

    expect(slots.length).toBe(8);

    const manifest = compileSessionDeliverableManifest({

      userGoal: SAAS_GROWTH_FULL_SDM_GOAL,

      capabilitySlug: "saas-growth-full",

      turnId: "t1",

    });

    expect(manifest?.profileId).not.toBe("geo");

  });



  it("Case2 compiles MD+HTML pair slots with report.html alias hints", () => {

    const manifest = compileSessionDeliverableManifest({

      userGoal: ES9_PRODUCT_RESEARCH_HTML_GOAL,

      capabilitySlug: "nova-research-product-user",

      turnId: "t1",

    });

    const htmlSlot = manifest?.slots.find((slot) =>
      slot.pathHint?.endsWith(".html")
      || slot.pathHints?.some((hint) => hint.endsWith(".html")),
    );

    expect(htmlSlot?.pathHints).toContain("report.html");

  });



  it("Case3 export settled when acceptance passed + shadow cert", () => {

    const settled = resolvePipelineValidationSettled({

      latestTurnAcceptanceMeta: {

        acceptanceStatus: "passed",

        finality: "complete",

      },

      diskSnapshotComplete: false,

      settledAcceptanceAuthority: true,

      certificateUiEnabled: true,

      certificateComplete: false,

      certificateEnforce: false,

    });

    expect(settled).toBe(true);

  });

  it("Case3 four-format compiles office-export parallelGroup slots", () => {
    const manifest = compileSessionDeliverableManifest({
      userGoal: ES9_FOUR_FORMAT_VAP_GOAL,
      turnId: "t1",
    });
    const exportSlots = manifest?.slots.filter((s) => s.parallelGroup === "office-export") ?? [];
    expect(exportSlots.length).toBeGreaterThanOrEqual(2);
  });

  it("Case3 four-format skips page-count clarification (ES9 RCA)", () => {
    const shortGoal = [
      "为【蔚来 ES9】撰写万里越雄关复盘报告，须使用官方或权威配图。",
      "须交付：report.md、PDF、Word、PPT 四种格式，写入系统分配任务目录。",
    ].join("\n");
    expect(isOfficeDeliverablePackGoal(shortGoal)).toBe(true);
    expect(
      detectClarificationNeeded({
        userGoal: shortGoal,
        missingPageCount: true,
        missingTopic: false,
        hasAttachments: false,
      }).needed,
    ).toBe(false);
  });



  it("Case4 geo-fast-check uses authority template with 4 slots", () => {

    expect(detectChecklistAuthorityTemplateId(ES9_GEO_FAST_CHECK_GOAL, "mkt-ai-seo"))

      .toBe("geo-fast-check-hub");

    const manifest = compileSessionDeliverableManifest({

      userGoal: ES9_GEO_FAST_CHECK_GOAL,

      capabilitySlug: "mkt-ai-seo",

      turnId: "t1",

    });

    const slots = manifest?.slots.filter(

      (slot) => slot.status !== "removed" && slot.id !== "universal_data_sources",

    ) ?? [];

    expect(slots.length).toBe(4);

    expect(slots.map((s) => s.pathHint)).toContain("report.html");

  });



  it("Case5 product-launch avoids social_matrix profile hijack", () => {

    const manifest = compileSessionDeliverableManifest({

      userGoal: ES9_PRODUCT_LAUNCH_GOAL,

      capabilitySlug: "product-launch-full",

      turnId: "t1",

    });

    expect(manifest?.profileId).not.toBe("social_matrix");

    const landing = manifest?.slots.find((slot) =>

      slot.pathHint?.includes("landing.html") || slot.label.includes("landing"),

    );

    expect(landing).toBeTruthy();

  });



  it("Case6 content-ip strategy slot has pathHints and rejects kind-only social md", () => {

    const slots = resolveAuthoritativeSdmSlots({

      userGoal: ES9_CONTENT_IP_LAUNCH_GOAL,

      capabilitySlug: "content-ip-launch",

    });

    const strategy = slots.find((slot) => slot.label.includes("策略"));

    expect(strategy?.pathHints?.length).toBeGreaterThan(0);

    const satisfied = slotSatisfiedByValidation(

      strategy!,

      ["artifacts/task-20260722-a7a1f199/03-social-matrix.md"],

      { taskArtifactDir: "artifacts/task-20260722-a7a1f199" },

    );

    expect(satisfied).toBe(false);

  });

});

