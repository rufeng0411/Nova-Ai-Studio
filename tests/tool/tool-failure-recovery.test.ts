import test from "node:test";
import assert from "node:assert/strict";

import { appendToolRecoveryHint, appendEmptyWebSearchRecovery, webSearchSoftFailureText } from "../../src/tool/recoveryHints.js";
import {
  buildSoftFetchRecoveryUserMessage,
  buildToolRecoveryUserMessage,
  isAgentErrorRecoverable,
  isSoftFailedToolResult,
  isStuckInvalidInputTurn,
  isTransientModelErrorMessage,
  MAX_RECOVERY_ATTEMPTS,
  shouldInjectSoftFetchRecoveryTurn,
  shouldInjectToolRecoveryTurn,
} from "../../src/agent/loop/toolFailureRecovery.js";
import type { PilotDeckToolResult } from "../../src/tool/protocol/result.js";

test("appendToolRecoveryHint adds web_search recovery guidance", () => {
  const message = appendToolRecoveryHint(
    "web_search",
    "tool_execution_failed",
    "Bocha API error (403): forbidden",
  );
  assert.match(message, /fetch_page_images/);
  assert.match(message, /Do not retry the same search query/);
});

test("appendToolRecoveryHint adds bash scrape recovery guidance", () => {
  const message = appendToolRecoveryHint(
    "bash",
    "tool_execution_failed",
    "command failed",
    { command: "curl -sL https://example.com | grep jpg" },
  );
  assert.match(message, /fetch_page_images/);
  assert.match(message, /write_file/);
});

test("appendEmptyWebSearchRecovery adds guidance when no organic results", () => {
  const summary = appendEmptyWebSearchRecovery("Web search results for: foo\n\nNo organic results.");
  assert.match(summary, /Recovery:/);
});

test("webSearchSoftFailureText includes recovery playbook", () => {
  const text = webSearchSoftFailureText("ROG NUC", "timeout");
  assert.match(text, /soft failure/i);
  assert.match(text, /fetch_page_images/);
});

test("shouldInjectToolRecoveryTurn when all non-permission tools fail", () => {
  const results: PilotDeckToolResult[] = [
    {
      type: "error",
      toolCallId: "1",
      toolName: "web_search",
      error: { code: "tool_execution_failed", message: "failed" },
      content: [{ type: "text", text: "failed" }],
      startedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T00:00:01.000Z",
    },
    {
      type: "error",
      toolCallId: "2",
      toolName: "bash",
      error: { code: "tool_execution_failed", message: "failed" },
      content: [{ type: "text", text: "failed" }],
      startedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T00:00:01.000Z",
    },
  ];
  assert.equal(shouldInjectToolRecoveryTurn(results), true);
  assert.equal(isStuckInvalidInputTurn(results), false);
  const recovery = buildToolRecoveryUserMessage(results, "en");
  const recoveryText = recovery.content[0]?.type === "text" ? recovery.content[0].text : "";
  assert.match(recoveryText, /write_file/);
  assert.equal(recovery.metadata?.synthetic, true);
  assert.equal(recovery.metadata?.purpose, "tool_recovery");

  const recoveryZh = buildToolRecoveryUserMessage(results, "zh-CN");
  const recoveryZhText = recoveryZh.content[0]?.type === "text" ? recoveryZh.content[0].text : "";
  assert.match(recoveryZhText, /write_file/);
  assert.match(recoveryZhText, /失败工具/);
});

test("shouldInjectSoftFetchRecoveryTurn when fetch tools soft-fail", () => {
  const softResult = (toolName: string): PilotDeckToolResult => ({
    type: "success",
    toolCallId: toolName,
    toolName,
    content: [{ type: "text", text: "soft failure" }],
    metadata: { softFailed: true, reason: "timeout" },
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:00:01.000Z",
  });
  const results = [softResult("web_fetch"), softResult("web_search")];
  assert.equal(isSoftFailedToolResult(results[0]!), true);
  assert.equal(shouldInjectSoftFetchRecoveryTurn(results), true);
  const recovery = buildSoftFetchRecoveryUserMessage("zh-CN");
  assert.equal(recovery.metadata?.purpose, "auto_continue");
});

test("isAgentErrorRecoverable marks max turns recoverable only", () => {
  assert.equal(isAgentErrorRecoverable("agent_tool_error_loop"), false);
  assert.equal(isAgentErrorRecoverable("agent_max_turns_reached"), true);
  assert.equal(isAgentErrorRecoverable("agent_model_error"), false);
});

test("MAX_RECOVERY_ATTEMPTS defaults to 8", () => {
  assert.equal(MAX_RECOVERY_ATTEMPTS, 8);
});

test("isTransientModelErrorMessage detects network failures", () => {
  assert.equal(isTransientModelErrorMessage("fetch failed"), true);
  assert.equal(isTransientModelErrorMessage("file not found"), false);
});
