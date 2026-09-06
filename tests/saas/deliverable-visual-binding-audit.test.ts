import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  applyVisualBindingAuditToAcceptance,
  extractVisualReferences,
  isOfficialGradeVisualSource,
  officialAssetsFromManifest,
  runDeliverableVisualBindingAudit,
} from "../../src/saas/media/visualAssetPlatform/deliverableVisualBindingAudit.js";
import type { VisualAssetManifest } from "../../src/saas/media/visualAssetPlatform/types.js";

function buildManifest(input: {
  taskArtifactDir: string;
  assets: VisualAssetManifest["assets"];
}): VisualAssetManifest {
  return {
    version: 1,
    sessionId: "test",
    taskArtifactDir: input.taskArtifactDir,
    goalVersion: 1,
    sourceUrls: [],
    updatedAt: new Date().toISOString(),
    assets: input.assets.map((asset, index) => ({
      assetId: `va_${index}`,
      recommendedTier: "none",
      role: "product_hero",
      provenance: {},
      processingStatus: "ok",
      ...asset,
    })),
    slotBindings: {},
    phase: "phase_b",
    autoDiscoverTriggered: true,
    errors: [],
  };
}

describe("deliverableVisualBindingAudit", () => {
  it("filters official-grade manifest sources", () => {
    expect(isOfficialGradeVisualSource("official_fetch")).toBe(true);
    expect(isOfficialGradeVisualSource("generate_image")).toBe(false);
    const manifest = buildManifest({
      taskArtifactDir: "artifacts/task-a",
      assets: [
        { source: "official_fetch", rawPath: "artifacts/task-a/a.jpg" },
        { source: "generate_image", rawPath: "artifacts/task-a/b.jpg" },
      ],
    });
    expect(officialAssetsFromManifest(manifest)).toHaveLength(1);
  });

  it("detects manifest path references in HTML", () => {
    const refs = extractVisualReferences('<img src="assets/raw/hero.jpg">');
    expect(refs).toEqual(["assets/raw/hero.jpg"]);
  });

  it("marks placeholder HTML as needs_repair when official assets exist", async () => {
    process.env.PILOTDECK_VISUAL_ASSET_PLATFORM = "shadow";
    process.env.PILOTDECK_VISUAL_BINDING_AUDIT = "enforce";
    const root = await mkdtemp(path.join(os.tmpdir(), "vap-binding-"));
    const relHtml = "artifacts/task-demo/index.html";
    const absHtml = path.join(root, relHtml);
    await mkdir(path.dirname(absHtml), { recursive: true });
    await writeFile(absHtml, '<img src="assets/placeholder.svg">', "utf8");
    const manifest = buildManifest({
      taskArtifactDir: "artifacts/task-demo",
      assets: [{
        source: "official_fetch",
        rawPath: "artifacts/task-demo/assets/raw/hero.jpg",
      }],
    });
    const audit = await runDeliverableVisualBindingAudit({
      cwd: root,
      verifiedPaths: [relHtml],
      taskArtifactDir: "artifacts/task-demo",
      officialMediaRequired: true,
      manifest,
    });
    expect(audit?.passed).toBe(false);
    expect(audit?.failures[0]?.code).toBe("visual_asset.unbound_in_deliverable");
  });

  it("fails partial bind when official img remains under placeholder overlay", async () => {
    process.env.PILOTDECK_VISUAL_BINDING_AUDIT = "enforce";
    const root = await mkdtemp(path.join(os.tmpdir(), "vap-binding-partial-"));
    const relHtml = "artifacts/task-demo/index.html";
    const absHtml = path.join(root, relHtml);
    await mkdir(path.dirname(absHtml), { recursive: true });
    await writeFile(
      absHtml,
      '<img src="assets/raw/hero.jpg"><div class="img-placeholder"><span>图源待补</span></div>',
      "utf8",
    );
    const manifest = buildManifest({
      taskArtifactDir: "artifacts/task-demo",
      assets: [{
        source: "official_fetch",
        rawPath: "artifacts/task-demo/assets/raw/hero.jpg",
      }],
    });
    const audit = await runDeliverableVisualBindingAudit({
      cwd: root,
      verifiedPaths: [relHtml],
      taskArtifactDir: "artifacts/task-demo",
      officialMediaRequired: true,
      manifest,
    });
    expect(audit?.passed).toBe(false);
    expect(audit?.failures[0]?.message).toMatch(/占位/);
  });

  it("applyVisualBindingAuditToAcceptance enforces repair in enforce mode", () => {
    const applied = applyVisualBindingAuditToAcceptance({
      audit: {
        passed: false,
        officialAssetCount: 2,
        boundPathCount: 0,
        failures: [{
          code: "visual_asset.unbound_in_deliverable",
          deliverablePath: "artifacts/task-a/index.html",
          message: "placeholder",
        }],
        shadowOnly: false,
        ladderExhausted: false,
      },
      failures: [],
      acceptance: "passed",
    });
    expect(applied.acceptance).toBe("needs_repair");
    expect(applied.failures.length).toBeGreaterThan(0);
  });
});

describe("detectVisualCorrectionMutation", () => {
  it("matches 配图不对 without 改为/禁止", async () => {
    const { detectVisualCorrectionMutation } = await import(
      "../../src/saas/taskState/detectGoalMutation.js"
    );
    const result = detectVisualCorrectionMutation("配图不对，其他没问题");
    expect(result?.visualCorrection).toBe(true);
    expect(result?.qualityOnly).toBe(true);
  });
});
