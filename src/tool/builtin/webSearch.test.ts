import { describe, it, expect } from "vitest";

import { createWebSearchTool } from "./webSearch.js";
import type { WebSearchCustomProviderConfig } from "./webSearch.js";
import type { PilotDeckToolRuntimeContext } from "../protocol/types.js";

// Mirrors the real `tools.webSearch.customProvider` mapping for a Bocha endpoint
// (provider: custom + endpoint: api.bochaai.com), which is the configuration that
// regressed in production: Bocha returns `code: 200` on success.
const BOCHA_CUSTOM: WebSearchCustomProviderConfig = {
  name: "bocha",
  auth: "bearer",
  method: "POST",
  queryParam: "query",
  resultsPath: "data.webPages.value",
  titleField: "name",
  urlField: "url",
  snippetField: "snippet",
};

function customSearchResponse(code: number): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      code,
      msg: code === 0 || code === 200 ? null : "boom",
      data: {
        webPages: {
          value: [
            {
              name: "纵横G700顶火鸣镝版 评测",
              url: "https://example.com/g700",
              snippet: "官方产品信息",
            },
          ],
        },
      },
    }),
    text: async () => "",
  } as unknown as Response;
}

function makeContext(): PilotDeckToolRuntimeContext {
  return { env: {} } as unknown as PilotDeckToolRuntimeContext;
}

function makeCustomTool(fetchImpl: typeof fetch) {
  return createWebSearchTool({
    provider: "custom",
    apiKey: "sk-test",
    endpoint: "https://api.bochaai.com/v1/web-search",
    customProvider: BOCHA_CUSTOM,
    fetchImpl,
  });
}

describe("web_search custom provider success-code handling", () => {
  it("treats Bocha-style code:200 as success (regression for '搜索受阻')", async () => {
    const tool = makeCustomTool((async () => customSearchResponse(200)) as unknown as typeof fetch);
    const out = await tool.execute({ query: "纵横G700顶火鸣镝版" }, makeContext());

    expect(out.metadata?.softFailed).toBeUndefined();
    expect(out.metadata?.provider).toBe("custom");
    expect(out.data.organic.length).toBe(1);
    expect(out.data.organic[0]?.title).toContain("纵横G700");
    expect(out.data.organic[0]?.link).toBe("https://example.com/g700");
  });

  it("treats serper/searxng-style code:0 as success", async () => {
    const tool = makeCustomTool((async () => customSearchResponse(0)) as unknown as typeof fetch);
    const out = await tool.execute({ query: "test" }, makeContext());

    expect(out.metadata?.softFailed).toBeUndefined();
    expect(out.data.organic.length).toBe(1);
  });

  it("still surfaces a genuine non-success code (401) as an error", async () => {
    const tool = makeCustomTool((async () => customSearchResponse(401)) as unknown as typeof fetch);

    // Genuine provider errors must keep failing so the model gets the recovery
    // hint and pivots (e.g. to web_fetch); only 0/200 are treated as success.
    await expect(tool.execute({ query: "test" }, makeContext())).rejects.toThrow(
      /Custom web search error code=401/,
    );
  });
});

describe("web_search Bocha fallback", () => {
  it("retries with Bocha when primary provider soft-fails and BOCHA_API_KEY is set", async () => {
    let callCount = 0;
    const fetchImpl = (async (url: string | URL | Request) => {
      callCount += 1;
      const href = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      if (href.includes("bochaai.com")) {
        return customSearchResponse(200);
      }
      return {
        ok: false,
        status: 503,
        json: async () => ({}),
        text: async () => "unavailable",
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const tool = createWebSearchTool({
      provider: "glm",
      apiKey: "glm-key",
      fetchImpl,
    });

    const out = await tool.execute(
      { query: "示例品牌 GEO 验证" },
      { env: { BOCHA_API_KEY: "bocha-key" } } as unknown as PilotDeckToolRuntimeContext,
    );

    expect(callCount).toBeGreaterThanOrEqual(2);
    expect(out.metadata?.softFailed).toBeUndefined();
    expect(out.data.organic.length).toBe(1);
  });
});

describe("web_search input schema robustness", () => {
  it("does not hard-reject stray params (additionalProperties is not false)", () => {
    const tool = makeCustomTool((async () => customSearchResponse(200)) as unknown as typeof fetch);
    const schema = tool.inputSchema as { additionalProperties?: boolean };

    // A weaker model passing `g` instead of `gl` previously produced a hard
    // invalid_tool_input failure; the schema must tolerate unknown keys.
    expect(schema.additionalProperties).not.toBe(false);
  });
});
