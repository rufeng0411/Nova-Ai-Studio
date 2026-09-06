import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileSessionDeliverableManifest,
  reconcileSlotsWithVerifiedPaths,
} from "../../src/saas/taskState/sessionDeliverableManifest.js";
import { pathSatisfiesSdmSlot } from "../../src/saas/deliverables/sdmSlotMatching.js";
import { filterVerifiedForContractBinding } from "../../src/saas/deliverables/filterVerifiedForContractBinding.js";
import { buildUnifiedDeliverableView } from "../../ui/src/shared/buildUnifiedDeliverableView.js";
import type { ChatMessage } from "../../ui/src/components/chat/types/types.js";

type LiveCase = {
  id: string;
  sessionIdPrefix: string;
  userGoal: string;
  capabilitySlug?: string;
  scopeDir?: string;
  diskFiles?: string[];
  expect: Record<string, unknown>;
};

const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/goal-loop/0709-live",
);
const index = JSON.parse(fs.readFileSync(path.join(fixtureRoot, "index.json"), "utf8")) as {
  cases: LiveCase[];
};

function manifestMessage(manifest: NonNullable<ReturnType<typeof compileSessionDeliverableManifest>>): ChatMessage {
  return {
    id: "manifest-1",
    type: "system",
    content: "",
    sessionDeliverableManifest: manifest as never,
  } as ChatMessage;
}

describe("goal-loop 0709-live UDC R11", () => {
  const prevManifestFlag = process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;

  beforeEach(() => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
  });

  afterEach(() => {
    if (prevManifestFlag == null) delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
    else process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = prevManifestFlag;
  });

  for (const fixture of index.cases) {
    it(`${fixture.id} (${fixture.sessionIdPrefix}) compile + reconcile invariants`, () => {
      const manifest = compileSessionDeliverableManifest({
        userGoal: fixture.userGoal,
        turnId: "turn-1",
        capabilitySlug: fixture.capabilitySlug,
      });
      expect(manifest).not.toBeNull();
      if (!manifest) return;

      if (fixture.expect.slotCount != null) {
        expect(
          manifest.slots.filter(
            (slot) => slot.status !== "removed" && slot.id !== "universal_data_sources",
          ),
        ).toHaveLength(fixture.expect.slotCount);
      }
      if (fixture.expect.profileId != null) {
        expect(manifest.profileId).toBe(fixture.expect.profileId);
      }
      if (fixture.expect.profileIdNot != null) {
        expect(manifest.profileId).not.toBe(fixture.expect.profileIdNot);
      }
      if (fixture.expect.firstPathHint != null) {
        expect(manifest.slots[0]?.pathHint).toContain(fixture.expect.firstPathHint);
      }
      if (Array.isArray(fixture.expect.pathHintContains)) {
        for (const term of fixture.expect.pathHintContains as string[]) {
          const hints = manifest.slots.flatMap((slot) => [
            slot.label ?? "",
            slot.pathHint ?? "",
            ...(slot.pathHints ?? []),
          ]).join(" ").toLowerCase();
          expect(hints).toContain(term.toLowerCase());
        }
      }

      if (fixture.diskFiles?.length) {
        const reconciled = reconcileSlotsWithVerifiedPaths(manifest, fixture.diskFiles);
        const bindIndex = fixture.expect.bindSlotIndex as number | undefined;
        if (bindIndex != null) {
          const slot = reconciled.manifest.slots[bindIndex];
          expect(slot?.status).toBe("done");
          expect(slot?.resolvedPath).toContain(String(fixture.expect.bindBasename ?? ""));
        }
      }

      if (fixture.expect.forbiddenVerifiedBasenames) {
        const polluted = [
          "artifacts/x/README.md",
          "artifacts/x/deliverables-index.md",
          "artifacts/x/01-aeo-audit-checklist.md",
        ];
        const filtered = filterVerifiedForContractBinding(polluted);
        for (const forbidden of fixture.expect.forbiddenVerifiedBasenames as string[]) {
          expect(filtered.some((p) => p.endsWith(forbidden))).toBe(false);
        }
      }
    });
  }

  it("geo-proclick-d7890d1d diskSnapshot enrich closes folder vs summary gap", () => {
    const fixture = index.cases.find((entry) => entry.id === "geo-proclick-d7890d1d");
    expect(fixture).toBeTruthy();
    const manifest = compileSessionDeliverableManifest({
      userGoal: fixture!.userGoal,
      turnId: "turn-1",
      capabilitySlug: fixture!.capabilitySlug,
    });
    expect(manifest).not.toBeNull();
    if (!manifest) return;

    const slot = manifest.slots[0];
    expect(pathSatisfiesSdmSlot(
      "artifacts/razer-pro-click-geo/01-aeo-audit-checklist.md",
      slot,
    )).toBe(true);

    const view = buildUnifiedDeliverableView({
      messages: [manifestMessage(manifest)],
      projectRoot: "general",
      sessionManifest: manifest as never,
      diskSnapshot: (fixture!.diskFiles ?? []).map((filePath) => ({
        path: filePath,
        basename: filePath.split("/").pop() ?? filePath,
        inContract: true,
        isProcessFile: false,
      })),
    });

    const delivered = view.rows.filter((row) => row.status === "delivered");
    expect(delivered.length).toBeGreaterThanOrEqual(Number(fixture!.expect.diskEnrichDelivered ?? 1));
    expect(view.rows[0]?.resolvedPath).toContain("01-aeo-audit-checklist.md");
  });
});
