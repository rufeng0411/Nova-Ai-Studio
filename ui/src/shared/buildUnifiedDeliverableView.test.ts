import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeStableContractHashV2 } from "../../../src/saas/deliverables/deliverableContractBinding";
import type { SessionDeliverableManifest } from "../../../src/saas/taskState/sessionDeliverableManifest";
import type { NormalizedMessage } from "../stores/useSessionStore";
import type { ChatMessage } from "../components/chat/types/types";
import { buildSessionExportHtml } from "./exportSessionHtml";
import { buildUnifiedDeliverableView } from "./buildUnifiedDeliverableView";
import {
  DELIVERABLE_CERTIFICATE_TELEMETRY_EVENT,
  recordDeliverableCertificateObservationOnce,
  type DeliverableCertificateTelemetryDetail,
} from "./turnAcceptanceMeta";
import {
  applyRuntimeFeatureFlags,
  resetRuntimeFeatureFlagsForTests,
} from "./runtimeFeatureFlags";

const labels = {
  exportedAt: "Exported",
  project: "Project",
  sessionId: "Session",
  messageCount: "Messages",
  messageId: "Message ID",
  messageKind: "Kind",
  messageIndex: "Index",
  turnId: "Turn ID",
  toolId: "Tool ID",
  runId: "Run ID",
  sequence: "Sequence",
  messageIndexTable: "Message ID index",
  debugManifest: "Structured index",
  timestamp: "Time",
  user: "User",
  assistant: "Assistant",
  toolCall: "Tool",
  toolResult: "Result",
  thinking: "Thinking",
  error: "Error",
  system: "System",
  attachments: "Attachments",
  images: "Image",
  activity: "Activity",
  noMessages: "No messages",
};

const exportFixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../tests/fixtures/goal-loop/0709-exports",
);

function loadExportFixture(name: string) {
  return JSON.parse(fs.readFileSync(path.join(exportFixtureRoot, `${name}.json`), "utf8"));
}

function countTableRows(html: string): number {
  const section = html.match(/<section class="deliverable-summary-export"[\s\S]*?<\/section>/);
  if (!section) return 0;
  return (section[0].match(/<tr>\s*<td>/g) ?? []).length;
}

function countDeliveredRows(html: string): number {
  const section = html.match(/<section class="deliverable-summary-export"[\s\S]*?<\/section>/);
  if (!section) return 0;
  return (section[0].match(/已交付/g) ?? []).length;
}

const certificateScopeDir = "artifacts/task-certificate";

const certificateManifest = {
  manifestVersion: 1,
  goalVersion: 1,
  sessionGoalAnchor: "交付双报告",
  compiledAtTurnId: "a1",
  taskArtifactDir: certificateScopeDir,
  slots: [
    {
      id: "report_a",
      label: "报告 A",
      kind: "markdown",
      pathHint: "report-a.md",
      required: true,
      status: "active" as const,
    },
    {
      id: "report_b",
      label: "报告 B",
      kind: "markdown",
      pathHint: "report-b.md",
      required: true,
      status: "active" as const,
    },
  ],
} satisfies SessionDeliverableManifest;
const certificateContractHash = computeStableContractHashV2(certificateManifest);

function certificateV2(done: 0 | 1 | 2) {
  const paths = [
    `${certificateScopeDir}/report-a.md`,
    `${certificateScopeDir}/report-b.md`,
  ];
  return {
    certificateVersion: 2,
    contractHashVersion: 2,
    contractHash: certificateContractHash,
    legacyContractHash: "legacy-v1-hash",
    evidenceHash: `evidence-${done}`,
    goalVersion: 1,
    scopeDir: certificateScopeDir,
    requiredDone: done,
    requiredTotal: 2,
    completionState: done === 2 ? "complete" : "incomplete",
    acceptanceStatus: done === 2 ? "passed" : "needs_repair",
    legacyAcceptanceStatus: "needs_repair",
    strictAcceptanceStatus: done === 2 ? "passed" : "needs_repair",
    units: certificateManifest.slots.map((slot) => ({
      unitId: slot.id,
      slotId: slot.id,
      slotLabel: slot.label,
      expectedPath: `${certificateScopeDir}/${slot.pathHint}`,
      expectedBasename: slot.pathHint,
      kind: slot.kind,
      required: true,
    })),
    slots: certificateManifest.slots.map((slot, index) => {
      const delivered = index < done;
      return {
        slotId: slot.id,
        label: slot.label,
        required: true,
        status: delivered ? "done" : "missing",
        resolvedPath: delivered ? paths[index] : undefined,
        requiredCount: 1,
        matchedCount: delivered ? 1 : 0,
        resolvedPaths: delivered ? [paths[index]] : [],
      };
    }),
  };
}

