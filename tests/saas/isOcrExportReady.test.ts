import test from "node:test";
import assert from "node:assert/strict";
import { isOcrExportReady } from "../../src/saas/document-export/uiExportRunner.js";

const MINERU_JWT =
  "eyJ0eXBlIjoiSldUIiwiYWxnIjoiSFM1MTIifQ.eyJqdGkiOiJ0ZXN0In0.signature";

test("isOcrExportReady reads DashScope from nested model.providers on full disk config", () => {
  const yamlRoot = {
    tools: {
      documentOcr: { provider: "mineru", mode: "cloud", fallbackProvider: "qwen-vl" },
    },
  };
  const diskConfig = {
    model: {
      providers: {
        qwen: { apiKey: "sk-test-dashscope-key-1234567890", models: {} },
      },
    },
  };
  assert.equal(isOcrExportReady({}, yamlRoot, diskConfig as never), true);
});

test("isOcrExportReady accepts MinerU token from tools.documentOcr on yaml root", () => {
  const yamlRoot = {
    tools: {
      documentOcr: {
        provider: "mineru",
        mode: "cloud",
        apiKey: MINERU_JWT,
        extractorMethod: "mineru",
      },
    },
  };
  assert.equal(isOcrExportReady({}, yamlRoot, undefined), true);
});

test("isOcrExportReady is false when neither MinerU nor DashScope is configured", () => {
  const yamlRoot = {
    tools: { documentOcr: { provider: "mineru", mode: "cloud" } },
  };
  assert.equal(isOcrExportReady({}, yamlRoot, { model: { providers: {} } } as never), false);
});
