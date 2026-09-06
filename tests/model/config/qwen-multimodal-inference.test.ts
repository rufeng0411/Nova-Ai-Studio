import test from "node:test";
import assert from "node:assert/strict";

import { isQwenNativeMultimodalModel, parseModelConfig } from "../../../src/model/config/parseModelConfig.js";

test("isQwenNativeMultimodalModel includes Qwen3.5/3.6/3.7 unified chat models", () => {
  assert.equal(isQwenNativeMultimodalModel("qwen3.8-max-preview"), true);
  assert.equal(isQwenNativeMultimodalModel("qwen3.7-max"), true);
  assert.equal(isQwenNativeMultimodalModel("qwen3.7-plus"), true);
  assert.equal(isQwenNativeMultimodalModel("qwen3.6-flash"), true);
  assert.equal(isQwenNativeMultimodalModel("qwen3.6-flash-2026-04-16"), true);
  assert.equal(isQwenNativeMultimodalModel("qwen3.6-plus"), true);
  assert.equal(isQwenNativeMultimodalModel("qwen3.5-flash"), true);
  assert.equal(isQwenNativeMultimodalModel("qwen3.5-omni-plus"), true);
  assert.equal(isQwenNativeMultimodalModel("qwen-vl-plus"), true);
});

test("isQwenNativeMultimodalModel excludes legacy text-only qwen chat ids", () => {
  assert.equal(isQwenNativeMultimodalModel("qwen-max"), false);
  assert.equal(isQwenNativeMultimodalModel("qwen-plus"), false);
  assert.equal(isQwenNativeMultimodalModel("qwen3-max"), false);
  assert.equal(isQwenNativeMultimodalModel("qwen3-coder-plus"), false);
});

test("parseModelConfig infers image input for qwen3.6-flash without yaml multimodal block", () => {
  const config = parseModelConfig({
    providers: {
      qwen: {
        protocol: "openai",
        url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        apiKey: "test-key",
        models: {
          "qwen3.6-flash": {},
          "qwen3.7-max": {},
          "qwen-max": {},
        },
      },
    },
  });

  assert.deepEqual(config.providers.qwen?.models["qwen3.6-flash"]?.multimodal.input, ["text", "image"]);
  assert.equal(config.providers.qwen?.models["qwen3.6-flash"]?.multimodal.maxImagesPerRequest, 250);
  assert.deepEqual(config.providers.qwen?.models["qwen3.7-max"]?.multimodal.input, ["text", "image"]);
  assert.deepEqual(config.providers.qwen?.models["qwen-max"]?.multimodal.input, ["text"]);
});