function certificateV1() {
  return {
    certificateVersion: 1,
    contractHash: "legacy-v1-hash",
    evidenceHash: "legacy-evidence",
    goalVersion: 1,
    scopeDir: certificateScopeDir,
    requiredDone: 1,
    requiredTotal: 2,
    completionState: "incomplete",
    acceptanceStatus: "needs_repair",
    slots: [
      {
        slotId: "report_a",
        label: "报告 A",
        required: true,
        status: "done",
        resolvedPath: `${certificateScopeDir}/report-a.md`,
      },
      {
        slotId: "report_b",
        label: "报告 B",
        required: true,
        status: "missing",
      },
    ],
  };
}

function certificateMessages(certificate?: unknown): ChatMessage[] {
  return [
    {
      id: "u1",
      type: "user",
      content: "请交付双报告",
      timestamp: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "m1",
      type: "assistant",
      content: "",
      timestamp: "2026-01-01T00:00:30.000Z",
      sessionDeliverableManifest: certificateManifest,
    },
    {
      id: "a1",
      type: "assistant",
      content: "已完成",
      timestamp: "2026-01-01T00:01:00.000Z",
      verifiedDeliverablePaths: [
        `${certificateScopeDir}/report-a.md`,
        `${certificateScopeDir}/report-b.md`,
      ],
      turnAcceptanceMeta: {
        finality: "final",
        acceptanceStatus: "passed",
        verifiedPaths: [
          `${certificateScopeDir}/report-a.md`,
          `${certificateScopeDir}/report-b.md`,
        ],
        ...(certificate === undefined ? {} : { acceptanceCertificate: certificate }),
      },
    },
  ];
}

function setCertificateUi(enabled: boolean): void {
  applyRuntimeFeatureFlags({
    deliverableCertificateUi: enabled,
    deliverableQualityUi: false,
    exportSnapshotV2: false,
    exportUserAuditModes: false,
    deliverableSettledAcceptanceAuthority: true,
  });
}

function setQualityUi(enabled: boolean): void {
  applyRuntimeFeatureFlags({
    deliverableCertificateUi: true,
    deliverableQualityUi: enabled,
    exportSnapshotV2: false,
    exportUserAuditModes: false,
  });
}

let installedTestWindow = false;

beforeEach(() => {
  if (typeof globalThis.window === "undefined") {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: new EventTarget(),
    });
    installedTestWindow = true;
  }
  resetRuntimeFeatureFlagsForTests();
  setCertificateUi(false);
});

afterEach(() => {
  resetRuntimeFeatureFlagsForTests();
  if (installedTestWindow) {
    delete (globalThis as { window?: Window }).window;
    installedTestWindow = false;
  }
});

describe("buildUnifiedDeliverableView export contract", () => {
  it("C8 e75fe21d: renders 8 pending rows when verified is empty", () => {
    const fixture = loadExportFixture("e75fe21d-export");
    const html = buildSessionExportHtml({
      title: fixture.title,
      projectName: "general",
      sessionId: `web-s_${fixture.sessionIdPrefix}`,
      messages: [
        {
          id: "user-1",
          sessionId: `web-s_${fixture.sessionIdPrefix}`,
          timestamp: "2026-07-09T05:00:00.000Z",
          provider: "pilotdeck",
          kind: "text",
          role: "user",
          content: fixture.userGoal,
        },
        {
          id: "manifest-1",
          sessionId: `web-s_${fixture.sessionIdPrefix}`,
          timestamp: "2026-07-09T05:00:01.000Z",
          provider: "pilotdeck",
          kind: "text",
          role: "assistant",
          content: "",
          sessionDeliverableManifest: fixture.manifest,
        } as NormalizedMessage,
      ],
      labels,
    });

    expect(html).toContain('data-testid="deliverable-summary-table"');
    expect(countTableRows(html)).toBe(fixture.expect.exportRowCount);
    expect(countDeliveredRows(html)).toBe(0);
  });

  it("C4 dc7a63d3: contract export caps at 7 rows, not 17 all-delivered", () => {
    const fixture = loadExportFixture("dc7a63d3-export");
    const html = buildSessionExportHtml({
      title: fixture.title,
      projectName: "general",
      sessionId: `web-s_${fixture.sessionIdPrefix}`,
      messages: [
        {
          id: "user-1",
          sessionId: `web-s_${fixture.sessionIdPrefix}`,
          timestamp: "2026-07-09T05:00:00.000Z",
          provider: "pilotdeck",
          kind: "text",
          role: "user",
          content: fixture.userGoal,
        },
        {
          id: "manifest-1",
          sessionId: `web-s_${fixture.sessionIdPrefix}`,
          timestamp: "2026-07-09T05:00:01.000Z",
          provider: "pilotdeck",
          kind: "text",
          role: "assistant",
          content: "",
          sessionDeliverableManifest: fixture.manifest,
        } as NormalizedMessage,
        {
          id: "assistant-1",
          sessionId: `web-s_${fixture.sessionIdPrefix}`,
          timestamp: "2026-07-09T05:10:00.000Z",
          provider: "pilotdeck",
          kind: "text",
          role: "assistant",
          content: "交付完成",
          verifiedDeliverablePaths: fixture.verifiedPaths,
          turnAcceptanceMeta: {
            verifiedPaths: fixture.verifiedPaths,
            acceptanceStatus: "needs_repair",
          },
        },
      ],
      labels,
    });

    expect(countTableRows(html)).toBe(fixture.expect.exportRowCount);
    expect(countDeliveredRows(html)).toBeLessThanOrEqual(fixture.expect.maxDeliveredRows);
    if (fixture.expect.forbiddenAllDeliveredWhenIncomplete) {
      expect(countDeliveredRows(html)).toBeLessThan(fixture.expect.exportRowCount);
    }
  });
});

