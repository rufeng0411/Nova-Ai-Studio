import assert from "node:assert/strict";
import test from "node:test";

import {
  OfficialMediaFallbackStateMachine,
  getOfficialMediaFallbackStateMachine,
  resetOfficialMediaFallbackStateMachinesForTests,
} from "../../src/saas/media/officialMediaFallbackStateMachine.js";
import {
  buildOfficialMediaPlaceholder,
  isOfficialMediaPlaceholderContent,
} from "../../src/saas/media/officialMediaPlaceholder.js";

const scope = {
  tenantScopeId: "tenant-fsm",
  principalScopeId: "user-fsm",
  workspaceRoot: process.cwd(),
  sessionId: "session-fsm",
  taskRoot: "artifacts/task-fsm",
  goalVersion: 1,
};

test.afterEach(() => {
  resetOfficialMediaFallbackStateMachinesForTests();
});

test("official media FSM follows discovery, localization, and ready states", () => {
  const fsm = new OfficialMediaFallbackStateMachine({
    allowPlaceholders: false,
  });

  const discovery = fsm.beginToolAttempt("fetch_page_images", {
    url: "https://brand.example.com/product",
  });
  assert.equal(discovery.allowed, true);
  assert.ok(discovery.permit);
  fsm.recordToolResult(discovery.permit!, {
    ok: true,
    data: { candidates: [{ candidateId: "candidate-1" }] },
  });
  assert.equal(fsm.snapshot().state, "official_localize");

  const localization = fsm.beginToolAttempt("fetch_media_asset", {
    candidateId: "candidate-1",
  });
  assert.equal(localization.allowed, true);
  assert.ok(localization.permit);
  fsm.recordToolResult(localization.permit!, {
    ok: true,
    data: { localPath: "artifacts/task-fsm/assets/hero.png" },
  });
  assert.equal(fsm.snapshot().state, "official_ready");
});

test("official media FSM permits only one in-flight attempt per ordered stage", () => {
  const fsm = new OfficialMediaFallbackStateMachine({
    allowPlaceholders: true,
  });
  const first = fsm.beginToolAttempt("fetch_page_images", {
    url: "https://brand.example.com/product-a",
  });
  assert.equal(first.allowed, true);
  assert.ok(first.permit);

  const concurrent = fsm.beginToolAttempt("fetch_page_images", {
    url: "https://brand.example.com/product-b",
  });
  assert.equal(concurrent.allowed, false);
  assert.match(concurrent.reason ?? "", /in[- ]flight|progress/iu);

  fsm.recordToolResult(first.permit!, {
    ok: true,
    data: { candidates: [{ candidateId: "candidate-1" }] },
  });
  assert.equal(fsm.snapshot().state, "official_localize");
});

test("official media budget survives turn changes for the same trusted scope", () => {
  const firstTurn = getOfficialMediaFallbackStateMachine(scope, {
    allowPlaceholders: true,
    maxDiscoveryAttempts: 1,
  });
  const discovery = firstTurn.beginToolAttempt("fetch_page_images", {
    url: "https://brand.example.com/product",
  });
  assert.ok(discovery.permit);
  firstTurn.recordToolResult(discovery.permit!, {
    ok: true,
    data: { candidates: [] },
  });
  assert.equal(firstTurn.snapshot().state, "placeholder_required");

  const secondTurn = getOfficialMediaFallbackStateMachine(scope, {
    allowPlaceholders: true,
    maxDiscoveryAttempts: 99,
  });
  assert.equal(secondTurn, firstTurn);
  const repeatedDiscovery = secondTurn.beginToolAttempt(
    "fetch_page_images",
    { url: "https://brand.example.com/another-product" },
  );
  assert.equal(repeatedDiscovery.allowed, false);
  assert.match(repeatedDiscovery.reason ?? "", /budget|state/iu);
});

test("official media FSM blocks fabricated fallback when placeholders are forbidden", () => {
  const fsm = new OfficialMediaFallbackStateMachine({
    allowPlaceholders: false,
    maxDiscoveryAttempts: 1,
  });
  const discovery = fsm.beginToolAttempt("fetch_page_images", {
    url: "https://brand.example.com/product",
  });
  assert.ok(discovery.permit);
  fsm.recordToolResult(discovery.permit!, {
    ok: false,
    error: "no official candidates",
  });

  assert.equal(fsm.snapshot().state, "blocked");
  assert.equal(fsm.shouldIssuePlaceholderRecovery(), false);
});

test("official media placeholder is deterministic, local-only, and machine-identifiable", () => {
  const first = buildOfficialMediaPlaceholder({
    label: "官方素材待补",
    width: 1600,
    height: 900,
  });
  const second = buildOfficialMediaPlaceholder({
    label: "官方素材待补",
    width: 1600,
    height: 900,
  });

  assert.deepEqual(second, first);
  assert.match(first.content, /PILOTDECK_OFFICIAL_MEDIA_PLACEHOLDER/u);
  assert.doesNotMatch(
    first.content,
    /(?:src|href)\s*=\s*["']https?:\/\//iu,
  );
  assert.equal(isOfficialMediaPlaceholderContent(first.content), true);
  assert.equal(isOfficialMediaPlaceholderContent("<svg></svg>"), false);
});
