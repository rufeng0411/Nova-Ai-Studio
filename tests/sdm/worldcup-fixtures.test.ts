/**
 * PD-SAAS-FORK: SDM Phase 4 — worldcup / Argentina pivot fixture replay (offline).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildWorldcupCampaignSdmSlots, isCampaignFullCaseGoal } from "../../src/saas/deliverables/campaignDeliverableCompleteness.js";
import { detectGoalMutation } from "../../src/saas/taskState/detectGoalMutation.js";
import {
  compileSessionDeliverableManifest,
  computeSdmProgress,
  resolveLatestSessionManifestFromEntries,
  updateSessionManifestOnUserMessage,
} from "../../src/saas/taskState/sessionDeliverableManifest.js";
import { resolvePrimaryTaskArtifactDir } from "../../src/saas/taskState/resolvePrimaryTaskArtifactDir.js";
import { redirectWritePathToTaskDir } from "../../src/saas/taskState/taskPathGuard.js";
import type { AgentTranscriptEntry } from "../../src/session/transcript/TranscriptEntry.js";

const fixtureDir = path.join(process.cwd(), "tests", "fixtures", "goal-loop");

function readJsonlFixture(name: string): AgentTranscriptEntry[] {
  const filePath = path.join(fixtureDir, name);
  const body = fs.readFileSync(filePath, "utf8");
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AgentTranscriptEntry);
}

function readMeta(name: string): Record<string, unknown> {
  const filePath = path.join(fixtureDir, `${name}.meta.json`);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

describe("SDM worldcup fixtures", () => {
  it("WC-01 campaign 8 slots from goal + jsonl hydrate", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const goal = String(readMeta("worldcup-wc01-campaign-8phase").userGoal ?? "");
    expect(isCampaignFullCaseGoal(goal)).toBe(true);
    const compiled = compileSessionDeliverableManifest({ userGoal: goal });
    // Campaign 8 stages; platform may append universal_data_sources as 9th.
    const campaignSlots = compiled?.slots.filter((s) => !/universal_data_sources/i.test(s.id)) ?? [];
    expect(campaignSlots).toHaveLength(8);
    expect(campaignSlots[0]?.id).toBe("stage_research");
    expect(campaignSlots[4]?.id).toBe("stage_website");

    const entries = readJsonlFixture("worldcup-wc01-campaign-8phase.jsonl");
    const hydrated = resolveLatestSessionManifestFromEntries(entries);
    const hydratedCampaign = hydrated?.slots.filter((s) => !/universal_data_sources/i.test(s.id)) ?? [];
    expect(hydratedCampaign).toHaveLength(8);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("WC-05 social carousel compiles profile slots (D class)", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const goal = String(readMeta("worldcup-wc05-social-carousel").userGoal ?? "");
    const manifest = compileSessionDeliverableManifest({
      userGoal: goal,
      capabilitySlug: "social-creative-matrix",
      majorCategory: "marketing",
    });
    expect(manifest).toBeTruthy();
    expect(manifest!.slots.length).toBeGreaterThan(0);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("WC-06 industry market md/pdf/html slots", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const goal = String(readMeta("worldcup-wc06-industry-market").userGoal ?? "");
    const manifest = compileSessionDeliverableManifest({ userGoal: goal });
    expect(manifest).toBeTruthy();
    const kinds = new Set(manifest!.slots.map((slot) => slot.kind).filter(Boolean));
    expect(kinds.has("markdown") || kinds.has("pdf") || kinds.has("html")).toBe(true);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("AR-Pivot md→PDF mutation bumps manifestVersion", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const base = compileSessionDeliverableManifest({
      userGoal: "写 markdown 报告并输出 report.md",
    });
    expect(base).toBeTruthy();
    const mutation = detectGoalMutation({
      userText: "把 Markdown 转成 PDF",
      manifest: base!,
    });
    expect(mutation.mutated).toBe(true);
    expect(mutation.action).toBe("replace");
    const next = updateSessionManifestOnUserMessage({
      userText: "把 Markdown 转成 PDF",
      previousManifest: base!,
      turnId: "t-pivot",
    });
    expect(next?.manifestVersion).toBe(2);
    expect(next?.slots.some((slot) => slot.kind === "pdf" && slot.status !== "removed")).toBe(true);

    const entries = readJsonlFixture("worldcup-ar-pivot-md-pdf.jsonl");
    const hydrated = resolveLatestSessionManifestFromEntries(entries);
    expect(hydrated?.manifestVersion).toBe(2);
    expect(hydrated?.slots.some((slot) => slot.kind === "pdf")).toBe(true);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("WC-01 repair progress uses SDM done/total", () => {
    const slots = buildWorldcupCampaignSdmSlots();
    slots[0]!.status = "done";
    slots[1]!.status = "done";
    slots[2]!.status = "done";
    const manifest = {
      manifestVersion: 1,
      goalVersion: 1,
      sessionGoalAnchor: "campaign",
      slots,
    };
    const progress = computeSdmProgress(manifest, [
      "artifacts/campaign/research.md",
      "artifacts/campaign/plan.html",
      "artifacts/campaign/brief.md",
    ]);
    expect(progress.done).toBeGreaterThanOrEqual(3);
    expect(progress.total).toBe(8);
  });

  it("WC-07 geo multi-turn html add preserves primary + 3 html slots", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    process.env.PILOTDECK_STDA_ADD_PRESERVE_ROOT = "1";
    process.env.PILOTDECK_SDM_HTML_SLOT_FUZZY = "1";
    const meta = readMeta("geo-wc07-multi-turn-html-add");
    const primaryDir = String(meta.primaryTaskDir ?? "");
    const entries = readJsonlFixture("geo-wc07-multi-turn-html-add.jsonl");
    const hydrated = resolveLatestSessionManifestFromEntries(entries);
    expect(hydrated?.taskArtifactDir).toBe(primaryDir);
    const htmlSlots = hydrated!.slots.filter((s) => s.kind === "html" && s.status !== "removed");
    expect(htmlSlots.length).toBe(3);
    expect(hydrated!.slots.find((s) => s.id === "profile_geo_platform")?.status).toBe("removed");

    const primary = resolvePrimaryTaskArtifactDir({ entries, manifest: hydrated });
    expect(primary?.taskArtifactDir).toBe(primaryDir);

    const verified = [
      `${primaryDir}/research.md`,
      `${primaryDir}/charts.md`,
      `${primaryDir}/geo-operation-manual.md`,
      `${primaryDir}/report-1-depth.html`,
      `${primaryDir}/report-2-panorama.html`,
      `${primaryDir}/report-3-operation-manual.html`,
    ];
    const progress = computeSdmProgress(hydrated!, verified);
    expect(progress.done).toBe(progress.total);
    expect(progress.total).toBeGreaterThanOrEqual(6);

    const explicitWrite = `${primaryDir}/report-1-depth.html`;
    const redirected = redirectWritePathToTaskDir(
      explicitWrite,
      "artifacts/task-20260710-ffd81a25",
      { knownTaskDirs: [primaryDir] },
    );
    expect(redirected).toBe(explicitWrite);

    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
    delete process.env.PILOTDECK_STDA_ADD_PRESERVE_ROOT;
    delete process.env.PILOTDECK_SDM_HTML_SLOT_FUZZY;
  });

  it("WC-07b replace md→pdf keeps taskArtifactDir in manifest", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const base = compileSessionDeliverableManifest({
      userGoal: "写 markdown 报告并输出 report.md",
    });
    const dir = "artifacts/task-20260710-f4424421";
    const withDir = { ...base!, taskArtifactDir: dir };
    const next = updateSessionManifestOnUserMessage({
      userText: "把 Markdown 转成 PDF",
      previousManifest: withDir,
      turnId: "t-replace",
    });
    expect(next?.supersedes?.diff).toBe("replace");
    expect(next?.taskArtifactDir).toBe(dir);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });

  it("WC-07c triple HTML does not trigger pivot (mutation wins)", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const manifest = compileSessionDeliverableManifest({ userGoal: "GEO 深度调查报告" });
    const mutation = detectGoalMutation({
      userText: "把三个报告都做成专业图表 HTML：深度洞察、行业全景、操作手册",
      manifest: manifest!,
    });
    expect(mutation.action).toBe("add");
    expect(mutation.addSlots?.length).toBe(3);
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
  });
});
