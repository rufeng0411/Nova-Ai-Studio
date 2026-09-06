import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createDefaultPermissionContext } from "../../src/permission/index.js";
import { OfficialMediaCandidateRegistry } from "../../src/saas/media/officialMediaCandidateRegistry.js";
import { OutboundGate } from "../../src/saas/resilience/outboundGate.js";
import {
  createFetchMediaAssetTool,
  MediaAssetTurnBudget,
  type FetchMediaAssetOutput,
} from "../../src/tool/builtin/fetchMediaAsset.js";
import type { PublicDnsResolver } from "../../src/tool/builtin/web/publicHttpUrlPolicy.js";
import type { PilotDeckToolRuntimeContext } from "../../src/tool/protocol/types.js";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const publicResolver: PublicDnsResolver = async () => [
  { address: "93.184.216.34", family: 4 },
];

function mediaContext(
  cwd: string,
  overrides: Partial<PilotDeckToolRuntimeContext> = {},
): PilotDeckToolRuntimeContext {
  return {
    sessionId: "session-media",
    turnId: "turn-media",
    cwd,
    taskArtifactDir: "artifacts/task-media",
    taskGoalVersion: 1,
    trustedExecutionScope: {
      tenantScopeId: "tenant-media",
      principalScopeId: "user-media",
    },
    permissionMode: "default",
    permissionContext: createDefaultPermissionContext({ cwd }),
    ...overrides,
  };
}

function registerCandidate(
  registry: OfficialMediaCandidateRegistry,
  cwd: string,
): void {
  registry.register({
    tenantScopeId: "tenant-media",
    principalScopeId: "user-media",
    workspaceRoot: cwd,
    sessionId: "session-media",
    taskRoot: "artifacts/task-media",
    goalVersion: 1,
    turnId: "turn-media",
    fullUrl:
      "https://cdn.example.com/hero.png?X-Amz-Signature=top-secret",
    sourcePageUrl:
      "https://brand.example.com/product?campaign=spring",
    mediaType: "image/png",
    sourceClassification: {
      url: "https://brand.example.com/product",
      level: "L0",
      reason: "official_source_root",
      sourceTier: "brand_official",
      rootId: "brand",
    },
  });
}

