import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveContinuationAction,
} from "../../src/saas/taskContinuationPolicy.js";

test("AgentLoop continuation policy retries alternate before requiring user action", () => {
  assert.equal(resolveContinuationAction({
    userGoal: "生成 Word 文档并报路径",
    missingIrreplaceableInput: true,
    directStartRequested: true,
    blockerStreak: 1,
    autoRecoveryContinueEnabled: true,
  }), "retry_alternate");
});

test("AgentLoop continuation policy stops auto recovery when resilience is disabled", () => {
  assert.equal(resolveContinuationAction({
    userGoal: "生成 PPT 并导出真实 pptx",
    assistantText: "Now let me create the file.",
    planningOrSetupStop: true,
    autoRecoveryContinueEnabled: false,
  }), "stop");
});
