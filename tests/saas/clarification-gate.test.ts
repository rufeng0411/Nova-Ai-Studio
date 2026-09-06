import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  detectClarificationNeeded,
  hasConcreteTopic,
  isClarificationGateEnabled,
  isFollowUpPptFromExistingDeliverables,
  userMessageHasAttachments,
} from "../../src/saas/clarificationGate.js";
import {
  goalHasPageCount,
  isShortClarificationAnswerText,
  resolveClarificationGoal,
} from "../../ui/shared/deliverableSessionGoal.mjs";

describe("clarificationGate", () => {
  it("harness tag [L2-CLARIFY] 生成PPT still has no concrete topic", () => {
    expect(hasConcreteTopic("[L2-CLARIFY] 生成PPT")).toBe(false);
    const r = detectClarificationNeeded({
      userGoal: "[L2-CLARIFY] 生成PPT",
      hasAttachments: false,
      missingTopic: !hasConcreteTopic("[L2-CLARIFY] 生成PPT"),
    });
    expect(r.needed).toBe(true);
  });

  it("asks when ppt without attachment and direct start not requested", () => {
    const r = detectClarificationNeeded({
      userGoal: "生成PPT",
      hasAttachments: false,
      missingTopic: true,
    });
    expect(r.needed).toBe(true);
    expect(r.kind).toBe("preference");
    expect(r.hasDefaultOption).toBe(true);
  });
  it("auto-defaults PPT page count — never questionnaire-blocks", () => {
    const r = detectClarificationNeeded({
      userGoal: "做个PPT介绍我们公司",
      hasAttachments: false,
      missingPageCount: true,
    });
    expect(r.needed).toBe(false);
  });

  it("weekly-update PPT with 封面 sections skips page-count gate", () => {
    const goal =
      "简约周会更新 PPT (weekly-update)\n要求：\n封面：团队名称\n议程：议题\n项目进展：完成与计划\n关键数据：KPI\n总结与行动项：跟进";
    const r = detectClarificationNeeded({
      userGoal: goal,
      hasAttachments: false,
      missingPageCount: true,
      missingTopic: false,
    });
    expect(r.needed).toBe(false);
  });
  it("classifies the topic prompt via the shared elicitation classifier, not a hardcoded kind", () => {
    // The prompt contains 「上传」(a required-pattern word) yet offers a default
    // option, so the shared classifier must keep it a preference. This guards the
    // dedupe: if clarificationGate ever reverts to hardcoding, intent stays correct.
    const r = detectClarificationNeeded({
      userGoal: "生成PPT",
      hasAttachments: false,
      missingTopic: true,
    });
    expect(r.kind).toBe("preference");
  });
  it("skips when direct start", () => {
    const r = detectClarificationNeeded({
      userGoal: "生成PPT，直接开始做",
      hasAttachments: false,
      missingTopic: true,
    });
    expect(r.needed).toBe(false);
  });

  it("1bde3fb1: 直接执行 / 禁止空转 skips clarification", () => {
    const r = detectClarificationNeeded({
      userGoal: "参考附件做内容飞轮：选题→长文→社媒切片，禁止空转，直接执行。",
      hasAttachments: true,
      missingPageCount: true,
      missingTopic: false,
    });
    expect(r.needed).toBe(false);
  });

  it("1bde3fb1: inlined attachment HTML mentioning PPT must not ask page count", () => {
    const polluted =
      "参考附件内容做内容飞轮：选题→长文→社媒切片，禁止空转，直接执行。\n" +
      "<attachment path=\"promo.html\">\n" +
      "<p>会给出报告、PPT、网页、视频等真实文件</p>\n" +
      "<p>美学幻灯、Bento 演示稿</p>\n" +
      "</attachment>";
    const r = detectClarificationNeeded({
      userGoal: polluted,
      hasAttachments: true,
      missingPageCount: true,
    });
    expect(r.needed).toBe(false);
  });
  it("detects attachments in user message blocks", () => {
    expect(userMessageHasAttachments([
      { role: "user", content: [{ type: "file", path: "a.docx" }] },
    ])).toBe(true);
    expect(userMessageHasAttachments([
      { role: "user", content: [{ type: "text", text: "hi" }] },
    ])).toBe(false);
  });
  it("hasConcreteTopic rejects bare ppt request", () => {
    expect(hasConcreteTopic("生成PPT")).toBe(false);
    expect(hasConcreteTopic("为吴裕泰品牌做12页春季营销PPT")).toBe(true);
  });
  it("goalHasPageCount matches 【6】页 and follow-up 6页", () => {
    expect(goalHasPageCount("【6】页 16:9 Nova 幻灯")).toBe(true);
    expect(goalHasPageCount("6页，开始做")).toBe(true);
    expect(goalHasPageCount("做个PPT介绍我们公司")).toBe(false);
  });

  it("Showcase: 8，继续 is a page answer even when stamped synthetic", () => {
    expect(isShortClarificationAnswerText("8，继续")).toBe(true);
    expect(isShortClarificationAnswerText("8")).toBe(true);
    const merged = resolveClarificationGoal([
      {
        role: "user",
        content: [{ type: "text", text: "杂志风格融资路演 PPT\n封面：品牌\n议程：融资" }],
      },
      {
        role: "user",
        content: [{ type: "text", text: "8，继续" }],
        metadata: { synthetic: true },
      },
    ]);
    expect(merged).toContain("8，继续");
    expect(goalHasPageCount(merged)).toBe(true);
  });
  it("skips page-count clarification when nova-ppt goal already has page count", () => {
    const r = detectClarificationNeeded({
      userGoal: "【6】页 16:9 韩国出局主题幻灯",
      capabilitySlug: "nova-ppt-aesthetic-slides",
      missingPageCount: true,
    });
    expect(r.needed).toBe(false);
  });
  it("CL-01: ppt-master slug skips page count question", () => {
    const r = detectClarificationNeeded({
      userGoal: "用原生可编辑 PPT 做融资路演",
      capabilitySlug: "ppt-master",
      hasAttachments: false,
      missingPageCount: true,
    });
    expect(r.needed).toBe(false);
  });
  it("CL-02: goal with 原生可编辑 PPT skips clarification", () => {
    const r = detectClarificationNeeded({
      userGoal: "用「原生可编辑 PPT」做 10 页路演稿",
      hasAttachments: false,
      missingPageCount: true,
      missingTopic: true,
    });
    expect(r.needed).toBe(false);
  });

  it("ROG: html-ppt direct-start with 【页数】 skips clarification (M3)", () => {
    const r = detectClarificationNeeded({
      userGoal: "为 ROG2026 做页动画 HTML 演示，【页数】10，直接开始做，做完告诉我 artifacts 路径",
      capabilitySlug: "html-ppt-skill",
      missingPageCount: true,
      missingTopic: false,
      hasAttachments: false,
    });
    expect(r.needed).toBe(false);
  });
  it("isClarificationGateEnabled respects env", () => {
    const prev = process.env.PILOTDECK_CLARIFICATION_GATE;
    process.env.PILOTDECK_CLARIFICATION_GATE = "0";
    expect(isClarificationGateEnabled()).toBe(false);
    process.env.PILOTDECK_CLARIFICATION_GATE = "1";
    expect(isClarificationGateEnabled()).toBe(true);
    if (prev === undefined) delete process.env.PILOTDECK_CLARIFICATION_GATE;
    else process.env.PILOTDECK_CLARIFICATION_GATE = prev;
  });

  it("ES9 RCA: skips clarification for 做成PPT when SDM already has report deliverables", () => {
    const manifest = {
      sessionGoalAnchor: "根据【蔚来ES9技术】做四格式交付包…report.pptx",
      slots: [
        { id: "slot_1", kind: "markdown", status: "done", resolvedPath: "artifacts/task/report.md" },
        { id: "slot_4", kind: "pptx", status: "done", resolvedPath: "artifacts/task/report.pptx" },
      ],
    };
    expect(isFollowUpPptFromExistingDeliverables("做成PPT", manifest)).toBe(true);
    const r = detectClarificationNeeded({
      userGoal: "做成PPT",
      hasAttachments: false,
      missingTopic: true,
      sessionManifest: manifest,
    });
    expect(r.needed).toBe(false);
  });

  it("still asks for bare 生成PPT without session manifest context", () => {
    const r = detectClarificationNeeded({
      userGoal: "生成PPT",
      hasAttachments: false,
      missingTopic: true,
    });
    expect(r.needed).toBe(true);
  });

  it("recognizes parsed attachment text blocks and pdf type", () => {
    expect(userMessageHasAttachments([
      { role: "user", content: [{ type: "text", text: "根据附件生成PPT\n<attachment parsed>正文</attachment>" }] },
    ])).toBe(true);
    expect(userMessageHasAttachments([
      { role: "user", content: [{ type: "pdf", path: "brief.pdf" }] },
    ])).toBe(true);
    expect(userMessageHasAttachments([
      { role: "user", content: [{ type: "text", text: "[Files attached: brief.docx]" }] },
    ])).toBe(true);
  });

  it("does not ask topic when attachment markup is inlined with 根据附件生成PPT", () => {
    const r = detectClarificationNeeded({
      userGoal: "根据附件生成PPT\n<attachment parsed>季度经营摘要</attachment>",
      hasAttachments: false,
      missingTopic: true,
    });
    expect(r.needed).toBe(false);
  });
});

