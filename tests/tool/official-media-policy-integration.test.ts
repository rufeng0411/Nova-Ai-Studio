import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildCapabilityBindingAppendPrompt } from "../../src/saas/capabilityBindingPrompt.js";
import { resolveMediaStrategy } from "../../src/saas/media/mediaStrategyResolver.js";
import { shouldUseVisualPlaceholderDegrade } from "../../src/saas/media/visualMediaDegradePolicy.js";
import { officialMediaV2Mode } from "../../src/saas/resilience/stabilityFlags.js";

const ROOT = new URL("../../", import.meta.url);
const FLAG = "PILOTDECK_OFFICIAL_MEDIA_V2";
const originalFlag = process.env[FLAG];

test.afterEach(() => {
  if (originalFlag === undefined) delete process.env[FLAG];
  else process.env[FLAG] = originalFlag;
});

test("media strategy recognizes provenance requirements without treating photography style as a source", () => {
  assert.equal(
    resolveMediaStrategy("鸣镝 G700 的图要来官方，制作网页。"),
    "official_fetch",
  );
  assert.equal(
    resolveMediaStrategy("只用品牌官方图片，禁止 AI 生图。"),
    "official_fetch",
  );
  assert.equal(
    resolveMediaStrategy("做一张官方摄影风的 AI 海报。"),
    "default",
  );
});

test("official media v2 tri-state is strict and defaults off", () => {
  delete process.env[FLAG];
  assert.equal(officialMediaV2Mode(), "off");
  process.env[FLAG] = "shadow";
  assert.equal(officialMediaV2Mode(), "shadow");
  process.env[FLAG] = "enforce";
  assert.equal(officialMediaV2Mode(), "enforce");
  process.env[FLAG] = "1";
  assert.equal(officialMediaV2Mode(), "off");
});

test("legacy visual degrade is mutually exclusive with enforced official-only media", () => {
  process.env[FLAG] = "enforce";
  assert.equal(shouldUseVisualPlaceholderDegrade({
    userGoal: "制作 HTML，图片必须来自品牌官方。",
    repeatKey: "generate_image:hero",
    forceFromTracker: true,
  }), false);
  assert.equal(shouldUseVisualPlaceholderDegrade({
    userGoal: "请按已绑定能力制作 HTML",
    officialMediaPolicy: "official_only",
    repeatKey: "fetch_page_images:timeout",
    forceFromTracker: true,
  }), false);

  process.env[FLAG] = "shadow";
  assert.equal(shouldUseVisualPlaceholderDegrade({
    userGoal: "制作 HTML，图片必须来自品牌官方。",
    repeatKey: "generate_image:hero",
    forceFromTracker: true,
  }), true);
});

test("capability binding fixes the official-media order ahead of fallback", () => {
  const prompt = buildCapabilityBindingAppendPrompt(
    {
      slug: "od-saas-landing",
      displayName: "官网设计",
      majorCategory: "creation",
    },
    {
      officialMediaPolicy: "official_only",
      allowPlaceholders: false,
    },
  );
  const discovery = prompt.indexOf("fetch_page_images");
  const localization = prompt.indexOf("fetch_media_asset");
  const write = prompt.indexOf("write_file", localization + 1);
  const render = prompt.indexOf("render_local_html_to_image");

  assert.ok(discovery >= 0);
  assert.ok(localization > discovery);
  assert.ok(write > localization);
  assert.ok(render > write);
  assert.match(prompt, /禁止.*generate_image/iu);
  assert.match(prompt, /不允许占位|禁止占位/iu);
});

test("development, packaging, and cloud rollout share only the official-media tri-state key", async () => {
  const [launcher, pack, cloud] = await Promise.all([
    readFile(new URL("scripts/lib/devLauncherCore.mjs", ROOT), "utf8"),
    readFile(new URL("scripts/release/pack.mjs", ROOT), "utf8"),
    readFile(new URL("scripts/release/apply-cloud-perf-env.sh", ROOT), "utf8"),
  ]);

  assert.match(
    launcher,
    /PILOTDECK_OFFICIAL_MEDIA_V2:\s*process\.env\.PILOTDECK_OFFICIAL_MEDIA_V2\s*\?\?\s*'shadow'/u,
  );
  assert.match(pack, /PILOTDECK_OFFICIAL_MEDIA_V2:\s*'off'/u);
  assert.match(
    cloud,
    /PILOTDECK_OFFICIAL_MEDIA_V2.*\^\(off\|shadow\|enforce\)\$/u,
  );
  for (const source of [launcher, pack, cloud]) {
    assert.doesNotMatch(
      source,
      /PILOTDECK_OFFICIAL_MEDIA_FSM|PILOTDECK_OFFICIAL_MEDIA_BUDGET|PILOTDECK_OFFICIAL_MEDIA_POLICY/u,
    );
  }
});
