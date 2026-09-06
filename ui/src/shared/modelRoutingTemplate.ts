/**
 * Save / load agent + router + memory model routing slices as named templates.
 * Stored locally in the browser (no API keys).
 */

export const MODEL_ROUTING_TEMPLATE_STORAGE_KEY = 'pilotdeck.modelRoutingTemplates.v1';
export const MODEL_ROUTING_TEMPLATE_VERSION = 1 as const;

export type ModelRoutingTemplateAgent = {
  model?: string;
  maxContextTokens?: number;
  params?: Record<string, unknown>;
  subagents?: { default?: string; params?: Record<string, unknown> };
};

export type ModelRoutingTemplateMemory = {
  enabled?: boolean;
  model?: string;
  apiType?: string;
  reasoningMode?: string;
  projectContinuity?: { enabled?: boolean };
};

export type ModelRoutingTemplateRouter = Record<string, unknown>;

export type ModelRoutingTemplate = {
  version: typeof MODEL_ROUTING_TEMPLATE_VERSION;
  id: string;
  name: string;
  savedAt: string;
  agent?: ModelRoutingTemplateAgent;
  memory?: ModelRoutingTemplateMemory;
  router?: ModelRoutingTemplateRouter;
  summary?: {
    agentModel?: string;
    memoryModel?: string;
    routerDefault?: string;
  };
};

export type ModelRoutingConfigSlice = {
  agent?: ModelRoutingTemplateAgent;
  memory?: ModelRoutingTemplateMemory;
  router?: ModelRoutingTemplateRouter;
};