describe("buildUnifiedDeliverableView task-folder snapshot completeness", () => {
  it("keeps unmatched rows checking when a truncated snapshot still binds one slot", () => {
    const scopeDir = "artifacts/task-truncated";
    const sessionManifest = {
      manifestVersion: 1,
      goalVersion: 1,
      sessionGoalAnchor: "交付双报告",
      compiledAtTurnId: "a1",
      taskArtifactDir: scopeDir,
      slots: [
        {
          id: "report_a",
          label: "报告 A",
          kind: "markdown",
          pathHint: "report-a.md",
          required: true,
          status: "active" as const,
        },
        {
          id: "report_b",
          label: "报告 B",
          kind: "markdown",
          pathHint: "report-b.md",
          required: true,
          status: "active" as const,
        },
      ],
    };
    const messages: ChatMessage[] = [
      { id: "u1", type: "user", content: "请交付双报告", timestamp: "2026-01-01T00:00:00.000Z" },
      {
        id: "a1",
        type: "assistant",
        content: "",
        timestamp: "2026-01-01T00:01:00.000Z",
        sessionDeliverableManifest: sessionManifest,
      },
    ];

    const view = buildUnifiedDeliverableView({
      messages,
      projectRoot: "/project",
      sessionManifest,
      scopeDir,
      sessionWideItems: [],
      sessionVerifiedPaths: [],
      validationSettled: true,
      diskSnapshotVersion: 2,
      diskSnapshotComplete: false,
      diskSnapshot: [{
        path: `${scopeDir}/report-a.md`,
        basename: "report-a.md",
        inContract: true,
        slotId: "report_a",
        unitId: "report_a",
        snapshotState: "inconclusive",
      }],
    });

    expect(view.rows).toHaveLength(2);
    expect(view.rows.find((row) => row.id === "report_a")?.status).toBe("delivered");
    expect(view.rows.find((row) => row.id === "report_b")?.status).toBe("checking");
    expect(view.rows.some((row) => row.status === "missing")).toBe(false);
  });

  it("keeps disk-hit rows checking and linkable when validation is not settled", () => {
    const scopeDir = "artifacts/task-unsettled-html";
    const sessionManifest = {
      manifestVersion: 1,
      goalVersion: 1,
      sessionGoalAnchor: "须交付：report.html",
      compiledAtTurnId: "a1",
      taskArtifactDir: scopeDir,
      slots: [
        {
          id: "html_report",
          label: "HTML 简报",
          kind: "html",
          pathHint: "report.html",
          required: true,
          status: "active" as const,
        },
      ],
    };
    const messages: ChatMessage[] = [
      { id: "u1", type: "user", content: "须交付：report.html", timestamp: "2026-01-01T00:00:00.000Z" },
      {
        id: "a1",
        type: "assistant",
        content: "",
        timestamp: "2026-01-01T00:01:00.000Z",
        sessionDeliverableManifest: sessionManifest,
      },
    ];

    const view = buildUnifiedDeliverableView({
      messages,
      projectRoot: "/project",
      sessionManifest,
      scopeDir,
      sessionWideItems: [],
      sessionVerifiedPaths: [],
      validationSettled: false,
      isAssistantWorking: true,
      sessionRepairActive: true,
      diskSnapshotVersion: 2,
      diskSnapshotComplete: false,
      diskSnapshot: [{
        path: `${scopeDir}/report.html`,
        basename: "report.html",
        inContract: true,
        slotId: "html_report",
        unitId: "html_report",
        snapshotState: "inconclusive",
      }],
    });

    const row = view.rows.find((item) => item.id === "html_report");
    expect(row?.status).toBe("checking");
    expect(row?.status).not.toBe("delivered");
    expect(row?.linkable).toBe(true);
    expect(row?.resolvedPath).toBe(`${scopeDir}/report.html`);
  });

  it("consumes a snapshot-v2 binding once when two slots share the same hint", () => {
    const scopeDir = "artifacts/task-shared-hint";
    const sessionManifest = {
      manifestVersion: 1,
      goalVersion: 1,
      sessionGoalAnchor: "交付两份报告",
      compiledAtTurnId: "a1",
      taskArtifactDir: scopeDir,
      slots: [
        {
          id: "report_a",
          label: "报告 A",
          kind: "markdown",
          pathHint: "shared.md",
          required: true,
          status: "active" as const,
        },
        {
          id: "report_b",
          label: "报告 B",
          kind: "markdown",
          pathHint: "shared.md",
          required: true,
          status: "active" as const,
        },
      ],
    };
    const messages: ChatMessage[] = [
      { id: "u1", type: "user", content: "请交付两份报告", timestamp: "2026-01-01T00:00:00.000Z" },
      {
        id: "a1",
        type: "assistant",
        content: "",
        timestamp: "2026-01-01T00:01:00.000Z",
        sessionDeliverableManifest: sessionManifest,
      },
    ];

    const view = buildUnifiedDeliverableView({
      messages,
      projectRoot: "/project",
      sessionManifest,
      scopeDir,
      sessionWideItems: [],
      sessionVerifiedPaths: [],
      validationSettled: true,
      diskSnapshotVersion: 2,
      diskSnapshotComplete: true,
      diskSnapshot: [{
        path: `${scopeDir}/shared.md`,
        basename: "shared.md",
        inContract: true,
        slotId: "report_a",
        unitId: "report_a",
        snapshotState: "verified",
      }],
    });

    expect(view.rows).toHaveLength(2);
    expect(view.rows.filter((row) => row.status === "delivered").map((row) => row.id)).toEqual(["report_a"]);
    expect(view.rows.find((row) => row.id === "report_b")?.status).toBe("missing");
  });

  it("does not promote an inContract=false useful extra in snapshot v2", () => {
    const scopeDir = "artifacts/task-useful-extra";
    const sessionManifest = {
      manifestVersion: 1,
      goalVersion: 1,
      sessionGoalAnchor: "交付报告",
      compiledAtTurnId: "a1",
      taskArtifactDir: scopeDir,
      slots: [{
        id: "report",
        label: "报告",
        kind: "markdown",
        pathHint: "report.md",
        required: true,
        status: "active" as const,
      }],
    };
    const messages: ChatMessage[] = [
      { id: "u1", type: "user", content: "请交付报告", timestamp: "2026-01-01T00:00:00.000Z" },
      {
        id: "a1",
        type: "assistant",
        content: "",
        timestamp: "2026-01-01T00:01:00.000Z",
        sessionDeliverableManifest: sessionManifest,
      },
    ];

    const view = buildUnifiedDeliverableView({
      messages,
      projectRoot: "/project",
      sessionManifest,
      scopeDir,
      sessionWideItems: [],
      sessionVerifiedPaths: [],
      validationSettled: true,
      diskSnapshotVersion: 2,
      diskSnapshotComplete: true,
      diskSnapshot: [{
        path: `${scopeDir}/report.md`,
        basename: "report.md",
        inContract: false,
        snapshotState: "verified",
      }],
    });

    expect(view.rows).toHaveLength(1);
    expect(view.rows[0]?.status).toBe("missing");
  });

  it("maps a count-slot unitId to exactly one stable expanded row", () => {
    const scopeDir = "artifacts/task-count";
    const sessionManifest = {
      manifestVersion: 1,
      goalVersion: 1,
      sessionGoalAnchor: "交付两篇平台成稿",
      compiledAtTurnId: "a1",
      taskArtifactDir: scopeDir,
      slots: [{
        id: "platform_drafts",
        label: "平台成稿",
        kind: "markdown",
        count: 2,
        pathHint: "shared-draft.md",
        required: true,
        status: "active" as const,
      }],
    };
    const messages: ChatMessage[] = [
      { id: "u1", type: "user", content: "请交付两篇平台成稿", timestamp: "2026-01-01T00:00:00.000Z" },
      {
        id: "a1",
        type: "assistant",
        content: "",
        timestamp: "2026-01-01T00:01:00.000Z",
        sessionDeliverableManifest: sessionManifest,
      },
    ];

    const view = buildUnifiedDeliverableView({
      messages,
      projectRoot: "/project",
      sessionManifest,
      scopeDir,
      sessionWideItems: [],
      sessionVerifiedPaths: [],
      validationSettled: true,
      diskSnapshotVersion: 2,
      diskSnapshotComplete: true,
      diskSnapshot: [{
        path: `${scopeDir}/shared-draft.md`,
        basename: "shared-draft.md",
        inContract: true,
        slotId: "platform_drafts",
        unitId: "platform_drafts__1",
        snapshotState: "verified",
      }],
    });

    expect(view.rows).toHaveLength(2);
    expect(view.rows.find((row) => row.id === "platform_drafts_1")?.status).toBe("delivered");
    expect(view.rows.find((row) => row.id === "platform_drafts_2")?.status).toBe("missing");
  });
});

