import type { CanonicalContentBlock, CanonicalMessage } from "../protocol/canonical.js";
import type { InputModality, MultimodalConstraints } from "../protocol/multimodal.js";

function placeholderFor(modality: InputModality): string {
  switch (modality) {
    case "image":
      return "[Image omitted: current model is text-only]";
    case "pdf":
      return "[PDF omitted: current model does not accept documents]";
    case "audio":
      return "[Audio omitted: current model does not accept audio]";
    default:
      return "[Content omitted: unsupported for current model]";
  }
}

function sanitizeToolResultContent(
  content: Extract<CanonicalContentBlock, { type: "tool_result" }>["content"],
  allowed: Set<InputModality>,
): Extract<CanonicalContentBlock, { type: "tool_result" }>["content"] {
  return content.map((item) => {
    if (item.type === "image" && !allowed.has("image")) {
      return { type: "text", text: placeholderFor("image") };
    }
    if (item.type === "pdf" && !allowed.has("pdf")) {
      return { type: "text", text: placeholderFor("pdf") };
    }
    return item;
  });
}

function sanitizeBlock(block: CanonicalContentBlock, allowed: Set<InputModality>): CanonicalContentBlock {
  if (block.type === "image" && !allowed.has("image")) {
    return { type: "text", text: placeholderFor("image") };
  }
  if (block.type === "pdf" && !allowed.has("pdf")) {
    return { type: "text", text: placeholderFor("pdf") };
  }
  if (block.type === "audio" && !allowed.has("audio")) {
    return { type: "text", text: placeholderFor("audio") };
  }
  if (block.type === "tool_result") {
    const nextContent = sanitizeToolResultContent(block.content, allowed);
    if (nextContent === block.content) {
      return block;
    }
    return { ...block, content: nextContent };
  }
  return block;
}

/** Drop unsupported multimodal blocks before provider serialization (prevents DashScope 400s). */
export function sanitizeMessagesForModel(
  messages: CanonicalMessage[],
  multimodal: MultimodalConstraints,
): CanonicalMessage[] {
  const allowed = new Set<InputModality>(multimodal.input);
  if (allowed.has("text") && allowed.has("image") && allowed.has("pdf") && allowed.has("audio")) {
    return messages;
  }

  return messages.map((message) => ({
    ...message,
    content: message.content.map((block) => sanitizeBlock(block, allowed)),
  }));
}
