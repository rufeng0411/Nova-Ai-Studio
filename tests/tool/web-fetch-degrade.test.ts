import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultPermissionContext } from "../../src/permission/index.js";
import { createWebFetchTool } from "../../src/tool/builtin/webFetch.js";
import {
  __setWebFetchHookForTesting,
  clearWebFetchCache,
} from "../../src/tool/index.js";
import type { PilotDeckToolRuntimeContext } from "../../src/tool/protocol/types.js";

function minimalContext(model: PilotDeckToolRuntimeContext["model"]): PilotDeckToolRuntimeContext {
  return {
    sessionId: "s1",
    turnId: "t1",
    cwd: process.cwd(),
    permissionMode: "default",
    permissionContext: createDefaultPermissionContext({ cwd: process.cwd() }),
    model,
  };
}

test("web_fetch degrades to raw markdown when secondary model fails", async () => {
  clearWebFetchCache();
  __setWebFetchHookForTesting(async () => ({
    status: 200,
    statusText: "OK",
    headers: { "content-type": "text/html" },
    arrayBuffer: async () =>
      Buffer.from(
        '<html><img src="https://dlcdnwebimgs.asus.com/gain/ABC/w2000/h1470/fwebp" /></html>',
      ).buffer,
  }));

  const tool = createWebFetchTool({ provider: "qwen", modelId: "qwen3.6-flash" });
  const result = await tool.execute(
    {
      url: "https://rog.asus.com/us/desktops/mini-pc/rog-nuc-2025/",
      prompt: "List image URLs",
    },
    minimalContext({
      stream: async function* () {
        yield {
          type: "error",
          error: {
            message: "fetch failed",
            code: "network_error",
            provider: "test",
            protocol: "openai",
            retryable: true,
          },
        };
      },
    }),
  );

  const text = result.content[0]?.type === "text" ? result.content[0].text : "";
  assert.match(text, /Secondary model summarization unavailable/);
  assert.match(text, /dlcdnwebimgs\.asus\.com/);

  __setWebFetchHookForTesting(null);
  clearWebFetchCache();
});

test("web_fetch soft-fails on transient HTTP fetch error", async () => {
  clearWebFetchCache();
  __setWebFetchHookForTesting(async () => {
    throw new Error("fetch failed");
  });

  const tool = createWebFetchTool();
  const result = await tool.execute(
    { url: "https://example.com/page", prompt: "summarize" },
    minimalContext(undefined),
  );

  const text = result.content[0]?.type === "text" ? result.content[0].text : "";
  assert.match(text, /Could not fetch page content/);
  assert.match(text, /Recovery:/);
  assert.equal(result.metadata?.softFailed, true);

  __setWebFetchHookForTesting(null);
  clearWebFetchCache();
});

test("web_fetch still throws on tool_aborted", async () => {
  clearWebFetchCache();
  __setWebFetchHookForTesting(async () => ({
    status: 200,
    statusText: "OK",
    headers: { "content-type": "text/html" },
    arrayBuffer: async () => Buffer.from("<html></html>").buffer,
  }));

  const tool = createWebFetchTool();
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    () =>
      tool.execute(
        { url: "https://example.com/page", prompt: "summarize" },
        {
          ...minimalContext({
            stream: async function* () {
              yield { type: "text_delta", text: "partial" };
            },
          }),
          abortSignal: controller.signal,
        },
      ),
    /aborted/i,
  );

  __setWebFetchHookForTesting(null);
  clearWebFetchCache();
});
