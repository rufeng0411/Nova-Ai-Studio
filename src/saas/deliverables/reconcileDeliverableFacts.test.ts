import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  dedupeVerifiedBrokenOverlap,
  novaDeckCompletePass,
  reconcileDeliverableFacts,
  satisfyPresentationPptxAlias,
  sanitizeMalformedRepairPaths,
  filterPptIntermediateBroken,
  campaignPhaseCompletePass,
  reanchorCampaignSlotPaths,
  markCampaignStageSatisfied,
} from "./reconcileDeliverableFacts.js";
import { resolveProfile } from "../deliverableCapabilityProfiles.js";

describe("reconcileDeliverableFacts", () => {
  const prevMissing = process.env.PILOTDECK_MISSING_REANCHOR;
  const prevAlias = process.env.PILOTDECK_PPTX_BASENAME_ALIAS;
  const prevNova = process.env.PILOTDECK_NOVA_SVG_DEGRADE;

  beforeEach(() => {
    process.env.PILOTDECK_MISSING_REANCHOR = "1";
    process.env.PILOTDECK_PPTX_BASENAME_ALIAS = "1";
    process.env.PILOTDECK_NOVA_SVG_DEGRADE = "1";
  });

  afterEach(() => {
    if (prevMissing == null) delete process.env.PILOTDECK_MISSING_REANCHOR;
    else process.env.PILOTDECK_MISSING_REANCHOR = prevMissing;
    if (prevAlias == null) delete process.env.PILOTDECK_PPTX_BASENAME_ALIAS;
    else process.env.PILOTDECK_PPTX_BASENAME_ALIAS = prevAlias;
    if (prevNova == null) delete process.env.PILOTDECK_NOVA_SVG_DEGRADE;
    else process.env.PILOTDECK_NOVA_SVG_DEGRADE = prevNova;
  });

  it("identity: empty input passes through", async () => {
    const profile = resolveProfile(undefined, undefined, "test");
    const out = await reconcileDeliverableFacts({
      cwd: os.tmpdir(),
      verified: [],
      missing: [],
      broken: [],
      failures: [],
      userGoal: "test",
      profile,
    });
    expect(out.missing).toEqual([]);
    expect(out.broken).toEqual([]);
  });

  it("G1 b2721bdd: real pptx satisfies presentation.pptx missing", () => {
    const missing = satisfyPresentationPptxAlias({
      missing: ["artifacts/slides/thunderobot-laptop/presentation.pptx"],
      verified: ["artifacts/slides/thunderobot-laptop/thunderobot-laptop.pptx"],
    });
    expect(missing).toEqual([]);
  });

  it("G3 dedupeVerifiedBrokenOverlap drops broken when verified exists on disk", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "rog-dedupe-"));
    const rel = "artifacts/slides-deck/slide-01.png";
    const abs = path.join(root, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, Buffer.alloc(128, 1));
    const broken = await dedupeVerifiedBrokenOverlap({
      cwd: root,
      verified: [rel],
      broken: [rel],
    });
    expect(broken).toEqual([]);
  });

  it("G3 novaDeckCompletePass clears deck gaps when manifest + pages ok", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "rog-nova-"));
    const deckDir = "artifacts/slides-thunder-abc123";
    const manifestPath = `${deckDir}/slide-manifest.json`;
    const pages = [1, 2, 3, 4, 5, 6].map((n) => ({
      image_path: `slide-${String(n).padStart(2, "0")}.png`,
    }));
    await fs.mkdir(path.join(root, deckDir), { recursive: true });
    await fs.writeFile(
      path.join(root, manifestPath),
      JSON.stringify({ pages, aspect_ratio: "16:9" }),
    );
    for (const page of pages) {
      const png = path.join(root, deckDir, page.image_path);
      await fs.writeFile(png, Buffer.alloc(256, 2));
    }
    const goal = "用「Nova-美学幻灯」把【雷神笔记本主题 + 6页数 + 产品展示】";
    const result = await novaDeckCompletePass({
      cwd: root,
      userGoal: goal,
      capabilitySlug: "nova-ppt-aesthetic-slides",
      verified: [manifestPath, ...pages.map((p) => `${deckDir}/${p.image_path}`)],
      missing: [],
      broken: pages.map((p) => `${deckDir}/${p.image_path}`),
    });
    expect(result.broken).toEqual([]);
    expect(result.failuresDropped).toBe(true);
  });

  it("nova-slide-deck profile resolves before generic ppt", () => {
    const profile = resolveProfile(
      "nova-ppt-aesthetic-slides",
      undefined,
      "Nova-美学幻灯 6页",
    );
    expect(profile.id).toBe("nova-slide-deck");
  });

  it("PR-C2 433ce25a: sanitizeMalformedRepairPaths drops backticks", () => {
    const out = sanitizeMalformedRepairPaths([
      "`artifacts/social/copy.md`",
      "copy.md",
      "artifacts/social/copywriting.md",
    ]);
    expect(out).toEqual(["artifacts/social/copywriting.md"]);
  });

  it("PR-C3 4a9605af: filterPptIntermediateBroken clears slide PNG", () => {
    const broken = filterPptIntermediateBroken({
      broken: [
        "artifacts/slides/wuyutai/slide-01/page-01.png",
        "artifacts/slides/wuyutai/s0-layout.png",
      ],
      verified: ["artifacts/slides/wuyutai/wuyutai-2026.pptx"],
      profileId: "ppt-master",
      userGoal: "原生可编辑 PPT",
    });
    expect(broken).toEqual([]);
  });

  it("PR-T2 f8795d13: campaignPhaseCompletePass clears PNG with HTML sibling", () => {
    const result = campaignPhaseCompletePass({
      userGoal: "帮【吴裕泰】做品牌传播 campaign 全案，按阶段一次规划执行",
      verified: [
        "artifacts/campaign/wuyutai/01-research.md",
        "artifacts/campaign/wuyutai/03-brief.md",
        "artifacts/campaign/wuyutai/06-platform-content.md",
        "artifacts/campaign/wuyutai/04-visual-kv.html",
        "artifacts/campaign/wuyutai/05-website/index.html",
      ],
      missing: ["artifacts/campaign/wuyutai/04-visual-kv.png"],
      broken: ["artifacts/campaign/wuyutai/04-visual-kv.png"],
    });
    expect(result.missing).toEqual([]);
    expect(result.broken).toEqual([]);
    expect(result.degraded).toBe(true);
  });

  it("reanchorCampaignSlotPaths expands bare brief.md under campaign dir", () => {
    const missing = reanchorCampaignSlotPaths({
      missing: ["brief.md"],
      verified: ["artifacts/campaign-wuyutai/03-brief.md"],
      userGoal: "帮【吴裕泰】做品牌传播 campaign 全案，按阶段一次规划执行",
      sessionManifest: {
        manifestVersion: 1,
        goalVersion: 1,
        sessionGoalAnchor: "campaign",
        slots: [{ id: "brief", label: "brief", pathHint: "brief.md", status: "active" }],
      },
    });
    expect(missing[0]).toBe("artifacts/campaign-wuyutai/brief.md");
  });

  it("markCampaignStageSatisfied clears gaps for satisfied research stage", () => {
    const result = markCampaignStageSatisfied({
      userGoal: "帮【吴裕泰】做品牌传播 campaign 全案，按阶段一次规划执行",
      verified: ["artifacts/campaign/wuyutai/01-research.md"],
      missing: ["artifacts/campaign/wuyutai/01-research.md"],
      broken: [],
    });
    expect(result.missing).toEqual([]);
  });
});
