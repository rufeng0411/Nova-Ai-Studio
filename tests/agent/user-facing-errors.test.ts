import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_ERROR_LABELS_EN,
  DEFAULT_ERROR_LABELS_ZH,
  buildExpandDetail,
  formatHandlingNotice,
  formatUserFacingNotice,
  formatUserFacingToolError,
  hasHardToolFailure,
  isBareTransientNetworkErrorLeak,
  isBareTransientNetworkErrorBody,
  sanitizeUserVisibleErrorText,
  isEngineToolHardStopLeak,
  isRecoverableToolError,
  isTransientNetworkErrorMessage,
  shouldAutoContinueAfterIncompleteDeliverableStop,
  stripRecoverySection,
  userGoalImpliesDeliverable,
} from "../../src/agent/errors/userFacingErrors.js";

test("detects transient network errors", () => {
  assert.equal(isTransientNetworkErrorMessage("web_fetch failed: fetch failed"), true);
  assert.equal(isTransientNetworkErrorMessage("file not found"), false);
});

test("maps network tool errors to network retry line", () => {
  const facing = formatUserFacingToolError(
    {
      toolName: "web_fetch",
      errorCode: "tool_execution_failed",
      rawContent: "web_fetch failed: fetch failed",
    },
    DEFAULT_ERROR_LABELS_EN,
  );
  assert.equal(facing.summary, DEFAULT_ERROR_LABELS_EN.unifiedRetry);
});

 test("maps genuine socket errors to network interrupt line", () => {
  const facing = formatUserFacingToolError(
    {
      toolName: "bash",
      errorCode: "tool_execution_failed",
      rawContent: "ECONNREFUSED connect failed",
    },
    DEFAULT_ERROR_LABELS_EN,
  );
  assert.equal(facing.summary, DEFAULT_ERROR_LABELS_EN.networkInterrupt);
});

test("formatHandlingNotice omits attempt counter from summary", () => {
  const notice = formatHandlingNotice(4, 5, DEFAULT_ERROR_LABELS_ZH);
  assert.equal(notice.summary, DEFAULT_ERROR_LABELS_ZH.unifiedRetry);
  assert.doesNotMatch(notice.summary, /4/);
});

test("buildExpandDetail merges technical text and hints", () => {
  const detail = buildExpandDetail(["hint one"], "fetch failed");
  assert.match(detail!, /fetch failed/);
  assert.match(detail!, /hint one/);
});

test("formatUserFacingNotice exhausted uses diagnostic summary", () => {
  const notice = formatUserFacingNotice(
    { code: "agent_model_error", raw: "model down", exhausted: true },
    DEFAULT_ERROR_LABELS_EN,
  );
  assert.equal(notice.summary, DEFAULT_ERROR_LABELS_EN.unifiedExhausted);
  assert.ok(notice.hints.length > 0);
});

test("detects bare fetch failed leak", () => {
  assert.equal(isBareTransientNetworkErrorLeak("fetch failed"), true);
  assert.equal(isBareTransientNetworkErrorLeak("web_fetch failed: fetch failed"), false);
});

test("detects multiline bare fetch failed bodies", () => {
  assert.equal(isBareTransientNetworkErrorBody("fetch failed\nfetch failed"), true);
  assert.equal(isBareTransientNetworkErrorBody("？？\nfetch failed"), true);
  assert.equal(isBareTransientNetworkErrorBody("Failed to fetch"), true);
  assert.equal(isBareTransientNetworkErrorBody("failed to fetch\nfailed to fetch"), true);
  assert.equal(isBareTransientNetworkErrorBody("已完成，路径：report.md"), false);
});

test("geo deliverable goal triggers incomplete deliverable auto-continue", () => {
  const goal = "帮雷蛇做品牌 GEO 全案，optimized.md，直接开始做，做完告诉我路径";
  assert.equal(userGoalImpliesDeliverable(goal), true);
  assert.equal(
    shouldAutoContinueAfterIncompleteDeliverableStop(
      "信息收集完毕。现在获取官网图片素材，并创建项目目录。",
      { userGoalText: goal, hadRecentToolSuccess: true },
    ),
    true,
  );
});

test("formatUserFacingNotice masks bare fetch failed", () => {
  const notice = formatUserFacingNotice(
    { raw: "fetch failed", recoverable: false, exhausted: true },
    DEFAULT_ERROR_LABELS_ZH,
  );
  assert.equal(notice.summary, DEFAULT_ERROR_LABELS_ZH.unifiedRetry);
  assert.equal(notice.severity, "handling");
});

test("sanitizeUserVisibleErrorText masks fetch failures", () => {
  assert.equal(
    sanitizeUserVisibleErrorText("fetch failed"),
    DEFAULT_ERROR_LABELS_ZH.unifiedRetry,
  );
  assert.equal(
    sanitizeUserVisibleErrorText("Failed to fetch"),
    DEFAULT_ERROR_LABELS_ZH.unifiedRetry,
  );
});

