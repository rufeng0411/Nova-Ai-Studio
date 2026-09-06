import { describe, expect, it } from "vitest";
import {
  buildImNotifyBindingAppendPrompt,
  userWantsImNotify,
} from "./notifyIntent.js";

describe("notifyIntent", () => {
  it("detects explicit notify intents", () => {
    expect(userWantsImNotify("发到企微：任务完成了")).toBe(true);
    expect(userWantsImNotify("请推送到钉钉")).toBe(true);
    expect(userWantsImNotify("notify to whatsapp")).toBe(true);
  });

  it("rejects greetings and unrelated text", () => {
    expect(userWantsImNotify("你好啊")).toBe(false);
    expect(userWantsImNotify("帮我写一份报告")).toBe(false);
  });

  it("binding prompt only when flag on and intent match", () => {
    expect(
      buildImNotifyBindingAppendPrompt({ flag: "off", userText: "发到企微" }),
    ).toBe("");
    expect(
      buildImNotifyBindingAppendPrompt({ flag: "enforce", userText: "你好" }),
    ).toBe("");
    expect(
      buildImNotifyBindingAppendPrompt({
        flag: "enforce",
        userText: "发到钉钉通知一下",
      }),
    ).toContain("notify_send");
  });
});
