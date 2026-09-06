import test from "node:test";
import assert from "node:assert/strict";

import { buildOpenAIRequest } from "../../../src/model/providers/openai/request.js";
import { sanitizeMessagesForModel } from "../../../src/model/request/sanitizeMessagesForModel.js";
import type { CanonicalMessage, ModelDefinition } from "../../../src/model/protocol/canonical.js";

const textOnlyModel: ModelDefinition = {
  id: "qwen3.6-flash",
  displayName: "Qwen Text",
  capabilities: {
    supportsToolUse: true,
    supportsStreaming: true,
    supportsParallelToolCalls: true,
    supportsThinking: false,
    supportsJsonSchema: true,
    supportsSystemPrompt: true,
    supportsPromptCache: false,
    maxContextTokens: 131072,
    maxOutputTokens: 8192,
  },
  multimodal: { input: ["text"] },
};

test("sanitizeMessagesForModel converts image blocks to text for text-only models", () => {
  const messages: CanonicalMessage[] = [
    {
      role: "user",
      content: [
        { type: "text", text: "hello" },
        {
          type: "image",
          source: "base64",
          data: "abc",
          mimeType: "image/png",
        },
      ],
    },
  ];

  const sanitized = sanitizeMessagesForModel(messages, textOnlyModel.multimodal);
  assert.deepEqual(sanitized[0]?.content, [
    { type: "text", text: "hello" },
    { type: "text", text: "[Image omitted: current model is text-only]" },
  ]);
});

test("buildOpenAIRequest does not emit image_url after sanitization", () => {
  const messages: CanonicalMessage[] = [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: "base64",
          data: "abc",
          mimeType: "image/png",
        },
      ],
    },
  ];

  const body = buildOpenAIRequest(
    {
      provider: "qwen",
      model: "qwen3.6-flash",
      messages: sanitizeMessagesForModel(messages, textOnlyModel.multimodal),
      stream: false,
    },
    textOnlyModel,
  );

  const content = body.messages[0]?.content;
  assert.equal(typeof content, "string");
  assert.doesNotMatch(JSON.stringify(body.messages), /image_url/);
  assert.doesNotMatch(JSON.stringify(body.messages), /input_audio/);
});
