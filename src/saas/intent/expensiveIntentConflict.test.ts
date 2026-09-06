import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  EXPENSIVE_INTENT_PPT_VS_FILES,
  admitExpensiveIntentAsk,
  assertExpensiveIntentAskPayload,
  detectExpensiveIntentConflict,
  expensiveIntentUserCopy,
  resolveExpensiveIntentCompileGoal,
  resolveExpensiveIntentConflictReply,
  stripImperativePptFromGoal,
} from "./expensiveIntentConflict.js";

const ZHIHU_ABSENCE = [
  "帮我做知乎选题和一篇长文，主题：企业级 Agent 落地。",
  "须交付：01-topics.md、02-longform.md。",
  "这两个内容在 PPT 里没有展示。",
  "写入系统分配任务目录。",
].join("\n");

const DUAL = [
  "帮我做知乎选题和一篇长文，主题：企业级 Agent 落地。",
  "须交付：01-topics.md、02-longform.md。",
  "另外做成一份PPT。",
  "写入系统分配任务目录。",
].join("\n");

const TRUE_PPT = "做一份周会PPT，须交付 presentation.pptx";

const ENFORCE_ADMIT = {
  userGoal: DUAL,
  mode: "enforce" as const,
  loopIteration: 1,
  latestUserRaw: DUAL,
};

