import { findCatalogProviderById } from './catalogProviders';
import {
  findBestModelPoolProviderForKind,
  listAllEnabledModelsFromPoolProvider,
  listEnabledMediaModelsFromPool,
  type ListPoolMediaModelsOptions,
  type MediaProvider,
  type ModelProviderSlice,
} from './resolveMediaFromModelProviders';

export type ListModelsApiRequest = {
  provider: string;
  baseUrl: string;
};

/** Map settings provider id → /api/providers/list-models body. Returns null if discovery is unsupported. */
export function buildListModelsRequest(
  providerId: string,
  urlOverride?: string,
): ListModelsApiRequest | null {
  const catalog = findCatalogProviderById(providerId);
  const baseUrl = (urlOverride || catalog?.defaultUrl || '').trim();
  const id = providerId.trim().toLowerCase();

  if (id === 'anthropic') {
    return null;
  }
  if (id === 'google') {
    return { provider: 'google', baseUrl };
  }
  if (id === 'qwen' || id === 'dashscope') {
    return { provider: 'qwen', baseUrl: baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1' };
  }
  if (id === 'volc_ark' || id === 'volcengine') {
    return {
      provider: 'volcengine',
      baseUrl: baseUrl || 'https://ark.cn-beijing.volces.com/api/v3',
    };
  }
  if (id === 'baidu' || id === 'qianfan') {
    return { provider: 'baidu', baseUrl: baseUrl || 'https://qianfan.baidubce.com/v2' };
  }
  if (id === 'zhipu' || id === 'glm' || id === 'bigmodel') {
    return { provider: 'zhipu', baseUrl: baseUrl || 'https://open.bigmodel.cn/api/paas/v4' };
  }
  if (id === 'kimi' || id === 'moonshot') {
    return { provider: 'kimi', baseUrl: baseUrl || 'https://api.moonshot.cn/v1' };
  }
  if (id === 'ollama' || id === 'lmstudio' || id === 'vllm' || id === 'openai_compatible') {
    return { provider: id, baseUrl };
  }

  return { provider: 'openai-compatible', baseUrl };
}

export const MODEL_KIND_LABELS: Record<string, string> = {
  chat: '对话',
  vl: '识图',
  image: '图片',
  video: '视频',
  tts: '语音',
  speech: '识别',
};

export function formatListModelOption(entry: {
  id?: string;
  label?: string;
  kinds?: string[];
}): { value: string; label: string } {
  const id = String(entry.id || '').trim();
  const primaryKind = entry.kinds?.[0];
  const kindTag = primaryKind ? MODEL_KIND_LABELS[primaryKind] || primaryKind : '';
  const prefix = kindTag ? `[${kindTag}] ` : '';
  const name = String(entry.label || id).trim();
  const label = name && name !== id ? `${prefix}${name}` : `${prefix}${id}`;
  return { value: id, label };
}

function poolOptionLabel(providerId: string, id: string, kinds: string[]): { value: string; label: string } {
  const catalog = findCatalogProviderById(providerId);
  const catalogModel = catalog?.models.find((m) => m.id === id);
  const formatted = formatListModelOption({
    id,
    label: catalogModel?.displayName ?? id,
    kinds,
  });
  return { value: formatted.value, label: `[模型池·${providerId}] ${formatted.label}` };
}

/** Build select options from model pool chips (already enabled in model.providers). */
export function buildMediaSelectOptionsFromPool(
  providers: Record<string, ModelProviderSlice> | undefined,
  mediaKind: 'image' | 'video',
  options: ListPoolMediaModelsOptions = { allProviders: true },
): Array<{ value: string; label: string }> {
  const typed = listEnabledMediaModelsFromPool(providers, mediaKind, options).map((entry) =>
    poolOptionLabel(entry.providerId, entry.id, entry.kinds),
  );
  if (typed.length > 0) return typed;

  const best = findBestModelPoolProviderForKind(providers, mediaKind);
  if (best) {
    return listEnabledMediaModelsFromPool(providers, mediaKind, {
      providerId: best.providerId,
      allProviders: false,
    }).map((entry) => poolOptionLabel(entry.providerId, entry.id, entry.kinds));
  }

  const fallbackProvider = options.mediaProvider;
  return listAllEnabledModelsFromPoolProvider(providers, fallbackProvider)
    .filter((entry) => entry.kinds.includes(mediaKind))
    .map((entry) => poolOptionLabel(entry.providerId, entry.id, entry.kinds));
}

export function mergeMediaSelectOptions(
  poolOptions: Array<{ value: string; label: string }>,
  fetchedOptions: Array<{ value: string; label: string }>,
): Array<{ value: string; label: string }> {
  const merged = new Map<string, { value: string; label: string }>();
  for (const option of poolOptions) {
    merged.set(option.value, option);
  }
  for (const option of fetchedOptions) {
    if (!merged.has(option.value)) {
      merged.set(option.value, option);
    }
  }
  return [...merged.values()];
}

function unionKindStrings(a: string[] | undefined, b: string[] | undefined): string[] | undefined {
  const set = new Set<string>();
  for (const list of [a, b]) {
    if (!list) continue;
    for (const k of list) {
      const v = String(k || '').trim().toLowerCase();
      if (v) set.add(v);
    }
  }
  return set.size > 0 ? [...set] : undefined;
}

export function mergeDiscoveredModelIds(
  existing: Record<string, Record<string, unknown>> | undefined,
  discovered: Array<{ id: string; kinds?: string[] }>,
): Record<string, Record<string, unknown>> {
  const next = { ...(existing ?? {}) };
  for (const entry of discovered) {
    const id = String(entry.id || '').trim();
    if (!id) continue;
    const prev = (next[id] ?? {}) as Record<string, unknown>;
    const prevKinds = Array.isArray(prev.kinds) ? prev.kinds.map((k) => String(k)) : undefined;
    const discoveredKinds = Array.isArray(entry.kinds) ? entry.kinds.map((k) => String(k)) : undefined;
    const mergedKinds = unionKindStrings(prevKinds, discoveredKinds);
    next[id] = {
      ...prev,
      ...(mergedKinds ? { kinds: mergedKinds } : {}),
    };
  }
  return next;
}

/** When curating, drop off-catalog pool entries then merge discovered representatives. */
export function mergeCuratedDiscoveredModels(
  existing: Record<string, Record<string, unknown>> | undefined,
  discovered: Array<{ id: string; kinds?: string[] }>,
  catalogModelIds: Set<string> | null,
): Record<string, Record<string, unknown>> {
  let base = existing ?? {};
  if (catalogModelIds) {
    base = Object.fromEntries(Object.entries(base).filter(([id]) => catalogModelIds.has(id)));
  }
  return mergeDiscoveredModelIds(base, discovered);
}
