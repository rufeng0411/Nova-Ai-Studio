import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readWebSessionMessages } from "../../../src/web/server/readSessionMessages.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const fixtureDir = path.join(root, "tests/fixtures/goal-loop");

async function replayFixture(name: string) {
  return readWebSessionMessages(
    { sessionKey: `replay-${name}`, limit: 200 },
    {
      projectRoot: path.join(root, "general"),
      pilotHome: path.join(root, ".saas-dev-data"),
      transcriptAbsPath: path.join(fixtureDir, `${name}.jsonl`),
      now: () => new Date("2026-07-02T00:00:00.000Z"),
    },
  );
}

test("H1-c: task-resume user rows are hidden from messages API", async () => {
  const result = await replayFixture("task-resume-leak");
  const body = result.messages.map((m) => m.text ?? "").join("\n");
  assert.equal(body.includes("<task-resume"), false);
  assert.equal(body.includes("missing_paths"), false);
});

test("Phase 0b: empty assistant turn injects gentle placeholder", async () => {
  const result = await replayFixture("empty-assistant-model-error");
  const assistantTexts = result.messages
    .filter((m) => m.role === "assistant" && m.kind === "text")
    .map((m) => m.text ?? "");
  assert.ok(assistantTexts.some((text) => text.trim().length > 8));
  assert.equal(/^(?:fetch failed)[.!?…]*$/im.test(assistantTexts.join("\n")), false);
});

test("P1: history envelope passes composite quality metadata and tolerates legacy rows", async () => {
  const temp = await mkdtemp(path.join(tmpdir(), "pilotdeck-history-p1-"));
  const transcript = path.join(temp, "history.jsonl");
  const base = {
    sessionId: "history-p1",
    turnId: "turn-1",
    createdAt: "2026-07-18T00:00:00.000Z",
  };
  const rows = [
    {
      ...base,
      type: "turn_acceptance_meta",
      sequence: 1,
      acceptanceStatus: "passed",
      verifiedPaths: ["artifacts/legacy/report.md"],
    },
    {
      ...base,
      turnId: "turn-2",
      type: "turn_acceptance_meta",
      sequence: 2,
      finality: "final",
      acceptanceStatus: "needs_repair",
      verifiedPaths: ["artifacts/social-matrix/index.md"],
      qualityContractHashVersion: 1,
      qualityContractHash: "quality-contract-hash",
      qualityEvidenceHashVersion: 1,
      qualityEvidenceHash: "quality-evidence-hash",
      qualityCompletion: "degraded_acceptable",
      completionState: "accepted_partial",
      partialReason: "official_media_degraded",
      qualityFailures: [{
        checkId: "official_media",
        domain: "official_media",
        reason: "official_media_unavailable",
        repairable: false,
      }],
      assetProvenanceSummary: {
        totalEntries: 2,
        validEntries: 1,
        officialEntries: 1,
        invalidEntries: 1,
        placeholderCount: 1,
        sourceLevelCounts: { L0: 1, L3: 1 },
        sourceTierCounts: { brand_official: 1 },
        ledgerEvidenceHash: "ledger-evidence-hash",
      },
      acceptanceCertificate: {
        certificateVersion: 2,
        contractHashVersion: 2,
        contractHash: "contract-v2",
        evidenceHash: "evidence-v2",
        goalVersion: 1,
        scopeDir: "artifacts/social-matrix",
        requiredDone: 1,
        requiredTotal: 1,
        completionState: "accepted_partial",
        partialReason: "official_media_degraded",
        acceptanceStatus: "passed",
        legacyAcceptanceStatus: "passed",
        strictAcceptanceStatus: "passed",
        qualityContractHashVersion: 1,
        qualityContractHash: "quality-contract-hash",
        qualityEvidenceHashVersion: 1,
        qualityEvidenceHash: "quality-evidence-hash",
        qualityCompletion: "degraded_acceptable",
        qualityFailures: [{
          checkId: "official_media",
          domain: "official_media",
          reason: "official_media_unavailable",
          repairable: false,
        }],
        assetProvenanceSummary: {
          totalEntries: 2,
          validEntries: 1,
          officialEntries: 1,
          invalidEntries: 1,
          placeholderCount: 1,
          sourceLevelCounts: { L0: 1, L3: 1 },
          sourceTierCounts: { brand_official: 1 },
          ledgerEvidenceHash: "ledger-evidence-hash",
        },
        units: [],
        slots: [],
      },
      compositeSlotQuality: [{
        profileId: "social_matrix",
        slotId: "social_pack",
        complete: false,
        reason: "composite_directory_incomplete",
        observedPaths: ["artifacts/social-matrix/index.md"],
        requiredBasenames: ["brief.md"],
        missingBasenames: ["brief.md"],
      }],
    },
  ];
  await writeFile(transcript, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");

  try {
    const result = await readWebSessionMessages(
      { sessionKey: "history-p1", limit: 20 },
      {
        projectRoot: temp,
        pilotHome: temp,
        transcriptAbsPath: transcript,
      },
    );
    assert.deepEqual(
      (result.latestTurnAcceptanceMeta as Record<string, unknown>).compositeSlotQuality,
      (rows[1] as { compositeSlotQuality: unknown }).compositeSlotQuality,
    );
    assert.deepEqual(result.latestTurnAcceptanceMeta, {
      acceptanceStatus: "needs_repair",
      verifiedPaths: ["artifacts/social-matrix/index.md"],
      missingPaths: [],
      brokenPaths: [],
      hiddenByPolicyPaths: [],
      resolvedPathMap: {},
      finality: "final",
      qualityContractHashVersion: 1,
      qualityContractHash: "quality-contract-hash",
      qualityEvidenceHashVersion: 1,
      qualityEvidenceHash: "quality-evidence-hash",
      qualityCompletion: "degraded_acceptable",
      completionState: "accepted_partial",
      partialReason: "official_media_degraded",
      qualityFailures: (rows[1] as { qualityFailures: unknown }).qualityFailures,
      assetProvenanceSummary: (rows[1] as { assetProvenanceSummary: unknown }).assetProvenanceSummary,
      acceptanceCertificate: (rows[1] as { acceptanceCertificate: unknown }).acceptanceCertificate,
      compositeSlotQuality: (rows[1] as { compositeSlotQuality: unknown }).compositeSlotQuality,
    });
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
