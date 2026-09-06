import { describe, expect, it } from "vitest";
import { parseUserActionNoticeFromMessage, sessionHasPendingUserActionRequired } from "./parseUserActionNotice.js";

describe("parseUserActionNoticeFromMessage", () => {
  it("reads structured userActionNotice", () => {
    const parsed = parseUserActionNoticeFromMessage({
      purpose: "user_action_required",
      userActionNotice: {
        title: "需要您完成一项配置",
        reason: "缺少 Key",
        steps: ["打开设置", "保存"],
      },
    });
    expect(parsed?.title).toContain("配置");
    expect(parsed?.steps).toHaveLength(2);
  });

  it("parses numbered steps from plain text", () => {
    const parsed = parseUserActionNoticeFromMessage({
      purpose: "user_action_required",
      content: [
        "需要您完成一项配置",
        "已尝试 3 种方式，仍缺少 MinerU 的 API Key",
        "1. 打开 设置",
        "2. 填入 Key",
      ].join("\n"),
    });
    expect(parsed?.steps.length).toBeGreaterThanOrEqual(2);
  });
});

describe("sessionHasPendingUserActionRequired", () => {
  it("blocks auto-continue while the latest card is unresolved", () => {
    expect(sessionHasPendingUserActionRequired([
      {
        type: "assistant",
        purpose: "user_action_required",
        content: "需要您完成一项配置\n已尝试 3 种方式，仍缺少 蚁小二 的 API Key\n1. 打开 设置",
      },
    ])).toBe(true);
  });

  it("clears after the user confirms configuration", () => {
    expect(sessionHasPendingUserActionRequired([
      {
        type: "assistant",
        purpose: "user_action_required",
        content: "需要您完成一项配置\n已尝试 3 种方式，仍缺少 蚁小二 的 API Key\n1. 打开 设置",
      },
      { type: "user", content: "已配置，继续" },
    ])).toBe(false);
  });

  it("stays blocked when the user only sends continue", () => {
    expect(sessionHasPendingUserActionRequired([
      {
        type: "assistant",
        purpose: "user_action_required",
        content: "需要您完成一项配置\n已尝试 3 种方式，仍缺少 蚁小二 的 API Key\n1. 打开 设置",
      },
      { type: "user", content: "继续" },
    ])).toBe(true);
  });

  it("expensive intent fuse clears pending after any non-synthetic user reply", () => {
    const asked = {
      type: "assistant",
      purpose: "user_action_required",
      metadata: { expensiveIntentFingerprint: "expensive_intent:ppt_vs_named_files" },
      content: "需要你选一下\n你点名要做的文件",
      userActionNotice: {
        title: "需要你选一下",
        reason: "你点名要做的文件，同时又说要做演示稿。",
        steps: ["按你点名的文件做（选题和长文），先不做演示稿"],
      },
    };
    expect(sessionHasPendingUserActionRequired([asked, { type: "user", content: "继续" }])).toBe(false);
    expect(sessionHasPendingUserActionRequired([asked, { type: "user", content: "？" }])).toBe(false);
    expect(sessionHasPendingUserActionRequired([asked])).toBe(true);
  });
});
