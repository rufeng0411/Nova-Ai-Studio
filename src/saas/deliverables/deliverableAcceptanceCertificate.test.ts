import { describe, expect, it } from "vitest";
import {
  buildDeliverableAcceptanceCertificate,
  computeEvidenceHash,
  computeStableContractHash,
} from "./deliverableAcceptanceCertificate.js";
import { buildBrandCampaignSdmSlots } from "./campaignDeliverableCompleteness.js";
import type { ContractBindingResult } from "./deliverableContractBinding.js";
import type { SessionDeliverableManifest } from "../taskState/sessionDeliverableManifest.js";

function manifest(slots: SessionDeliverableManifest["slots"]): SessionDeliverableManifest {
  return {
    manifestVersion: 1,
    goalVersion: 1,
    sessionGoalAnchor: "anchor",
    slots,
    taskArtifactDir: "artifacts/task-0717/",
  };
}

describe("deliverableAcceptanceCertificate", () => {
  it("one file binds one slot only", () => {
    const m = manifest(buildBrandCampaignSdmSlots());
    const cert = buildDeliverableAcceptanceCertificate({
      manifest: m,
      scopeDir: m.taskArtifactDir ?? null,
      verifiedPaths: [
        "artifacts/task-0717/research-report.md",
        "artifacts/task-0717/campaign-brief.docx",
      ],
      acceptanceStatus: "needs_repair",
    });
    expect(cert?.requiredDone).toBe(2);
    expect(cert?.requiredTotal).toBe(6);
    expect(cert?.completionState).toBe("incomplete");
    const paths = cert?.slots.filter((s) => s.status === "done").map((s) => s.resolvedPath);
    expect(new Set(paths).size).toBe(paths?.length);
  });

  it("contractHash stable across progress-only changes", () => {
    const m = manifest(buildBrandCampaignSdmSlots());
    const h1 = computeStableContractHash(m);
    const h2 = computeStableContractHash({ ...m, goalVersion: 1 });
    expect(h1).toBe(h2);
  });

  it("optionalDerived captures extra verified files without expanding required slots", () => {
    const m = manifest([
      {
        id: "md_report",
        label: "市场报告",
        kind: "markdown",
        pathHint: "nova-market-report.md",
        required: true,
        status: "done",
        resolvedPath: "artifacts/task-0717/nova-market-report.md",
      },
    ]);
    const cert = buildDeliverableAcceptanceCertificate({
      manifest: m,
      scopeDir: m.taskArtifactDir ?? null,
      verifiedPaths: [
        "artifacts/task-0717/nova-market-report.md",
        "artifacts/task-0717/nova-market-report.docx",
      ],
      acceptanceStatus: "passed",
    });
    expect(cert?.requiredDone).toBe(1);
    expect(cert?.requiredTotal).toBe(1);
    expect(cert?.completionState).toBe("complete");
    expect(cert?.optionalDerived?.length).toBe(1);
    expect(cert?.optionalDerived?.[0]?.resolvedPath).toMatch(/\.docx$/i);
  });

  it("evidenceHash changes when resolvedPath changes", () => {
    const rowsA = [{ slotId: "a", label: "A", required: true, status: "done" as const, resolvedPath: "x.md" }];
    const rowsB = [{ slotId: "a", label: "A", required: true, status: "done" as const, resolvedPath: "y.md" }];
    expect(computeEvidenceHash(rowsA)).not.toBe(computeEvidenceHash(rowsB));
  });

  it("evidenceHash changes when the second unit binding changes from B to C", () => {
    const rows = [{
      slotId: "articles",
      label: "成稿",
      required: true,
      status: "done" as const,
      resolvedPath: "artifacts/task-0717/article-a.md",
      requiredCount: 2,
      matchedCount: 2,
      resolvedPaths: [
        "artifacts/task-0717/article-a.md",
        "artifacts/task-0717/article-b.md",
      ],
    }];
    const binding = (
      secondPath: string,
    ): ContractBindingResult => ({
      complete: true,
      requiredCount: 2,
      matchedCount: 2,
      units: [
        {
          unitId: "articles__1",
          slotId: "articles",
          slotLabel: "成稿",
          expectedPath: "artifacts/task-0717/article-a.md",
          expectedBasename: "article-a.md",
          kind: "markdown",
          required: true,
        },
        {
          unitId: "articles__2",
          slotId: "articles",
          slotLabel: "成稿",
          expectedPath: secondPath,
          expectedBasename: secondPath.split("/").pop()!,
          kind: "markdown",
          required: true,
        },
      ],
      bindings: [
        {
          unitId: "articles__1",
          slotId: "articles",
          evidencePath: "artifacts/task-0717/article-a.md",
          matchTier: "exact",
          matched: true,
        },
        {
          unitId: "articles__2",
          slotId: "articles",
          evidencePath: secondPath,
          matchTier: "exact",
          matched: true,
        },
      ],
      slotSummaries: [],
      usedEvidencePaths: [
        "artifacts/task-0717/article-a.md",
        secondPath,
      ],
    });

    const hashB = computeEvidenceHash(rows, binding("artifacts/task-0717/article-b.md"));
    const hashC = computeEvidenceHash(rows, binding("artifacts/task-0717/article-c.md"));

    expect(hashB).not.toBe(hashC);
  });
});
