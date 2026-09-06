import { describe, expect, it } from "vitest";
import { isNovaWakePhrase, isNovaWakePhraseOnly } from "./isNovaWakePhrase.js";
import { formatVisitCount, greetingForOpen, novaLine } from "./novaPersona.js";

describe("isNovaWakePhrase", () => {
  it("F6 sentence-start only", () => {
    expect(isNovaWakePhrase("Hello Nova")).toBe(true);
    expect(isNovaWakePhrase("hey nova")).toBe(true);
    expect(isNovaWakePhrase("你好 Nova")).toBe(true);
    expect(isNovaWakePhrase("嗨 Nova")).toBe(true);
    expect(isNovaWakePhrase("嘿 Nova")).toBe(true);
    expect(isNovaWakePhrase("Hi Nova")).toBe(true);
    expect(isNovaWakePhraseOnly("Hello Nova")).toBe(true);
    expect(isNovaWakePhrase("请帮 Nova 写周会")).toBe(false);
    expect(isNovaWakePhrase("做一份 Nova 品牌 PPT")).toBe(false);
    expect(isNovaWakePhraseOnly("做一份 Nova 品牌 PPT")).toBe(false);
  });
});

describe("novaPersona", () => {
  it("F2 identity contains Nova, never Jarvis", () => {
    expect(novaLine("wake")).toContain("Nova");
    expect(novaLine("identity")).toContain("Nova");
    expect(novaLine("wake", "en")).toContain("Nova");
    expect(novaLine("wake")).not.toMatch(/贾维斯|Jarvis|Steward/i);
    expect(novaLine("deleteBody")).toBe("将从记录中删除此对话，且无法撤销");
  });

  it("greeting uses snapshot only when present", () => {
    expect(greetingForOpen({ hasOpenedBefore: false })).toBe("我是 Nova。要做啥直接说。");
    expect(greetingForOpen({ hasOpenedBefore: true })).toBe("在呢。说要做的就行。");
    expect(greetingForOpen({
      hasOpenedBefore: true,
      snapshot: { running: 3, waiting: 1 },
    })).toBe("3件在跑，1件等你。");
    expect(formatVisitCount(3, 1, "en")).toMatch(/3 running/);
  });
});
