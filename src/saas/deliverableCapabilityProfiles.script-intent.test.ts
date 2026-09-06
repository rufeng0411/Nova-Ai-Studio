import { afterEach, describe, expect, it } from "vitest";
import { compileSessionDeliverableManifest } from "./taskState/sessionDeliverableManifest.js";
import { buildTaskGoalContract } from "./taskState/taskGoalContract.js";
import { shouldTriggerDeliverableRepair } from "./taskContinuationPolicy.js";
import { resolveMediaStrategy } from "./media/mediaStrategyResolver.js";
import {
  isScriptDraftGoal,
  isVideoMp4FilmGoal,
  resolveProfile,
} from "./deliverableCapabilityProfiles.js";

describe("script vs film intent", () => {
  afterEach(() => {
    delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
    delete process.env.PILOTDECK_EXPENSIVE_INTENT_CLARIFY;
  });

  it("口播脚本 is markdown profile, not video-mp4", () => {
    expect(isScriptDraftGoal("写一个短视频口播脚本")).toBe(true);
    expect(isVideoMp4FilmGoal("写一个短视频口播脚本")).toBe(false);
    expect(resolveProfile(undefined, undefined, "写一个短视频口播脚本").id).toBe("script-md");
    const contract = buildTaskGoalContract({ userGoal: "写一个短视频口播脚本" });
    expect(contract.expectedKinds).toEqual(["markdown"]);
    expect(contract.expectedKinds).not.toContain("video");
  });

  it("生成视频脚本，不要做成视频 stays markdown", () => {
    expect(resolveProfile(undefined, undefined, "生成视频脚本，不要做成视频").id).toBe("script-md");
    expect(buildTaskGoalContract({ userGoal: "生成视频脚本，不要做成视频" }).expectedKinds).toEqual([
      "markdown",
    ]);
  });

  it("explicit film goals stay video-mp4", () => {
    expect(resolveProfile(undefined, undefined, "生成 10 秒广告视频").id).toBe("video-mp4");
    expect(resolveProfile(undefined, undefined, "文生视频成片").id).toBe("video-mp4");
    expect(buildTaskGoalContract({ userGoal: "生成 10 秒广告视频" }).expectedKinds).toContain("video");
  });

  it("产品演示脚本 is not ppt", () => {
    expect(resolveProfile(undefined, undefined, "产品演示脚本").id).toBe("script-md");
    expect(buildTaskGoalContract({ userGoal: "产品演示脚本" }).expectedKinds).not.toContain("pptx");
  });

  it("Python 脚本 is not video or html", () => {
    const profile = resolveProfile(undefined, undefined, "写一段 Python 脚本");
    expect(profile.id).toBe("default");
    const kinds = buildTaskGoalContract({ userGoal: "写一段 Python 脚本" }).expectedKinds;
    expect(kinds).not.toContain("video");
    expect(kinds).not.toContain("html");
  });

  it("script draft does not force render_html_video", () => {
    expect(resolveMediaStrategy("写一个短视频口播脚本")).toBe("default");
    expect(resolveMediaStrategy("生成视频脚本，不要做成视频")).toBe("default");
  });

  it("Hub film slugs still bind mp4", () => {
    expect(resolveProfile("tool-generate-video", undefined, "生成视频").id).toBe("video-mp4");
    expect(resolveProfile("hf-product-launch-video", undefined, "官网成片").id).toBe("hyperframes");
  });

  it("script-md SDM has no required mp4", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const manifest = compileSessionDeliverableManifest({
      userGoal: "写一个短视频口播脚本",
      turnId: "t1",
    });
    const kinds = (manifest?.slots ?? []).map((slot) => slot.kind);
    expect(kinds).not.toContain("video");
    expect((manifest?.slots ?? []).some((slot) => /\.mp4$/i.test(slot.pathHint ?? ""))).toBe(false);
  });

  it("attachment 须交付 does not expand research pack", () => {
    const polluted = [
      "出一份 HTML 报告",
      "<attachment parsed>",
      "须交付：01-sources.md",
      "01-sources-and-synthesis.md",
      "</attachment>",
    ].join("\n");
    expect(resolveProfile(undefined, undefined, polluted).id).toBe("html");
  });

  it("live 口播+须交付脚本.md does not compile html/video slots", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const goal = [
      "写一个短视频口播脚本，主题：智能手表开箱 30 秒。",
      "须交付：脚本.md",
      "不要做成视频，不要 mp4，不要 HTML 录屏。",
      "直接开始做，写入系统分配任务目录。",
    ].join("\n");
    expect(resolveProfile(undefined, undefined, goal).id).toBe("script-md");
    const manifest = compileSessionDeliverableManifest({ userGoal: goal, turnId: "t-live-script" });
    const kinds = (manifest?.slots ?? []).map((slot) => slot.kind);
    expect(kinds).not.toContain("video");
    expect(kinds).not.toContain("html");
    expect((manifest?.slots ?? []).some((slot) => /脚本\.md$/i.test(slot.pathHint ?? ""))).toBe(true);
  });

  it("HTML 简报 + 不要 PPT binds html not ppt", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const goal = [
      "写一份极简单页 HTML 简报，主题：北京早高峰通勤观察。",
      "须交付：report.html",
      "不要配图、不要调研包、不要 Word/PPT。",
      "直接开始做，写入系统分配任务目录。",
    ].join("\n");
    expect(resolveProfile(undefined, undefined, goal).id).toBe("html");
    const manifest = compileSessionDeliverableManifest({ userGoal: goal, turnId: "t-live-html" });
    const htmlHint = (manifest?.slots ?? []).find((slot) => slot.kind === "html")?.pathHint ?? "";
    expect(htmlHint).toMatch(/report\.html$/i);
    expect(htmlHint).not.toMatch(/不要配图/);
  });

  it("附件 HTML 摘要 须交付 report.html binds html not research", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const goal = [
      "根据附件生成一份 HTML 摘要，须交付：report.html，直接开始做。",
      "<attachment parsed path=\"brief.docx\">",
      "季度经营摘要：营收同比增长 18%。",
      "</attachment>",
    ].join("\n");
    expect(resolveProfile(undefined, undefined, goal).id).toBe("html");
    const manifest = compileSessionDeliverableManifest({ userGoal: goal, turnId: "t-live-attach" });
    const htmlHint = (manifest?.slots ?? []).find((slot) => slot.kind === "html")?.pathHint ?? "";
    expect(htmlHint).toMatch(/report\.html$/i);
    expect(htmlHint).not.toMatch(/根据附件|须交付|直接开始做/);
  });

  it("verified script md does not trigger film repair", () => {
    expect(shouldTriggerDeliverableRepair({
      userGoal: "写一个短视频口播脚本",
      validationResult: {
        acceptance: "needs_repair",
        verified: ["artifacts/task-x/脚本.md"],
        missing: ["artifacts/task-x/promo.mp4"],
        broken: [],
      },
      sessionManifest: {
        profileId: "script-md",
        slots: [{ id: "s1", kind: "markdown", status: "done", pathHint: "脚本.md" }],
      },
    } as never)).toBe(false);
  });

  it("知乎选题长文 +「在 PPT 里没有展示」does not bind ppt", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const goal = [
      "帮我做知乎选题和一篇长文，主题：企业级 Agent 落地。",
      "须交付：01-topics.md、02-longform.md。",
      "这两个内容在 PPT 里没有展示。",
      "写入系统分配任务目录。",
    ].join("\n");
    expect(resolveProfile(undefined, undefined, goal).id).not.toBe("ppt");
    const manifest = compileSessionDeliverableManifest({ userGoal: goal, turnId: "t-zhihu-ppt-absence" });
    const hints = (manifest?.slots ?? []).map((slot) => String(slot.pathHint ?? ""));
    expect(hints.some((hint) => /01-topics\.md$/i.test(hint))).toBe(true);
    expect(hints.some((hint) => /02-longform\.md$/i.test(hint))).toBe(true);
    expect(hints.some((hint) => /presentation\.pptx$/i.test(hint))).toBe(false);
    expect(manifest?.profileId).not.toBe("ppt");
  });

  it("explicit PPT goal still binds ppt", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    const goal = "做一份周会PPT，须交付：presentation.pptx。写入系统分配任务目录。";
    expect(resolveProfile(undefined, undefined, goal).id).toBe("ppt");
  });

  it("enforce dual named-files vs PPT compiles md slots and keeps original anchor", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    process.env.PILOTDECK_EXPENSIVE_INTENT_CLARIFY = "enforce";
    const dual = [
      "帮我做知乎选题和一篇长文，主题：企业级 Agent 落地。",
      "须交付：01-topics.md、02-longform.md。",
      "另外做成一份PPT。",
      "写入系统分配任务目录。",
    ].join("\n");
    const manifest = compileSessionDeliverableManifest({ userGoal: dual, turnId: "t-dual-enforce" });
    const hints = (manifest?.slots ?? []).map((slot) => String(slot.pathHint ?? ""));
    expect(manifest?.profileId).not.toBe("ppt");
    expect(hints.some((hint) => /01-topics\.md$/i.test(hint))).toBe(true);
    expect(hints.some((hint) => /02-longform\.md$/i.test(hint))).toBe(true);
    expect(hints.some((hint) => /presentation\.pptx$/i.test(hint))).toBe(false);
    expect(manifest?.sessionGoalAnchor).toMatch(/做成一份PPT/);
  });

  it("TRUE_PPT still binds ppt under expensive-intent enforce", () => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    process.env.PILOTDECK_EXPENSIVE_INTENT_CLARIFY = "enforce";
    const goal = "做一份周会PPT，须交付 presentation.pptx";
    const manifest = compileSessionDeliverableManifest({ userGoal: goal, turnId: "t-true-ppt" });
    expect(resolveProfile(undefined, undefined, goal).id).toBe("ppt");
    expect(manifest?.profileId).toBe("ppt");
  });
});