test("formatUserFacingNotice masks multiline bare fetch failed", () => {
  const notice = formatUserFacingNotice(
    { raw: "fetch failed\nfetch failed", recoverable: false, exhausted: true },
    DEFAULT_ERROR_LABELS_ZH,
  );
  assert.equal(notice.summary, DEFAULT_ERROR_LABELS_ZH.unifiedRetry);
  assert.equal(notice.severity, "handling");
});

test("formatUserFacingNotice masks large file repair hard stop when exhausted", () => {
  const notice = formatUserFacingNotice(
    {
      code: "agent_tool_error_loop",
      raw: "Large file repair stopped after 5 post-draft attempts. A workspace file already exists; report the current file path and remaining gap.",
      exhausted: true,
    },
    DEFAULT_ERROR_LABELS_ZH,
  );
  assert.equal(notice.summary, DEFAULT_ERROR_LABELS_ZH.unifiedExhausted);
  assert.equal(notice.severity, "pause");
  assert.equal(notice.technicalDetail, null);
});

test("formatUserFacingNotice handling for large file repair before exhausted", () => {
  const notice = formatUserFacingNotice(
    {
      raw: "Large file repair stopped after 5 post-draft attempts.",
      recoverable: true,
      exhausted: false,
    },
    DEFAULT_ERROR_LABELS_ZH,
  );
  assert.equal(notice.summary, DEFAULT_ERROR_LABELS_ZH.unifiedRetry);
  assert.equal(notice.severity, "handling");
});

test("storyboard pack goal implies deliverable", () => {
  const goal = "用「连续性分镜包」为【广告创意】输出 continuity 分镜包：bible、镜头卡、交接矩阵。";
  assert.equal(userGoalImpliesDeliverable(goal), true);
  assert.equal(
    shouldAutoContinueAfterIncompleteDeliverableStop(
      "好的，我先读取已有的文件，然后逐个补充完整。",
      { userGoalText: goal, hadRecentToolSuccess: true },
    ),
    true,
  );
});

test("seedance prompt goal implies deliverable", () => {
  const goal = "用「即梦分镜提示」为【雷蛇灵刃2026】写 15 秒 Seedance 2.0 分镜提示词";
  assert.equal(userGoalImpliesDeliverable(goal), true);
});

test("a51fa91d: acquisition leads goal implies deliverable without 生成/输出 verb", () => {
  assert.equal(
    userGoalImpliesDeliverable(
      "查一下北京【人工智能外包】潜在客户，整理成线索表报告，直接开始做。",
    ),
    true,
  );
});

test("Showcase OD pricing/dashboard hub copy implies deliverable", () => {
  assert.equal(
    userGoalImpliesDeliverable(
      "定价卡片 (Pricing Card)\n描述：一个常见的 SaaS 页面组件，用于展示不同套餐的价格和功能对比。",
    ),
    true,
  );
  assert.equal(
    userGoalImpliesDeliverable(
      "企业后台管理仪表盘 (dashboard)\n描述：用于快速搭建数据密集型的后台系统，如客户管理、数据监控等。",
    ),
    true,
  );
});

test("nova research hub try prompts imply deliverable", () => {
  assert.equal(
    userGoalImpliesDeliverable(
      "用「Nova-行业市场」写【冷泡茶】市场研究报告：规模、产业链、PEST/SWOT 与进入建议。",
    ),
    true,
  );
  assert.equal(
    userGoalImpliesDeliverable(
      "用「Nova-通用调研」围绕【新茶饮】写综合调研报告：背景、发现、舆情与建议。",
    ),
    true,
  );
  assert.equal(
    userGoalImpliesDeliverable(
      "用「Nova-竞品对标」对【品类】做竞品全量对标：竞品清单、维度对比与突围策略。",
    ),
    true,
  );
});

test("nova research incomplete stop after web_search without md", () => {
  const goal =
    "用「Nova-行业市场」写【冷泡茶】市场研究报告：规模、产业链、PEST/SWOT 与进入建议。";
  assert.equal(
    shouldAutoContinueAfterIncompleteDeliverableStop(
      "好的，我来整理冷泡茶行业市场研究报告。先加载技能并启动调研。",
      { userGoalText: goal, hadRecentToolSuccess: true },
    ),
    true,
  );
  assert.equal(
    shouldAutoContinueAfterIncompleteDeliverableStop(
      "让我再补充一些具体品牌的细节信息。",
      { userGoalText: goal, hadRecentToolSuccess: true },
    ),
    true,
  );
});

test("detects engine tool hard stop leak", () => {
  assert.equal(
    isEngineToolHardStopLeak("Repeated invalid tool input after recovery attempts."),
    true,
  );
  assert.equal(
    isEngineToolHardStopLeak("Large file repair stopped after 5 post-draft attempts."),
    true,
  );
});

test("hasHardToolFailure treats recoverable session errors as soft", () => {
  assert.equal(hasHardToolFailure({ type: "error", recoverable: true, noticeSeverity: "handling" }), false);
  assert.equal(hasHardToolFailure({ type: "error", noticeSeverity: "pause" }), true);
});
