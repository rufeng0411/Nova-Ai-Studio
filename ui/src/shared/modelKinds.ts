import { findCatalogProviderById } from './catalogProviders';

export type ModelKind = 'chat' | 'vl' | 'image' | 'video' | 'tts' | 'speech';

export function inferModelKind(modelId: string): ModelKind {
  const id = String(modelId || '').toLowerCase();
  if (/^imagen-|imagen-|nano-banana|gemini-.*-image|flash-image|image-generation/.test(id)) {
    return 'image';
  }
  if (/^veo-|veo-|lyria-/.test(id)) {
    return 'video';
  }
  if (/seedream|qwen-image|wanx.*t2i|wanx2\.1-t2i|t2i-turbo|t2i-plus|image-edit|jimeng_t2i|high_aes|text-to-image/.test(id)) {
    return 'image';
  }
  if (/seedance|happyhorse|wanx.*t2v|wanx.*i2v|t2v|i2v|text-to-video|image-to-video|videogen/.test(id)) {
    return 'video';
  }
  if (/gemini-.*-tts|preview-tts|multimodalembedding/.test(id)) return 'tts';
  if (/cosyvoice|sambert|qwen-tts|qwen3-tts|voice-enrollment/.test(id)) return 'tts';
  if (/paraformer|fun-asr|qwen3-asr|asr|speech/.test(id)) return 'speech';
  if (/qwen-vl|qwen3\.5-ocr|vision|vl-/.test(id)) return 'vl';
  if (/kimi-k2.*code|coder/.test(id)) return 'chat';
  if (/^glm-/.test(id)) return 'chat';
  return 'chat';
}

function unionKinds(...groups: ModelKind[][]): ModelKind[] {
  const set = new Set<ModelKind>();
  for (const group of groups) {
    for (const kind of group) set.add(kind);
  }
  return [...set];
}

/** Kinds for a model-pool entry: catalog chip > yaml meta > id inference (union, never drop image/video). */
export function resolveModelKindsForPoolEntry(
  providerId: string,
  modelId: string,
  meta?: Record<string, unknown> | null,
): ModelKind[] {
  const catalog = findCatalogProviderById(providerId);
  const catalogModel = catalog?.models.find((m) => m.id === modelId);
  const fromCatalog: ModelKind[] = catalogModel?.modelKind
    ? catalogModel.modelKind === 'vl'
      ? ['vl', 'chat']
      : [catalogModel.modelKind]
    : [];

  const raw = meta?.kinds;
  const fromMeta: ModelKind[] = Array.isArray(raw) && raw.length > 0
    ? (raw.map((k) => String(k).toLowerCase()).filter(Boolean) as ModelKind[])
    : [];

  const inferred = inferModelKind(modelId);
  const fromInfer: ModelKind[] = inferred === 'vl' ? ['vl', 'chat'] : [inferred];

  return unionKinds(fromCatalog, fromMeta, fromInfer);
}

export function modelEntryKinds(
  modelId: string,
  meta?: Record<string, unknown> | null,
): ModelKind[] {
  const raw = meta?.kinds;
  const inferred = inferModelKind(modelId);
  if (Array.isArray(raw) && raw.length > 0) {
    const fromMeta = raw.map((k) => String(k).toLowerCase()).filter(Boolean) as ModelKind[];
    const fromInfer: ModelKind[] = inferred === 'vl' ? ['vl', 'chat'] : [inferred];
    return unionKinds(fromMeta, fromInfer);
  }
  if (inferred === 'vl') return ['vl', 'chat'];
  return [inferred];
}

export function primaryModelKind(modelId: string, meta?: Record<string, unknown> | null): ModelKind {
  return modelEntryKinds(modelId, meta)[0] ?? 'chat';
}
