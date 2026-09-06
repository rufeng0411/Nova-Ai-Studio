import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { accumulateDockExpectedManifest } from "../../ui/src/shared/accumulateDockExpectedManifest.js";
import { sessionManifestToExpectedEntries } from "../../ui/src/shared/resolveSessionDeliverableManifest.js";
import { reconcileSlotsWithVerifiedPaths } from "../../src/saas/taskState/sessionDeliverableManifest.js";
import { resolveProfile } from "../../src/saas/deliverableCapabilityProfiles.js";
import { kindMatchAllowed, pathSatisfiesSdmSlot } from "../../src/saas/deliverables/sdmSlotMatching.js";

type FixtureCase = {
  id: string;
  sessionIdPrefix: string;
  userGoal: string;
  capabilitySlug?: string;
  manifest: Record<string, unknown>;
  verifiedPaths: string[];
  expect: {
    minContractRows?: number;
    maxContractRows?: number;
    contractRowCount?: number;
    forbiddenBasenames?: string[];
    forbiddenExclusiveBasenames?: string[];
    forbiddenGoalTerms?: string[];
  };
};

const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/goal-loop/0708",
);
const index = JSON.parse(fs.readFileSync(path.join(fixtureRoot, "index.json"), "utf8")) as {
  cases: FixtureCase[];
};

function basename(p: string): string {
  return p.split("/").pop() ?? p;
}

describe("goal-loop 0708 golden batch", () => {
  for (const fixture of index.cases) {
    it(`${fixture.id} (${fixture.sessionIdPrefix}) contract invariants`, () => {
      const base = sessionManifestToExpectedEntries(fixture.manifest as never);
      const contractRows = accumulateDockExpectedManifest(base, [], fixture.verifiedPaths);
      const reconciled = reconcileSlotsWithVerifiedPaths(
        fixture.manifest as never,
        fixture.verifiedPaths,
      );

      if (fixture.expect.contractRowCount != null) {
        expect(contractRows).toHaveLength(fixture.expect.contractRowCount);
      }
      if (fixture.expect.minContractRows != null) {
        expect(contractRows.length).toBeGreaterThanOrEqual(fixture.expect.minContractRows);
      }
      if (fixture.expect.maxContractRows != null) {
        expect(contractRows.length).toBeLessThanOrEqual(fixture.expect.maxContractRows);
      }

      for (const forbidden of fixture.expect.forbiddenBasenames ?? []) {
        expect(contractRows.some((row) => basename(row.path ?? "").includes(forbidden))).toBe(false);
      }

      if (fixture.expect.forbiddenExclusiveBasenames?.length) {
        const exclusiveTemplate = contractRows.filter((row) =>
          fixture.expect.forbiddenExclusiveBasenames!.some((name) => (row.path ?? "").includes(name)),
        );
        expect(exclusiveTemplate.length).toBeLessThan(contractRows.length);
      }

      for (const term of fixture.expect.forbiddenGoalTerms ?? []) {
        expect(fixture.userGoal.includes(term)).toBe(false);
        expect(String(reconciled.manifest.sessionGoalAnchor ?? "")).not.toContain(term);
      }
    });
  }

  it("0708-10 mkt-ads profile wins over generic content profile", () => {
    const profile = resolveProfile("mkt-ads", undefined, "付费投放");
    expect(profile.id).toBe("mkt_ads");
    expect(profile.requiredBasenameGroups?.length).toBeGreaterThan(0);
  });

  it("0708-10 template pathHint slot does not kind-swallow verified md files", () => {
    const templateSlot = {
      id: "required_markdown_1",
      kind: "markdown",
      pathHint: "skills/mkt-ads/references/ad-copy-templates.md",
    };
    expect(kindMatchAllowed(templateSlot)).toBe(false);
    expect(pathSatisfiesSdmSlot("artifacts/ads-plan.md", templateSlot)).toBe(false);
  });
});
