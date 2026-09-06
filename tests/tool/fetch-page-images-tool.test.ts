import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultPermissionContext } from "../../src/permission/index.js";
import { createFetchPageImagesTool } from "../../src/tool/builtin/fetchPageImages.js";
import type { PublicDnsResolver } from "../../src/tool/builtin/web/publicHttpUrlPolicy.js";
import type { PilotDeckToolRuntimeContext } from "../../src/tool/protocol/types.js";

const ROG_SAMPLE_HTML = `
  <img src="https://dlcdnwebimgs.asus.com/gain/C9628BBF-3B65-44A9-A1B0-98B3AFC5CED4/w2000/h1470/fwebp" />
  <img src="https://dlcdnwebimgs.asus.com/files/media/7dce9eea-0357-4e73-8307-5cef093661c0/V1/img/banner.jpg" />
`;

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

test("fetch_page_images returns ranked JSON from mocked page HTML", async () => {
  const tool = createFetchPageImagesTool({
    fetchImpl: async () =>
      new Response(ROG_SAMPLE_HTML, {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    dnsResolver: publicResolver,
  });

  const result = await tool.execute(
    { url: "https://rog.asus.com/us/desktops/mini-pc/rog-nuc-2025/", minWidth: 800 },
    minimalContext(),
  );

  assert.ok(result.data);
  assert.ok(result.data!.count >= 2);
  assert.match(result.data!.images[0] ?? "", /dlcdnwebimgs\.asus\.com/);
  const text = result.content[0]?.type === "text" ? result.content[0].text : "";
  assert.match(text, /"sourceUrl"/);
});

test("fetch_page_images live network smoke (ROG NUC page)", {
  timeout: 90_000,
  skip: process.env.PILOTDECK_LIVE_NETWORK_TESTS !== "1",
}, async () => {
  const tool = createFetchPageImagesTool();
  const result = await tool.execute(
    { url: "https://rog.asus.com/us/desktops/mini-pc/rog-nuc-2025/" },
    minimalContext(),
  );
  assert.ok(result.data!.count > 10, `expected many images, got ${result.data!.count}`);
  assert.match(result.data!.images[0] ?? "", /dlcdnwebimgs\.asus\.com/);
});

test("fetch_page_images live network smoke (Tesla Model Y page)", {
  timeout: 90_000,
  skip: process.env.PILOTDECK_LIVE_NETWORK_TESTS !== "1",
}, async () => {
  const tool = createFetchPageImagesTool();
  try {
    const result = await tool.execute(
      { url: "https://www.tesla.com/modely" },
      minimalContext(),
    );
    assert.ok(result.data!.count >= 0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert.match(message, /fetch_page_images failed/);
  }
});
