import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  _clearVisualMediaAttemptTrackersForTests,
  buildVisualMediaDegradeStrategyBlock,
  getMediaDegradeThreshold,
  getVisualMediaAttemptTracker,
  hasGenerateImageHardFail,
  isDocumentStyleVisualGoal,
  isVisualMediaAcquisitionTool,
  recordVisualMediaFailuresForSession,
  shouldBypassLegacyVisualMediaDegrade,
  shouldSkipCreativeVisualPlaceholderDegrade,
  shouldUseVisualPlaceholderDegrade,
  toolNameFromRepeatKey,
  VisualMediaAttemptTracker,
} from "./visualMediaDegradePolicy.js";

describe("visualMediaDegradePolicy", () => {
  beforeEach(() => {
    _clearVisualMediaAttemptTrackersForTests();
    delete process.env.PILOTDECK_MEDIA_DEGRADE_AFTER;
  });

  afterEach(() => {
    delete process.env.PILOTDECK_MEDIA_DEGRADE_AFTER;
  });

  it("detects document-style visual goals", () => {
    expect(isDocumentStyleVisualGoal("做一份官网 HTML 落地页")).toBe(true);
    expect(isDocumentStyleVisualGoal("export pdf report")).toBe(true);
    expect(isDocumentStyleVisualGoal("写一段 Python 脚本")).toBe(false);
  });

  it("tracks per-tool failures and forces placeholder at threshold", () => {
    process.env.PILOTDECK_MEDIA_DEGRADE_AFTER = "2";
    expect(getMediaDegradeThreshold()).toBe(2);
    const tracker = new VisualMediaAttemptTracker();
    expect(tracker.recordFailure("generate_image").shouldForcePlaceholder).toBe(false);
    expect(tracker.recordFailure("generate_image").shouldForcePlaceholder).toBe(true);
  });

  it("forces placeholder when cumulative failures exceed total threshold", () => {
    const tracker = new VisualMediaAttemptTracker();
    tracker.recordFailure("web_search");
    tracker.recordFailure("web_fetch");
    tracker.recordFailure("fetch_page_images");
    expect(tracker.recordFailure("generate_image").shouldForcePlaceholder).toBe(true);
  });

  it("records session failures only for document visual goals", () => {
    const stat = recordVisualMediaFailuresForSession(
      "sess-1",
      "制作品牌海报 HTML",
      [{
        type: "error",
        toolName: "generate_image",
        toolCallId: "c1",
        error: { message: "fail", code: "tool_execution_failed" },
      }],
    );
    expect(stat?.perToolCount).toBe(1);
    expect(recordVisualMediaFailuresForSession("sess-1", "闲聊", [{
      type: "error",
      toolName: "generate_image",
      toolCallId: "c2",
      error: { message: "fail", code: "tool_execution_failed" },
    }])).toBeNull();
    expect(getVisualMediaAttemptTracker("sess-1").shouldForcePlaceholderDegrade()).toBe(false);
  });

  it("parses repeat keys and decides placeholder degrade", () => {
    expect(toolNameFromRepeatKey("fetch_page_images:abc")).toBe("fetch_page_images");
    expect(isVisualMediaAcquisitionTool("web_fetch")).toBe(true);
    expect(shouldUseVisualPlaceholderDegrade({
      userGoal: "官网 HTML",
      repeatKey: "generate_image:foo",
    })).toBe(true);
    expect(shouldUseVisualPlaceholderDegrade({
      userGoal: "写 Python",
      repeatKey: "generate_image:foo",
    })).toBe(false);
  });

  it("bypasses SVG continue degrade for official_only goals", () => {
    process.env.PILOTDECK_OFFICIAL_MEDIA_V2 = "enforce";
    try {
      expect(
        shouldBypassLegacyVisualMediaDegrade(
          "图和资料要来自官网 https://zongheng.chery.cn/",
        ),
      ).toBe(true);
      expect(
        shouldUseVisualPlaceholderDegrade({
          userGoal: "图和资料要来自官网 https://zongheng.chery.cn/ 做 HTML",
          repeatKey: "fetch_page_images:x",
          officialMediaPolicy: "official_only",
        }),
      ).toBe(false);
    } finally {
      delete process.env.PILOTDECK_OFFICIAL_MEDIA_V2;
    }
  });

  it("injects creative prefer-generate block when goal is creative poster", () => {
    process.env.PILOTDECK_PREFER_GENERATE_IMAGE = "shadow";
    try {
      const block = buildVisualMediaDegradeStrategyBlock("zh-CN", {
        userGoal: "做一张活动海报 HTML，主视觉要好看",
        capabilitySlug: "od-poster-hero",
      });
      expect(block).toContain('creative_prefer_gen="1"');
      expect(block).toContain("generate_image");
      expect(block).not.toContain("优先一次调用 resolve_session_visual_assets");
    } finally {
      delete process.env.PILOTDECK_PREFER_GENERATE_IMAGE;
    }
  });

  it("skips placeholder degrade on creative generate_image billing hard-fail", () => {
    process.env.PILOTDECK_PREFER_GENERATE_IMAGE = "shadow";
    try {
      const results = [{
        type: "error" as const,
        toolName: "generate_image",
        toolCallId: "c1",
        error: {
          message: "Provider Arrearage: account overdue-payment",
          code: "tool_execution_failed" as const,
        },
        content: [{ type: "text" as const, text: "Provider Arrearage: account overdue-payment" }],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      }];
      expect(hasGenerateImageHardFail(results)).toBe(true);
      expect(shouldSkipCreativeVisualPlaceholderDegrade({
        userGoal: "做一张竖版海报",
        capabilitySlug: "od-poster-hero",
        results,
      })).toBe(true);
    } finally {
      delete process.env.PILOTDECK_PREFER_GENERATE_IMAGE;
    }
  });
});
