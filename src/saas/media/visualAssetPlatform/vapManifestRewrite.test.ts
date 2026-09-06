import { describe, expect, it } from "vitest";
import path from "node:path";

import {
  applyVapManifestRewriteBeforeWrite,
  rewriteDeliverableVisualRefs,
  validateVisualRefsExistOnDisk,
} from "./vapManifestRewrite.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");
const SESSION_DOWNLOADS = "tests/fixtures/visual-deliverable-core/artifacts/sessions/fixture-session/downloads";
const CORE_BOUND_DIR = "tests/fixtures/visual-deliverable-core/core-bound";
const CORE_BOUND_HTML = `${CORE_BOUND_DIR}/index.html`;
const HERO_DOWNLOAD = `${SESSION_DOWNLOADS}/hero.jpg`;

describe("vapManifestRewrite", () => {
  it("rewrites missing refs to manifest relative paths", () => {
    const manifest = {
      version: 1 as const,
      sessionId: "test",
      taskArtifactDir: CORE_BOUND_DIR,
      goalVersion: 1,
      sourceUrls: [],
      updatedAt: "2026-07-19T00:00:00.000Z",
      assets: [
        {
          assetId: "hero-1",
          source: "official_fetch" as const,
          rawPath: HERO_DOWNLOAD,
          recommendedTier: "none" as const,
          role: "product_hero" as const,
          provenance: {},
          processingStatus: "ok" as const,
        },
      ],
      slotBindings: {},
      phase: "idle" as const,
      autoDiscoverTriggered: false,
      errors: [],
    };
    const brokenHtml = `<img src="assets/missing.png" alt="x"/>`;
    const result = rewriteDeliverableVisualRefs({
      content: brokenHtml,
      filePath: CORE_BOUND_HTML,
      workspaceRoot: REPO_ROOT,
      manifest,
    });
    expect(result.content).toMatch(/sessions\/fixture-session\/downloads\/hero\.jpg/);
    expect(result.rewritten).toBeGreaterThan(0);
  });

  it("rewrites external http refs to manifest relative paths", () => {
    const manifest = {
      version: 1 as const,
      sessionId: "test",
      taskArtifactDir: CORE_BOUND_DIR,
      goalVersion: 1,
      sourceUrls: [],
      updatedAt: "2026-07-19T00:00:00.000Z",
      assets: [
        {
          assetId: "hero-1",
          source: "official_fetch" as const,
          rawPath: HERO_DOWNLOAD,
          recommendedTier: "none" as const,
          role: "product_hero" as const,
          provenance: { sourceUrl: "https://cdn.example.com/hero.jpg" },
          processingStatus: "ok" as const,
        },
      ],
      slotBindings: {},
      phase: "idle" as const,
      autoDiscoverTriggered: false,
      errors: [],
    };
    const brokenMd = "![hero](https://cdn.example.com/hero.jpg)";
    const result = rewriteDeliverableVisualRefs({
      content: brokenMd,
      filePath: `${CORE_BOUND_DIR}/report.md`,
      workspaceRoot: REPO_ROOT,
      manifest,
    });
    expect(result.content).not.toContain("https://cdn.example.com/hero.jpg");
    expect(result.rewritten).toBeGreaterThan(0);
  });

  it("validates refs exist on disk for core-bound fixture", async () => {
    const ok = await validateVisualRefsExistOnDisk({
      content: '<img src="../artifacts/sessions/fixture-session/downloads/hero.jpg"/>',
      filePath: CORE_BOUND_HTML,
      workspaceRoot: REPO_ROOT,
    });
    expect(ok.ok).toBe(true);

    const missing = await validateVisualRefsExistOnDisk({
      content: '<img src="assets/missing.png"/>',
      filePath: CORE_BOUND_HTML,
      workspaceRoot: REPO_ROOT,
    });
    expect(missing.ok).toBe(false);
    expect(missing.missing).toContain("assets/missing.png");
  });

  it("applyVapManifestRewriteBeforeWrite fixes broken src before write", async () => {
    const result = await applyVapManifestRewriteBeforeWrite({
      workspaceRoot: REPO_ROOT,
      taskArtifactDir: CORE_BOUND_DIR,
      sessionId: "test",
      filePath: CORE_BOUND_HTML,
      content: '<img src="assets/missing.png"/>',
      officialMediaRequired: true,
    });
    expect(result.ok).toBe(true);
    expect(result.content).toMatch(/sessions\/fixture-session\/downloads\/hero\.jpg/);
    expect(result.rewritten).toBeGreaterThan(0);
  });
});
