import assert from "node:assert/strict";
import test from "node:test";
import { shouldBypassOrchestrationForCapability } from "../../src/router/orchestrate/shouldBypassOrchestration.js";

test("bypasses orchestration for od-mobile-app", () => {
  assert.equal(shouldBypassOrchestrationForCapability("od-mobile-app"), true);
});

test("bypasses orchestration for open-design", () => {
  assert.equal(shouldBypassOrchestrationForCapability("open-design"), true);
});

test("does not bypass for unrelated capabilities", () => {
  assert.equal(shouldBypassOrchestrationForCapability("some-unknown-slug-xyz"), false);
  assert.equal(shouldBypassOrchestrationForCapability(undefined), false);
});

test("bypasses orchestration for office deliverable pack goals (ES9)", () => {
  const goal = [
    "须交付：report.md、PDF、Word、PPT 四种格式，写入系统分配任务目录。",
    "标准成果清单：",
    "1. report.md",
    "2. report.pdf",
  ].join("\n");
  assert.equal(shouldBypassOrchestrationForCapability(undefined, undefined, goal), true);
});
