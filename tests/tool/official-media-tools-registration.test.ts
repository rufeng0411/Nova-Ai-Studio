import assert from "node:assert/strict";
import test from "node:test";

import { normalizePermissionEntry } from "../../src/permission/settings.js";
import { appendToolRecoveryHint } from "../../src/tool/recoveryHints.js";
import { createBuiltinRegistry } from "../../src/tool/registry/createBuiltinRegistry.js";

test("builtin registry exposes both P0-4/P0-5 tools and supports explicit opt-out", () => {
  const registry = createBuiltinRegistry({ agent: false });
  assert.equal(registry.has("fetch_media_asset"), true);
  assert.equal(registry.has("FetchMediaAsset"), true);
  assert.equal(registry.has("render_local_html_to_image"), true);
  assert.equal(registry.has("RenderLocalHtmlToImage"), true);

  const disabled = createBuiltinRegistry({
    agent: false,
    fetchMediaAsset: false,
    renderLocalHtmlToImage: false,
  });
  assert.equal(disabled.has("fetch_media_asset"), false);
  assert.equal(disabled.has("render_local_html_to_image"), false);
});

test("permission aliases and recovery guidance recognize both media tools", () => {
  assert.equal(
    normalizePermissionEntry("FetchMediaAsset"),
    "fetch_media_asset",
  );
  assert.equal(
    normalizePermissionEntry("RenderLocalHtmlToImage"),
    "render_local_html_to_image",
  );
  assert.match(
    appendToolRecoveryHint(
      "fetch_media_asset",
      "tool_execution_failed",
      "download failed",
    ),
    /different candidate|fetch_page_images/iu,
  );
  assert.match(
    appendToolRecoveryHint(
      "render_local_html_to_image",
      "tool_execution_failed",
      "render failed",
    ),
    /write_file|local HTML/iu,
  );
});
