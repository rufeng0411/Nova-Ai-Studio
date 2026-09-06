import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveDocumentImportConfig } from "../../../src/pilot/config/resolveDocumentImportConfig.js";

describe("resolveDocumentImportConfig", () => {
  it("defaults to enabled local_first", () => {
    const cfg = resolveDocumentImportConfig(undefined, {});
    assert.equal(cfg.enabled, true);
    assert.equal(cfg.cloudPreference, "local_first");
    assert.equal(cfg.workerConcurrency, 4);
    assert.ok(cfg.enabledProviders["mupdf-pdf"]);
  });

  it("reads yaml block", () => {
    const cfg = resolveDocumentImportConfig({
      documentImport: {
        enabled: false,
        cloudPreference: "local_only",
        workerConcurrency: 2,
      },
    }, {});
    assert.equal(cfg.enabled, false);
    assert.equal(cfg.cloudPreference, "local_only");
    assert.equal(cfg.workerConcurrency, 2);
  });
});
