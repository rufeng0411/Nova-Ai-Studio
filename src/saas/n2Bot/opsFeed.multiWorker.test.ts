import { describe, expect, it } from "vitest";
import {
  buildN2OpsFeed,
  buildN2OpsRailSections,
  filesFromSlotBindingsOnly,
  groupN2OpsItems,
  planStopAll,
} from "./opsFeed.js";
import type { N2OpsCatalogRow, N2OpsCertificate, N2OpsCron } from "./opsFeed.js";

const steward: N2OpsCatalogRow = {
  sessionId: "s-n2",
  userId: 1,
  kind: "n2_bot",
  title: "N2 Bot",
  executionStatus: "idle",
};

const delegatedRun: N2OpsCatalogRow = {
  sessionId: "w-run",
  userId: 1,
  title: "委派进行",
  executionStatus: "running",
};
const delegatedQueue: N2OpsCatalogRow = {
  sessionId: "w-queue",
  userId: 1,
  title: "委派排队",
  executionStatus: "queued",
};
const delegatedNeed: N2OpsCatalogRow = {
  sessionId: "w-need",
  userId: 1,
  title: "委派卡住",
  executionStatus: "paused",
};
const delegatedDone: N2OpsCatalogRow = {
  sessionId: "w-done",
  userId: 1,
  title: "委派完成",
  executionStatus: "idle",
};
const nativeRun: N2OpsCatalogRow = {
  sessionId: "wb-run",
  userId: 1,
  title: "工作台原生",
  firstPrompt: "做一份周会 PPT",
  executionStatus: "running",
};
const otherUser: N2OpsCatalogRow = {
  sessionId: "other-run",
  userId: 2,
  title: "别人的",
  executionStatus: "running",
};
const greeting: N2OpsCatalogRow = {
  sessionId: "chat-hi",
  userId: 1,
  firstPrompt: "你好啊",
  executionStatus: "idle",
  greetingIdle: true,
};

const certs: N2OpsCertificate[] = [
  {
    sessionId: "w-need",
    userActionRequired: true,
    issue: "quota",
    slotBindings: [{ path: "a/报告.md", kind: "md", label: "报告" }],
  },
  {
    sessionId: "w-done",
    complete: true,
    acceptance: "passed",
    slotBindings: [{ path: "a/提案.pdf", kind: "pdf", label: "提案" }],
  },
  { sessionId: "w-run", step: "还在写" },
];

const crons: N2OpsCron[] = [
  { taskId: "c1", sessionKey: "w-plan-worker", message: "每天九点竞品简报", nextRunAt: "09:00" },
];

describe("opsFeed multi-worker", () => {
  it("B1/B2 includes native + delegated, excludes steward/other/greeting", () => {
    const items = buildN2OpsFeed({
      viewerUserId: 1,
      stewardSessionId: "s-n2",
      rows: [steward, delegatedRun, delegatedQueue, delegatedNeed, delegatedDone, nativeRun, otherUser, greeting],
      certificates: certs,
      crons,
    });
    const ids = items.map((i) => i.workerSessionId);
    expect(ids).toContain("wb-run");
    expect(ids).toContain("w-run");
    expect(ids).toContain("w-queue");
    expect(ids).toContain("w-need");
    expect(ids).toContain("w-done");
    expect(ids).toContain("w-plan-worker");
    expect(ids).not.toContain("s-n2");
    expect(ids).not.toContain("other-run");
    expect(ids).not.toContain("chat-hi");
    const grouped = groupN2OpsItems(items);
    expect(grouped.need.length).toBeGreaterThanOrEqual(1);
    expect(grouped.run.some((i) => i.workerSessionId === "wb-run")).toBe(true);
    expect(grouped.plan.length).toBe(1);
  });

  it("running items sort before older idle, and outcomes come from slotBindings", () => {
    const items = buildN2OpsFeed({
      viewerUserId: 1,
      stewardSessionId: "s-n2",
      rows: [
        { ...delegatedDone, lastActivityAt: "2026-08-20T12:00:00.000Z", isGeneral: true, projectLabel: "通用" },
        { ...nativeRun, lastActivityAt: "2026-08-20T11:00:00.000Z", isGeneral: true, projectLabel: "通用" },
        {
          sessionId: "p-run",
          userId: 1,
          title: "项目路演",
          executionStatus: "running",
          lastActivityAt: "2026-08-20T10:00:00.000Z",
          isGeneral: false,
          legacyProjectId: "workspaces-mingdi",
          projectLabel: "鸣镝",
        },
        {
          sessionId: "p-done",
          userId: 1,
          title: "旧提案",
          executionStatus: "idle",
          lastActivityAt: "2026-08-19T10:00:00.000Z",
          isGeneral: false,
          legacyProjectId: "workspaces-mingdi",
          projectLabel: "鸣镝",
        },
      ],
      certificates: [
        { sessionId: "w-done", complete: true, slotBindings: [{ path: "a/提案.pdf", kind: "pdf", label: "提案" }] },
        { sessionId: "p-done", complete: true, slotBindings: [{ path: "a/路演.pptx", kind: "pptx", label: "路演" }] },
      ],
    });
    expect(items[0]?.status).toBe("run");
    expect(items.map((i) => i.workerSessionId).slice(0, 2).sort()).toEqual(["p-run", "wb-run"].sort());
    const done = items.find((i) => i.workerSessionId === "w-done");
    expect(done?.hasOutcomes).toBe(true);
    expect(done?.outcomeCount).toBe(1);

    const sections = buildN2OpsRailSections(items);
    expect(sections[0]?.kind).toBe("live");
    expect(sections[0]?.items.some((i) => i.projectLabel === "鸣镝")).toBe(true);
    const general = sections.find((s) => s.kind === "general");
    expect(general?.items.some((i) => i.workerSessionId === "w-done")).toBe(true);
    const project = sections.find((s) => s.kind === "project");
    expect(project?.label).toBe("鸣镝");
  });

  it("B3 pause native removes from run", () => {
    const paused = { ...nativeRun, executionStatus: "paused" };
    const items = buildN2OpsFeed({
      viewerUserId: 1,
      stewardSessionId: "s-n2",
      rows: [steward, paused],
    });
    expect(items.find((i) => i.workerSessionId === "wb-run")?.status).not.toBe("run");
  });

  it("B5 stopall pauses viewer workers only", () => {
    const plan = planStopAll({
      viewerUserId: 1,
      stewardSessionId: "s-n2",
      rows: [steward, delegatedRun, nativeRun, otherUser, delegatedQueue],
    });
    expect(plan.pauseIds.sort()).toEqual(["w-queue", "w-run", "wb-run"].sort());
    expect(plan.skippedOtherUser).toContain("other-run");
    expect(plan.skippedSteward).toContain("s-n2");
  });

  it("B10/B12 files only from slotBindings", () => {
    const files = filesFromSlotBindingsOnly([
      { path: "a/提案.pdf", kind: "pdf", label: "提案" },
    ]);
    expect(files).toEqual([{ path: "a/提案.pdf", kind: "pdf", label: "提案" }]);
    expect(filesFromSlotBindingsOnly(undefined)).toEqual([]);
  });
});
