import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyAskUserQuestionPolicy,
} from "../../src/saas/taskContinuationPolicy.js";

test("preference elicitation with default option is skippable", () => {
  assert.deepEqual(classifyAskUserQuestionPolicy({
    question: "请选择主视觉风格",
    options: ["清凉国风（推荐）", "现代极简", "按默认方案继续"],
  }), {
    kind: "preference",
    hasDefaultOption: true,
  });
});

test("required input is not downgraded to preference elicitation", () => {
  assert.equal(classifyAskUserQuestionPolicy({
    question: "请上传源文件或配置 API Key 后继续",
    options: ["我已上传"],
  }).kind, "required");
});
