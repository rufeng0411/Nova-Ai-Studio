import assert from "node:assert/strict";
import test from "node:test";

import { OfficialMediaCandidateRegistry } from "../../src/saas/media/officialMediaCandidateRegistry.js";

const candidateBinding = {
  tenantScopeId: "tenant-1",
  principalScopeId: "user-1",
  workspaceRoot: "F:/workspace-one",
  sessionId: "session-1",
  taskRoot: "artifacts/task-20260719-media001",
  goalVersion: 1,
};

test("official media registry binds candidates to tenant, principal, workspace, session, task root, and goal version", () => {
  const registry = new OfficialMediaCandidateRegistry({
    idFactory: () => "candidate-bound",
  });
  registry.register({
    ...candidateBinding,
    turnId: "turn-1",
    fullUrl: "https://cdn.example.com/hero.jpg?token=secret",
    sourcePageUrl: "https://brand.example.com/product?campaign=spring",
    sourceClassification: {
      url: "https://brand.example.com/product",
      level: "L0",
      reason: "official_source_root",
      sourceTier: "brand_official",
    },
  });

  const stored = registry.resolve("candidate-bound", candidateBinding);
  assert.ok(stored);
  assert.match(stored.assetUrlHash, /^[a-f0-9]{64}$/u);
  assert.match(stored.sourcePageHash, /^[a-f0-9]{64}$/u);
  assert.match(stored.bindingHash, /^[a-f0-9]{64}$/u);
  assert.equal(
    registry.resolve("candidate-bound", {
      ...candidateBinding,
      tenantScopeId: "tenant-2",
    }),
    undefined,
  );
  assert.equal(
    registry.resolve("candidate-bound", {
      ...candidateBinding,
      taskRoot: "artifacts/task-20260719-other001",
    }),
    undefined,
  );
});

test("official media registry exposes only canonical metadata and retains full URL in memory", () => {
  let now = 1_000;
  let sequence = 0;
  const registry = new OfficialMediaCandidateRegistry({
    maxEntries: 2,
    ttlMs: 500,
    now: () => now,
    idFactory: () => `candidate-${sequence += 1}`,
  });

  const publicCandidate = registry.register({
    ...candidateBinding,
    sessionId: "session-1",
    turnId: "turn-1",
    fullUrl:
      "https://cdn.example.com/hero.jpg?X-Amz-Signature=secret&width=1600",
    sourcePageUrl: "https://brand.example.com/product?campaign=spring",
    width: 1600,
    height: 900,
    mediaType: "image/jpeg",
    sourceClassification: {
      url: "https://brand.example.com/product",
      level: "L0",
      reason: "official_source_root",
      sourceTier: "brand_official",
      rootId: "brand",
    },
  });

  assert.deepEqual(publicCandidate, {
    candidateId: "candidate-1",
    canonicalUrl: "https://cdn.example.com/hero.jpg",
    width: 1600,
    height: 900,
    mediaType: "image/jpeg",
    sourcePage: "https://brand.example.com/product",
  });
  assert.doesNotMatch(JSON.stringify(publicCandidate), /secret|X-Amz/iu);

  const stored = registry.resolve("candidate-1", candidateBinding);
  assert.equal(
    stored?.fullUrl,
    "https://cdn.example.com/hero.jpg?X-Amz-Signature=secret&width=1600",
  );
  assert.equal(stored?.sourceClassification.level, "L0");
  assert.equal(
    registry.resolve("candidate-1", {
      ...candidateBinding,
      sessionId: "other-session",
    }),
    undefined,
  );

  registry.register({
    ...candidateBinding,
    sessionId: "session-1",
    turnId: "turn-1",
    fullUrl: "https://cdn.example.com/second.jpg?token=secret",
    sourcePageUrl: "https://brand.example.com/product",
    sourceClassification: {
      url: "https://brand.example.com/product",
      level: "L0",
      reason: "user_explicit_url",
    },
  });
  registry.register({
    ...candidateBinding,
    sessionId: "session-1",
    turnId: "turn-1",
    fullUrl: "https://cdn.example.com/third.jpg?token=secret",
    sourcePageUrl: "https://brand.example.com/product",
    sourceClassification: {
      url: "https://brand.example.com/product",
      level: "L0",
      reason: "user_explicit_url",
    },
  });
  assert.equal(registry.size, 2);
  assert.equal(registry.resolve("candidate-1", candidateBinding), undefined);

  now += 501;
  assert.equal(registry.resolve("candidate-2", candidateBinding), undefined);
  assert.equal(registry.size, 0);
});

test("official media registry remains bounded when numeric options are invalid", () => {
  let now = 1_000;
  let sequence = 0;
  const registry = new OfficialMediaCandidateRegistry({
    maxEntries: Number.NaN,
    ttlMs: Number.POSITIVE_INFINITY,
    now: () => now,
    idFactory: () => `candidate-${sequence += 1}`,
  });

  for (let index = 0; index <= 400; index += 1) {
    registry.register({
      ...candidateBinding,
      sessionId: "session-1",
      turnId: "turn-1",
      fullUrl: `https://cdn.example.com/image-${index}.jpg?token=secret`,
      sourcePageUrl: "https://brand.example.com/product",
      sourceClassification: {
        url: "https://brand.example.com/product",
        level: "L0",
        reason: "user_explicit_url",
      },
    });
  }

  assert.equal(registry.size, 400);
  now += 10 * 60 * 1_000;
  assert.equal(registry.size, 0);
});
