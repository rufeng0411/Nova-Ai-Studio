import { describe, expect, it } from "vitest";
import {
  isValidDeleteConfirmToken,
  resolveSessionVoiceAction,
} from "./sessionVoiceActions.js";
import type { N2OpsItem } from "./n2BotTypes.js";

const weekly: N2OpsItem = {
  workerSessionId: "w-weekly",
  title: "周会",
  status: "done",
  step: "ok",
};
const research: N2OpsItem = {
  workerSessionId: "w-research",
  title: "调研",
  status: "run",
  step: "run",
};
const runningB: N2OpsItem = {
  workerSessionId: "w-b",
  title: "报告B",
  status: "run",
  step: "run",
};

const owned = ["w-weekly", "w-research", "w-b"];

describe("sessionVoiceActions", () => {
  it("lock 周会 and 调研", () => {
    const r = resolveSessionVoiceAction({
      kind: "lock",
      text: "锁定周会和调研",
      cards: [weekly, research, runningB],
      viewerOwnedIds: owned,
    });
    expect(r.type).toBe("lock");
    if (r.type === "lock") {
      expect(r.sessionIds.sort()).toEqual(["w-research", "w-weekly"].sort());
    }
  });

  it("进行中都锁上 only run group", () => {
    const r = resolveSessionVoiceAction({
      kind: "lock",
      text: "把进行中那几件都锁上",
      cards: [weekly, research, runningB],
      viewerOwnedIds: owned,
    });
    expect(r.type).toBe("lock");
    if (r.type === "lock") {
      expect(r.sessionIds.sort()).toEqual(["w-b", "w-research"].sort());
    }
  });

  it("locked delete asks unlock first", () => {
    const r = resolveSessionVoiceAction({
      kind: "delete_record",
      text: "删掉周会",
      cards: [weekly],
      viewerOwnedIds: owned,
      flagsBySessionId: { "w-weekly": { locked: true } },
    });
    expect(r.type).toBe("delete_blocked_locked");
  });

  it("delete without confirm does not execute", () => {
    const r = resolveSessionVoiceAction({
      kind: "delete_record",
      text: "删掉周会",
      cards: [weekly],
      viewerOwnedIds: owned,
    });
    expect(r.type).toBe("delete_card");
    if (r.type === "delete_card") {
      expect(r.card.body).toContain("无法撤销");
      expect(isValidDeleteConfirmToken(r.card.confirmToken || "", ["w-weekly"])).toBe(true);
    }
  });

  it("confirm_delete executes with token", () => {
    const pending = resolveSessionVoiceAction({
      kind: "delete_record",
      text: "删掉周会",
      cards: [weekly],
      viewerOwnedIds: owned,
    });
    if (pending.type !== "delete_card" || !pending.card.confirmToken) {
      throw new Error("expected card");
    }
    const r = resolveSessionVoiceAction({
      kind: "confirm_delete",
      text: "确定",
      cards: [weekly],
      viewerOwnedIds: owned,
      pendingDelete: {
        sessionIds: ["w-weekly"],
        confirmToken: pending.card.confirmToken,
      },
    });
    expect(r.type).toBe("delete_execute");
  });

  it("算了 cancels", () => {
    const r = resolveSessionVoiceAction({
      kind: "close",
      text: "算了",
      cards: [weekly],
      viewerOwnedIds: owned,
    });
    expect(r.type).toBe("cancel");
  });

  it("cannot delete steward", () => {
    const r = resolveSessionVoiceAction({
      kind: "delete_record",
      text: "删掉管家",
      cards: [{ workerSessionId: "s-n2", title: "管家", status: "done", step: "", sessionKind: "n2_bot" }],
      viewerOwnedIds: ["s-n2"],
      stewardSessionId: "s-n2",
    });
    expect(r.type).toBe("reject");
    if (r.type === "reject") expect(r.reason).toBe("steward");
  });

  it("complete / uncomplete", () => {
    const done = resolveSessionVoiceAction({
      kind: "complete_task",
      text: "这件任务完成",
      cards: [weekly],
      lastFocusCardId: "w-weekly",
      viewerOwnedIds: owned,
    });
    expect(done.type).toBe("complete");
    const undone = resolveSessionVoiceAction({
      kind: "uncomplete_task",
      text: "取消任务完成",
      cards: [weekly],
      lastFocusCardId: "w-weekly",
      viewerOwnedIds: owned,
    });
    expect(undone.type).toBe("uncomplete");
  });

  it("cross-user rejected", () => {
    const r = resolveSessionVoiceAction({
      kind: "delete_record",
      text: "删掉周会",
      cards: [weekly],
      viewerOwnedIds: ["someone-else"],
    });
    expect(r.type).toBe("reject");
    if (r.type === "reject") expect(r.reason).toBe("cross_user");
  });
});
