import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAutoRecoveryContinueMessage,
  buildPrematureStopRecoveryUserMessage,
  looksLikeTaskDelivered,
  shouldAutoContinueAfterAssistantText,
  shouldAutoContinueAfterIncompleteDeliverableStop,
  shouldAutoContinueAfterTurnOutcome,
  isHardTurnCompleteStop,
  userGoalRequestsDirectStart,
  userGoalImpliesDeliverable,
} from "../../src/agent/errors/userFacingErrors.js";

test("shouldAutoContinueAfterAssistantText detects give-up phrases", () => {
  assert.equal(
    shouldAutoContinueAfterAssistantText("目前获取不到相关信息，请您回复「继续」我再试。"),
    true,
  );
  assert.equal(
    shouldAutoContinueAfterAssistantText("Unable to fetch the page. Please let me know if you want me to continue."),
    true,
  );
});

test("shouldAutoContinueAfterAssistantText ignores delivered work", () => {
  const delivered = "已完成，HTML 已保存至 artifacts/site/index.html，请查收。";
  assert.equal(shouldAutoContinueAfterAssistantText(delivered), false);
  assert.equal(looksLikeTaskDelivered(delivered), true);
});

test("looksLikeTaskDelivered rejects html-only completion for video goals", () => {
  const userGoal = "15 秒 HTML 代码做视频，韩国出局，渲染成 mp4";
  const htmlOnly = "已完成，HTML 演示页已保存至 artifacts/demo/index.html，请查收。";
  assert.equal(looksLikeTaskDelivered(htmlOnly, { userGoal }), false);
  const withMp4 = "已完成，视频已保存至 artifacts/demo/out.mp4，请查收。";
  assert.equal(looksLikeTaskDelivered(withMp4, { userGoal }), true);
});

test("shouldAutoContinueAfterTurnOutcome marks failed turns recoverable", () => {
  assert.equal(shouldAutoContinueAfterTurnOutcome({ exitCode: 1 }), true);
  assert.equal(shouldAutoContinueAfterTurnOutcome({ success: false }), true);
  assert.equal(shouldAutoContinueAfterTurnOutcome({ aborted: true, exitCode: 1 }), false);
  assert.equal(shouldAutoContinueAfterTurnOutcome({ exitCode: 0, success: true }), false);
});

test("shouldAutoContinueAfterTurnOutcome blocks non-recoverable hard failures", () => {
  assert.equal(
    shouldAutoContinueAfterTurnOutcome({
      exitCode: 1,
      success: false,
      errorCode: "agent_model_error",
      errorRecoverable: false,
    }),
    false,
  );
});

test("isHardTurnCompleteStop detects model hard stop", () => {
  assert.equal(isHardTurnCompleteStop({ errorRecoverable: false }), true);
  assert.equal(isHardTurnCompleteStop({ errorCode: "agent_model_error" }), true);
  assert.equal(isHardTurnCompleteStop({ success: false }), false);
});

test("buildAutoRecoveryContinueMessage forbids asking user to continue", () => {
  const zh = buildAutoRecoveryContinueMessage("zh");
  assert.match(zh, /不要向用户索要「继续」/);
  const en = buildAutoRecoveryContinueMessage("en");
  assert.match(en, /Do not ask the user to type continue/i);
});

test("shouldAutoContinueAfterIncompleteDeliverableStop detects planning stop without pptx", () => {
  const userGoal = "用「PPT幻灯」生成一份可编辑的 PPT 文件，严格根据附件分页";
  assert.equal(
    shouldAutoContinueAfterIncompleteDeliverableStop(
      "Good. Now let me write the full PPT generation script for all 24 slides.",
      { hadRecentToolSuccess: true, userGoalText: userGoal },
    ),
    true,
  );
  assert.equal(
    shouldAutoContinueAfterIncompleteDeliverableStop(
      "已完成，PPT 已保存至 artifacts/deck/out.pptx，请查收。",
      { userGoalText: userGoal },
    ),
    false,
  );
});

test("userGoalImpliesDeliverable detects ppt requests", () => {
  assert.equal(userGoalImpliesDeliverable("生成可编辑 PPT"), true);
  assert.equal(userGoalImpliesDeliverable("你好"), false);
});

test("campaign all-in-one artifact tasks are treated as deliverable goals", () => {
  const userGoal = [
    "帮我做【吴裕泰2026年夏季营销】的品牌传播 campaign 全案，按阶段一次规划执行，产出存 artifacts/ 报路径：",
    "传播 brief：输出 Word(.docx)。主视觉：一张竖版主视觉海报。",
    "多平台内容：各平台文案 + 四套比例配图。直接开始做，每阶段完成告诉我文件路径。",
  ].join("\n");
  assert.equal(userGoalImpliesDeliverable(userGoal), true);
  assert.equal(userGoalRequestsDirectStart(userGoal), true);
  assert.equal(
    shouldAutoContinueAfterIncompleteDeliverableStop(
      "开始执行！先确认资料，然后逐一推进。",
      { userGoalText: userGoal, hadRecentToolSuccess: true },
    ),
    true,
  );
});

test("non-user aborted deliverable turns are recoverable", () => {
  assert.equal(
    shouldAutoContinueAfterTurnOutcome({
      aborted: true,
      userAborted: false,
      userGoalText: "输出 Word(.docx)，产出存 artifacts/ 报路径，直接开始做",
      assistantText: "开始执行！先确认资料，然后逐一推进。",
    }),
    true,
  );
  assert.equal(
    shouldAutoContinueAfterTurnOutcome({
      aborted: true,
      userAborted: true,
      userGoalText: "输出 Word(.docx)，产出存 artifacts/ 报路径，直接开始做",
      assistantText: "开始执行！先确认资料，然后逐一推进。",
    }),
    false,
  );
});

test("buildPrematureStopRecoveryUserMessage is synthetic auto_continue", () => {
  const message = buildPrematureStopRecoveryUserMessage("zh", "soft_fetch_failure");
  assert.equal(message.metadata?.synthetic, true);
  assert.equal(message.metadata?.purpose, "auto_continue");
  const text = message.content[0]?.type === "text" ? message.content[0].text : "";
  assert.match(text, /联网抓取/);
});

test("video and html open/playback complaints trigger repair instead of generic completion", () => {
  const userGoal = [
    "帮我把【世界杯2026挪威主题】做成一支能直接发的演示视频，三步连着做，每步把文件存到 artifacts/ 并告诉我路径：",
    "先写 8-12 节结构化大纲。",
    "再做深色现代风动效网页演示。",
    "最后渲染成横版 1080p 视频。",
  ].join("\n");

  assert.equal(
    shouldAutoContinueAfterAssistantText(
      "HTML 演示页和 outline.md 已完成。视频需本地执行 render_html_video 生成。",
      {
        latestUserText: "视频无法播放",
        userGoalText: userGoal,
      },
    ),
    true,
  );
  assert.equal(
    shouldAutoContinueAfterAssistantText(
      "好的，我来完成。三个文件路径：outline.md、index.html。",
      {
        latestUserText: "视频没了？网页也无法使用？？",
        userGoalText: userGoal,
      },
    ),
    true,
  );
});