describe("expensive intent fuse via clarificationGate", () => {
  const dual = [
    "帮我做知乎选题和一篇长文，主题：企业级 Agent 落地。",
    "须交付：01-topics.md、02-longform.md。",
    "另外做成一份PPT。",
    "写入系统分配任务目录。",
  ].join("\n");
  const zhihu = [
    "帮我做知乎选题和一篇长文，主题：企业级 Agent 落地。",
    "须交付：01-topics.md、02-longform.md。",
    "这两个内容在 PPT 里没有展示。",
    "写入系统分配任务目录。",
  ].join("\n");
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    saved.gate = process.env.PILOTDECK_CLARIFICATION_GATE;
    saved.fuse = process.env.PILOTDECK_EXPENSIVE_INTENT_CLARIFY;
    process.env.PILOTDECK_CLARIFICATION_GATE = "1";
  });

  afterEach(() => {
    if (saved.gate === undefined) delete process.env.PILOTDECK_CLARIFICATION_GATE;
    else process.env.PILOTDECK_CLARIFICATION_GATE = saved.gate;
    if (saved.fuse === undefined) delete process.env.PILOTDECK_EXPENSIVE_INTENT_CLARIFY;
    else process.env.PILOTDECK_EXPENSIVE_INTENT_CLARIFY = saved.fuse;
  });

  it("ZHIHU_ABSENCE does not ask", () => {
    process.env.PILOTDECK_EXPENSIVE_INTENT_CLARIFY = "enforce";
    expect(detectClarificationNeeded({ userGoal: zhihu, latestUserRaw: zhihu }).needed).toBe(false);
  });

  it("DUAL enforce asks required fuse once", () => {
    process.env.PILOTDECK_EXPENSIVE_INTENT_CLARIFY = "enforce";
    const r = detectClarificationNeeded({
      userGoal: dual,
      latestUserRaw: dual,
    });
    expect(r.needed).toBe(true);
    expect(r.kind).toBe("required");
    expect(r.hasDefaultOption).toBe(false);
    expect(r.fingerprint).toBe("expensive_intent:ppt_vs_named_files");
    expect(r.question).toMatch(/需要你选一下|点名要做的文件/);
  });

  it("DUAL shadow/off does not ask", () => {
    process.env.PILOTDECK_EXPENSIVE_INTENT_CLARIFY = "shadow";
    expect(detectClarificationNeeded({ userGoal: dual, latestUserRaw: dual }).needed).toBe(false);
    process.env.PILOTDECK_EXPENSIVE_INTENT_CLARIFY = "off";
    expect(detectClarificationNeeded({ userGoal: dual, latestUserRaw: dual }).needed).toBe(false);
  });

  it("DUAL + 直接开始做 does not ask", () => {
    process.env.PILOTDECK_EXPENSIVE_INTENT_CLARIFY = "enforce";
    const goal = `${dual}\n直接开始做`;
    expect(detectClarificationNeeded({ userGoal: goal, latestUserRaw: goal }).needed).toBe(false);
  });

  it("TRUE_PPT is not this fuse", () => {
    process.env.PILOTDECK_EXPENSIVE_INTENT_CLARIFY = "enforce";
    const r = detectClarificationNeeded({
      userGoal: "做一份周会PPT，须交付 presentation.pptx",
      latestUserRaw: "做一份周会PPT，须交付 presentation.pptx",
      missingTopic: false,
    });
    expect(r.fingerprint).not.toBe("expensive_intent:ppt_vs_named_files");
  });

  it("生成PPT without topic still uses preference questionnaire", () => {
    delete process.env.PILOTDECK_EXPENSIVE_INTENT_CLARIFY;
    const r = detectClarificationNeeded({
      userGoal: "生成PPT",
      hasAttachments: false,
      missingTopic: true,
    });
    expect(r.needed).toBe(true);
    expect(r.kind).toBe("preference");
    expect(r.hasDefaultOption).toBe(true);
  });

  it("already asked never asks again", () => {
    process.env.PILOTDECK_EXPENSIVE_INTENT_CLARIFY = "enforce";
    const r = detectClarificationNeeded({
      userGoal: dual,
      latestUserRaw: dual,
      alreadyAskedFingerprint: "expensive_intent:ppt_vs_named_files",
    });
    expect(r.needed).toBe(false);
  });

  it("R1: userGoal=DUAL latestUserRaw=继续 alreadyAsked → needed false", () => {
    process.env.PILOTDECK_EXPENSIVE_INTENT_CLARIFY = "enforce";
    const r = detectClarificationNeeded({
      userGoal: dual,
      latestUserRaw: "继续",
      alreadyAskedFingerprint: "expensive_intent:ppt_vs_named_files",
    });
    expect(r.needed).toBe(false);
  });
});
