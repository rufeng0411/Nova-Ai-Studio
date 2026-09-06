import { describe, expect, it } from "vitest";
import { isPureGreetingUserText, resolveCurrentIntent } from "./resolveCurrentIntent.js";

describe("resolveCurrentIntent", () => {
  it("treats pure greeting as dialogue", () => {
    const result = resolveCurrentIntent({ userText: "你好" });
    expect(result.mode).toBe("dialogue");
    expect(result.reasonCode).toBe("natural_discussion");
  });

  it("treats role-play chat as dialogue", () => {
    const result = resolveCurrentIntent({
      userText: "我想跟马斯克聊聊火星移民",
    });
    expect(result.mode).toBe("dialogue");
  });

  it("treats search-then-chat as execute", () => {
    const result = resolveCurrentIntent({
      userText: "查一下马斯克今天说了什么，再聊聊",
    });
    expect(result.mode).toBe("execute");
  });

  it("treats generate-from-chat as execute", () => {
    const result = resolveCurrentIntent({
      userText: "把刚才聊的内容生成一张海报",
      priorMode: "dialogue",
    });
    expect(result.mode).toBe("execute");
  });

  it("asks when analyze intent is ambiguous", () => {
    const result = resolveCurrentIntent({
      userText: "帮我分析一下这个市场",
    });
    expect(result.mode).toBe("clarify");
    expect(result.clarification?.fingerprint).toBe("intent:ambiguous_analyze");
    expect(result.clarification?.options).toHaveLength(2);
  });

  it("fuses repeated ambiguous analyze to dialogue", () => {
    const result = resolveCurrentIntent({
      userText: "帮我分析一下这个市场",
      priorClarifyFingerprint: "intent:ambiguous_analyze",
      consecutiveClarifyCount: 1,
    });
    expect(result.mode).toBe("dialogue");
    expect(result.reasonCode).toBe("clarify_fuse_dialogue");
  });

  it("honours explicit chat negation over stored execute binding", () => {
    const result = resolveCurrentIntent({
      userText: "先聊聊，不要搜索也不要生成文件",
      capabilityContext: { slug: "geo-serp-analysis", majorCategory: "geo" },
      priorMode: "execute",
    });
    expect(result.mode).toBe("dialogue");
  });

  it("routes explicit non-chat-first capability to execute", () => {
    const result = resolveCurrentIntent({
      userText: "试一下",
      capabilityContext: { slug: "geo-serp-analysis", majorCategory: "geo" },
    });
    expect(result.mode).toBe("execute");
  });

  it("routes chat-first capability without deliverable signal to dialogue", () => {
    const result = resolveCurrentIntent({
      userText: "我们聊聊品牌定位",
      capabilityContext: { slug: "persona-founder", majorCategory: "brainstorming" },
    });
    expect(result.mode).toBe("dialogue");
  });

  it("defaults bare continue to execute when no anchor", () => {
    const result = resolveCurrentIntent({
      userText: "继续",
    });
    expect(result.mode).toBe("execute");
    expect(result.reasonCode).toBe("continuation_execute");
  });

  it("routes question mark to execute when prior turn was execute", () => {
    const result = resolveCurrentIntent({
      userText: "？",
      priorMode: "execute",
    });
    expect(result.mode).toBe("execute");
    expect(result.reasonCode).toBe("continuation_execute");
  });

  it("routes question mark to dialogue when prior turn was dialogue", () => {
    const result = resolveCurrentIntent({
      userText: "?",
      priorMode: "dialogue",
    });
    expect(result.mode).toBe("dialogue");
  });

  it("routes deep research query to execute", () => {
    const result = resolveCurrentIntent({
      userText: "帮我深度查询最新的ai agent趋势",
    });
    expect(result.mode).toBe("execute");
    expect(result.reasonCode).toBe("explicit_execute_action");
  });

  it("continues chat when prior mode was dialogue", () => {
    const result = resolveCurrentIntent({
      userText: "继续",
      priorMode: "dialogue",
    });
    expect(result.mode).toBe("dialogue");
  });

  it("continues execute when prior mode was execute", () => {
    const result = resolveCurrentIntent({
      userText: "继续",
      priorMode: "execute",
    });
    expect(result.mode).toBe("execute");
  });

  it("treats mixed chat-first without immediate deliverable as dialogue", () => {
    const result = resolveCurrentIntent({
      userText: "先聊聊再决定是否生成海报",
    });
    expect(result.mode).toBe("dialogue");
    expect(result.reasonCode).toBe("mixed_intent_dialogue_first");
  });

  it("treats mixed immediate deliverable as execute", () => {
    const result = resolveCurrentIntent({
      userText: "先分析并直接生成报告",
    });
    expect(result.mode).toBe("execute");
  });

  it("isPureGreetingUserText matches casual hello", () => {
    expect(isPureGreetingUserText("你好啊")).toBe(true);
    expect(isPureGreetingUserText("帮我写报告")).toBe(false);
  });
});
