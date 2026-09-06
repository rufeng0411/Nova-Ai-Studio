import { buildAnthropicRequest, type AnthropicRequestBody } from "../providers/anthropic/request.js";
import { buildOpenAIRequest, type OpenAIRequestBody } from "../providers/openai/request.js";
import type { CanonicalModelRequest, ModelConfig } from "../protocol/canonical.js";
import { sanitizeMessagesForModel } from "./sanitizeMessagesForModel.js";
import { validateModelRequest } from "./validateModelRequest.js";

export type ProviderRequestBody = AnthropicRequestBody | OpenAIRequestBody;

export function buildModelRequest(
  request: CanonicalModelRequest,
  config: ModelConfig,
): ProviderRequestBody {
  const provider = config.providers[request.provider];
  const model = provider?.models[request.model];
  const sanitizedRequest = model
    ? { ...request, messages: sanitizeMessagesForModel(request.messages, model.multimodal) }
    : request;

  const { provider: resolvedProvider, model: resolvedModel } = validateModelRequest(sanitizedRequest, config);

  if (resolvedProvider.protocol === "anthropic") {
    return buildAnthropicRequest(sanitizedRequest, resolvedModel);
  }

  return buildOpenAIRequest(sanitizedRequest, resolvedModel);
}
