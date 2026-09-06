import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { validateEngineDeliverables, validateNovaImageSlideDeckForTest } from "../../src/agent/deliverables/validateDeliverablesEngine.js";
import {
  appendResearchSource,
  createEmptyResearchSourceLedger,
} from "../../src/saas/research/researchSourceLedger.js";

describe("validateDeliverablesEngine content quality", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "pilotdeck-content-quality-"));
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    process.env.PILOTDECK_CONTENT_QUALITY_V2 = "shadow";
    process.env.PILOTDECK_OFFICIAL_MEDIA_V2 = "off";
  });

  afterEach(async () => {
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
    delete process.env.PILOTDECK_CONTENT_QUALITY_V2;
    delete process.env.PILOTDECK_OFFICIAL_MEDIA_V2;
    await rm(cwd, { recursive: true, force: true });
  });

  it("requires exact Nova slide page count and slide-NN filenames", async () => {
    const deckDir = join(cwd, "artifacts", "slides-g700");
    await mkdir(deckDir, { recursive: true });
    const manifest = {
      page_count: 6,
      pages: Array.from({ length: 6 }, (_value, index) => ({
        image_path: `slide-${String(index + 1).padStart(2, "0")}.png`,
      })),
    };
    await writeFile(join(deckDir, "slide-manifest.json"), JSON.stringify(manifest), "utf8");
    for (let index = 1; index <= 6; index += 1) {
      await writeFile(
        join(deckDir, `slide-${String(index).padStart(2, "0")}.png`),
        Buffer.from([137, 80, 78, 71, index]),
      );
    }

    const pass = await validateEngineDeliverables({
      cwd,
      messages: [],
      userGoal: "做 6 页 Nova 美学幻灯",
      capabilitySlug: "nova-ppt-aesthetic-slides",
      sessionManifest: {
        version: 1,
        goalVersion: 1,
        slots: [{
          id: "slides",
          slotId: "slides",
          label: "slides",
          required: true,
          kind: "file",
          pathHints: ["slide-manifest.json"],
          status: "active",
        }],
        taskArtifactDir: "artifacts/slides-g700",
      } as never,
    });
    expect(pass?.verified.some((pathValue) => pathValue.endsWith("slide-manifest.json"))).toBe(true);

    await writeFile(join(deckDir, "slide-07.png"), Buffer.from([137, 80, 78, 71]), "utf8");
    manifest.pages.push({ image_path: "slide-07.png" });
    manifest.page_count = 7;
    await writeFile(join(deckDir, "slide-manifest.json"), JSON.stringify(manifest), "utf8");

    const excessCheck = await validateNovaImageSlideDeckForTest({
      cwd,
      candidatePaths: new Set(["artifacts/slides-g700/slide-manifest.json"]),
      userGoal: "做 6 页 Nova 美学幻灯",
    });
    expect(excessCheck.failures.some((failure) =>
      failure.reason === "count_excess" || failure.message.includes("超过要求"),
    )).toBe(true);
  });

  it("records product research source ledger evidence for shadow checks", async () => {
    const taskDir = join(cwd, "artifacts", "task-research");
    await mkdir(taskDir, { recursive: true });
    let ledger = createEmptyResearchSourceLedger();
    for (let index = 0; index < 3; index += 1) {
      ledger = appendResearchSource({
        ledger,
        kind: "web_fetch",
        canonicalUrl: `https://brand.example/${index}`,
        content: `鸣镝 G700 用户研究来源 ${index} `.repeat(8),
        subjectAnchor: "鸣镝 G700",
        accepted: true,
      }).ledger;
    }
    await writeFile(
      join(taskDir, "research-source-ledger.json"),
      JSON.stringify(ledger),
      "utf8",
    );
    await writeFile(
      join(taskDir, "product-user-research.md"),
      "# 用户画像\n\n".repeat(20),
      "utf8",
    );

    const result = await validateEngineDeliverables({
      cwd,
      messages: [],
      userGoal: "为鸣镝 G700 写产品用户研究报告，固定八章",
      capabilitySlug: "nova-research-product-user",
      sessionManifest: {
        version: 1,
        goalVersion: 1,
        slots: [{
          slotId: "report",
          label: "报告",
          required: true,
          kind: "markdown",
          pathHints: ["product-user-research.md"],
        }],
        taskArtifactDir: "artifacts/task-research",
      } as never,
      qualityContract: {
        contractVersion: 1,
        subjectAnchor: "鸣镝 G700",
        subjectAliases: ["鸣镝G700"],
        exactQuantityAssertions: [{ unit: "chapter", exact: 8 }],
        officialMediaPolicy: "none",
        allowedSourceTiers: [],
        allowPlaceholders: false,
        forbidGenerateImage: false,
      },
    });
    expect(result).not.toBeNull();
  });
});
