import { describe, expect, it } from "vitest";
import {
  isPptDeliverableProfile,
  resolveProfile,
  shouldBypassOrchestrationForProfile,
} from "../../src/saas/deliverableCapabilityProfiles.js";

describe("deliverableCapabilityProfiles", () => {
  it("resolves anth-pptx as ppt", () => {
    const p = resolveProfile("anth-pptx");
    expect(p.recoveryKind).toBe("ppt");
    expect(p.bypassOrchestration).toBe(true);
    expect(p.expectedExtensions).toContain(".pptx");
  });

  it("ppt-master SDM is presentation.pptx only", () => {
    const p = resolveProfile("ppt-master");
    expect(p.id).toBe("ppt-master");
    expect(p.requiredBasenameGroups).toEqual([["presentation.pptx"]]);
  });

  it("resolves nova-bento-slides as bento html deck", () => {
    const p = resolveProfile("nova-bento-slides");
    expect(p.id).toBe("nova-bento-deck");
    expect(p.recoveryKind).toBe("html");
    expect(p.requiredBasenameGroups).toEqual([["deck.bento.html"]]);
    expect(isPptDeliverableProfile("nova-bento-slides")).toBe(false);
  });

  it("userGoal Nova可编辑演示稿 routes to bento deck not pptx", () => {
    const p = resolveProfile(
      undefined,
      undefined,
      "用「Nova可编辑演示稿」帮我：世界杯48强介绍，16页，16:9",
    );
    expect(p.id).toBe("nova-bento-deck");
    expect(p.requiredBasenameGroups).toEqual([["deck.bento.html"]]);
  });

  it("resolves nova-ppt prefix", () => {
    expect(resolveProfile("nova-ppt-aesthetic-slides").recoveryKind).toBe("ppt");
    expect(resolveProfile("nova-ppt-deck").recoveryKind).toBe("ppt");
  });

  it("resolves html-ppt prefix", () => {
    expect(resolveProfile("html-ppt-demo").recoveryKind).toBe("ppt");
  });

  it("resolves pd-geo as research/geo bypass", () => {
    const p = resolveProfile("pd-geo");
    expect(p.bypassOrchestration).toBe(true);
    expect(["research", "geo"]).toContain(p.recoveryKind);
  });

  it("resolves anth-docx", () => {
    const p = resolveProfile("anth-docx");
    expect(p.recoveryKind).toBe("docx");
    expect(p.expectedExtensions).toContain(".docx");
  });

  it("resolves content marketing slugs", () => {
    expect(resolveProfile("mkt-brand-voice").recoveryKind).toBe("content");
  });

  it("declares execution contracts for degradable media and visual capabilities", () => {
    const social = resolveProfile("social-creative-matrix");
    expect(social.id).toBe("social_matrix");
    expect(social.executionContract?.optionalMissingKeyServices).toEqual(expect.arrayContaining(["image", "video", "export", "mineru"]));
    expect(social.executionContract?.irreplaceableBlockers).toContain("yixiaoer");

    const websiteVideo = resolveProfile("hf-website-to-video");
    expect(websiteVideo.id).toBe("hyperframes");
    expect(websiteVideo.executionContract?.fallbackStrategy).toMatch(/HyperFrames|promo\.mp4/);

    const web3d = resolveProfile(undefined, undefined, "用 3D网页创作做世界杯展示网页");
    expect(web3d.id).toBe("web_3d");

    const canvas = resolveProfile(undefined, undefined, "用视觉画布设计一张挪威队世界杯海报");
    expect(canvas.id).toBe("visual_canvas");
  });

  it("resolves TimesFM forecasting as a required forecast artifact profile", () => {
    const p = resolveProfile("edu-sci-timesfm-forecasting");
    expect(p.id).toBe("timesfm");
    expect(p.expectedExtensions).toEqual(expect.arrayContaining([".json", ".csv", ".png"]));
    expect(p.requiredBasenameGroups).toEqual(expect.arrayContaining([
      expect.arrayContaining(["forecast.json", "forecast.csv"]),
      expect.arrayContaining(["forecast.png", "forecast-chart.png"]),
    ]));
  });

  it("resolves od- design bypass", () => {
    expect(resolveProfile("od-dashboard").bypassOrchestration).toBe(true);
  });

  it("resolves open-design", () => {
    expect(resolveProfile("open-design").bypassOrchestration).toBe(true);
  });

  it("userGoal html landing page fallback", () => {
    const p = resolveProfile(undefined, undefined, "做官网落地页网页");
    expect(p.recoveryKind).toBe("html");
    expect(p.expectedExtensions).toContain(".html");
    expect(p.acceptanceTier).toBe("L1");
  });

  it("storyboard pack declares required artifacts", () => {
    const p = resolveProfile("create-vid-storyboard-pack");
    expect(p.acceptanceTier).toBe("L1");
    expect(p.requiredArtifacts).toEqual([
      "continuity_bible.md",
      "shot_cards.md",
      "handoff_design_matrix.md",
    ]);
  });

  it("resolves frontend-slides as ppt", () => {
    expect(resolveProfile("frontend-slides").recoveryKind).toBe("ppt");
  });

  it("resolves Remotion and React programmatic video templates", () => {
    const p = resolveProfile("remotion-video-template");
    expect(p.recoveryKind).toBe("video_template");
    expect(p.expectedExtensions).toEqual(expect.arrayContaining([".html", ".tsx", ".json"]));
    expect(p.requiredBasenameGroups).toEqual(expect.arrayContaining([
      expect.arrayContaining(["template.tsx", "AiVideoTemplate.tsx", "Root.tsx"]),
      expect.arrayContaining(["params.json", "package.json"]),
      expect.arrayContaining(["preview.html", "demo-preview.html"]),
    ]));

    expect(resolveProfile(undefined, undefined, "React 程序化视频模板，支持批量渲染").id).toBe("video_template");
  });

  it("userGoal ppt fallback", () => {
    expect(resolveProfile(undefined, undefined, "生成24页PPT").recoveryKind).toBe("ppt");
  });

  it("userGoal docx fallback", () => {
    expect(resolveProfile(undefined, undefined, "导出word文档").recoveryKind).toBe("docx");
  });

  it("userGoal research fallback", () => {
    expect(resolveProfile(undefined, undefined, "写调研报告").recoveryKind).toBe("research");
  });

  it("1bde3fb1: 内容飞轮口语 binds content_flywheel", () => {
    expect(
      resolveProfile(
        undefined,
        undefined,
        "参考附件内容做内容飞轮：选题→长文→社媒切片，禁止空转，直接执行。",
      ).id,
    ).toBe("content_flywheel");
  });

  it("userGoal storyboard pack fallback", () => {
    const p = resolveProfile(undefined, undefined, "连续性分镜包 bible 镜头卡 交接矩阵");
    expect(p.id).toBe("storyboard");
    expect(p.requiredBasenames).toContain("handoff_design_matrix.md");
  });

  it("userGoal seedance prompt fallback", () => {
    expect(resolveProfile(undefined, undefined, "Seedance 分镜提示词").id).toBe("storyboard");
  });

  it("default unknown slug", () => {
    const p = resolveProfile("random-skill-xyz");
    expect(p.id).toBe("default");
    expect(p.bypassOrchestration).toBe(false);
  });

  it("isPptDeliverableProfile", () => {
    expect(isPptDeliverableProfile("anth-pptx")).toBe(true);
    expect(isPptDeliverableProfile("pd-geo")).toBe(false);
  });

  it("shouldBypassOrchestrationForProfile", () => {
    expect(shouldBypassOrchestrationForProfile("anth-pptx")).toBe(true);
    expect(shouldBypassOrchestrationForProfile("unknown")).toBe(false);
  });
});
