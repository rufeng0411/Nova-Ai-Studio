import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultPermissionContext } from "../../src/permission/index.js";
import { OfficialMediaCandidateRegistry } from "../../src/saas/media/officialMediaCandidateRegistry.js";
import type { OfficialSourceRootsRegistry } from "../../src/saas/media/officialSourceRoots.js";
import { OutboundGate } from "../../src/saas/resilience/outboundGate.js";
import { createFetchPageImagesTool } from "../../src/tool/builtin/fetchPageImages.js";
import type { PublicDnsResolver } from "../../src/tool/builtin/web/publicHttpUrlPolicy.js";
import type { PilotDeckToolRuntimeContext } from "../../src/tool/protocol/types.js";

const publicResolver: PublicDnsResolver = async () => [
  { address: "93.184.216.34", family: 4 },
];

const sourceRoots: OfficialSourceRootsRegistry = {
  version: 1,
  roots: [{
    id: "brand-example",
    rootUrl: "https://brand.example.com/",
    sourceTier: "brand_official",
    includeSubdomains: true,
  }],
};

function officialContext(
  overrides: Partial<PilotDeckToolRuntimeContext> = {},
): PilotDeckToolRuntimeContext {
  return {
    sessionId: "session-1",
    turnId: "turn-1",
    cwd: process.cwd(),
    taskArtifactDir: "artifacts/task-official-media",
    taskGoalVersion: 1,
    trustedExecutionScope: {
      tenantScopeId: "tenant-1",
      principalScopeId: "user-1",
    },
    permissionMode: "default",
    permissionContext: createDefaultPermissionContext({ cwd: process.cwd() }),
    qualityContractMode: "enforce",
    sessionGoalQualityContract: {
      contractVersion: 1,
      subjectAliases: [],
      exactQuantityAssertions: [],
      officialMediaPolicy: "official_only",
      allowedSourceTiers: ["brand_official"],
      allowPlaceholders: false,
      forbidGenerateImage: true,
    },
    ...overrides,
  };
}

const candidateBinding = {
  tenantScopeId: "tenant-1",
  principalScopeId: "user-1",
  workspaceRoot: process.cwd(),
  sessionId: "session-1",
  taskRoot: "artifacts/task-official-media",
  goalVersion: 1,
};

test("official fetch returns only canonical candidate metadata and keeps signed URL in bounded registry", async () => {
  let gateRuns = 0;
  let requestRedirect: RequestRedirect | undefined;
  const gate = new OutboundGate(1);
  const originalRun = gate.run.bind(gate);
  gate.run = async <T>(fn: () => Promise<T>): Promise<T> => {
    gateRuns += 1;
    return originalRun(fn);
  };
  const registry = new OfficialMediaCandidateRegistry({
    idFactory: () => "candidate-1",
  });
  const html = `
    <img
      src="https://cdn.example.net/assets/hero.jpg?X-Amz-Signature=secret&width=1600"
      width="1600"
      height="900"
    />
  `;
  const fetchImpl: typeof fetch = async (_input, init) => {
    requestRedirect = init?.redirect;
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  };
  const tool = createFetchPageImagesTool({
    fetchImpl,
    dnsResolver: publicResolver,
    candidateRegistry: registry,
    officialSourceRoots: sourceRoots,
    outboundGate: gate,
  });

  const result = await tool.execute(
    {
      url: "https://brand.example.com/product?campaign=spring",
      minWidth: 800,
    },
    officialContext(),
  );

  assert.equal(gateRuns, 1);
  assert.equal(requestRedirect, "manual");
  assert.deepEqual(result.data, {
    mode: "official",
    sourceUrl: "https://brand.example.com/product",
    count: 1,
    images: [],
    candidates: [{
      candidateId: "candidate-1",
      canonicalUrl: "https://cdn.example.net/assets/hero.jpg",
      width: 1600,
      height: 900,
      mediaType: "image/jpeg",
      sourcePage: "https://brand.example.com/product",
    }],
  });
  const modelText =
    result.content[0]?.type === "text" ? result.content[0].text : "";
  assert.doesNotMatch(modelText, /secret|X-Amz-Signature|campaign=spring/iu);

  const stored = registry.resolve("candidate-1", candidateBinding);
  assert.equal(
    stored?.fullUrl,
    "https://cdn.example.net/assets/hero.jpg?X-Amz-Signature=secret&width=1600",
  );
  assert.equal(stored?.sourceClassification.level, "L0");
  assert.equal(stored?.sourceClassification.sourceTier, "brand_official");
});

test("official-only fetch does not expose candidates from an unverified source page", async () => {
  const registry = new OfficialMediaCandidateRegistry({
    idFactory: () => "candidate-unverified",
  });
  const tool = createFetchPageImagesTool({
    fetchImpl: async () =>
      new Response(
        `<img src="https://cdn.example.net/assets/unverified-hero.jpg" />`,
        {
          status: 200,
          headers: { "content-type": "text/html" },
        },
      ),
    dnsResolver: publicResolver,
    candidateRegistry: registry,
    officialSourceRoots: sourceRoots,
  });

  const result = await tool.execute(
    { url: "https://publisher.example.net/story" },
    officialContext(),
  );
  assert.deepEqual(result.data?.candidates, []);
  assert.equal(result.data?.count, 0);
  assert.equal(registry.size, 0);
});

test("a URL explicitly present in trusted user input can establish an L0 source", async () => {
  const registry = new OfficialMediaCandidateRegistry({
    idFactory: () => "candidate-explicit",
  });
  const pageUrl = "https://launch.example.net/product";
  const tool = createFetchPageImagesTool({
    fetchImpl: async () =>
      new Response(
        `<img src="https://cdn.example.net/assets/user-linked-hero.jpg" />`,
        {
          status: 200,
          headers: { "content-type": "text/html" },
        },
      ),
    dnsResolver: publicResolver,
    candidateRegistry: registry,
    officialSourceRoots: { version: 1, roots: [] },
  });

  const result = await tool.execute(
    { url: pageUrl },
    officialContext({ trustedUserExplicitUrls: [pageUrl] }),
  );
  assert.equal(result.data?.count, 1);
  assert.equal(
    registry.resolve("candidate-explicit", candidateBinding)
      ?.sourceClassification.level,
    "L0",
  );
  assert.equal(
    registry.resolve("candidate-explicit", candidateBinding)
      ?.sourceClassification.reason,
    "source_page_inheritance",
  );
});

test("fetch_page_images input validation uses the public URL policy", async () => {
  const tool = createFetchPageImagesTool({
    dnsResolver: publicResolver,
  });
  const validation = await tool.validateInput?.(
    { url: "https://127.0.0.1/private" },
    officialContext(),
  );
  assert.deepEqual(validation, {
    ok: false,
    issues: [{
      path: "url",
      code: "invalid_type",
      message: "url failed public HTTP policy validation.",
    }],
  });
});