test("fetch_media_asset localizes a bound candidate atomically and records redacted provenance", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "fetch-media-asset-"));
  try {
    await mkdir(path.join(cwd, "artifacts", "task-media"), {
      recursive: true,
    });
    const registry = new OfficialMediaCandidateRegistry({
      idFactory: () => "candidate-media",
    });
    registerCandidate(registry, cwd);
    let gateRuns = 0;
    const gate = new OutboundGate(1);
    const originalRun = gate.run.bind(gate);
    gate.run = async <T>(operation: () => Promise<T>): Promise<T> => {
      gateRuns += 1;
      return originalRun(operation);
    };
    const tool = createFetchMediaAssetTool({
      candidateRegistry: registry,
      outboundGate: gate,
      dnsResolver: publicResolver,
      fetchImpl: async () =>
        new Response(PNG_1X1, {
          status: 200,
          headers: {
            "content-type": "image/png",
            "content-length": String(PNG_1X1.byteLength),
          },
        }),
    });

    const result = await tool.execute(
      { candidateId: "candidate-media", filename: "hero" },
      mediaContext(cwd),
    );
    const data = result.data as FetchMediaAssetOutput;
    assert.equal(gateRuns, 1);
    assert.match(
      data.localPath,
      /^artifacts\/task-media\/assets\/hero-[a-f0-9]{12}\.png$/u,
    );
    assert.equal(data.width, 1);
    assert.equal(data.height, 1);
    assert.equal(data.mimeType, "image/png");
    assert.match(data.sha256, /^[a-f0-9]{64}$/u);
    assert.equal(data.sourcePage, "https://brand.example.com/product");
    assert.equal((await readFile(path.join(cwd, data.localPath))).byteLength, PNG_1X1.byteLength);
    const ledger = await readFile(
      path.join(
        cwd,
        "artifacts",
        "task-media",
        "assets",
        ".asset-provenance-ledger.json",
      ),
      "utf8",
    );
    assert.match(ledger, /candidate-media/u);
    assert.doesNotMatch(ledger, /top-secret|X-Amz-Signature|campaign=spring/iu);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("fetch_media_asset rejects a candidate reused across tenant or task boundaries before download", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "fetch-media-scope-"));
  try {
    await mkdir(path.join(cwd, "artifacts", "task-media"), {
      recursive: true,
    });
    await mkdir(path.join(cwd, "artifacts", "task-other"), {
      recursive: true,
    });
    const registry = new OfficialMediaCandidateRegistry({
      idFactory: () => "candidate-media",
    });
    registerCandidate(registry, cwd);
    let fetchCalls = 0;
    const tool = createFetchMediaAssetTool({
      candidateRegistry: registry,
      dnsResolver: publicResolver,
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response(PNG_1X1, {
          headers: { "content-type": "image/png" },
        });
      },
    });

    await assert.rejects(
      tool.execute(
        { candidateId: "candidate-media" },
        mediaContext(cwd, {
          trustedExecutionScope: {
            tenantScopeId: "tenant-other",
            principalScopeId: "user-media",
          },
        }),
      ),
      /candidate.*scope|bound candidate/iu,
    );
    await assert.rejects(
      tool.execute(
        { candidateId: "candidate-media" },
        mediaContext(cwd, {
          taskArtifactDir: "artifacts/task-other",
        }),
      ),
      /candidate.*scope|bound candidate/iu,
    );
    assert.equal(fetchCalls, 0);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("fetch_media_asset rejects the workspace root as a task artifact directory", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "fetch-media-root-scope-"));
  try {
    const registry = new OfficialMediaCandidateRegistry({
      idFactory: () => "candidate-root",
    });
    registry.register({
      tenantScopeId: "tenant-media",
      principalScopeId: "user-media",
      workspaceRoot: cwd,
      sessionId: "session-media",
      taskRoot: ".",
      goalVersion: 1,
      turnId: "turn-media",
      fullUrl: "https://cdn.example.com/hero.png",
      sourcePageUrl: "https://brand.example.com/product",
      mediaType: "image/png",
      sourceClassification: {
        url: "https://brand.example.com/product",
        level: "L0",
        reason: "official_source_root",
        sourceTier: "brand_official",
        rootId: "brand",
      },
    });
    let fetchCalls = 0;
    const tool = createFetchMediaAssetTool({
      candidateRegistry: registry,
      dnsResolver: publicResolver,
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response(PNG_1X1, {
          headers: { "content-type": "image/png" },
        });
      },
    });

    await assert.rejects(
      tool.execute(
        { candidateId: "candidate-root" },
        mediaContext(cwd, { taskArtifactDir: "." }),
      ),
      /task artifact directory|active task/iu,
    );
    assert.equal(fetchCalls, 0);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("fetch_media_asset rejects a response whose MIME disagrees with image magic", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "fetch-media-mime-"));
  try {
    await mkdir(path.join(cwd, "artifacts", "task-media"), {
      recursive: true,
    });
    const registry = new OfficialMediaCandidateRegistry({
      idFactory: () => "candidate-media",
    });
    registerCandidate(registry, cwd);
    const tool = createFetchMediaAssetTool({
      candidateRegistry: registry,
      dnsResolver: publicResolver,
      fetchImpl: async () =>
        new Response(PNG_1X1, {
          headers: { "content-type": "image/jpeg" },
        }),
    });

    await assert.rejects(
      tool.execute(
        { candidateId: "candidate-media" },
        mediaContext(cwd),
      ),
      /MIME|magic/iu,
    );
    assert.deepEqual(
      await readdir(
        path.join(cwd, "artifacts", "task-media", "assets"),
      ),
      [],
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("fetch_media_asset reserves and enforces the aggregate per-turn download budget", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "fetch-media-budget-"));
  try {
    await mkdir(path.join(cwd, "artifacts", "task-media"), {
      recursive: true,
    });
    let sequence = 0;
    const registry = new OfficialMediaCandidateRegistry({
      idFactory: () => `candidate-${sequence += 1}`,
    });
    registerCandidate(registry, cwd);
    registerCandidate(registry, cwd);
    let fetchCalls = 0;
    const budget = new MediaAssetTurnBudget({
      maxBytesPerAsset: PNG_1X1.byteLength,
      maxBytesPerTurn: PNG_1X1.byteLength,
    });
    const tool = createFetchMediaAssetTool({
      candidateRegistry: registry,
      downloadBudget: budget,
      dnsResolver: publicResolver,
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response(PNG_1X1, {
          headers: {
            "content-type": "image/png",
            "content-length": String(PNG_1X1.byteLength),
          },
        });
      },
    });

    await tool.execute(
      { candidateId: "candidate-1", filename: "first" },
      mediaContext(cwd),
    );
    await assert.rejects(
      tool.execute(
        { candidateId: "candidate-2", filename: "second" },
        mediaContext(cwd),
      ),
      /turn download budget/iu,
    );
    assert.equal(fetchCalls, 1);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("fetch_media_asset rejects an assets reparse point that escapes the task root", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "fetch-media-link-"));
  const outside = await mkdtemp(path.join(os.tmpdir(), "fetch-media-outside-"));
  try {
    const taskRoot = path.join(cwd, "artifacts", "task-media");
    await mkdir(taskRoot, { recursive: true });
    await symlink(
      outside,
      path.join(taskRoot, "assets"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const registry = new OfficialMediaCandidateRegistry({
      idFactory: () => "candidate-media",
    });
    registerCandidate(registry, cwd);
    let fetchCalls = 0;
    const tool = createFetchMediaAssetTool({
      candidateRegistry: registry,
      dnsResolver: publicResolver,
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response(PNG_1X1, {
          headers: { "content-type": "image/png" },
        });
      },
    });

    await assert.rejects(
      tool.execute(
        { candidateId: "candidate-media" },
        mediaContext(cwd),
      ),
      /reparse|outside.*task|symbolic/iu,
    );
    assert.equal(fetchCalls, 0);
    assert.deepEqual(await readdir(outside), []);
  } finally {
    await rm(cwd, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
