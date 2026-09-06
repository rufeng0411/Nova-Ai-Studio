import test from "node:test";
import assert from "node:assert/strict";

import { isOcrExportReady } from "../../src/saas/document-export/uiExportRunner.js";

const MINERU_JWT =
  "eyJ0eXBlIjoiSldUIiwiYWxnIjoiSFM1MTIifQ.eyJqdGkiOiJ0ZXN0In0.signature";

test("isOcrExportReady reads DashScope key from nested model.providers on full PilotDeck config", () => {
  const yaml = {
    tools: {
      documentOcr: { provider: "mineru", mode: "cloud", fallbackProvider: "qwen-vl" },
    },
  };
  const fullConfig = {
    model: {
      providers: {
        qwen: { apiKey: "sk-test-dashscope-key-1234567890", models: {} },
      },
    },
  };
  assert.equal(isOcrExportReady({}, yaml, fullConfig as never), true);
});

test("isOcrExportReady accepts MinerU token from env when yaml has no explicit key", () => {
  const yaml = { tools: { documentOcr: { provider: "mineru", mode: "cloud" } } };
  assert.equal(
    isOcrExportReady({ MINERU_API_TOKEN: MINERU_JWT }, yaml, undefined),
    true,
  );
});

test("isOcrExportReady is false when neither MinerU nor DashScope is available", () => {
  const yaml = { tools: { documentOcr: { provider: "mineru", mode: "cloud" } } };
  assert.equal(isOcrExportReady({}, yaml, { model: { providers: {} } } as never), false);
});
