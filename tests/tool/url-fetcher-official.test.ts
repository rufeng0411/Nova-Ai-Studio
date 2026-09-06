import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultPermissionContext } from "../../src/permission/index.js";
import { createWebFetchTool } from "../../src/tool/builtin/webFetch.js";
import {
  __setWebFetchHookForTesting,
  clearWebFetchCache,
  getURLMarkdownContent,
} from "../../src/tool/index.js";
import type { PublicDnsResolver } from "../../src/tool/builtin/web/publicHttpUrlPolicy.js";
import type { PilotDeckToolRuntimeContext } from "../../src/tool/protocol/types.js";

const publicResolver: PublicDnsResolver = async () => [
  { address: "93.184.216.34", family: 4 },
];

function context(
  official: boolean,
): PilotDeckToolRuntimeContext {
  return {
    sessionId: "session-1",
    turnId: "turn-1",
    cwd: process.cwd(),
    permissionMode: "default",
    permissionContext: createDefaultPermissionContext({ cwd: process.cwd() }),
    ...(official
      ? {
          qualityContractMode: "enforce" as const,
          sessionGoalQualityContract: {
            contractVersion: 1 as const,
            subjectAliases: [],
            exactQuantityAssertions: [],
            officialMediaPolicy: "official_only" as const,
            allowedSourceTiers: ["brand_official" as const],
            allowPlaceholders: false,
            forbidGenerateImage: true,
          },
        }
      : {}),
  };
}

test("ordinary web_fetch keeps legacy W7 redirect semantics", async () => {
  clearWebFetchCache();
  __setWebFetchHookForTesting(async () => ({
    status: 302,
    statusText: "Found",
    headers: { location: "https://other.example.net/final" },
    arrayBuffer: async () => new ArrayBuffer(0),
  }));
  try {
    const result = await getURLMarkdownContent(
      "https://example.com/start",
      new AbortController().signal,
    );
    assert.deepEqual(result, {
      type: "redirect",
      originalUrl: "https://example.com/start",
      redirectUrl: "https://other.example.net/final",
      statusCode: 302,
    });
  } finally {
    __setWebFetchHookForTesting(null);
    clearWebFetchCache();
  }
});

test("ordinary web_fetch does not inherit the official publicOnly DNS policy", async () => {
  clearWebFetchCache();
  __setWebFetchHookForTesting(async () => ({
    status: 200,
    statusText: "OK",
    headers: { "content-type": "text/plain" },
    arrayBuffer: async () => {
      const bytes = Buffer.from("legacy-content", "utf8");
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      );
    },
  }));
  try {
    const tool = createWebFetchTool();
    const result = await tool.execute(
      { url: "https://localhost.local/page", prompt: "return content" },
      context(false),
    );
    const text =
      result.content[0]?.type === "text" ? result.content[0].text : "";
    assert.equal(text, "legacy-content");
  } finally {
    __setWebFetchHookForTesting(null);
    clearWebFetchCache();
  }
});

test("official media web_fetch forces publicOnly DNS validation", async () => {
  let fetchCalled = false;
  const privateResolver: PublicDnsResolver = async () => [
    { address: "10.0.0.8", family: 4 },
  ];
  const tool = createWebFetchTool({
    publicDnsResolver: privateResolver,
    publicFetchImpl: async () => {
      fetchCalled = true;
      return new Response("should not be reached");
    },
  });

  await assert.rejects(
    () =>
      tool.execute(
        { url: "https://example.com/page", prompt: "return content" },
        context(true),
      ),
    /non-public address/i,
  );
  assert.equal(fetchCalled, false);
});

test("official media web_fetch uses bounded manual public fetch for valid pages", async () => {
  let redirectMode: RequestRedirect | undefined;
  const tool = createWebFetchTool({
    publicDnsResolver: publicResolver,
    publicFetchImpl: async (_input, init) => {
      redirectMode = init?.redirect;
      return new Response("<html><body>official content</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    },
  });

  const result = await tool.execute(
    { url: "http://example.com/page", prompt: "return content" },
    context(true),
  );
  const text =
    result.content[0]?.type === "text" ? result.content[0].text : "";
  assert.equal(redirectMode, "manual");
  assert.match(text, /official content/u);
});
