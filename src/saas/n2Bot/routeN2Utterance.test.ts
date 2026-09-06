import { describe, expect, it, vi } from "vitest";
import {
  needsFileBeforeDelegate,
  routeN2Utterance,
  shouldDispatchWorker,
} from "./routeN2Utterance.js";

describe("routeN2Utterance", () => {
  it("A7 / F8 default unmatched is chat not delegate", () => {
    const r = routeN2Utterance({ text: "周会开场怎么更自然一点" });
    expect(r.kind).toBe("chat");
    expect(r.tier).not.toBe("T3");
  });

  it("F1 你好啊 is T0 and must not dispatch", () => {
    const r = routeN2Utterance({ text: "你好啊" });
    expect(r.tier).toBe("T0");
    expect(["wake", "thanks", "identity"]).toContain(r.kind);
    expect(shouldDispatchWorker(r, "你好啊", false)).toBe(false);
  });

  it("F2 identity T0", () => {
    const r = routeN2Utterance({ text: "你是谁" });
    expect(r.kind).toBe("identity");
    expect(r.tier).toBe("T0");
  });

  it("F3 帮我想想 is T2 chat not delegate", () => {
    const r = routeN2Utterance({ text: "帮我想想周会怎么讲" });
    expect(r.kind).toBe("chat");
    expect(r.tier).toBe("T2");
    expect(shouldDispatchWorker(r, "帮我想想周会怎么讲", false)).toBe(false);
  });

  it("F4 做一份周会 PPT is T3", () => {
    const r = routeN2Utterance({ text: "做一份 6 页周会 PPT" });
    expect(r.kind).toBe("delegate");
    expect(r.tier).toBe("T3");
  });

  it("F5 quality feedback with lastFocus is not a new worker", () => {
    const r = routeN2Utterance({ text: "这页好丑", lastFocusCardId: "w-weekly" });
    expect(r.kind).toBe("quality_feedback");
    expect(r.tier).not.toBe("T3");
  });

  it("F6 Hello Nova is wake T0", () => {
    const r = routeN2Utterance({ text: "Hello Nova" });
    expect(r.kind).toBe("wake");
    expect(r.tier).toBe("T0");
  });

  it("F9 按这份材料 without attachments does not dispatch", () => {
    const r = routeN2Utterance({ text: "按这份材料做 PPT", hasAttachments: false });
    expect(needsFileBeforeDelegate("按这份材料做 PPT", false)).toBe(true);
    expect(shouldDispatchWorker(r, "按这份材料做 PPT", false)).toBe(false);
  });

  it("B6 progress / ? is T1 not acceptTurn", () => {
    expect(routeN2Utterance({ text: "进度" }).kind).toBe("progress");
    expect(routeN2Utterance({ text: "？" }).kind).toBe("progress");
    expect(routeN2Utterance({ text: "手头" }).tier).toBe("T1");
  });

  it("stopall / peek / share / send", () => {
    expect(routeN2Utterance({ text: "都停" }).kind).toBe("stopall");
    expect(routeN2Utterance({ text: "收起" }).kind).toBe("peek_close");
    expect(routeN2Utterance({ text: "下一页" }).kind).toBe("peek_next");
    expect(routeN2Utterance({ text: "分享" }).kind).toBe("share");
    expect(routeN2Utterance({ text: "发给李总" }).kind).toBe("send");
    expect(routeN2Utterance({ text: "允许" }).kind).toBe("allow");
  });

  it("pending elicit only maps options", () => {
    const r = routeN2Utterance({
      text: "确定",
      pendingElicit: { optionIds: ["confirm", "cancel"] },
    });
    expect(r.kind).toBe("confirm_delete");
    expect(r.tier).toBe("T1");
  });

  it("F1 greeting path must not await fetch — classifier is sync", () => {
    const fetchSpy = vi.fn();
    const r = routeN2Utterance({ text: "谢谢" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(r.tier).toBe("T0");
  });
});
