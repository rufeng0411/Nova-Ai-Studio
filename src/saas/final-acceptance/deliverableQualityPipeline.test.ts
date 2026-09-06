import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { SessionGoalQualityContract } from "../constraints/goalQualityContract.js";
import {
  appendAssetProvenanceEntry,
} from "../media/assetProvenanceLedger.js";
import {
  buildOfficialMediaPlaceholder,
} from "../media/officialMediaPlaceholder.js";
import { runDeliverableQualityPipeline } from "./deliverableQualityPipeline.js";

const TASK_DIR = "artifacts/task-quality";
const HTML_PATH = `${TASK_DIR}/index.html`;

function contract(
  overrides: Partial<SessionGoalQualityContract> = {},
): SessionGoalQualityContract {
  return {
    contractVersion: 1,
    subjectAnchor: "鸣镝 G700",
    subjectAliases: ["鸣镝G700"],
    exactQuantityAssertions: [{ unit: "page", exact: 2 }],
    officialMediaPolicy: "none",
    allowedSourceTiers: [],
    allowPlaceholders: true,
    forbidGenerateImage: false,
    ...overrides,
  };
}

describe("deliverable quality pipeline", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "pilotdeck-quality-pipeline-"));
    await mkdir(join(cwd, "artifacts", "task-quality"), {
      recursive: true,
    });
    process.env.PILOTDECK_CONTENT_QUALITY_V2 = "enforce";
    process.env.PILOTDECK_OFFICIAL_MEDIA_V2 = "off";
  });

  afterEach(async () => {
    delete process.env.PILOTDECK_CONTENT_QUALITY_V2;
    delete process.env.PILOTDECK_OFFICIAL_MEDIA_V2;
    delete process.env.PILOTDECK_QUALITY_ACCEPT;
    delete process.env.PILOTDECK_COMPOSITE_SLOT_QUALITY;
    await rm(cwd, { recursive: true, force: true });
  });

  it("passes matching subject and exact page assertions", async () => {
    const html = [
      "<!doctype html><html><body>",
      "<section>鸣镝 G700 产品概览</section>",
      "<section>鸣镝 G700 用户洞察</section>",
      "</body></html>",
    ].join("");
    await writeFile(join(cwd, ...HTML_PATH.split("/")), html, "utf8");

    const result = await runDeliverableQualityPipeline({
      cwd,
      scopeDir: TASK_DIR,
      verifiedPaths: [HTML_PATH],
      candidates: [{
        path: HTML_PATH,
        kind: "html",
        exists: true,
        sizeBytes: html.length,
        textPreview: html,
      }],
      qualityContract: contract(),
      qualityContractHash: "qgc1:test",
      contentQualityEnforce: true,
    });

    expect(result.qualityCompletion).toBe("passed");
    expect(result.enforcedQualityCompletion).toBe("passed");
    expect(result.qualityFailures).toEqual([]);
    expect(result.qualityEvidenceHash).toMatch(/^qev1:[a-f0-9]{64}$/);
  });

  it("reports a repairable subject failure without changing the frozen contract", async () => {
    const html = [
      "<!doctype html><html><body>",
      "<section>无关产品概览</section>",
      "<section>无关产品洞察</section>",
      "</body></html>",
    ].join("");
    await writeFile(join(cwd, ...HTML_PATH.split("/")), html, "utf8");

    const result = await runDeliverableQualityPipeline({
      cwd,
      scopeDir: TASK_DIR,
      verifiedPaths: [HTML_PATH],
      candidates: [{
        path: HTML_PATH,
        kind: "html",
        exists: true,
        sizeBytes: html.length,
        textPreview: html,
      }],
      qualityContract: contract(),
      qualityContractHash: "qgc1:test",
      contentQualityEnforce: true,
    });

    expect(result.qualityCompletion).toBe("needs_repair");
    expect(result.enforcedQualityCompletion).toBe("needs_repair");
    expect(result.qualityFailures).toContainEqual(
      expect.objectContaining({
        checkId: "content.subject_anchor",
        repairable: true,
      }),
    );
  });

  it("changes quality evidence hash when a verified output changes", async () => {
    const first = "<!doctype html><html><body><section>鸣镝 G700 A</section><section>鸣镝 G700 B</section></body></html>";
    await writeFile(join(cwd, ...HTML_PATH.split("/")), first, "utf8");
    const input = {
      cwd,
      scopeDir: TASK_DIR,
      verifiedPaths: [HTML_PATH],
      candidates: [{
        path: HTML_PATH,
        kind: "html" as const,
        exists: true,
        sizeBytes: first.length,
        textPreview: first,
      }],
      qualityContract: contract(),
      qualityContractHash: "qgc1:test",
      contentQualityEnforce: true,
    };
    const before = await runDeliverableQualityPipeline(input);

    const second = first.replace(" A", " C");
    await writeFile(join(cwd, ...HTML_PATH.split("/")), second, "utf8");
    const after = await runDeliverableQualityPipeline({
      ...input,
      candidates: [{
        ...input.candidates[0],
        sizeBytes: second.length,
        textPreview: second,
      }],
    });

    expect(after.qualityEvidenceHash).not.toBe(before.qualityEvidenceHash);
  });

  it("observes content failures in shadow without enforcing them", async () => {
    process.env.PILOTDECK_CONTENT_QUALITY_V2 = "shadow";
    const html = "<!doctype html><html><body><section>A</section></body></html>";
    await writeFile(join(cwd, ...HTML_PATH.split("/")), html, "utf8");

    const result = await runDeliverableQualityPipeline({
      cwd,
      scopeDir: TASK_DIR,
      verifiedPaths: [HTML_PATH],
      candidates: [{
        path: HTML_PATH,
        kind: "html",
        exists: true,
        sizeBytes: html.length,
        textPreview: html,
      }],
      qualityContract: contract(),
      qualityContractHash: "qgc1:test",
    });

    expect(result.qualityCompletion).toBe("needs_repair");
    expect(result.enforcedQualityCompletion).toBe("not_applicable");
  });

  it("enforces official provenance independently when content quality is off", async () => {
    process.env.PILOTDECK_CONTENT_QUALITY_V2 = "off";
    process.env.PILOTDECK_OFFICIAL_MEDIA_V2 = "enforce";
    const bytes = Buffer.from("official-image-fixture");
    const assetPath = `${TASK_DIR}/assets/hero.png`;
    await mkdir(join(cwd, "artifacts", "task-quality", "assets"), {
      recursive: true,
    });
    await writeFile(join(cwd, ...assetPath.split("/")), bytes);
    await appendAssetProvenanceEntry({
      taskRoot: join(cwd, "artifacts", "task-quality"),
      entry: {
        candidateId: "candidate-1",
        localPath: assetPath,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        assetUrlHash: "b".repeat(64),
        sourcePage: "https://brand.example/products/g700",
        sourceLevel: "L0",
        sourceTier: "brand_official",
        mimeType: "image/png",
        width: 1600,
        height: 900,
        bytes: bytes.length,
        fetchedAt: "2026-07-19T00:00:00.000Z",
      },
    });

    const result = await runDeliverableQualityPipeline({
      cwd,
      scopeDir: TASK_DIR,
      verifiedPaths: [assetPath],
      candidates: [{
        path: assetPath,
        kind: "image",
        exists: true,
        sizeBytes: bytes.length,
      }],
      qualityContract: contract({
        subjectAnchor: undefined,
        subjectAliases: [],
        exactQuantityAssertions: [],
        officialMediaPolicy: "official_only",
        allowedSourceTiers: ["brand_official"],
        allowPlaceholders: false,
      }),
      qualityContractHash: "qgc1:official",
    });

    expect(result.enforcedQualityCompletion).toBe("passed");
    expect(result.assetProvenanceSummary).toMatchObject({
      totalEntries: 1,
      validEntries: 1,
      officialEntries: 1,
      invalidEntries: 0,
    });
    expect(JSON.stringify(result.assetProvenanceSummary)).not.toContain(
      "brand.example",
    );
  });

  it("maps an explicitly allowed official placeholder to degraded_acceptable", async () => {
    process.env.PILOTDECK_CONTENT_QUALITY_V2 = "off";
    process.env.PILOTDECK_OFFICIAL_MEDIA_V2 = "enforce";
    const placeholder = buildOfficialMediaPlaceholder();
    const placeholderPath = `${TASK_DIR}/assets/${placeholder.filename}`;
    await mkdir(join(cwd, "artifacts", "task-quality", "assets"), {
      recursive: true,
    });
    await writeFile(
      join(cwd, ...placeholderPath.split("/")),
      placeholder.content,
      "utf8",
    );

    const result = await runDeliverableQualityPipeline({
      cwd,
      scopeDir: TASK_DIR,
      verifiedPaths: [placeholderPath],
      candidates: [{
        path: placeholderPath,
        kind: "image",
        exists: true,
        sizeBytes: placeholder.content.length,
        textPreview: placeholder.content,
      }],
      qualityContract: contract({
        subjectAnchor: undefined,
        subjectAliases: [],
        exactQuantityAssertions: [],
        officialMediaPolicy: "official_only",
        allowedSourceTiers: ["brand_official"],
        allowPlaceholders: true,
      }),
      qualityContractHash: "qgc1:placeholder",
    });

    expect(result.qualityCompletion).toBe("degraded_acceptable");
    expect(result.enforcedQualityCompletion).toBe("degraded_acceptable");
    expect(result.assetProvenanceSummary.placeholderCount).toBe(1);
  });
});