describe("buildUnifiedDeliverableView certificate authority", () => {
  it("keeps legacy provisional paths when the runtime certificate flag is off", () => {
    const view = buildUnifiedDeliverableView({
      messages: certificateMessages(),
      projectRoot: "/project",
      sessionManifest: certificateManifest,
      scopeDir: certificateScopeDir,
      sessionWideItems: [{
        id: "report-a",
        path: `${certificateScopeDir}/report-a.md`,
        apiPath: `${certificateScopeDir}/report-a.md`,
        kind: "document",
        source: "text",
      }],
      sessionVerifiedPaths: [],
    });

    expect(view.rows.find((row) => row.id === "report_a")?.status).toBe("delivered");
  });

  it("does not consume v2 progress or hash while the runtime certificate flag is off", () => {
    const view = buildUnifiedDeliverableView({
      messages: certificateMessages(certificateV2(1)),
      projectRoot: "/project",
      sessionManifest: certificateManifest,
      scopeDir: certificateScopeDir,
      sessionWideItems: [],
      sessionVerifiedPaths: [
        `${certificateScopeDir}/report-a.md`,
        `${certificateScopeDir}/report-b.md`,
      ],
    });

    expect(view.rows.every((row) => row.status === "delivered")).toBe(true);
    expect(view.progress).toMatchObject({ done: 2, total: 2 });
    expect(view.contractHash).not.toBe(certificateContractHash);
  });

  it("returns only auditable legacy/strict shadow differences without render side effects", () => {
    const events: Array<Record<string, unknown>> = [];
    const listener = (event: Event) => {
      events.push((event as CustomEvent).detail as Record<string, unknown>);
    };
    window.addEventListener(DELIVERABLE_CERTIFICATE_TELEMETRY_EVENT, listener);

    const shadowView = buildUnifiedDeliverableView({
      messages: certificateMessages(certificateV2(2)),
      projectRoot: "/project",
      sessionManifest: certificateManifest,
      scopeDir: certificateScopeDir,
      sessionWideItems: [],
    });
    const equalView = buildUnifiedDeliverableView({
      messages: certificateMessages({
        ...certificateV2(2),
        legacyAcceptanceStatus: "passed",
      }),
      projectRoot: "/project",
      sessionManifest: certificateManifest,
      scopeDir: certificateScopeDir,
      sessionWideItems: [],
    });

    window.removeEventListener(DELIVERABLE_CERTIFICATE_TELEMETRY_EVENT, listener);
    expect(events).toEqual([]);
    expect(shadowView.certificateObservation).toMatchObject({
      case: "shadow_diff",
      reason: "legacy_strict_status_diff",
      contractHash: certificateContractHash,
      legacyAcceptanceStatus: "needs_repair",
      strictAcceptanceStatus: "passed",
    });
    expect(equalView.certificateObservation).toBeUndefined();
  });

  it("emits one local telemetry event for a repeated certificate observation", () => {
    const view = buildUnifiedDeliverableView({
      messages: certificateMessages(certificateV2(2)),
      projectRoot: "/project",
      sessionManifest: certificateManifest,
      scopeDir: certificateScopeDir,
      sessionWideItems: [],
    });
    const telemetry: DeliverableCertificateTelemetryDetail[] = [];
    const listener = (event: Event) => {
      telemetry.push((event as CustomEvent<DeliverableCertificateTelemetryDetail>).detail);
    };
    const seenKeys = new Set<string>();
    window.addEventListener(DELIVERABLE_CERTIFICATE_TELEMETRY_EVENT, listener);

    try {
      expect(recordDeliverableCertificateObservationOnce(
        view.certificateObservation,
        seenKeys,
      )).toBe(true);
      expect(recordDeliverableCertificateObservationOnce(
        view.certificateObservation,
        seenKeys,
      )).toBe(false);
      expect(telemetry).toHaveLength(1);
      expect(telemetry[0]).toMatchObject({
        event: "deliverable_certificate_ui",
        case: "shadow_diff",
      });
    } finally {
      window.removeEventListener(DELIVERABLE_CERTIFICATE_TELEMETRY_EVENT, listener);
    }
  });

  it("uses v2 units, slot status, strict progress and hash for a complete certificate", () => {
    setCertificateUi(true);
    const view = buildUnifiedDeliverableView({
      messages: certificateMessages(certificateV2(2)),
      projectRoot: "/project",
      sessionManifest: certificateManifest,
      scopeDir: certificateScopeDir,
      sessionWideItems: [],
      sessionVerifiedPaths: [],
    });

    expect(view.rows.map((row) => row.id)).toEqual(["report_a", "report_b"]);
    expect(view.rows.every((row) => row.status === "delivered")).toBe(true);
    expect(view.progress).toMatchObject({ done: 2, total: 2 });
    expect(view.contractHash).toBe(certificateContractHash);
  });

  it.each([
    {
      label: "complete",
      certificate: {
        ...certificateV2(2),
        qualityCompletion: "passed",
      },
      expected: {
        completionState: "complete",
        qualityCompletion: "passed",
      },
    },
    {
      label: "official media degraded",
      certificate: {
        ...certificateV2(2),
        completionState: "accepted_partial",
        partialReason: "official_media_degraded",
        qualityCompletion: "degraded_acceptable",
      },
      expected: {
        completionState: "accepted_partial",
        partialReason: "official_media_degraded",
        qualityCompletion: "degraded_acceptable",
      },
    },
    {
      label: "user acknowledged",
      certificate: {
        ...certificateV2(2),
        completionState: "accepted_partial",
        partialReason: "user_acknowledged",
        qualityCompletion: "not_applicable",
      },
      expected: {
        completionState: "accepted_partial",
        partialReason: "user_acknowledged",
        qualityCompletion: "not_applicable",
      },
    },
    {
      label: "blocked",
      certificate: {
        ...certificateV2(1),
        completionState: "blocked",
        blockedReasonType: "system_exhausted",
        qualityCompletion: "blocked",
      },
      expected: {
        completionState: "blocked",
        blockedReasonType: "system_exhausted",
        qualityCompletion: "blocked",
      },
    },
  ])("exposes the final v2 quality status for $label", ({ certificate, expected }) => {
    setQualityUi(true);
    const view = buildUnifiedDeliverableView({
      messages: certificateMessages(certificate),
      projectRoot: "/project",
      sessionManifest: certificateManifest,
      scopeDir: certificateScopeDir,
      sessionWideItems: [],
    });

    expect(view.qualityStatus).toMatchObject(expected);
  });

  it("keeps certificate quality status hidden while the runtime quality flag is off", () => {
    setCertificateUi(true);
    const view = buildUnifiedDeliverableView({
      messages: certificateMessages({
        ...certificateV2(2),
        qualityCompletion: "passed",
      }),
      projectRoot: "/project",
      sessionManifest: certificateManifest,
      scopeDir: certificateScopeDir,
      sessionWideItems: [],
    });

    expect(view.qualityStatus).toBeUndefined();
  });

  it("does not let legacy verified paths or newer disk evidence override a partial v2 certificate", () => {
    setCertificateUi(true);
    const view = buildUnifiedDeliverableView({
      messages: certificateMessages(certificateV2(1)),
      projectRoot: "/project",
      sessionManifest: certificateManifest,
      scopeDir: certificateScopeDir,
      sessionWideItems: [],
      sessionVerifiedPaths: [
        `${certificateScopeDir}/report-a.md`,
        `${certificateScopeDir}/report-b.md`,
      ],
      diskSnapshotVersion: 2,
      diskSnapshotComplete: true,
      diskSnapshot: [{
        path: `${certificateScopeDir}/report-b.md`,
        basename: "report-b.md",
        inContract: true,
        slotId: "report_b",
        unitId: "report_b",
        snapshotState: "verified",
      }],
    });

    expect(view.rows.find((row) => row.id === "report_a")?.status).toBe("delivered");
    expect(view.rows.find((row) => row.id === "report_b")?.status).toBe("missing");
    expect(view.progress).toMatchObject({ done: 1, total: 2 });
  });

  it("ES9: acceptance passed settles rows when disk snapshot incomplete (certificate UI shadow)", () => {
    setCertificateUi(true);
    const view = buildUnifiedDeliverableView({
      messages: [],
      projectRoot: "/project",
      sessionManifest: certificateManifest,
      scopeDir: certificateScopeDir,
      latestTurnAcceptanceMeta: {
        acceptanceStatus: "passed",
        verifiedPaths: [`${certificateScopeDir}/report-a.md`],
      },
      diskSnapshotComplete: false,
      sessionWideItems: [],
      sessionVerifiedPaths: [`${certificateScopeDir}/report-a.md`],
    });
    expect(view.rows.some((row) => row.status === "checking" && view.rows.length === view.rows.filter((r) => r.status === "checking").length)).toBe(false);
    expect(view.rows.find((row) => row.id === "report_a")?.status).not.toBe("checking");
  });

  it("rejects a v2 certificate from another task scope", () => {
    setCertificateUi(true);
    const view = buildUnifiedDeliverableView({
      messages: certificateMessages({
        ...certificateV2(2),
        scopeDir: "artifacts/task-old",
      }),
      projectRoot: "/project",
      sessionManifest: certificateManifest,
      scopeDir: certificateScopeDir,
      sessionWideItems: [],
      sessionVerifiedPaths: [],
    });

    expect(view.rows).toHaveLength(2);
    expect(view.rows.every((row) => row.status === "checking")).toBe(true);
    expect(view.progress).toMatchObject({ done: 0, total: 2 });
    expect(view.certificateObservation).toMatchObject({
      case: "stale",
      reason: "certificate_scope_mismatch",
    });
  });

  it("rejects a v2 certificate from a stale goal version", () => {
    setCertificateUi(true);
    const view = buildUnifiedDeliverableView({
      messages: certificateMessages({
        ...certificateV2(2),
        goalVersion: 0,
      }),
      projectRoot: "/project",
      sessionManifest: certificateManifest,
      scopeDir: certificateScopeDir,
      sessionWideItems: [],
      sessionVerifiedPaths: [],
    });

    expect(view.rows).toHaveLength(2);
    expect(view.rows.every((row) => row.status === "checking")).toBe(true);
    expect(view.progress).toMatchObject({ done: 0, total: 2 });
    expect(view.certificateObservation).toMatchObject({
      case: "stale",
      reason: "certificate_goal_version_mismatch",
    });
  });

  it("rejects a v2 certificate whose contract hash does not match the frozen manifest", () => {
    setCertificateUi(true);
    const view = buildUnifiedDeliverableView({
      messages: certificateMessages({
        ...certificateV2(2),
        contractHash: "stale-contract-hash",
      }),
      projectRoot: "/project",
      sessionManifest: certificateManifest,
      scopeDir: certificateScopeDir,
      sessionWideItems: [],
      sessionVerifiedPaths: [],
    });

    expect(view.rows).toHaveLength(2);
    expect(view.rows.every((row) => row.status === "checking")).toBe(true);
    expect(view.certificateObservation).toMatchObject({
      case: "stale",
      reason: "certificate_contract_hash_mismatch",
      certificateVersion: 2,
      contractHashVersion: 2,
    });
  });

  it.each([
    {
      label: "missing",
      certificate: undefined,
      expectedCase: "missing",
      expectedReason: "certificate_missing",
    },
    {
      label: "corrupt",
      certificate: {
        ...certificateV2(2),
        units: undefined,
      },
      expectedCase: "corrupt_v2",
      expectedReason: "v2_units_missing",
    },
    {
      label: "misbound",
      certificate: (() => {
        const certificate = certificateV2(1);
        return {
          ...certificate,
          units: certificate.units.map((unit, index) => (
            index === 1 ? { ...unit, slotId: "report_a" } : unit
          )),
        };
      })(),
      expectedCase: "corrupt_v2",
      expectedReason: "v2_unit_slot_count_mismatch",
    },
  ])("keeps fixed rows checking and returns an observation for $label v2", ({
    certificate,
    expectedCase,
    expectedReason,
  }) => {
    setCertificateUi(true);
    const view = buildUnifiedDeliverableView({
      messages: certificateMessages(certificate),
      projectRoot: "/project",
      sessionManifest: certificateManifest,
      scopeDir: certificateScopeDir,
      sessionWideItems: [{
        id: "optimistic-a",
        path: `${certificateScopeDir}/report-a.md`,
        apiPath: `${certificateScopeDir}/report-a.md`,
        kind: "document",
        source: "text",
      }],
      sessionVerifiedPaths: [
        `${certificateScopeDir}/report-a.md`,
        `${certificateScopeDir}/report-b.md`,
      ],
    });

    expect(view.rows).toHaveLength(2);
    expect(view.rows.every((row) => row.status === "checking")).toBe(true);
    expect(view.progress).toMatchObject({ done: 0, total: 2 });
    expect(view.certificateObservation).toMatchObject({
      case: expectedCase,
      reason: expectedReason,
    });
  });

  it("does not reuse an older v2 certificate when the latest acceptance turn is missing one", () => {
    setCertificateUi(true);
    const messages = [
      ...certificateMessages(certificateV2(2)),
      {
        id: "a2",
        type: "assistant" as const,
        content: "新回合完成",
        timestamp: "2026-01-01T00:02:00.000Z",
        turnAcceptanceMeta: {
          acceptanceStatus: "passed",
          verifiedPaths: [`${certificateScopeDir}/report-a.md`],
        },
      },
    ];

    const view = buildUnifiedDeliverableView({
      messages,
      projectRoot: "/project",
      sessionManifest: certificateManifest,
      scopeDir: certificateScopeDir,
      sessionWideItems: [],
    });

    expect(view.rows).toHaveLength(2);
    expect(view.rows.every((row) => row.status === "checking")).toBe(true);
    expect(view.progress).toMatchObject({ done: 0, total: 2 });
  });

  it("allows only strict snapshot unit evidence to turn rows green when v2 is missing", () => {
    setCertificateUi(true);
    const view = buildUnifiedDeliverableView({
      messages: certificateMessages(),
      projectRoot: "/project",
      sessionManifest: certificateManifest,
      scopeDir: certificateScopeDir,
      sessionWideItems: [],
      sessionVerifiedPaths: [
        `${certificateScopeDir}/report-a.md`,
        `${certificateScopeDir}/report-b.md`,
      ],
      diskSnapshotVersion: 2,
      diskSnapshotComplete: false,
      diskSnapshot: [{
        path: `${certificateScopeDir}/report-a.md`,
        basename: "report-a.md",
        inContract: true,
        slotId: "report_a",
        unitId: "report_a",
        snapshotState: "inconclusive",
      }],
    });

    expect(view.rows).toHaveLength(2);
    expect(view.rows.find((row) => row.id === "report_a")?.status).toBe("delivered");
    expect(view.rows.find((row) => row.id === "report_b")?.status).toBe("checking");
  });

  it("reads a historical v1 certificate without fabricating v2 units or hashes", () => {
    setCertificateUi(true);
    const view = buildUnifiedDeliverableView({
      messages: certificateMessages(certificateV1()),
      projectRoot: "/project",
      sessionManifest: certificateManifest,
      scopeDir: certificateScopeDir,
      sessionWideItems: [],
      sessionVerifiedPaths: [],
    });

    expect(view.rows.map((row) => row.id)).toEqual(["report_a", "report_b"]);
    expect(view.rows.find((row) => row.id === "report_a")?.status).toBe("delivered");
    expect(view.rows.find((row) => row.id === "report_b")?.status).toBe("missing");
    expect(view.progress).toMatchObject({ done: 1, total: 2 });
    expect(view.contractHash).toBe("legacy-v1-hash");
    expect(view.rows.some((row) => row.id.includes("__"))).toBe(false);
  });

  it("normalizes trailing punctuation and filters out-of-scope, process and skill paths", () => {
    const view = buildUnifiedDeliverableView({
      messages: [{
        id: "u1",
        type: "user",
        content: "生成结果",
        timestamp: "2026-01-01T00:00:00.000Z",
      }],
      projectRoot: "/project",
      scopeDir: "artifacts/task-path-filter",
      sessionWideItems: [
        {
          id: "report",
          path: "artifacts/task-path-filter/report.md。",
          apiPath: "artifacts/task-path-filter/report.md。",
          kind: "document",
          source: "text",
        },
        {
          id: "outside",
          path: "artifacts/another-task/report.md",
          apiPath: "artifacts/another-task/report.md",
          kind: "document",
          source: "text",
        },
        {
          id: "process",
          path: "artifacts/task-path-filter/create-report.py",
          apiPath: "artifacts/task-path-filter/create-report.py",
          kind: "code",
          source: "tool",
        },
        {
          id: "skill",
          path: "skills/report/SKILL.md",
          apiPath: "skills/report/SKILL.md",
          kind: "document",
          source: "text",
        },
      ],
      sessionVerifiedPaths: [],
    });

    expect(view.rows).toHaveLength(1);
    expect(view.rows[0]?.resolvedPath ?? view.rows[0]?.path).toBe(
      "artifacts/task-path-filter/report.md",
    );
  });
});
