import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DocumentImportProviderRegistry,
} from "../../../src/saas/document-import/providerRegistry.js";
import type { ImportResult } from "../../../src/saas/document-import/types.js";

describe("DocumentImportProviderRegistry", () => {
  it("orders local_first before cloud", () => {
    const registry = new DocumentImportProviderRegistry();
    registry.register({
      id: "local",
      kinds: ["pdf"],
      integrationLevel: "L2",
      priority: 50,
      availability: () => "ready",
      canHandle: () => true,
      parse: async () => ({ status: "insufficient_content", charCount: 0, durationMs: 0, providerId: "local" }),
    });
    registry.register({
      id: "cloud",
      kinds: ["pdf"],
      integrationLevel: "cloud",
      priority: 60,
      availability: () => "ready",
      canHandle: () => true,
      parse: async () => ({
        status: "ok",
        charCount: 500,
        durationMs: 1,
        providerId: "cloud",
        text: "ok",
      }),
    });
    const ctx = {
      workspaceRoot: "/tmp",
      documentImport: {
        enabled: true,
        cloudPreference: "local_first" as const,
        workerConcurrency: 4,
        timeoutMs: 30000,
        maxFileBytes: { pdf: 1e6, office: 1e6 },
        truncate: { maxChars: 1000, maxTableRows: 200 },
        fallbackProvider: "mineru" as const,
        enabledProviders: { local: true, cloud: true },
      },
    };
    const result = registry.parseWithFallback(ctx, {
      sourceAbsolutePath: "/tmp/a.pdf",
      sourcePath: "a.pdf",
      kind: "pdf",
      fileSizeBytes: 100,
    });
    return result.then((r: ImportResult) => {
      assert.equal(r.providerId, "cloud");
      assert.equal(r.status, "ok");
    });
  });
});