describe("expensiveIntentConflict", () => {
  const savedGate = process.env.PILOTDECK_CLARIFICATION_GATE;

  beforeEach(() => {
    process.env.PILOTDECK_CLARIFICATION_GATE = "1";
  });

  afterEach(() => {
    if (savedGate === undefined) delete process.env.PILOTDECK_CLARIFICATION_GATE;
    else process.env.PILOTDECK_CLARIFICATION_GATE = savedGate;
  });

  it("知乎缺席投诉 is not a conflict", () => {
    expect(detectExpensiveIntentConflict(ZHIHU_ABSENCE)).toBeNull();
  });

  it("named md + imperative PPT is the ppt_vs_named_files fuse", () => {
    expect(detectExpensiveIntentConflict(DUAL)?.fingerprint).toBe(EXPENSIVE_INTENT_PPT_VS_FILES);
  });

  it("须交付 pptx is not a conflict", () => {
    expect(detectExpensiveIntentConflict(TRUE_PPT)).toBeNull();
  });

  it("strips imperative PPT but keeps named md files", () => {
    const stripped = stripImperativePptFromGoal(DUAL);
    expect(stripped).not.toMatch(/做成一份PPT/i);
    expect(stripped).toMatch(/01-topics\.md/);
  });

  it("does not strip a named pptx deliverable", () => {
    expect(stripImperativePptFromGoal(TRUE_PPT)).toMatch(/PPT|pptx/i);
  });

  it("shadow/off never ask", () => {
    expect(admitExpensiveIntentAsk({
      ...ENFORCE_ADMIT,
      mode: "shadow",
    }).action).not.toBe("ask");
    expect(admitExpensiveIntentAsk({
      ...ENFORCE_ADMIT,
      mode: "off",
    }).action).not.toBe("ask");
  });

  it("enforce + DUAL + latestUserRaw=DUAL asks once", () => {
    const decision = admitExpensiveIntentAsk(ENFORCE_ADMIT);
    expect(decision.action).toBe("ask");
  });

  it("loopIteration 2 cannot ask", () => {
    expect(admitExpensiveIntentAsk({
      ...ENFORCE_ADMIT,
      loopIteration: 2,
    }).action).toBe("fallback_keep");
  });

  it("already-asked fingerprint never asks again", () => {
    expect(admitExpensiveIntentAsk({
      ...ENFORCE_ADMIT,
      latestUserRaw: "继续",
      alreadyAskedFingerprint: EXPENSIVE_INTENT_PPT_VS_FILES,
    }).action).not.toBe("ask");
    expect(admitExpensiveIntentAsk({
      ...ENFORCE_ADMIT,
      latestUserRaw: "？",
      alreadyAskedFingerprint: EXPENSIVE_INTENT_PPT_VS_FILES,
    }).action).not.toBe("ask");
  });

  it("A10: latestUserRaw 继续 cannot first-fire even if userGoal is DUAL", () => {
    expect(admitExpensiveIntentAsk({
      userGoal: DUAL,
      mode: "enforce",
      loopIteration: 1,
      latestUserRaw: "继续",
      alreadyAskedFingerprint: null,
    }).action).not.toBe("ask");
  });

  it("task-resume is fallback_keep", () => {
    expect(admitExpensiveIntentAsk({
      ...ENFORCE_ADMIT,
      latestUserRaw: "<task-resume>\n<user_goal>x</user_goal>\n</task-resume>",
    }).action).toBe("fallback_keep");
  });

  it("assert rejects preference / wrong fingerprint / 继续 in options", () => {
    const copy = expensiveIntentUserCopy("zh-CN");
    expect(assertExpensiveIntentAskPayload({
      kind: "preference",
      hasDefaultOption: true,
      fingerprint: EXPENSIVE_INTENT_PPT_VS_FILES,
      question: copy.reason,
      optionKeep: copy.optionKeep,
      optionSwitch: copy.optionSwitch,
    })).toBe(false);
    expect(assertExpensiveIntentAskPayload({
      kind: "required",
      hasDefaultOption: false,
      fingerprint: "missing_input:clarification",
      question: copy.reason,
      optionKeep: copy.optionKeep,
      optionSwitch: copy.optionSwitch,
    })).toBe(false);
    expect(assertExpensiveIntentAskPayload({
      kind: "required",
      hasDefaultOption: false,
      fingerprint: EXPENSIVE_INTENT_PPT_VS_FILES,
      question: "x",
      optionKeep: "继续按推荐做",
      optionSwitch: copy.optionSwitch,
    })).toBe(false);
  });

  it("assert accepts required payload with frozen copy", () => {
    const copy = expensiveIntentUserCopy("zh-CN");
    const question = [copy.reason, `1. ${copy.optionKeep}`, `2. ${copy.optionSwitch}`, copy.hint].join("\n");
    expect(assertExpensiveIntentAskPayload({
      kind: "required",
      hasDefaultOption: false,
      fingerprint: EXPENSIVE_INTENT_PPT_VS_FILES,
      question,
      optionKeep: copy.optionKeep,
      optionSwitch: copy.optionSwitch,
    })).toBe(true);
  });

  it("pending replies always handled; only 2 switches", () => {
    const fp = EXPENSIVE_INTENT_PPT_VS_FILES;
    for (const text of ["继续", "？", "啊？", "好", "……", "8", DUAL]) {
      const reply = resolveExpensiveIntentConflictReply(text, fp);
      expect(reply.handled).toBe(true);
      expect(reply.chosen).toBe("keep_must_deliver");
    }
    expect(resolveExpensiveIntentConflictReply("2", fp).chosen).toBe("switch_to_ppt");
    expect(resolveExpensiveIntentConflictReply("现在改做演示稿", fp).chosen).toBe("switch_to_ppt");
    expect(resolveExpensiveIntentConflictReply("改做PPT", fp).chosen).toBe("switch_to_ppt");
    expect(resolveExpensiveIntentConflictReply("随便", null).handled).toBe(false);
  });

  it("pending never returns handled=false", () => {
    for (const text of ["", "   ", "???", "新需求请改成调研报告", "1", "2"]) {
      expect(resolveExpensiveIntentConflictReply(text, EXPENSIVE_INTENT_PPT_VS_FILES).handled).toBe(true);
    }
  });

  it("compile overlay strips only in enforce keep", () => {
    const shadow = resolveExpensiveIntentCompileGoal({ userGoal: DUAL, mode: "shadow" });
    expect(shadow.stripped).toBe(false);
    expect(shadow.compileGoal).toBe(DUAL);
    const enforce = resolveExpensiveIntentCompileGoal({ userGoal: DUAL, mode: "enforce" });
    expect(enforce.stripped).toBe(true);
    expect(enforce.compileGoal).not.toMatch(/做成一份PPT/i);
    const switched = resolveExpensiveIntentCompileGoal({
      userGoal: DUAL,
      mode: "enforce",
      chosen: "switch_to_ppt",
    });
    expect(switched.stripped).toBe(false);
  });

  it("user copy options never contain 继续/推荐/默认", () => {
    for (const lang of ["zh-CN", "en"] as const) {
      const copy = expensiveIntentUserCopy(lang);
      expect(copy.optionKeep).not.toMatch(/继续|推荐|默认|default|continue/i);
      expect(copy.optionSwitch).not.toMatch(/继续|推荐|默认|default|continue/i);
      expect(copy.title).toMatch(lang === "zh-CN" ? /需要你选一下/ : /Need a quick choice/);
    }
  });
});
