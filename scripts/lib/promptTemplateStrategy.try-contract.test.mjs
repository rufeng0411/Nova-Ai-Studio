/**
 * PD-SAAS-FORK workbench yield P0-C: try-prompt contract density for whitelist slugs.
 * Run: node --test scripts/lib/promptTemplateStrategy.try-contract.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  finalizeHubTryPrompt,
  TRY_PROMPT_CONTRACT_V2_SLUGS,
} from "./promptTemplateStrategy.mjs";

describe("try-prompt contract v2", () => {
  const samples = [
    "od-saas-landing",
    "nova-bento-slides",
    "anth-pptx",
    "geo-keyword-research",
    "hf-hyperframes",
  ];

  for (const slug of samples) {
    it(`${slug} try-prompt includes 须交付 + basename + capability block`, () => {
      assert.ok(TRY_PROMPT_CONTRACT_V2_SLUGS.has(slug));
      const out = finalizeHubTryPrompt("请帮我完成该能力任务。", {
        slug,
        name: slug,
        majorCategory: "creation",
      });
      assert.match(out, /须交付/);
      assert.match(out, /【能力】/);
      assert.match(out, /系统分配/);
      if (slug === "od-saas-landing") assert.match(out, /index\.html/i);
      if (slug === "geo-keyword-research") assert.match(out, /keywords\.md/i);
      if (slug === "anth-pptx") assert.match(out, /presentation\.pptx/i);
      if (slug === "nova-bento-slides") assert.match(out, /deck\.bento\.html|bento/i);
      if (slug === "hf-hyperframes") assert.match(out, /promo\.mp4|缺.*Key/i);
    });
  }
});
