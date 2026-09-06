export type ModelKind = "chat" | "vl" | "image" | "video" | "tts" | "speech";

export function inferModelKind(modelId: string): ModelKind {
  const id = String(modelId || "").toLowerCase();
  if (/seedream|qwen-image|wanx|t2i|image-edit|jimeng_t2i|high_aes/.test(id)) return "image";
  if (/seedance|happyhorse|t2v|i2v|text-to-video|image-to-video/.test(id)) return "video";
  if (/cosyvoice|sambert|qwen-tts|qwen3-tts|voice-enrollment/.test(id)) return "tts";
  if (/paraformer|fun-asr|qwen3-asr|asr|speech/.test(id)) return "speech";
  if (/qwen-vl|qwen3\.5-ocr|vision|vl-/.test(id)) return "vl";
  if (/kimi-k2.*code|coder/.test(id)) return "chat";
  if (/^glm-/.test(id)) return "chat";
  return "chat";
}

function unionKinds(...groups: ModelKind[][]): ModelKind[] {
  const set = new Set<ModelKind>();
  for (const group of groups) {
    for (const kind of group) set.add(kind);
  }
  return [...set];
}

export function modelEntryKinds(
  modelId: string,
  meta?: Record<string, unknown> | null,
): ModelKind[] {
  const raw = meta?.kinds;
  const inferred = inferModelKind(modelId);
  if (Array.isArray(raw) && raw.length > 0) {
    const fromMeta = raw.map((k) => String(k).toLowerCase()).filter(Boolean) as ModelKind[];
    const fromInfer: ModelKind[] = inferred === "vl" ? ["vl", "chat"] : [inferred];
    return unionKinds(fromMeta, fromInfer);
  }
  if (inferred === "vl") return ["vl", "chat"];
  return [inferred];
}

export function primaryModelKind(modelId: string, meta?: Record<string, unknown> | null): ModelKind {
  return modelEntryKinds(modelId, meta)[0] ?? "chat";
}