function cloneJson<T>(value: T | undefined): T | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepMergeObjects(
  base: Record<string, unknown> | undefined,
  patch: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!patch) return base ? { ...base } : undefined;
  const out: Record<string, unknown> = { ...(base ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    const prev = out[key];
    if (isPlainObject(prev) && isPlainObject(value)) {
      out[key] = deepMergeObjects(prev, value) ?? {};
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function buildModelRoutingSummary(slice: ModelRoutingConfigSlice): ModelRoutingTemplate['summary'] {
  return {
    agentModel: slice.agent?.model?.trim() || undefined,
    memoryModel: slice.memory?.model?.trim() || undefined,
    routerDefault: typeof slice.router?.scenarios === 'object' && slice.router.scenarios !== null
      ? String((slice.router.scenarios as Record<string, unknown>).default ?? '').trim() || undefined
      : undefined,
  };
}

export function extractModelRoutingSlice(config: ModelRoutingConfigSlice): ModelRoutingConfigSlice {
  const agent = config.agent
    ? cloneJson({
        model: config.agent.model,
        maxContextTokens: config.agent.maxContextTokens,
        params: config.agent.params,
        subagents: config.agent.subagents,
      })
    : undefined;

  const memory = config.memory
    ? cloneJson({
        enabled: config.memory.enabled,
        model: config.memory.model,
        apiType: config.memory.apiType,
        reasoningMode: config.memory.reasoningMode,
        projectContinuity: config.memory.projectContinuity,
      })
    : undefined;

  const router = config.router ? cloneJson(config.router) : undefined;

  return { agent, memory, router };
}

export function extractModelRoutingTemplate(config: ModelRoutingConfigSlice, name: string): ModelRoutingTemplate {
  const slice = extractModelRoutingSlice(config);
  return {
    version: MODEL_ROUTING_TEMPLATE_VERSION,
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    savedAt: new Date().toISOString(),
    ...slice,
    summary: buildModelRoutingSummary(slice),
  };
}

export function applyModelRoutingTemplate<T extends ModelRoutingConfigSlice>(
  base: T,
  template: ModelRoutingTemplate | ModelRoutingConfigSlice,
): T {
  const slice = 'version' in template ? extractModelRoutingSlice(template) : template;
  return {
    ...base,
    agent: slice.agent ? { ...(base.agent ?? {}), ...slice.agent, subagents: slice.agent.subagents
      ? { ...(base.agent?.subagents ?? {}), ...slice.agent.subagents }
      : base.agent?.subagents } : base.agent,
    memory: slice.memory
      ? {
          ...(base.memory ?? {}),
          ...slice.memory,
          projectContinuity: slice.memory.projectContinuity
            ? { ...(base.memory?.projectContinuity ?? {}), ...slice.memory.projectContinuity }
            : base.memory?.projectContinuity,
        }
      : base.memory,
    router: deepMergeObjects(
      base.router as Record<string, unknown> | undefined,
      slice.router,
    ) as T['router'],
  };
}

export function listModelRefsInSlice(slice: ModelRoutingConfigSlice): string[] {
  const refs = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === 'string' && value.trim() && value.trim() !== 'inherit') {
      refs.add(value.trim());
    }
  };

  add(slice.agent?.model);
  add(slice.agent?.subagents?.default);
  add(slice.memory?.model);
  if (slice.router && typeof slice.router === 'object') {
    const scenarios = slice.router.scenarios;
    if (isPlainObject(scenarios)) {
      for (const value of Object.values(scenarios)) add(value);
    }
    const fallback = slice.router.fallback;
    if (isPlainObject(fallback)) {
      for (const list of Object.values(fallback)) {
        if (Array.isArray(list)) list.forEach(add);
      }
    }
    const tokenSaver = slice.router.tokenSaver;
    if (isPlainObject(tokenSaver)) {
      add(tokenSaver.judge);
      const tiers = tokenSaver.tiers;
      if (isPlainObject(tiers)) {
        for (const tier of Object.values(tiers)) {
          if (isPlainObject(tier)) add(tier.model);
        }
      }
    }
  }
  return [...refs];
}

export function validateModelRefsAgainstPool(
  slice: ModelRoutingConfigSlice,
  providers: Record<string, { models?: Record<string, unknown> | null }> | undefined,
): string[] {
  const missing: string[] = [];
  for (const ref of listModelRefsInSlice(slice)) {
    const slash = ref.indexOf('/');
    if (slash <= 0) {
      missing.push(ref);
      continue;
    }
    const providerId = ref.slice(0, slash);
    const modelId = ref.slice(slash + 1);
    if (!providers?.[providerId]?.models?.[modelId]) {
      missing.push(ref);
    }
  }
  return missing;
}

export function parseModelRoutingTemplateImport(raw: string): ModelRoutingTemplate | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  const name = typeof obj.name === 'string' ? obj.name.trim() : '';
  if (!name) return null;
  const slice = extractModelRoutingSlice({
    agent: obj.agent as ModelRoutingTemplateAgent | undefined,
    memory: obj.memory as ModelRoutingTemplateMemory | undefined,
    router: obj.router as ModelRoutingTemplateRouter | undefined,
  });
  if (!slice.agent && !slice.memory && !slice.router) return null;
  return {
    version: MODEL_ROUTING_TEMPLATE_VERSION,
    id: typeof obj.id === 'string' && obj.id.trim()
      ? obj.id.trim()
      : `tpl-import-${Date.now()}`,
    name,
    savedAt: typeof obj.savedAt === 'string' ? obj.savedAt : new Date().toISOString(),
    ...slice,
    summary: buildModelRoutingSummary(slice),
  };
}

export function readModelRoutingTemplates(read: (key: string) => string | null): ModelRoutingTemplate[] {
  const raw = read(MODEL_ROUTING_TEMPLATE_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is ModelRoutingTemplate => Boolean(item) && typeof item === 'object' && typeof (item as ModelRoutingTemplate).name === 'string')
      .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  } catch {
    return [];
  }
}

export function writeModelRoutingTemplates(
  templates: ModelRoutingTemplate[],
  write: (key: string, value: string) => void,
): void {
  write(MODEL_ROUTING_TEMPLATE_STORAGE_KEY, JSON.stringify(templates, null, 2));
}

export function upsertModelRoutingTemplate(
  templates: ModelRoutingTemplate[],
  template: ModelRoutingTemplate,
): ModelRoutingTemplate[] {
  const without = templates.filter((item) => item.id !== template.id);
  return [template, ...without];
}

export function downloadModelRoutingTemplateJson(template: ModelRoutingTemplate): void {
  const blob = new Blob([JSON.stringify(template, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${template.name.replace(/[^\w\u4e00-\u9fff-]+/g, '_') || 'model-routing-template'}.json`;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
