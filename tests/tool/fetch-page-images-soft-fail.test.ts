import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultPermissionContext } from "../../src/permission/index.js";
import { createFetchPageImagesTool } from "../../src/tool/builtin/fetchPageImages.js";
import type { PublicDnsResolver } from "../../src/tool/builtin/web/publicHttpUrlPolicy.js";
import type { PilotDeckToolRuntimeContext } from "../../src/tool/protocol/types.js";

const publicResolver: PublicDnsResolver = async () => [
  { address: "93.184.216.34", family: 4 },
];

function minimalContext(): PilotDeckToolRuntimeContext {
  return {
    sessionId: "s1",
    turnId: "t1",
    cwd: process.cwd(),
    permissionMode: "default",
    permissionContext: createDefaultPermissionContext({ cwd: process.cwd() }),
  };
}

test("fetch_page_images soft-fails on network error", async () => {
  const tool = createFetchPageImagesTool({
    fetchImpl: async () => {
      throw new Error("fetch failed");
    },
    dnsResolver: publicResolver,
  });

  const result = await tool.execute(
    { url: "https://rog.asus.com/us/desktops/mini-pc/rog-nuc-2025/" },
    minimalContext(),
  );

  const text = result.content[0]?.type === "text" ? result.content[0].text : "";
  assert.match(text, /Could not fetch page images/);
  assert.match(text, /Recovery:/);
  assert.equal(result.metadata?.softFailed, true);
  assert.equal(result.data?.count, 0);
});

test("fetch_page_images soft-fails on HTTP error", async () => {
  const tool = createFetchPageImagesTool({
    fetchImpl: async () =>
      new Response("", {
        status: 503,
        statusText: "Service Unavailable",
        headers: { "content-type": "text/html" },
      }),
    dnsResolver: publicResolver,
  });

  const result = await tool.execute(
    { url: "https://example.com/product" },
    minimalContext(),
  );

  assert.equal(result.metadata?.softFailed, true);
  assert.equal(result.data?.count, 0);
  const text = result.content[0]?.type === "text" ? result.content[0].text : "";
  assert.match(text, /HTTP 503/);
});
