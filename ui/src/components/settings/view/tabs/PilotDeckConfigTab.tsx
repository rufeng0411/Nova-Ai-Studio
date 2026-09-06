import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
 AlertCircle,
 Bot,
 Brain,
 Check,
 CheckCircle2,
 ChevronLeft,
 ChevronDown,
 ChevronRight,
 Clock,
 Database,
 FileCog,
 FolderOpen,
 Gauge,
 Gift,
 Image as ImageIcon,
 Info,
 Loader2,
 Plus,
 RefreshCw,
 Route,
 Save,
 Search,
 Server,
 Trash2,
 Wifi,
 XCircle,
 Zap,
 type LucideIcon,
} from 'lucide-react';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { Button } from '../../../../shared/view/ui';
import { authenticatedFetch } from '../../../../utils/api';
import { isImeEnterEvent } from '../../../../utils/ime';
import { usePilotDeckConfig, type ConfigReload } from '../../../../hooks/usePilotDeckConfig';
import {
 getAlwaysOnProjectRoot,
 isAlwaysOnProjectEnabled,
 setAlwaysOnProjectEnabled,
} from '../../../../utils/alwaysOnConfigPatch';
import SettingsCard from '../SettingsCard';
import SettingsRow from '../SettingsRow';
import SettingsSection from '../SettingsSection';
import SettingsToggle from '../SettingsToggle';
import { cn } from '../../../../lib/utils';
import {
 CATALOG_PROVIDERS,
 defaultEnabledModelsForProvider,
 filterDiscoveredForCatalogMerge,
 findCatalogProviderById,
 shouldCurateDiscoveredMerge,
 catalogFreeTierModels,
 catalogModelsExcludingFreeTier,
 CATALOG_PROVIDER_GROUPS,
 type CatalogProvider,
 type CatalogProviderCategory,
 type CatalogModel,
 type ModelKind,
} from '../../../../shared/catalogProviders';
import { primaryModelKind } from '../../../../shared/modelKinds';
import {
 coalesceMediaBaseUrl,
 findBestModelPoolProviderForKind,
 findModelProviderForMedia,
 isConfiguredApiKey,
 listEnabledMediaModelsFromPool,
 resolveMediaToolFromModelProviders,
} from '../../../../shared/resolveMediaFromModelProviders';
import {
 buildListModelsRequest,
 buildMediaSelectOptionsFromPool,
 formatListModelOption,
 mergeDiscoveredModelIds,
 mergeCuratedDiscoveredModels,
 mergeMediaSelectOptions,
 MODEL_KIND_LABELS,
} from '../../../../shared/providerListModels';
import { listAllEnabledModelsFromPoolProvider } from '../../../../shared/resolveMediaFromModelProviders';
import {
  compactStandbyModelSlots,
  normalizeStandbyModelSlots,
} from '../../../../../shared/providerApiKeys.mjs';
import {
  ProviderApiKeySlotsEditor,
  StandbyModelsEditor,
  MediaCapabilityFallbackEditor,
  WebSearchCapabilityFallbackEditor,
  isProviderConfigured,
} from './modelPoolRedundancyEditors';
import type { MediaProvider } from '../../../../shared/resolveMediaFromModelProviders';
import type { SettingsProject } from '../../types/types';
import {
 PILOTDECK_CONFIG_SECTION_GROUPS,
 PILOTDECK_CONFIG_SECTIONS,
 type PilotDeckConfigSectionId,
} from './pilotDeckConfigSections';
import ModelRoutingTemplateBar from './ModelRoutingTemplateBar';

// ── V2 schema types ────────────────────────────────────────────────────
// Schema mirrors ~/.pilotdeck/pilotdeck.yaml exactly. No more
// pre-/post-translation in the backend — disk shape === UI shape.

type V2Provider = {
 protocol?: 'openai' | 'anthropic';
 url?: string;
 apiKey?: string;
 /** PD-SAAS-FORK: up to 3 backup keys (4 total with apiKey). */
 apiKeys?: string[];
 timeoutMs?: number;
 headers?: Record<string, string>;
 models?: Record<string, Record<string, unknown> | null>;
};

type PilotDeckConfig = {
 schemaVersion?: number;
 agent?: {
 model?: string;
 maxContextTokens?: number;
 params?: Record<string, unknown>;
 subagents?: { default?: string; params?: Record<string, unknown> };
 };
 model?: {
 providers?: Record<string, V2Provider>;
 };
 memory?: {
 enabled?: boolean;
 projectContinuity?: { enabled?: boolean };
 model?: string;
 apiType?: string;
 reasoningMode?: string;
 autoIndexIntervalMinutes?: number;
 autoDreamIntervalMinutes?: number;
 captureStrategy?: string;
 includeAssistant?: boolean;
 maxMessageChars?: number;
 heartbeatBatchSize?: number;
 };
 proxy?: {
 url?: string;
 noProxy?: string;
 };
 webui?: {
 runtime?: {
 host?: string;
 serverPort?: number;
 vitePort?: number;
 apiTimeoutMs?: number;
 databasePath?: string;
 workspacesRoot?: string;
 };
 };
 alwaysOn?: {
 enabled?: boolean;
 trigger?: {
 enabled?: boolean;
 tickIntervalMinutes?: number;
 cooldownMinutes?: number;
 dailyBudget?: number;
 heartbeatStaleSeconds?: number;
 recentUserMsgMinutes?: number;
 preferChannel?: string;
 };
 dormancy?: {
 enabled?: boolean;
 debounceMs?: number;
 ignoreGlobs?: string[];
 };
 workspace?: {
 gitWorktreeBaseDir?: string;
 snapshotBaseDir?: string;
 snapshotMaxBytes?: number;
 gitLfs?: boolean;
 maxPlansPerCycle?: number;
 };
 execution?: {
 maxTurns?: number;
 maxToolCalls?: number;
 timeoutMinutes?: number;
 };
 projects?: Record<string, { enabled?: boolean }>;
 };
 cron?: {
 enabled?: boolean;
 timezone?: string;
 maxConcurrentRuns?: number;
 };
 customEnv?: Record<string, string>;
 router?: {
 enabled?: boolean;
 scenarios?: Record<string, string>;
 fallback?: Record<string, string[]>;
 zeroUsageRetry?: {
 enabled?: boolean;
 maxAttempts?: number;
 };
 tokenSaver?: {
 enabled?: boolean;
 judge?: string;
 defaultTier?: string;
 judgeTimeoutMs?: number;
 tiers?: Record<string, { model?: string; description?: string }>;
 rules?: string[];
 subagent?: { policy?: string };
 };
 autoOrchestrate?: {
 enabled?: boolean;
 triggerTiers?: string[];
 slimSystemPrompt?: boolean;
 };
 stats?: {
 enabled?: boolean;
 modelPricing?: Record<string, { input?: number; output?: number; cacheRead?: number }>;
 };
 } & Record<string, unknown>;
 gateway?: { enabled?: boolean; home?: string } & Record<string, unknown>;
 tools?: {
 image?: {
 provider?: 'openai-compatible' | 'google' | 'qwen' | 'volcengine' | 'baidu' | 'azure' | 'cloud';
 apiKey?: string;
 baseUrl?: string;
 model?: string;
 fallbacks?: Array<{
 provider?: 'openai-compatible' | 'google' | 'qwen' | 'volcengine' | 'baidu' | 'azure' | 'cloud';
 apiKey?: string;
 baseUrl?: string;
 model?: string;
 }>;
 };
 video?: {
 provider?: 'openai-compatible' | 'google' | 'qwen' | 'volcengine' | 'baidu' | 'azure' | 'cloud';
 apiKey?: string;
 baseUrl?: string;
 model?: string;
 fallbacks?: Array<{
 provider?: 'openai-compatible' | 'google' | 'qwen' | 'volcengine' | 'baidu' | 'azure' | 'cloud';
 apiKey?: string;
 baseUrl?: string;
 model?: string;
 }>;
 };
 tts?: {
 provider?: 'openai-compatible' | 'google' | 'qwen' | 'volcengine' | 'baidu' | 'azure' | 'cloud';
 apiKey?: string;
 baseUrl?: string;
 model?: string;
 fallbacks?: Array<{
 provider?: 'openai-compatible' | 'google' | 'qwen' | 'volcengine' | 'baidu' | 'azure' | 'cloud';
 apiKey?: string;
 baseUrl?: string;
 model?: string;
 }>;
 };
 speech?: {
 provider?: 'openai-compatible' | 'google' | 'qwen' | 'volcengine' | 'baidu' | 'azure' | 'cloud';
 apiKey?: string;
 baseUrl?: string;
 model?: string;
 fallbacks?: Array<{
 provider?: 'openai-compatible' | 'google' | 'qwen' | 'volcengine' | 'baidu' | 'azure' | 'cloud';
 apiKey?: string;
 baseUrl?: string;
 model?: string;
 }>;
 };
 webSearch?: {
 provider?: 'glm' | 'tavily' | 'bocha' | 'custom';
 apiKey?: string;
 endpoint?: string;
 fallbacks?: Array<{
 provider?: 'glm' | 'tavily' | 'bocha' | 'custom';
 apiKey?: string;
 endpoint?: string;
 }>;
 customProvider?: {
 name?: string;
 auth?: 'bearer' | 'bodyApiKey' | 'queryApiKey' | 'none';
 method?: 'GET' | 'POST';
 queryParam?: string;
 apiKeyParam?: string;
 resultsPath?: string;
 titleField?: string;
 urlField?: string;
 snippetField?: string;
 sourceField?: string;
 publishedAtField?: string;
 };
 };
 yixiaoer?: {
 apiKey?: string;
 apiUrl?: string;
 };
 documentCompose?: {
 aspectRatio?: string;
 };
 documentOcr?: {
 provider?: 'mineru' | 'qwen-vl';
 mode?: 'cloud' | 'local';
 apiUrl?: string;
 apiKey?: string;
 model?: string;
 fallbackProvider?: 'mineru' | 'qwen-vl';
 extractorMethod?: 'mineru' | 'hybrid';
 inpaintMethod?: 'baidu' | 'pil_fallback';
 };
 baiduAi?: {
 apiKey?: string;
 secretKey?: string;
 enabled?: boolean;
 };
 documentExport?: {
 cloudPreference?: 'cloud_first' | 'local_only';
 defaultQuality?: 'fast' | 'balanced' | 'fidelity';
 playwright?: { poolSize?: number };
 nutrient?: { apiKey?: string };
 };
 documentImport?: {
 enabled?: boolean;
 cloudPreference?: 'local_first' | 'cloud_first' | 'local_only';
 workerConcurrency?: number;
 timeoutMs?: number;
 maxFileBytes?: { pdf?: number; office?: number };
 truncate?: { maxChars?: number; maxTableRows?: number };
 fallbackProvider?: 'mineru' | 'qwen-vl';
 };
 skillServices?: {
 fal?: { apiKey?: string };
 typefully?: { apiKey?: string };
 videodb?: { apiKey?: string };
 music?: { apiKey?: string };
 wonda?: { apiKey?: string };
 nutrient?: { apiKey?: string };
 sentry?: { apiKey?: string };
 };
 };
};

const MODEL_KIND_SECTION_ORDER: ModelKind[] = ['chat', 'vl', 'image', 'video', 'tts', 'speech'];

function catalogEntryKind(entry: CatalogModel): ModelKind {
 return entry.modelKind ?? primaryModelKind(entry.id);
}

function FreeTierGiftIcon({ className, title }: { className?: string; title: string }) {
 return (
  <span className="inline-flex shrink-0" title={title} aria-hidden>
   <Gift className={cn('h-3 w-3 text-emerald-600 dark:text-emerald-400', className)} strokeWidth={2} />
  </span>
 );
}

function groupCatalogModelsByKind(models: CatalogModel[]): Array<{ kind: ModelKind; models: CatalogModel[] }> {
 const buckets = new Map<ModelKind, CatalogModel[]>();
 for (const model of models) {
 const kind = catalogEntryKind(model);
 const list = buckets.get(kind) ?? [];
 list.push(model);
 buckets.set(kind, list);
 }
 return MODEL_KIND_SECTION_ORDER.filter((kind) => buckets.has(kind)).map((kind) => ({
 kind,
 models: buckets.get(kind) ?? [],
 }));
}

type DiscoveredModelEntry = { id: string; label?: string; kinds?: string[] };

/** Catalog chips + last fetched models (通义等拉取后展示完整清单，不限于 catalog 芯片). */
function buildPanelModelsFromDiscovery(
 catalogEntry: CatalogProvider | undefined,
 discovered: DiscoveredModelEntry[],
): CatalogModel[] {
 const byId = new Map<string, CatalogModel>();
 for (const model of catalogEntry ? catalogModelsExcludingFreeTier(catalogEntry.models) : []) {
  byId.set(model.id, model);
 }
 for (const entry of discovered) {
  const id = String(entry.id || '').trim();
  if (!id || byId.has(id)) continue;
  const catalog = catalogEntry?.models.find((m) => m.id === id);
  if (catalog?.freeTier) continue;
  const kind = (entry.kinds?.[0] as ModelKind | undefined) ?? primaryModelKind(id);
  byId.set(
   id,
   catalog ?? {
    id,
    displayName: String(entry.label || id).trim(),
    modelKind: kind === 'chat' ? undefined : kind,
    supportsImage: kind === 'vl' ? true : catalog?.supportsImage,
   },
  );
 }
 return [...byId.values()];
}

type SectionId = PilotDeckConfigSectionId;

const SECTIONS = PILOTDECK_CONFIG_SECTIONS;

const SECTION_GROUPS = PILOTDECK_CONFIG_SECTION_GROUPS;

const SECTION_ICONS: Record<SectionId, LucideIcon> = {
 models: Database,
 agents: Bot,
 router: Route,
 memory: Brain,
 providerHub: ImageIcon,
 tools: Search,
 alwaysOn: Zap,
 cron: Clock,
 gateway: Wifi,
 advanced: Server,
 customEnv: FileCog,
};

// ── Config status presentation ──────────────────────────────────────────

type SubsystemKey = 'processEnv' | 'memory' | 'router' | 'gateway';
type StatusState = 'ok' | 'skipped' | 'error' | 'unknown';

type SubsystemResult = {
 reloaded?: boolean;
 skipped?: boolean;
 reason?: string;
 error?: string;
 note?: string;
};

const STATUS_ITEMS: Array<{ key: SubsystemKey; labelKey: string }> = [
 { key: 'processEnv', labelKey: 'processEnv' },
 { key: 'memory', labelKey: 'memory' },
 { key: 'router', labelKey: 'router' },
 { key: 'gateway', labelKey: 'gateway' },
];

function classifySubsystem(result: SubsystemResult | undefined): StatusState {
 if (!result) return 'unknown';
 if (result.error) return 'error';
 if (result.reloaded) return 'ok';
 if (result.skipped) return 'skipped';
 return 'unknown';
}

function statusDotClasses(state: StatusState): string {
 if (state === 'ok') return 'bg-green-500';
 if (state === 'error') return 'bg-destructive';
 return 'bg-muted-foreground/60';
}

function fallbackSubsystemStatus(key: SubsystemKey, config: PilotDeckConfig | null): { state: StatusState; detailKey: string } {
 if (!config) {
 return { state: 'unknown', detailKey: 'pending' };
 }
 if (key === 'processEnv') {
 return { state: 'ok', detailKey: 'processEnv.applied' };
 }
 if (key === 'memory') {
 return config?.memory?.enabled === false
 ? { state: 'skipped', detailKey: 'memory.disabled' }
 : { state: 'ok', detailKey: 'memory.enabled' };
 }
 if (key === 'router') {
 return config?.router?.enabled === false
 ? { state: 'skipped', detailKey: 'router.disabled' }
 : { state: 'ok', detailKey: 'router.enabled' };
 }
 return config?.gateway?.enabled
 ? { state: 'ok', detailKey: 'gateway.enabled' }
 : { state: 'skipped', detailKey: 'gateway.disabled' };
}

function subsystemStatus(key: SubsystemKey, config: PilotDeckConfig | null, reload: ConfigReload | null): { state: StatusState; detailKey: string; detail?: string } {
 const fallback = fallbackSubsystemStatus(key, config);
 const result = reload?.[key] as SubsystemResult | undefined;

 if (!result) return fallback;
 if (result.error) return { state: 'error', detailKey: fallback.detailKey, detail: result.error };
 if ((key === 'memory' || key === 'router' || key === 'gateway') && fallback.state === 'skipped') {
 return fallback;
 }

 const state = classifySubsystem(result);
 if (state === 'unknown') return fallback;
 if (state === 'skipped') return fallback;
 return { state, detailKey: fallback.detailKey, detail: result.note };
}

function ConfigStatusGrid({
 config,
 reload,
}: {
 config: PilotDeckConfig | null;
 reload: ConfigReload | null;
}) {
 const { t } = useTranslation('settings');
 return (
 <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
 {STATUS_ITEMS.map((item) => {
 const status = subsystemStatus(item.key, config, reload);
 return (
 <div key={item.key} className="rounded-lg bg-muted/30 px-3.5 py-2.5">
 <div className="flex items-center gap-2 text-[13px] font-semibold leading-5 text-foreground">
 <span className={cn('h-2.5 w-2.5 rounded-full', statusDotClasses(status.state))} />
 <span>{t(`pilotDeckConfig.status.subsystems.${item.labelKey}.label`)}</span>
 </div>
 <div className={cn('mt-0.5 text-[11px] leading-4', status.state === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
 {status.detail ?? t(`pilotDeckConfig.status.subsystems.${status.detailKey}`)}
 </div>
 </div>
 );
 })}
 </div>
 );
}

// ── Form-mode helpers ──────────────────────────────────────────────────

function safeParseYaml(text: string): PilotDeckConfig | null {
 try {
 const value = parseYaml(text);
 if (value && typeof value === 'object' && !Array.isArray(value)) return value as PilotDeckConfig;
 return null;
 } catch {
 return null;
 }
}

/**
 * Returns a new YAML string with the patched config — everything else (top-
 * level shape, formatting defaults) flows through `yaml`'s round-trip.
 *
 * Note: comments and key ordering are not preserved across this trip. Users
 * who care about hand-formatted YAML should use the Raw YAML tab — that mode
 * just edits the textarea and never reserializes.
 */
function configToYamlString(config: PilotDeckConfig): string {
 return stringifyYaml(config, { indent: 2, lineWidth: 0 });
}

type Path = readonly (string | number)[];

function patch<T extends PilotDeckConfig>(config: T, path: Path, value: unknown): T {
 // Immutable deep set. Each key cloned along the way so React picks up the
 // change. Numeric segments materialise arrays; everything else materialises
 // objects.
 if (path.length === 0) return value as T;
 const [head, ...rest] = path;
 const isArrayKey = typeof head === 'number';
 const current: any = config ?? (isArrayKey ? [] : {});
 const next: any = isArrayKey ? [...(current as unknown[])] : { ...(current as object) };
 next[head as string | number] = rest.length === 0 ? value : patch(current?.[head as string | number] ?? (typeof rest[0] === 'number' ? [] : {}), rest, value);
 return next as T;
}

function rewriteProviderRef(value: unknown, oldProviderId: string, newProviderId: string): unknown {
 const oldPrefix = `${oldProviderId}/`;
 if (typeof value !== 'string' || !value.startsWith(oldPrefix)) return value;
 return `${newProviderId}/${value.slice(oldPrefix.length)}`;
}

function rewriteProviderRefs(config: PilotDeckConfig, oldProviderId: string, newProviderId: string): PilotDeckConfig {
 let next = config;

 const agentModel = rewriteProviderRef(next.agent?.model, oldProviderId, newProviderId);
 if (agentModel !== next.agent?.model) {
 next = patch(next, ['agent', 'model'], agentModel);
 }

 const subagentDefault = rewriteProviderRef(next.agent?.subagents?.default, oldProviderId, newProviderId);
 if (subagentDefault !== next.agent?.subagents?.default) {
 next = patch(next, ['agent', 'subagents', 'default'], subagentDefault);
 }

 const memoryModel = rewriteProviderRef(next.memory?.model, oldProviderId, newProviderId);
 if (memoryModel !== next.memory?.model) {
 next = patch(next, ['memory', 'model'], memoryModel);
 }

 const memoryLlm = (next.memory as Record<string, unknown> | undefined)?.llm;
 if (memoryLlm && typeof memoryLlm === 'object' && !Array.isArray(memoryLlm)) {
 const llm = memoryLlm as Record<string, unknown>;
 if (llm.provider === oldProviderId) {
 next = patch(next, ['memory', 'llm', 'provider'], newProviderId);
 }
 }

 const scenarios = next.router?.scenarios;
 if (scenarios) {
 const rewritten = Object.fromEntries(
 Object.entries(scenarios).map(([key, ref]) => [key, rewriteProviderRef(ref, oldProviderId, newProviderId) as string]),
 );
 if (Object.entries(scenarios).some(([key, ref]) => rewritten[key] !== ref)) {
 next = patch(next, ['router', 'scenarios'], rewritten);
 }
 }

 const fallback = next.router?.fallback;
 if (fallback) {
 const rewritten = Object.fromEntries(
 Object.entries(fallback).map(([key, refs]) => [
 key,
 refs.map((ref) => rewriteProviderRef(ref, oldProviderId, newProviderId) as string),
 ]),
 );
 if (Object.entries(fallback).some(([key, refs]) => rewritten[key].some((ref, index) => ref !== refs[index]))) {
 next = patch(next, ['router', 'fallback'], rewritten);
 }
 }

 const judge = rewriteProviderRef(next.router?.tokenSaver?.judge, oldProviderId, newProviderId);
 if (judge !== next.router?.tokenSaver?.judge) {
 next = patch(next, ['router', 'tokenSaver', 'judge'], judge);
 }

 const tiers = next.router?.tokenSaver?.tiers;
 if (tiers) {
 const rewritten = Object.fromEntries(
 Object.entries(tiers).map(([key, tier]) => [
 key,
 {
 ...tier,
 model: rewriteProviderRef(tier.model, oldProviderId, newProviderId) as string | undefined,
 },
 ]),
 );
 if (Object.entries(tiers).some(([key, tier]) => rewritten[key].model !== tier.model)) {
 next = patch(next, ['router', 'tokenSaver', 'tiers'], rewritten);
 }
 }

 return next;
}

const MASK = '********';

function isMaskedSecret(value: string | undefined): boolean {
 return value === MASK;
}

/** Password fields must not bind MASK/placeholders as value — browsers render them as bullets. */
function secretDisplayValue(value: string | undefined): string {
 if (!value) return '';
 if (isMaskedSecret(value)) return '';
 if (value === 'PLACEHOLDER_RUN_ONBOARDING_TO_REPLACE') return '';
 if (value.startsWith('PLACEHOLDER_')) return '';
 return value;
}

function hasUsableSecret(value: string | undefined): boolean {
 const trimmed = (value ?? '').trim();
 return Boolean(trimmed) && !isMaskedSecret(trimmed) && trimmed !== 'PLACEHOLDER_RUN_ONBOARDING_TO_REPLACE' && !trimmed.startsWith('PLACEHOLDER_');
}

function providerDisplayName(providerId: string, catalogEntry?: CatalogProvider, emptyFallback = 'Custom Provider'): string {
 if (catalogEntry?.displayName) return catalogEntry.displayName;
 const normalized = providerId.trim();
 if (!normalized) return emptyFallback;
 return normalized
 .split(/[-_\s]+/)
 .filter(Boolean)
 .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
 .join(' ');
}

// ── Reusable inputs ────────────────────────────────────────────────────

function TextInput({
 value,
 onChange,
 placeholder,
 type = 'text',
 className,
 monospace,
}: {
 value: string | number | undefined;
 onChange: (next: string) => void;
 placeholder?: string;
 type?: 'text' | 'password' | 'number';
 className?: string;
 monospace?: boolean;
}) {
 return (
 <input
 type={type}
 value={value === undefined ? '' : String(value)}
 onChange={(e) => onChange(e.target.value)}
 placeholder={placeholder}
 spellCheck={false}
 className={cn(
 'w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] leading-5 text-foreground outline-none',
 'focus:ring-1 focus:ring-ring',
 monospace && 'font-mono text-xs',
 className,
 )}
 />
 );
}

function SecretTextInput({
 value,
 onChange,
 placeholder,
 emptyPlaceholder,
 maskedPlaceholder,
 className,
 monospace,
}: {
 value: string | undefined;
 onChange: (next: string) => void;
 placeholder?: string;
 emptyPlaceholder?: string;
 maskedPlaceholder?: string;
 className?: string;
 monospace?: boolean;
}) {
 const masked = isMaskedSecret(value);
 return (
 <TextInput
 type="password"
 value={secretDisplayValue(value)}
 placeholder={placeholder ?? (masked ? (maskedPlaceholder ?? 'Existing key kept — type to replace') : emptyPlaceholder)}
 monospace={monospace}
 className={className}
 onChange={onChange}
 />
 );
}

function NumberInput({
 value,
 onChange,
 placeholder,
}: {
 value: number | undefined;
 onChange: (next: number | undefined) => void;
 placeholder?: string;
}) {
 return (
 <TextInput
 type="number"
 value={value}
 placeholder={placeholder}
 onChange={(s) => {
 if (s === '') return onChange(undefined);
 const n = Number(s);
 if (Number.isFinite(n)) onChange(n);
 }}
 />
 );
}

function Select({
 value,
 onChange,
 options,
}: {
 value: string | undefined;
 onChange: (next: string) => void;
 options: Array<{ value: string; label: string }>;
}) {
 const selectedLabel = options.find((opt) => opt.value === value)?.label ?? '';
 return (
 <div className="relative min-w-0">
 <div className="pointer-events-none flex w-full min-w-0 items-center rounded-md border border-border bg-background px-2 py-1.5 pr-8 text-[13px] leading-5 text-foreground">
 <span className="block min-w-0 truncate" title={selectedLabel}>{selectedLabel}</span>
 </div>
 <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">▾</span>
 <select
 value={value ?? ''}
 onChange={(e) => onChange(e.target.value)}
 className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
 aria-label={selectedLabel}
 >
 {options.map((opt) => (
 <option key={opt.value} value={opt.value}>{opt.label}</option>
 ))}
 </select>
 </div>
 );
}

function ModelRefInput({
 value,
 onChange,
 options,
 placeholder,
}: {
 value: string | undefined;
 onChange: (next: string) => void;
 options: Array<{ value: string; label: string }>;
 placeholder?: string;
}) {
 const selected = value ?? '';
 const hasSelected = !selected || options.some((opt) => opt.value === selected);
 const selectOptions = [
 { value: '', label: placeholder ?? 'Select a configured model' },
 ...options,
 ...(!hasSelected ? [{ value: selected, label: `Missing: ${selected}` }] : []),
 ];
 return (
 <Select value={selected} onChange={onChange} options={selectOptions} />
 );
}

function FormRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
 return (
 <div className="grid grid-cols-1 items-start gap-2 px-4 py-2.5 sm:grid-cols-[180px_1fr] sm:gap-4">
 <div className="min-w-0">
 <div className="text-[13px] font-medium leading-5 text-foreground">{label}</div>
 {description && <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{description}</div>}
 </div>
 <div className="min-w-0">{children}</div>
 </div>
 );
}

// PD-SAAS-FORK: collapsible config block — configured blocks collapse by
// default with a green check badge to keep the admin hub compact.
function CollapsibleHubBlock({
  title,
  configured,
  configuredLabel,
  summary,
  defaultOpen = false,
  className,
  children,
}: {
  title: ReactNode;
  configured: boolean;
  configuredLabel?: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation('settings');
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-md text-left transition-colors hover:opacity-80"
      >
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
        <span className="text-xs font-semibold text-foreground">{title}</span>
        {configured ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-normal text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {configuredLabel ?? t('pilotDeckConfig.panels.models.configuredBadge', { defaultValue: '已配置' })}
          </span>
        ) : (
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
            title={t('pilotDeckConfig.panels.models.notConfiguredBadge', { defaultValue: '待配置' })}
          />
        )}
        {!open && summary ? (
          <span className="min-w-0 truncate text-[11px] font-normal text-muted-foreground">{summary}</span>
        ) : null}
      </button>
      {open ? <div className="mt-3 space-y-3">{children}</div> : null}
    </div>
  );
}

// ── Section components ─────────────────────────────────────────────────

function ServiceSection({ config, onChange }: { config: PilotDeckConfig; onChange: (next: PilotDeckConfig) => void }) {
 const { t } = useTranslation('settings');
 const [showAdvanced, setShowAdvanced] = useState(false);
 const r = config.webui?.runtime ?? {};
 const set = (key: string, value: unknown) =>
 onChange(patch(config, ['webui', 'runtime', key], value));
 return (
 <SettingsSection
 title={t('pilotDeckConfig.panels.runtime.title')}
 description={t('pilotDeckConfig.panels.runtime.description')}
 >
 <SettingsCard>
 <div className="divide-y divide-border">
 <FormRow label={t('pilotDeckConfig.panels.runtime.fields.host.label')} description={t('pilotDeckConfig.panels.runtime.fields.host.description')}>
 <TextInput value={r.host} placeholder="0.0.0.0" onChange={(v) => set('host', v)} />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.runtime.fields.serverPort.label')} description={t('pilotDeckConfig.panels.runtime.fields.serverPort.description')}>
 <NumberInput value={r.serverPort} placeholder="3001" onChange={(v) => set('serverPort', v)} />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.runtime.fields.workspacesRoot.label')} description={t('pilotDeckConfig.panels.runtime.fields.workspacesRoot.description')}>
 <TextInput value={r.workspacesRoot} placeholder="~" monospace onChange={(v) => set('workspacesRoot', v)} />
 </FormRow>
 </div>
 <div className="border-t border-border px-4 py-2.5">
 <button
 type="button"
 onClick={() => setShowAdvanced((next) => !next)}
 aria-expanded={showAdvanced}
 className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium leading-5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
 >
 <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showAdvanced && 'rotate-180')} />
 {t('pilotDeckConfig.panels.runtime.advancedToggle')}
 </button>
 </div>
 {showAdvanced && (
 <div className="divide-y divide-border border-t border-border">
 <FormRow label={t('pilotDeckConfig.panels.runtime.fields.vitePort.label')} description={t('pilotDeckConfig.panels.runtime.fields.vitePort.description')}>
 <NumberInput value={r.vitePort} placeholder="5173" onChange={(v) => set('vitePort', v)} />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.runtime.fields.apiTimeout.label')} description={t('pilotDeckConfig.panels.runtime.fields.apiTimeout.description')}>
 <NumberInput value={r.apiTimeoutMs} placeholder="120000" onChange={(v) => set('apiTimeoutMs', v)} />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.runtime.fields.databasePath.label')} description={t('pilotDeckConfig.panels.runtime.fields.databasePath.description')}>
 <TextInput value={r.databasePath} placeholder="~/.pilotdeck/auth.db" monospace onChange={(v) => set('databasePath', v)} />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.runtime.fields.proxyUrl.label')} description={t('pilotDeckConfig.panels.runtime.fields.proxyUrl.description')}>
 <TextInput value={config.proxy?.url} placeholder="http://127.0.0.1:7890" monospace onChange={(v) => onChange(patch(config, ['proxy', 'url'], v))} />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.runtime.fields.proxyNoProxy.label')} description={t('pilotDeckConfig.panels.runtime.fields.proxyNoProxy.description')}>
 <TextInput value={config.proxy?.noProxy} placeholder="127.0.0.1,localhost" monospace onChange={(v) => onChange(patch(config, ['proxy', 'noProxy'], v))} />
 </FormRow>
 </div>
 )}
 </SettingsCard>
 </SettingsSection>
 );
}

function ProviderCard({
 providerId,
 provider,
 onChange,
 onRemove,
 onRename,
 catalogEntry,
}: {
 providerId: string;
 provider: V2Provider;
 onChange: (next: V2Provider) => void;
 onRemove: () => void;
 onRename: (newId: string) => boolean;
 catalogEntry?: CatalogProvider;
}) {
  const { t } = useTranslation('settings');
  const protocol = provider.protocol ?? catalogEntry?.protocol ?? 'openai';
  const effectiveUrl = provider.url || catalogEntry?.defaultUrl || '';
  const enabledModels = Object.keys(provider.models ?? {});
  const [newModelId, setNewModelId] = useState('');
  const [discoveringModels, setDiscoveringModels] = useState(false);
  const [discoverHint, setDiscoverHint] = useState('');
  const [providerIdDraft, setProviderIdDraft] = useState(providerId);
  const [providerIdError, setProviderIdError] = useState('');
  // PD-SAAS-FORK: configured providers collapse by default (green check badge);
  // the detailed model list is also collapsed until expanded or after a fetch.
  const configured = isProviderConfigured(provider) || (
    Boolean(catalogEntry?.optionalApiKey)
    && Boolean(effectiveUrl)
    && enabledModels.length > 0
  );
  const [cardOpen, setCardOpen] = useState(!configured);
  const [modelListOpen, setModelListOpen] = useState(false);
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModelEntry[]>([]);
 const displayName = providerDisplayName(
 providerIdDraft || providerId,
 catalogEntry,
 t('pilotDeckConfig.panels.models.customProvider'),
 );

 useEffect(() => {
 setProviderIdDraft(providerId);
 setProviderIdError('');
 }, [providerId]);

 const update = (patch: Partial<V2Provider>) => onChange({ ...provider, ...patch });

 const discoverModels = async () => {
 const request = buildListModelsRequest(providerId, provider.url);
 if (!request) {
 setDiscoverHint('该供应商暂不支持自动拉取，请手动添加模型 ID。');
 return;
 }
 const optionalKey = catalogEntry?.optionalApiKey;
 if (!optionalKey && !hasUsableSecret(provider.apiKey) && !isConfiguredApiKey(provider.apiKey)) {
 setDiscoverHint('请先填写 API Key');
 return;
 }
 if (optionalKey && !effectiveUrl) {
 setDiscoverHint('请先填写 Base URL');
 return;
 }
 setDiscoveringModels(true);
 setDiscoverHint('');
 try {
 const res = await authenticatedFetch('/api/providers/list-models', {
 method: 'POST',
 body: JSON.stringify({
 provider: request.provider,
 apiKey: hasUsableSecret(provider.apiKey) ? provider.apiKey : '',
 baseUrl: request.baseUrl || provider.url || '',
 modelPoolProviderId: providerId,
 ...(optionalKey ? { allowOptionalApiKey: true } : {}),
 }),
 });
 const data = await res.json();
 if (!data.ok || !Array.isArray(data.models) || data.models.length === 0) {
 setDiscoverHint(data.error || '未获取到模型列表');
 return;
 }
 const remoteTotal = data.models.length;
 const curateMerge = shouldCurateDiscoveredMerge(providerId);
 const toMerge = curateMerge
 ? filterDiscoveredForCatalogMerge(providerId, data.models)
 : data.models;
 const catalogIds = curateMerge
 ? new Set(catalogEntry?.models.map((m) => m.id) ?? [])
 : null;
      if (curateMerge) {
        update({
          models: mergeCuratedDiscoveredModels(provider.models, toMerge, catalogIds),
        });
      } else {
        setDiscoveredModels(data.models);
        update({
          models: mergeDiscoveredModelIds(
            provider.models,
            data.models.filter((entry) => provider.models && entry.id in provider.models),
          ),
        });
      }
      setModelListOpen(true);
 const total = toMerge.length;
 const remoteCount = Number(data.remoteCount) || remoteTotal;
 const kindCounts = toMerge.reduce(
 (acc: Record<string, number>, item: { kinds?: string[] }) => {
 const kind = item.kinds?.[0] || 'chat';
 acc[kind] = (acc[kind] || 0) + 1;
 return acc;
 },
 {},
 );
 const breakdown = Object.entries(kindCounts)
 .map(([kind, count]) => `${MODEL_KIND_LABELS[kind] || kind} ${count}`)
 .join(' · ');
 setDiscoverHint(
 curateMerge && remoteTotal > total
 ? `远程共 ${remoteTotal} 个模型，已精选 ${total} 个代表型号（${breakdown}）。勾选下方芯片启用；图片/视频用于出图出片。`
 : !curateMerge && (data.supplemented || remoteCount < remoteTotal)
 ? `已拉取 ${total} 个模型（含内置补充清单：${breakdown}）。点击芯片启用；图片/视频用于出图出片。`
 : `已拉取 ${total} 个模型（${breakdown}）。已按类型分组显示；对话/识图用于聊天，图片/视频用于出图出片（能力接入中心会自动继承本供应商密钥）。`,
 );
 } catch (error) {
 setDiscoverHint(error instanceof Error ? error.message : String(error));
 } finally {
 setDiscoveringModels(false);
 }
 };

 const commitProviderId = () => {
 const nextId = providerIdDraft.trim();
 if (!nextId || nextId === providerId) {
 setProviderIdDraft(providerId);
 setProviderIdError('');
 return;
 }
 if (onRename(nextId)) {
 setProviderIdError('');
 } else {
 setProviderIdDraft(providerId);
 setProviderIdError(t('pilotDeckConfig.panels.models.providerIdDuplicate'));
 }
 };

 const metaForCatalogModel = (mid: string): Record<string, unknown> => {
 const catalogModel = catalogEntry?.models.find((m) => m.id === mid);
 if (catalogModel?.modelKind) {
 const kinds = catalogModel.modelKind === 'vl' ? ['vl', 'chat'] : [catalogModel.modelKind];
 return { kinds };
 }
 const discovered = discoveredModels.find((m) => m.id === mid);
 if (discovered?.kinds?.length) return { kinds: discovered.kinds };
 return {};
 };

 const addModel = (mid: string, meta?: Record<string, unknown>) => {
 const id = mid.trim();
 if (!id) return;
 if (provider.models && id in provider.models) return;
 update({ models: { ...(provider.models ?? {}), [id]: meta ?? metaForCatalogModel(id) } });
 setNewModelId('');
 };
 const removeModel = (mid: string) => {
 const next = { ...(provider.models ?? {}) };
 delete next[mid];
 update({ models: next });
 };
 const toggleCatalogModel = (mid: string) => {
 if (provider.models && mid in provider.models) {
 removeModel(mid);
 } else {
 addModel(mid, metaForCatalogModel(mid));
 }
 };

 const freeTierModels = catalogEntry ? catalogFreeTierModels(catalogEntry.models) : [];
 const panelModels = buildPanelModelsFromDiscovery(catalogEntry, discoveredModels);
 const panelModelIds = new Set(panelModels.map((m) => m.id));
 const enabledFreeTierCount = freeTierModels.filter((m) => provider.models && m.id in provider.models).length;

 const enableAllFreeTierModels = () => {
 if (freeTierModels.length === 0) return;
 const next = { ...(provider.models ?? {}) };
 for (const m of freeTierModels) {
 if (!(m.id in next)) {
 next[m.id] = metaForCatalogModel(m.id);
 }
 }
 update({ models: next });
 setModelListOpen(true);
 };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background/50 p-4 transition-colors">
      {/* PD-SAAS-FORK: collapsible header — green check when configured */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCardOpen((next) => !next)}
          aria-expanded={cardOpen}
          className="flex min-w-0 flex-1 items-center gap-2 text-left transition-opacity hover:opacity-80"
        >
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', cardOpen && 'rotate-180')}
          />
          <span className="truncate text-sm font-semibold text-foreground">{displayName}</span>
          {configured ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('pilotDeckConfig.panels.models.configuredBadge', { defaultValue: '已配置' })}
            </span>
          ) : (
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
              title={t('pilotDeckConfig.panels.models.notConfiguredBadge', { defaultValue: '待配置' })}
            />
          )}
          {enabledModels.length > 0 ? (
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {t('pilotDeckConfig.panels.models.enabledCount', {
                defaultValue: '已启用 {{count}} 个模型',
                count: enabledModels.length,
              })}
            </span>
          ) : null}
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {cardOpen && (<>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">{t('pilotDeckConfig.panels.models.providerId')}</span>
        <input
          value={providerIdDraft}
          onChange={(e) => {
            setProviderIdDraft(e.target.value);
            setProviderIdError('');
          }}
          onBlur={commitProviderId}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              setProviderIdDraft(providerId);
              setProviderIdError('');
              e.currentTarget.blur();
            }
          }}
          className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[11px] text-foreground outline-none focus:ring-1 focus:ring-ring"
        />
        {providerIdError && (
          <span className="text-[10px] text-destructive">{providerIdError}</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
 <label className="text-xs text-muted-foreground">
 <span className="mb-1 block">{t('pilotDeckConfig.panels.models.protocol')}</span>
 <Select
 value={protocol}
 onChange={(v) => update({ protocol: v as 'openai' | 'anthropic' })}
 options={[
 { value: 'openai', label: t('pilotDeckConfig.panels.models.protocolOptions.openai') },
 { value: 'anthropic', label: t('pilotDeckConfig.panels.models.protocolOptions.anthropic') },
 ]}
 />
 </label>
 <label className="text-xs text-muted-foreground">
 <span className="mb-1 block">{t('pilotDeckConfig.panels.models.baseUrl')}</span>
 <TextInput
 value={provider.url}
 placeholder={catalogEntry?.defaultUrl || 'https://api.example.com/v1'}
 monospace
 onChange={(v) => update({ url: v })}
 />
 <span className="mt-0.5 block text-[10px] text-muted-foreground/70">
 {t('pilotDeckConfig.panels.models.baseUrlHint')}
 </span>
 {!provider.url && catalogEntry && (
 <span className="mt-0.5 block text-[10px] text-muted-foreground/70">
 {t('pilotDeckConfig.panels.models.defaultsTo')}{' '}
 <code className="font-mono">{catalogEntry.defaultUrl}</code>
 {' '}{t('pilotDeckConfig.panels.models.fromCatalog')}
 </span>
 )}
 {effectiveUrl && provider.url && (
 <span className="mt-0.5 block text-[10px] text-muted-foreground/70">
 {t('pilotDeckConfig.panels.models.effective')}{' '}
 <code className="font-mono">{effectiveUrl}</code>
 </span>
 )}
 </label>
 </div>

 {/* PD-SAAS-FORK: up to 4 API key slots per provider */}
 <ProviderApiKeySlotsEditor provider={provider} onChange={update} />

 {/* Models — chip-style toggles for catalog models + a free-form input. */}
 <div>
 <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
 <span>{t('pilotDeckConfig.panels.models.enabledModels')}</span>
 <span className="text-[10px] text-muted-foreground/60">
 · <ImageIcon className="inline h-2.5 w-2.5" /> {t('pilotDeckConfig.panels.models.supportsImageInput')}
 </span>
 {freeTierModels.length > 0 ? (
  <span className="text-[10px] text-muted-foreground/60">
   · <Gift className="inline h-2.5 w-2.5 text-emerald-600/80 dark:text-emerald-400/80" strokeWidth={2} />{' '}
   {t('pilotDeckConfig.panels.models.freeTierBadge', { defaultValue: '免费额度' })}
  </span>
 ) : null}
 {buildListModelsRequest(providerId, provider.url) ? (
 <Button
 variant="outline"
 size="sm"
 className="h-6 gap-1 px-2 text-[10px]"
 onClick={() => void discoverModels()}
 disabled={discoveringModels || (
   !catalogEntry?.optionalApiKey
   && !hasUsableSecret(provider.apiKey)
   && !isConfiguredApiKey(provider.apiKey)
 ) || (catalogEntry?.optionalApiKey && !effectiveUrl)}
 >
 {discoveringModels ? (
 <Loader2 className="h-3 w-3 animate-spin" />
 ) : (
 <RefreshCw className="h-3 w-3" />
 )}
 {t('pilotDeckConfig.panels.providerHub.fetchModels', { defaultValue: '拉取模型列表' })}
 </Button>
 ) : null}
          {discoverHint ? <span className="text-[10px] text-muted-foreground">{discoverHint}</span> : null}
        </div>
        {freeTierModels.length > 0 && (
          <div className="mb-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5">
            <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                <Gift className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                {t('pilotDeckConfig.panels.models.freeTierZone', { defaultValue: '免费额度专区' })}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {t('pilotDeckConfig.panels.models.freeTierHint', {
                  defaultValue: '百炼控制台有免费额度，用完即停；点击芯片启用',
                })}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-6 gap-1 px-2 text-[10px]"
                onClick={enableAllFreeTierModels}
                disabled={enabledFreeTierCount >= freeTierModels.length}
              >
                <Plus className="h-3 w-3" />
                {t('pilotDeckConfig.panels.models.enableAllFreeTier', {
                  defaultValue: '一键启用全部免费模型',
                })}
              </Button>
              {enabledFreeTierCount > 0 ? (
                <span className="text-[10px] text-muted-foreground">
                  {t('pilotDeckConfig.panels.models.freeTierEnabledCount', {
                    defaultValue: '已启用 {{count}}/{{total}}',
                    count: enabledFreeTierCount,
                    total: freeTierModels.length,
                  })}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {freeTierModels.map((m) => {
                const on = provider.models && m.id in provider.models;
                const kind = catalogEntryKind(m);
                return (
                  <div
                    key={m.id}
                    className={cn(
                      'group inline-flex items-center rounded-md border text-[11px] transition-colors',
                      on
                        ? 'border-emerald-600/40 bg-emerald-500/15 text-foreground'
                        : 'border-emerald-500/25 bg-background text-muted-foreground hover:border-emerald-600/40 hover:text-foreground',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleCatalogModel(m.id)}
                      className="inline-flex items-center gap-1 px-2 py-1"
                      title={
                        on
                          ? t('pilotDeckConfig.panels.models.clickDisable')
                          : t('pilotDeckConfig.panels.models.clickEnable')
                      }
                    >
                      {on && <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />}
                      <FreeTierGiftIcon
                        title={t('pilotDeckConfig.panels.models.freeTierIconTitle', {
                          defaultValue: '百炼免费额度，用完即停',
                        })}
                      />
                      {m.displayName}
                      {m.supportsImage && kind !== 'image' && kind !== 'video' && (
                        <ImageIcon className="h-3 w-3 text-muted-foreground/70" strokeWidth={2} />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* PD-SAAS-FORK: detailed model list collapsed by default */}
        <button
          type="button"
          onClick={() => setModelListOpen((next) => !next)}
          aria-expanded={modelListOpen}
          className="mb-1.5 inline-flex items-center gap-1 rounded-md text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown className={cn('h-3 w-3 transition-transform', modelListOpen && 'rotate-180')} />
          {modelListOpen
            ? t('pilotDeckConfig.panels.models.collapseModelList', { defaultValue: '收起模型列表' })
            : t('pilotDeckConfig.panels.models.expandModelList', {
                defaultValue: '展开模型列表（已启用 {{count}} 个）',
                count: enabledModels.length,
              })}
        </button>
        {modelListOpen && (<>
        {catalogEntry && panelModels.length > 0 && (
 <div className="mb-2 space-y-2">
 {groupCatalogModelsByKind(panelModels).map(({ kind, models: groupModels }) => (
 <div key={kind}>
 <div className="mb-1 text-[10px] font-medium text-muted-foreground">
 {MODEL_KIND_LABELS[kind] || kind}
 {(kind === 'image' || kind === 'video') && (
 <span className="ml-1 font-normal text-muted-foreground/70">· 出图/出片</span>
 )}
 </div>
 <div className="flex flex-wrap gap-1.5">
 {groupModels.map((m) => {
 const on = provider.models && m.id in provider.models;
 return (
 <div
 key={m.id}
 className={cn(
 'group inline-flex items-center rounded-md border text-[11px] transition-colors',
 on
 ? 'border-foreground/30 bg-muted/60 text-foreground'
 : 'border-border bg-muted text-muted-foreground hover:border-foreground/30 hover:text-foreground',
 (kind === 'image' || kind === 'video') && 'border-dashed',
 )}
 >
 <button
 type="button"
 onClick={() => toggleCatalogModel(m.id)}
 className="inline-flex items-center gap-1 px-2 py-1"
 title={on ? t('pilotDeckConfig.panels.models.clickDisable') : t('pilotDeckConfig.panels.models.clickEnable')}
 >
 {on && <Check className="h-3 w-3 text-foreground" strokeWidth={2.5} />}
 {m.freeTier ? (
  <FreeTierGiftIcon
   title={t('pilotDeckConfig.panels.models.freeTierIconTitle', {
    defaultValue: '百炼免费额度，用完即停',
   })}
  />
 ) : null}
 {m.displayName}
 {m.supportsImage && kind !== 'image' && kind !== 'video' && (
 <ImageIcon className="h-3 w-3 text-muted-foreground/70" strokeWidth={2} />
 )}
 </button>
 </div>
 );
 })}
 </div>
 </div>
 ))}
 </div>
 )}
 {/* Custom (off-catalog) models currently enabled */}
 {(() => {
 const customIds = enabledModels.filter(
 (mid) => !panelModelIds.has(mid) && (!catalogEntry || !catalogEntry.models.some((m) => m.id === mid && m.freeTier)),
 );
 if (customIds.length === 0) return null;
 const byKind = new Map<ModelKind, string[]>();
 for (const mid of customIds) {
 const kind = primaryModelKind(mid, provider.models?.[mid] as Record<string, unknown> | undefined);
 const list = byKind.get(kind) ?? [];
 list.push(mid);
 byKind.set(kind, list);
 }
 return MODEL_KIND_SECTION_ORDER.filter((k) => byKind.has(k)).map((kind) => (
 <div key={`custom-${kind}`} className="mb-2">
 <div className="mb-1 text-[10px] font-medium text-muted-foreground">
 {MODEL_KIND_LABELS[kind]}（自定义）
 </div>
 {byKind.get(kind)?.map((mid) => (
 <div key={mid} className="mb-1 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px]">
 <code className="flex-1 truncate font-mono">{mid}</code>
 <button
 type="button"
 onClick={() => removeModel(mid)}
 className="text-muted-foreground hover:text-destructive"
 title={t('pilotDeckConfig.actions.remove')}
 >
 <Trash2 className="h-3 w-3" />
 </button>
 </div>
 ))}
 </div>
 ));
 })()}
 {/* Add custom model */}
 <div className="flex items-center gap-2">
 <input
 value={newModelId}
 onChange={(e) => setNewModelId(e.target.value)}
 placeholder={t('pilotDeckConfig.panels.models.customModelPlaceholder')}
 className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground outline-none focus:ring-1 focus:ring-ring"
 onKeyDown={(e) => { if (e.key === 'Enter' && !isImeEnterEvent(e)) addModel(newModelId); }}
 />
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => addModel(newModelId)} disabled={!newModelId.trim()}>
            <Plus className="mr-1 h-3 w-3" />
            {t('pilotDeckConfig.actions.add')}
          </Button>
        </div>
        </>)}
      </div>
      </>)}
    </div>
  );
}

function CatalogPicker({
 existingIds,
 onPick,
 onCustom,
}: {
 existingIds: Set<string>;
 onPick: (catalog: CatalogProvider) => void;
 onCustom: () => void;
}) {
 const { t } = useTranslation('settings');
 const [open, setOpen] = useState(false);
 const available = CATALOG_PROVIDERS.filter((p) => !existingIds.has(p.id));
 const availableByCategory = useMemo(() => {
  const buckets = new Map<CatalogProviderCategory, CatalogProvider[]>();
  for (const provider of available) {
   const category = provider.category ?? 'gateway';
   const list = buckets.get(category) ?? [];
   list.push(provider);
   buckets.set(category, list);
  }
  return buckets;
 }, [available]);

 const renderProviderButton = (p: CatalogProvider) => (
  <button
   key={p.id}
   type="button"
   onClick={() => { onPick(p); setOpen(false); }}
   className="rounded-md border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:border-foreground/40 hover:bg-muted"
  >
   <div className="font-medium text-foreground">{p.displayName}</div>
   <div className="mt-0.5 text-[10px] text-muted-foreground">
    {p.pickerHint
     ? p.pickerHint
     : t('pilotDeckConfig.panels.models.modelCount', { count: p.models.length })}
   </div>
  </button>
 );

 if (!open) {
 return (
 <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
 <Plus className="mr-1 h-3.5 w-3.5" />
 {t('pilotDeckConfig.panels.models.addProvider')}
 </Button>
 );
 }
 return (
 <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
 <div className="flex items-center justify-between">
 <div className="text-sm font-medium text-foreground">{t('pilotDeckConfig.panels.models.addProviderTitle')}</div>
 <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{t('pilotDeckConfig.panels.models.cancel')}</Button>
 </div>
 {CATALOG_PROVIDER_GROUPS.map((group) => {
  const providers = availableByCategory.get(group.id) ?? [];
  if (providers.length === 0) return null;
  return (
   <div key={group.id}>
    <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">
     {t(group.labelKey, { defaultValue: group.defaultLabel })}
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
     {providers.map(renderProviderButton)}
    </div>
   </div>
  );
 })}
 <div>
  <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">
   {t('pilotDeckConfig.panels.models.providerGroupCustom', { defaultValue: '自定义' })}
  </div>
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
   <button
    type="button"
    onClick={() => { onCustom(); setOpen(false); }}
    className="rounded-md border border-dashed border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:border-foreground/40 hover:bg-muted"
   >
    <div className="font-medium text-foreground">+ {t('pilotDeckConfig.panels.models.customProvider')}</div>
    <div className="mt-0.5 text-[10px] text-muted-foreground">{t('pilotDeckConfig.panels.models.manualSetup')}</div>
   </button>
  </div>
 </div>
 </div>
 );
}

function ModelsSection({ config, onChange }: { config: PilotDeckConfig; onChange: (next: PilotDeckConfig) => void }) {
 const { t } = useTranslation('settings');
 const providers = config.model?.providers ?? {};
 const ids = Object.keys(providers);
 const modelRefOptions = buildModelRefOptions(config);
 const standbySlots = normalizeStandbyModelSlots(config.router?.fallback?.default ?? []);

 const setStandbySlots = (slots: string[]) => {
 const chain = compactStandbyModelSlots(slots);
 let next = patch(config, ['router', 'fallback', 'default'], chain);
 if (chain.length === 0) {
 const fallback = { ...(config.router?.fallback ?? {}) };
 delete fallback.default;
 next = patch(next, ['router', 'fallback'], Object.keys(fallback).length > 0 ? fallback : undefined);
 }
 onChange(ensureModelRefsConfigured(next, chain));
 };

 const setProvider = (id: string, prov: V2Provider) =>
 onChange(patch(config, ['model', 'providers', id], prov));
 const removeProvider = (id: string) => {
 const next = { ...providers };
 delete next[id];
 onChange(patch(config, ['model', 'providers'], next));
 };
 const renameProvider = (oldId: string, newId: string) => {
 const id = newId.trim();
 if (!id || id === oldId) return true;
 if (providers[id]) return false;
 const next: Record<string, V2Provider> = {};
 for (const [k, v] of Object.entries(providers)) next[k === oldId ? id : k] = v;
 onChange(rewriteProviderRefs(patch(config, ['model', 'providers'], next), oldId, id));
 return true;
 };

 const handleCatalogPick = (cp: CatalogProvider) => {
 if (providers[cp.id]) return;
 setProvider(cp.id, {
 apiKey: '',
 // protocol and url are stored explicitly so the saved yaml carries
 // them — backend catalog auto-fill kicks in only when the disk
 // value is missing, which is what we want for user-editable configs.
 protocol: cp.protocol,
 url: cp.defaultUrl,
 models: defaultEnabledModelsForProvider(cp),
 });
 };

 const handleCustom = () => {
 let i = 1;
 while (providers[`provider${i}`]) i++;
 setProvider(`provider${i}`, {
 protocol: 'openai',
 url: '',
 apiKey: '',
 models: {},
 });
 };

 return (
 <SettingsSection
 title={t('pilotDeckConfig.panels.models.title')}
 description={t('pilotDeckConfig.panels.models.description')}
 >
 <div className="space-y-3">
 <div className="flex justify-start">
 <CatalogPicker
 existingIds={new Set(ids)}
 onPick={handleCatalogPick}
 onCustom={handleCustom}
 />
 </div>
 {ids.length === 0 && (
 <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
 {t('pilotDeckConfig.panels.models.emptyProviders')}
 </div>
 )}
 {ids.map((id) => (
 <ProviderCard
 key={id}
 providerId={id}
 provider={providers[id] ?? {}}
 catalogEntry={findCatalogProviderById(id)}
 onChange={(next) => setProvider(id, next)}
 onRemove={() => removeProvider(id)}
 onRename={(newId) => renameProvider(id, newId)}
 />
 ))}
 <StandbyModelsEditor
 slots={standbySlots}
 modelOptions={modelRefOptions}
 onChange={setStandbySlots}
 />
 </div>
 </SettingsSection>
 );
}

function splitModelRef(ref: string | undefined): { providerId: string; modelId: string } | null {
 const value = ref?.trim() ?? '';
 const slash = value.indexOf('/');
 if (slash <= 0 || slash === value.length - 1) return null;
 return { providerId: value.slice(0, slash), modelId: value.slice(slash + 1) };
}

function ensureModelRefConfigured<T extends PilotDeckConfig>(config: T, ref: string | undefined): T {
 const parsed = splitModelRef(ref);
 if (!parsed) return config;

 const provider = config.model?.providers?.[parsed.providerId];
 if (!provider) return config;
 if (provider.models && Object.prototype.hasOwnProperty.call(provider.models, parsed.modelId)) return config;

 return patch(config, ['model', 'providers', parsed.providerId, 'models', parsed.modelId], {});
}

function ensureModelRefsConfigured<T extends PilotDeckConfig>(config: T, refs: Array<string | undefined>): T {
 return refs.reduce((next, ref) => ensureModelRefConfigured(next, ref), config);
}

// Build the "provider/model" options for agent / memory / router model dropdowns
// from configured providers. Catalog providers expose every catalog model, while
// custom/off-catalog models come from the provider's saved models map.
function buildModelRefOptions(config: PilotDeckConfig): Array<{ value: string; label: string }> {
 const out: Array<{ value: string; label: string }> = [];
 const providers = config.model?.providers ?? {};
 for (const [pid, prov] of Object.entries(providers)) {
 const catalog = findCatalogProviderById(pid);
 const seen = new Set<string>();

 if (catalog) {
 for (const model of catalog.models) {
 seen.add(model.id);
 const freeSuffix = model.freeTier ? ' · 免费' : '';
 out.push({
 value: `${pid}/${model.id}`,
 label: `${catalog.displayName}: ${model.displayName}${freeSuffix}`,
 });
 }
 }

 for (const mid of Object.keys(prov.models ?? {})) {
 if (seen.has(mid)) continue;
 out.push({
 value: `${pid}/${mid}`,
 label: catalog ? `${catalog.displayName}: ${mid}` : `${pid}/${mid}`,
 });
 }
 }
 return out;
}

function activeModelCapabilities(config: PilotDeckConfig): {
 ref: string;
 providerId: string;
 modelId: string;
 catalogModel?: CatalogModel;
 catalogProvider?: CatalogProvider;
 multimodalInput: string[] | null;
 maxOutputTokensOverride: number | undefined;
} | null {
 const ref = config.agent?.model ?? '';
 if (!ref) return null;
 const slash = ref.indexOf('/');
 if (slash <= 0 || slash === ref.length - 1) return null;
 const providerId = ref.slice(0, slash);
 const modelId = ref.slice(slash + 1);
 const provider = config.model?.providers?.[providerId];
 if (!provider) return null;
 const userDef = provider.models?.[modelId];
 const userMultimodal = userDef && typeof userDef === 'object'
 ? (userDef as Record<string, unknown>).multimodal
 : null;
 let multimodalInput: string[] | null = null;
 if (userMultimodal && typeof userMultimodal === 'object') {
 const input = (userMultimodal as Record<string, unknown>).input;
 if (Array.isArray(input)) multimodalInput = input.filter((s): s is string => typeof s === 'string');
 }
 const userCapabilities = userDef && typeof userDef === 'object'
 ? (userDef as Record<string, unknown>).capabilities
 : null;
 let maxOutputTokensOverride: number | undefined;
 if (userCapabilities && typeof userCapabilities === 'object') {
 const v = (userCapabilities as Record<string, unknown>).maxOutputTokens;
 if (typeof v === 'number' && Number.isFinite(v) && v > 0) maxOutputTokensOverride = v;
 }
 const catalogProvider = findCatalogProviderById(providerId);
 const catalogModel = catalogProvider?.models.find((m) => m.id === modelId);
 return { ref, providerId, modelId, catalogModel, catalogProvider, multimodalInput, maxOutputTokensOverride };
}

function AgentsSection({ config, onChange }: { config: PilotDeckConfig; onChange: (next: PilotDeckConfig) => void }) {
 const { t } = useTranslation('settings');
 const [showAdvanced, setShowAdvanced] = useState(false);
 const refOptions = buildModelRefOptions(config);
 const mainRef = config.agent?.model ?? '';
 const subDefault = config.agent?.subagents?.default ?? 'inherit';

 const mainOptions = [
 { value: '', label: '— pick a model —' },
 ...refOptions,
 ];
 const subOptions = [
 { value: 'inherit', label: t('pilotDeckConfig.panels.agents.subagents.inherit') },
 ...refOptions,
 ];

 const caps = activeModelCapabilities(config);
 // True when the *effective* config (catalog ∪ user override) supports image.
 const supportsImageEffective = caps
 ? caps.multimodalInput
 ? caps.multimodalInput.includes('image')
 : Boolean(caps.catalogModel?.supportsImage)
 : false;
 // True only when the user explicitly wrote a multimodal.input override.
 const userOverrideActive = caps?.multimodalInput != null;

 const setImageOverride = (enable: boolean) => {
 if (!caps) return;
 const { providerId, modelId } = caps;
 const providers = config.model?.providers ?? {};
 const provider = providers[providerId] ?? {};
 const models = { ...(provider.models ?? {}) };
 const existingDef = models[modelId];
 const def: Record<string, unknown> = existingDef && typeof existingDef === 'object'
 ? { ...(existingDef as Record<string, unknown>) }
 : {};

 const catalogDefault = Boolean(caps.catalogModel?.supportsImage);
 if (enable === catalogDefault) {
 delete def.multimodal;
 } else {
 def.multimodal = { input: enable ? ['text', 'image'] : ['text'] };
 }
 models[modelId] = def as Record<string, unknown>;
 onChange(patch(config, ['model', 'providers', providerId, 'models'], models));
 };

 const setMaxOutputTokens = (value: number | undefined) => {
 if (!caps) return;
 const { providerId, modelId } = caps;
 const providers = config.model?.providers ?? {};
 const provider = providers[providerId] ?? {};
 const models = { ...(provider.models ?? {}) };
 const existingDef = models[modelId];
 const def: Record<string, unknown> = existingDef && typeof existingDef === 'object'
 ? { ...(existingDef as Record<string, unknown>) }
 : {};
 const capabilities: Record<string, unknown> = def.capabilities && typeof def.capabilities === 'object'
 ? { ...(def.capabilities as Record<string, unknown>) }
 : {};
 if (value === undefined) {
 delete capabilities.maxOutputTokens;
 } else {
 capabilities.maxOutputTokens = value;
 }
 if (Object.keys(capabilities).length > 0) {
 def.capabilities = capabilities;
 } else {
 delete def.capabilities;
 }
 models[modelId] = def as Record<string, unknown>;
 onChange(patch(config, ['model', 'providers', providerId, 'models'], models));
 };

 return (
 <SettingsSection
 title={t('pilotDeckConfig.panels.agents.title')}
 description={t('pilotDeckConfig.panels.agents.description')}
 >
 <SettingsCard divided>
 <FormRow label={t('pilotDeckConfig.panels.agents.mainModel.label')} description={t('pilotDeckConfig.panels.agents.mainModel.description')}>
 <Select
 value={mainRef}
 options={mainOptions}
 onChange={(v) => onChange(patch(ensureModelRefConfigured(config, v), ['agent', 'model'], v))}
 />
 </FormRow>

 {caps && (
 <div className="px-4 py-3">
 <div className="rounded-md border border-border/60 bg-muted/30 p-3">
 <div className="mb-2 text-xs font-medium text-foreground">
 {t('pilotDeckConfig.panels.agents.capabilities.title')}
 </div>
 <div className="flex flex-wrap items-center gap-3 text-xs">
 <span className="inline-flex items-center gap-1.5">
 <ImageIcon className="h-3.5 w-3.5" />
 {t('pilotDeckConfig.panels.agents.capabilities.imageInput')}
 </span>
 <label className="inline-flex items-center gap-2">
 <input
 type="checkbox"
 checked={supportsImageEffective}
 onChange={(e) => setImageOverride(e.target.checked)}
 className="h-3.5 w-3.5 rounded border-border"
 />
 <span className={cn(
 'rounded px-1.5 py-0.5 text-[10px] font-medium',
 supportsImageEffective
 ? 'border border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300'
 : 'border border-border bg-muted text-muted-foreground',
 )}>
 {supportsImageEffective ? t('pilotDeckConfig.panels.agents.capabilities.enabled') : t('pilotDeckConfig.panels.agents.capabilities.disabled')}
 </span>
 </label>
 </div>
 <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
 {userOverrideActive
 ? t('pilotDeckConfig.panels.agents.capabilities.overrideActive')
 : caps.catalogModel
 ? (caps.catalogModel.supportsImage ? t('pilotDeckConfig.panels.agents.capabilities.catalogSupportsImage') : t('pilotDeckConfig.panels.agents.capabilities.catalogTextOnly'))
 : t('pilotDeckConfig.panels.agents.capabilities.noCatalog')}
 {' '}{t('pilotDeckConfig.panels.agents.capabilities.imageWarning')}
 </p>

 <div className="mt-3 border-t border-border/60 pt-3">
 <div className="flex flex-wrap items-center gap-3 text-xs">
 <span className="inline-flex items-center gap-1.5">
 <Gauge className="h-3.5 w-3.5" />
 {t('pilotDeckConfig.panels.agents.capabilities.maxOutputTokens')}
 </span>
 <input
 type="number"
 min={1}
 value={caps.maxOutputTokensOverride ?? ''}
 placeholder="16384"
 onChange={(e) => {
 const v = e.target.value;
 if (v === '') return setMaxOutputTokens(undefined);
 const n = Number(v);
 if (Number.isFinite(n) && n > 0) setMaxOutputTokens(Math.floor(n));
 }}
 className="w-28 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
 />
 </div>
 <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
 {t('pilotDeckConfig.panels.agents.capabilities.maxOutputDescription')}
 </p>
 </div>

 <div className="mt-3 border-t border-border/60 pt-3">
 <div className="flex flex-wrap items-center gap-3 text-xs">
 <span className="inline-flex items-center gap-1.5">
 <Gauge className="h-3.5 w-3.5" />
 {t('pilotDeckConfig.panels.agents.capabilities.maxContextTokens')}
 </span>
 <input
 type="number"
 min={1}
 value={config.agent?.maxContextTokens ?? ''}
 placeholder={String(caps.catalogModel?.maxContextTokens ?? 200000)}
 onChange={(e) => {
 const v = e.target.value;
 if (v === '') {
 const next = { ...(config.agent ?? {}) };
 delete next.maxContextTokens;
 onChange(patch(config, ['agent'], next));
 return;
 }
 const n = Number(v);
 if (Number.isFinite(n) && n > 0) {
 onChange(patch(config, ['agent', 'maxContextTokens'], Math.floor(n)));
 }
 }}
 className="w-28 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
 />
 </div>
 <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
 {t('pilotDeckConfig.panels.agents.capabilities.maxContextDescription')}
 </p>
 </div>
 </div>
 </div>
 )}

 <div className="px-4 py-2.5">
 <button
 type="button"
 onClick={() => setShowAdvanced((next) => !next)}
 aria-expanded={showAdvanced}
 className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium leading-5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
 >
 <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showAdvanced && 'rotate-180')} />
 {t('pilotDeckConfig.panels.agents.advancedToggle')}
 </button>
 </div>

 {showAdvanced && (
 <div className="divide-y divide-border">
 <FormRow label={t('pilotDeckConfig.panels.agents.subagents.label')} description={t('pilotDeckConfig.panels.agents.subagents.description')}>
 <Select
 value={subDefault}
 options={subOptions}
 onChange={(v) => onChange(patch(ensureModelRefConfigured(config, v), ['agent', 'subagents', 'default'], v))}
 />
 </FormRow>
 <div className="flex gap-2 px-4 py-3 text-[11px] leading-5 text-muted-foreground">
 <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
 <p>{t('pilotDeckConfig.panels.agents.subagents.routerNote')}</p>
 </div>
 </div>
 )}
 </SettingsCard>
 </SettingsSection>
 );
}

const WELL_KNOWN_ENV_KEYS = [
 { key: 'TAVILY_API_KEY', hint: 'Tavily web search API key' },
 { key: 'FIRECRAWL_API_KEY', hint: 'Firecrawl web scraping API key' },
 { key: 'SERPER_API_KEY', hint: 'Serper search API key' },
 { key: 'BROWSERBASE_API_KEY', hint: 'Browserbase API key' },
];

function CustomEnvSection({ config, onChange }: { config: PilotDeckConfig; onChange: (next: PilotDeckConfig) => void }) {
 const { t } = useTranslation('settings');
 const envMap = config.customEnv ?? {};
 const entries = Object.entries(envMap);
 const [newKey, setNewKey] = useState('');
 const [newValue, setNewValue] = useState('');

 const setEnv = (key: string, value: string) => {
 onChange(patch(config, ['customEnv', key], value));
 };
 const removeEnv = (key: string) => {
 const next = { ...envMap };
 delete next[key];
 onChange(patch(config, ['customEnv'], next));
 };
 const addEntry = () => {
 const key = newKey.trim();
 if (!key) return;
 onChange(patch(config, ['customEnv', key], newValue));
 setNewKey('');
 setNewValue('');
 };
 const addWellKnown = (key: string) => {
 if (envMap[key] !== undefined) return;
 onChange(patch(config, ['customEnv', key], ''));
 };

 const unusedWellKnown = WELL_KNOWN_ENV_KEYS.filter((wk) => envMap[wk.key] === undefined);

 return (
 <SettingsSection
 title={t('pilotDeckConfig.panels.customEnv.title')}
 description={t('pilotDeckConfig.panels.customEnv.description')}
 >
 <SettingsCard className="space-y-3 p-4">
 {entries.length === 0 && (
 <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
 {t('pilotDeckConfig.panels.customEnv.empty')}
 </div>
 )}
 {entries.map(([key, value]) => {
 const isMasked = isMaskedSecret(value);
 return (
 <div key={key} className="space-y-1">
 <div className="flex items-center gap-2">
 <input
 value={key}
 readOnly
 className="w-[200px] shrink-0 rounded-md border border-border bg-muted px-2 py-1.5 font-mono text-xs text-foreground outline-none"
 />
 <span className="text-muted-foreground">=</span>
 <SecretTextInput
 value={value}
 placeholder={isMasked ? t('pilotDeckConfig.panels.customEnv.existingValueKept') : 'value'}
 monospace
 className="min-w-0 flex-1"
 onChange={(v) => setEnv(key, v)}
 />
 <button
 type="button"
 onClick={() => removeEnv(key)}
 className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
 title={t('pilotDeckConfig.actions.remove')}
 >
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </div>
 {isMasked && (
 <div className="ml-[216px] flex items-center gap-1 text-[11px] text-muted-foreground">
 <Info className="h-3 w-3" />
 {t('pilotDeckConfig.panels.customEnv.valueHidden')}
 </div>
 )}
 </div>
 );
 })}

 <div className="border-t border-border pt-3">
 <div className="mb-2 text-xs font-medium text-foreground">{t('pilotDeckConfig.panels.customEnv.addVariable')}</div>
 <div className="flex items-center gap-2">
 <input
 value={newKey}
 onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
 placeholder="KEY_NAME"
 className="w-[200px] shrink-0 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
 />
 <span className="text-muted-foreground">=</span>
 <input
 value={newValue}
 onChange={(e) => setNewValue(e.target.value)}
 placeholder="value"
 type="password"
 className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
 onKeyDown={(e) => { if (e.key === 'Enter' && !isImeEnterEvent(e)) addEntry(); }}
 />
 <Button variant="outline" size="sm" className="shrink-0" onClick={addEntry} disabled={!newKey.trim()}>
 <Plus className="mr-1 h-3.5 w-3.5" />
 {t('pilotDeckConfig.panels.customEnv.add')}
 </Button>
 </div>
 </div>

 {unusedWellKnown.length > 0 && (
 <div className="border-t border-border pt-3">
 <div className="mb-2 text-xs text-muted-foreground">{t('pilotDeckConfig.panels.customEnv.quickAddKeys')}</div>
 <div className="flex flex-wrap gap-1.5">
 {unusedWellKnown.map((wk) => (
 <button
 key={wk.key}
 type="button"
 onClick={() => addWellKnown(wk.key)}
 className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
 title={wk.hint}
 >
 <Plus className="h-3 w-3" />
 {wk.key}
 </button>
 ))}
 </div>
 </div>
 )}
 </SettingsCard>
 </SettingsSection>
 );
}

function AlwaysOnSection({
 config,
 projects,
 onChange,
}: {
 config: PilotDeckConfig;
 projects: SettingsProject[];
 onChange: (next: PilotDeckConfig) => void;
}) {
 const { t } = useTranslation('settings');
 const ao = config.alwaysOn ?? {};
 const trigger = ao.trigger ?? {};
 const dormancy = ao.dormancy ?? {};
 const workspace = ao.workspace ?? {};
 const execution = ao.execution ?? {};
 const enabled = ao.enabled === true;

 const projectRows = projects
 .map(project => ({ project, root: getAlwaysOnProjectRoot(project) }))
 .filter(item => item.root.length > 0);

 return (
 <SettingsSection
 title={t('pilotDeckConfig.panels.alwaysOn.title')}
 description={t('pilotDeckConfig.panels.alwaysOn.description')}
 >
 <div className="space-y-4">
 {/* General */}
 <SettingsCard>
 <SettingsRow
 label={t('pilotDeckConfig.panels.alwaysOn.enabled.label')}
 description={t('pilotDeckConfig.panels.alwaysOn.enabled.description')}
 >
 <SettingsToggle
 checked={enabled}
 ariaLabel={t('pilotDeckConfig.panels.alwaysOn.enabled.label')}
 onChange={(value) => onChange(patch(config, ['alwaysOn', 'enabled'], value))}
 />
 </SettingsRow>
 </SettingsCard>

 {enabled && (
 <>
 {/* Trigger */}
 <SettingsSection
 title={t('pilotDeckConfig.panels.alwaysOn.trigger.title')}
 description={t('pilotDeckConfig.panels.alwaysOn.trigger.description')}
 >
 <SettingsCard divided>
 <SettingsRow
 label={t('pilotDeckConfig.panels.alwaysOn.trigger.autoDiscovery.label')}
 description={t('pilotDeckConfig.panels.alwaysOn.trigger.autoDiscovery.description')}
 >
 <SettingsToggle
 checked={trigger.enabled === true}
 ariaLabel={t('pilotDeckConfig.panels.alwaysOn.trigger.autoDiscovery.label')}
 onChange={(value) => onChange(patch(config, ['alwaysOn', 'trigger', 'enabled'], value))}
 />
 </SettingsRow>
 <FormRow label={t('pilotDeckConfig.panels.alwaysOn.trigger.tickInterval.label')} description={t('pilotDeckConfig.panels.alwaysOn.trigger.tickInterval.description')}>
 <NumberInput
 value={trigger.tickIntervalMinutes}
 placeholder="5"
 onChange={(value) => onChange(patch(config, ['alwaysOn', 'trigger', 'tickIntervalMinutes'], value))}
 />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.alwaysOn.trigger.cooldown.label')} description={t('pilotDeckConfig.panels.alwaysOn.trigger.cooldown.description')}>
 <NumberInput
 value={trigger.cooldownMinutes}
 placeholder="60"
 onChange={(value) => onChange(patch(config, ['alwaysOn', 'trigger', 'cooldownMinutes'], value))}
 />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.alwaysOn.trigger.dailyBudget.label')} description={t('pilotDeckConfig.panels.alwaysOn.trigger.dailyBudget.description')}>
 <NumberInput
 value={trigger.dailyBudget}
 placeholder="4"
 onChange={(value) => onChange(patch(config, ['alwaysOn', 'trigger', 'dailyBudget'], value))}
 />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.alwaysOn.trigger.heartbeatStale.label')} description={t('pilotDeckConfig.panels.alwaysOn.trigger.heartbeatStale.description')}>
 <NumberInput
 value={trigger.heartbeatStaleSeconds}
 placeholder="90"
 onChange={(value) => onChange(patch(config, ['alwaysOn', 'trigger', 'heartbeatStaleSeconds'], value))}
 />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.alwaysOn.trigger.recentUserMsg.label')} description={t('pilotDeckConfig.panels.alwaysOn.trigger.recentUserMsg.description')}>
 <NumberInput
 value={trigger.recentUserMsgMinutes}
 placeholder="5"
 onChange={(value) => onChange(patch(config, ['alwaysOn', 'trigger', 'recentUserMsgMinutes'], value))}
 />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.alwaysOn.trigger.preferChannel.label')} description={t('pilotDeckConfig.panels.alwaysOn.trigger.preferChannel.description')}>
 <Select
 value={trigger.preferChannel}
 onChange={(value) => onChange(patch(config, ['alwaysOn', 'trigger', 'preferChannel'], value))}
 options={[
 { value: 'web', label: 'Web UI' },
 { value: 'tui', label: 'TUI' },
 ]}
 />
 </FormRow>
 </SettingsCard>
 </SettingsSection>

 {/* Dormancy */}
 <SettingsSection
 title={t('pilotDeckConfig.panels.alwaysOn.dormancy.title')}
 description={t('pilotDeckConfig.panels.alwaysOn.dormancy.description')}
 >
 <SettingsCard divided>
 <SettingsRow
 label={t('pilotDeckConfig.panels.alwaysOn.dormancy.enabled.label')}
 description={t('pilotDeckConfig.panels.alwaysOn.dormancy.enabled.description')}
 >
 <SettingsToggle
 checked={dormancy.enabled !== false}
 ariaLabel={t('pilotDeckConfig.panels.alwaysOn.dormancy.enabled.label')}
 onChange={(value) => onChange(patch(config, ['alwaysOn', 'dormancy', 'enabled'], value))}
 />
 </SettingsRow>
 <FormRow label={t('pilotDeckConfig.panels.alwaysOn.dormancy.debounce.label')} description={t('pilotDeckConfig.panels.alwaysOn.dormancy.debounce.description')}>
 <NumberInput
 value={dormancy.debounceMs}
 placeholder="2000"
 onChange={(value) => onChange(patch(config, ['alwaysOn', 'dormancy', 'debounceMs'], value))}
 />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.alwaysOn.dormancy.ignoreGlobs.label')} description={t('pilotDeckConfig.panels.alwaysOn.dormancy.ignoreGlobs.description')}>
 <textarea
 value={(dormancy.ignoreGlobs ?? []).join('\n')}
 placeholder={"**/.git/**\n**/node_modules/**\n**/.pilotdeck/**\n**/dist/**\n**/.DS_Store"}
 onChange={(e) => {
 const globs = e.target.value.split('\n').filter((s) => s.trim().length > 0);
 onChange(patch(config, ['alwaysOn', 'dormancy', 'ignoreGlobs'], globs));
 }}
 spellCheck={false}
 className="min-h-[100px] w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs leading-5 text-foreground outline-none focus:ring-1 focus:ring-ring"
 />
 </FormRow>
 </SettingsCard>
 </SettingsSection>

 {/* Workspace */}
 <SettingsSection
 title={t('pilotDeckConfig.panels.alwaysOn.workspace.title')}
 description={t('pilotDeckConfig.panels.alwaysOn.workspace.description')}
 >
 <SettingsCard divided>
 <FormRow label={t('pilotDeckConfig.panels.alwaysOn.workspace.gitWorktree.label')} description={t('pilotDeckConfig.panels.alwaysOn.workspace.gitWorktree.description')}>
 <TextInput
 value={workspace.gitWorktreeBaseDir}
 placeholder="(auto)"
 monospace
 onChange={(v) => onChange(patch(config, ['alwaysOn', 'workspace', 'gitWorktreeBaseDir'], v || undefined))}
 />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.alwaysOn.workspace.snapshotDir.label')} description={t('pilotDeckConfig.panels.alwaysOn.workspace.snapshotDir.description')}>
 <TextInput
 value={workspace.snapshotBaseDir}
 placeholder="(auto)"
 monospace
 onChange={(v) => onChange(patch(config, ['alwaysOn', 'workspace', 'snapshotBaseDir'], v || undefined))}
 />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.alwaysOn.workspace.snapshotMaxBytes.label')} description={t('pilotDeckConfig.panels.alwaysOn.workspace.snapshotMaxBytes.description')}>
 <NumberInput
 value={workspace.snapshotMaxBytes}
 placeholder="1073741824"
 onChange={(value) => onChange(patch(config, ['alwaysOn', 'workspace', 'snapshotMaxBytes'], value))}
 />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.alwaysOn.workspace.maxPlansPerCycle.label')} description={t('pilotDeckConfig.panels.alwaysOn.workspace.maxPlansPerCycle.description')}>
 <NumberInput
 value={workspace.maxPlansPerCycle}
 placeholder="3"
 onChange={(value) => onChange(patch(config, ['alwaysOn', 'workspace', 'maxPlansPerCycle'], value))}
 />
 </FormRow>
 <SettingsRow
 label={t('pilotDeckConfig.panels.alwaysOn.workspace.gitLfs.label')}
 description={t('pilotDeckConfig.panels.alwaysOn.workspace.gitLfs.description')}
 >
 <SettingsToggle
 checked={workspace.gitLfs === true}
 ariaLabel={t('pilotDeckConfig.panels.alwaysOn.workspace.gitLfs.label')}
 onChange={(value) => onChange(patch(config, ['alwaysOn', 'workspace', 'gitLfs'], value))}
 />
 </SettingsRow>
 </SettingsCard>
 </SettingsSection>

 {/* Execution */}
 <SettingsSection
 title={t('pilotDeckConfig.panels.alwaysOn.execution.title')}
 description={t('pilotDeckConfig.panels.alwaysOn.execution.description')}
 >
 <SettingsCard divided>
 <FormRow label={t('pilotDeckConfig.panels.alwaysOn.execution.maxTurns.label')} description={t('pilotDeckConfig.panels.alwaysOn.execution.maxTurns.description')}>
 <NumberInput
 value={execution.maxTurns}
 placeholder="30"
 onChange={(value) => onChange(patch(config, ['alwaysOn', 'execution', 'maxTurns'], value))}
 />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.alwaysOn.execution.maxToolCalls.label')} description={t('pilotDeckConfig.panels.alwaysOn.execution.maxToolCalls.description')}>
 <NumberInput
 value={execution.maxToolCalls}
 placeholder="200"
 onChange={(value) => onChange(patch(config, ['alwaysOn', 'execution', 'maxToolCalls'], value))}
 />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.alwaysOn.execution.timeout.label')} description={t('pilotDeckConfig.panels.alwaysOn.execution.timeout.description')}>
 <NumberInput
 value={execution.timeoutMinutes}
 placeholder="20"
 onChange={(value) => onChange(patch(config, ['alwaysOn', 'execution', 'timeoutMinutes'], value))}
 />
 </FormRow>
 </SettingsCard>
 </SettingsSection>

 {/* Workspace opt-in */}
 <SettingsSection
 title={t('pilotDeckConfig.panels.alwaysOn.workspaceOptIn.title')}
 description={t('pilotDeckConfig.panels.alwaysOn.workspaceOptIn.description')}
 >
 <SettingsCard divided>
 {projectRows.length === 0 ? (
 <div className="px-4 py-6 text-sm text-muted-foreground">
 {t('pilotDeckConfig.panels.alwaysOn.workspaceOptIn.empty')}
 </div>
 ) : (
 projectRows.map(({ project, root }) => (
 <SettingsRow
 key={root}
 label={project.displayName || project.name}
 description={root}
 >
 <SettingsToggle
 checked={isAlwaysOnProjectEnabled(config, project)}
 ariaLabel={`Toggle Always-On for ${project.displayName || project.name}`}
 onChange={(en) => onChange(setAlwaysOnProjectEnabled(config, project, en))}
 />
 </SettingsRow>
 ))
 )}
 </SettingsCard>
 </SettingsSection>
 </>
 )}
 </div>
 </SettingsSection>
 );
}

function CronSection({ config, onChange }: { config: PilotDeckConfig; onChange: (next: PilotDeckConfig) => void }) {
 const { t } = useTranslation('settings');
 const cron = config.cron ?? {};
 const enabled = cron.enabled !== false;

 return (
 <SettingsSection
 title={t('pilotDeckConfig.panels.cron.title')}
 description={t('pilotDeckConfig.panels.cron.description')}
 >
 <SettingsCard divided>
 <SettingsRow
 label={t('pilotDeckConfig.panels.cron.enabled.label')}
 description={t('pilotDeckConfig.panels.cron.enabled.description')}
 >
 <SettingsToggle
 checked={enabled}
 ariaLabel={t('pilotDeckConfig.panels.cron.enabled.label')}
 onChange={(value) => onChange(patch(config, ['cron', 'enabled'], value))}
 />
 </SettingsRow>
 <FormRow
 label={t('pilotDeckConfig.panels.cron.timezone.label')}
 description={t('pilotDeckConfig.panels.cron.timezone.description')}
 >
 <TextInput
 value={cron.timezone}
 placeholder="Asia/Shanghai"
 monospace
 onChange={(value) => onChange(patch(config, ['cron', 'timezone'], value || undefined))}
 />
 </FormRow>
 <FormRow
 label={t('pilotDeckConfig.panels.cron.maxConcurrentRuns.label')}
 description={t('pilotDeckConfig.panels.cron.maxConcurrentRuns.description')}
 >
 <NumberInput
 value={cron.maxConcurrentRuns}
 placeholder="2"
 onChange={(value) => onChange(patch(config, ['cron', 'maxConcurrentRuns'], value))}
 />
 </FormRow>
 </SettingsCard>
 </SettingsSection>
 );
}

function MemorySection({ config, onChange }: { config: PilotDeckConfig; onChange: (next: PilotDeckConfig) => void }) {
 const { t } = useTranslation('settings');
 const m = config.memory ?? {};
 // Memory uses a "provider/model" reference, or "inherit" to fall back
 // to agent.model. The backend treats `undefined` and `"inherit"` the
 // same way, so we map both to the inherit option in the UI.
 const refOptions = buildModelRefOptions(config);
 const options = [
 { value: 'inherit', label: t('pilotDeckConfig.panels.memory.model.inherit') },
 ...refOptions,
 ];
 const selected = m.model && m.model.trim() ? m.model : 'inherit';
 return (
 <SettingsSection
 title={t('pilotDeckConfig.panels.memory.title')}
 description={t('pilotDeckConfig.panels.memory.description')}
 >
 <SettingsCard>
 <SettingsRow
 label={t('pilotDeckConfig.panels.memory.enabled.label')}
 description={t('pilotDeckConfig.panels.memory.enabled.description')}
 >
 <SettingsToggle
 checked={Boolean(m.enabled)}
 ariaLabel={t('pilotDeckConfig.panels.memory.enabled.label')}
 onChange={(v) => onChange(patch(config, ['memory', 'enabled'], v))}
 />
 </SettingsRow>
 {/* PD-SAAS-FORK: project continuity toggle (default on) */}
 {m.enabled && (
 <>
 <SettingsRow
 label={t('pilotDeckConfig.panels.memory.projectContinuity.label')}
 description={t('pilotDeckConfig.panels.memory.projectContinuity.description')}
 >
 <SettingsToggle
 checked={m.projectContinuity?.enabled !== false}
 ariaLabel={t('pilotDeckConfig.panels.memory.projectContinuity.label')}
 onChange={(v) => onChange(patch(config, ['memory', 'projectContinuity', 'enabled'], v))}
 />
 </SettingsRow>
 <FormRow
 label={t('pilotDeckConfig.panels.memory.model.label')}
 description={t('pilotDeckConfig.panels.memory.model.description')}
 >
 <Select
 value={selected}
 options={options}
 onChange={(v) => {
 const nextValue = v === 'inherit' ? '' : v;
 onChange(patch(ensureModelRefConfigured(config, nextValue), ['memory', 'model'], nextValue));
 }}
 />
 </FormRow>
 </>
 )}
 </SettingsCard>
 </SettingsSection>
 );
}

function ToolsSection({ config, onChange }: { config: PilotDeckConfig; onChange: (next: PilotDeckConfig) => void }) {
 const { t } = useTranslation('settings');
 const bochaDefaultEndpoint = 'https://api.bochaai.com/v1/web-search';
 const glmDefaultEndpoint = 'https://api.z.ai/api/paas/v4/web_search';
 const ws = config.tools?.webSearch ?? {};
 const provider =
 ws.provider === 'tavily' || ws.provider === 'bocha' || ws.provider === 'custom'
 ? ws.provider
 : 'glm';
 const apiKey = typeof ws.apiKey === 'string' ? ws.apiKey : '';
 const endpoint = typeof ws.endpoint === 'string' ? ws.endpoint : '';
 const custom = ws.customProvider ?? {};
 const endpointValue =
 endpoint
 || (provider === 'glm'
 ? glmDefaultEndpoint
 : provider === 'tavily'
 ? 'https://api.tavily.com/search'
 : provider === 'bocha'
 ? bochaDefaultEndpoint
 : '');
 const endpointPlaceholder = provider === 'custom'
 ? 'https://example.com/search'
 : provider === 'tavily'
 ? 'https://api.tavily.com/search'
 : provider === 'bocha'
 ? bochaDefaultEndpoint
 : glmDefaultEndpoint;

 // Test-connection state — modeled after onboarding's LlmConfigurationStep
 // so behaviour and accessibility match across the app. Reset whenever the
 // user edits the key or endpoint so a stale ✓ never lies about new input.
 const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
 const [testMessage, setTestMessage] = useState('');

 const resetTest = () => {
 setTestStatus('idle');
 setTestMessage('');
 };

 const setProvider = (nextProvider: 'glm' | 'tavily' | 'bocha' | 'custom') => {
 const nextTools = {
 webSearch: {
 provider: nextProvider,
 ...(nextProvider === 'glm'
 ? { endpoint: glmDefaultEndpoint }
 : nextProvider === 'bocha'
 ? { endpoint: bochaDefaultEndpoint }
 : {}),
 },
 };
 onChange(patch(config, ['tools'], nextTools));
 resetTest();
 };

 const setField = (field: 'apiKey' | 'endpoint', value: string) => {
 const trimmed = value;
 const nextWs: NonNullable<PilotDeckConfig['tools']>['webSearch'] = { ...ws };
 nextWs.provider = provider;
 if (trimmed === '') {
 delete nextWs[field];
 } else {
 nextWs[field] = trimmed;
 }
 const nextTools = Object.keys(nextWs).length > 0 ? { webSearch: nextWs } : undefined;
 onChange(patch(config, ['tools'], nextTools));
 resetTest();
 };

 const setCustomField = (
 field: keyof NonNullable<NonNullable<PilotDeckConfig['tools']>['webSearch']>['customProvider'],
 value: string,
 ) => {
 const nextWs: NonNullable<PilotDeckConfig['tools']>['webSearch'] = {
 ...ws,
 provider: 'custom',
 customProvider: { ...(ws.customProvider ?? {}) },
 };
 if (value === '') {
 delete nextWs.customProvider?.[field];
 } else if (field === 'auth') {
 nextWs.customProvider![field] = value as 'bearer' | 'bodyApiKey' | 'queryApiKey' | 'none';
 } else if (field === 'method') {
 nextWs.customProvider![field] = value as 'GET' | 'POST';
 } else {
 nextWs.customProvider![field] = value;
 }
 if (Object.keys(nextWs.customProvider ?? {}).length === 0) {
 delete nextWs.customProvider;
 }
 onChange(patch(config, ['tools'], { webSearch: nextWs }));
 resetTest();
 };

 const handleTest = async () => {
 const trimmedKey = hasUsableSecret(apiKey) ? apiKey.trim() : '';
 if (!trimmedKey) {
 setTestStatus('error');
 setTestMessage(t('pilotDeckConfig.panels.tools.test.needsKey'));
 return;
 }
 setTestStatus('testing');
 setTestMessage('');
 try {
 const res = await authenticatedFetch('/api/config/test-web-search', {
 method: 'POST',
 body: JSON.stringify({ provider, apiKey: trimmedKey, endpoint: endpointValue.trim(), customProvider: custom }),
 });
 const data = await res.json();
 if (data.ok) {
 setTestStatus('success');
 setTestMessage(
 t('pilotDeckConfig.panels.tools.test.success', {
 count: data.organicCount ?? 0,
 latency: data.latencyMs ?? 0,
 }),
 );
 } else {
 setTestStatus('error');
 setTestMessage(
 t('pilotDeckConfig.panels.tools.test.failedPrefix', { error: data.error || 'unknown' }),
 );
 }
 } catch (err) {
 setTestStatus('error');
 setTestMessage(
 t('pilotDeckConfig.panels.tools.test.failedPrefix', {
 error: err instanceof Error ? err.message : String(err),
 }),
 );
 }
 };

 return (
 <SettingsSection
 title={t('pilotDeckConfig.panels.tools.title')}
 description={t('pilotDeckConfig.panels.tools.description')}
 >
 <SettingsCard divided>
 <FormRow
 label={t('pilotDeckConfig.panels.tools.provider.label')}
 description={t('pilotDeckConfig.panels.tools.provider.description')}
 >
 <Select
 value={provider}
 options={[
 { value: 'glm', label: t('pilotDeckConfig.panels.tools.provider.glm') },
 { value: 'tavily', label: t('pilotDeckConfig.panels.tools.provider.tavily') },
 { value: 'bocha', label: t('pilotDeckConfig.panels.tools.provider.bocha') },
 { value: 'custom', label: t('pilotDeckConfig.panels.tools.provider.custom') },
 ]}
 onChange={(v) =>
 setProvider(
 v === 'custom'
 ? 'custom'
 : v === 'tavily'
 ? 'tavily'
 : v === 'bocha'
 ? 'bocha'
 : 'glm',
 )
 }
 />
 </FormRow>
 <FormRow
 label={t('pilotDeckConfig.panels.tools.apiKey.label')}
 description={t('pilotDeckConfig.panels.tools.apiKey.description')}
 >
 <SecretTextInput
 value={apiKey}
 emptyPlaceholder={t('pilotDeckConfig.panels.tools.apiKey.placeholder')}
 maskedPlaceholder={t('pilotDeckConfig.panels.tools.apiKey.maskedPlaceholder')}
 monospace
 onChange={(v) => setField('apiKey', v)}
 />
 {isMaskedSecret(apiKey) && (
 <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
 <Info className="h-3 w-3" />
 {t('pilotDeckConfig.panels.tools.apiKey.keyHidden')}
 </p>
 )}
 </FormRow>
 <FormRow
 label={t('pilotDeckConfig.panels.tools.endpoint.label')}
 description={t('pilotDeckConfig.panels.tools.endpoint.description')}
 >
 <TextInput
 value={endpointValue}
 placeholder={endpointPlaceholder}
 monospace
 onChange={(v) => setField('endpoint', v)}
 />
 </FormRow>
 {provider === 'custom' && (
 <>
 <FormRow
 label={t('pilotDeckConfig.panels.tools.custom.name.label')}
 description={t('pilotDeckConfig.panels.tools.custom.name.description')}
 >
 <TextInput
 value={custom.name ?? ''}
 placeholder="My Search"
 onChange={(v) => setCustomField('name', v)}
 />
 </FormRow>
 <FormRow
 label={t('pilotDeckConfig.panels.tools.custom.auth.label')}
 description={t('pilotDeckConfig.panels.tools.custom.auth.description')}
 >
 <Select
 value={custom.auth ?? 'bearer'}
 options={[
 { value: 'bearer', label: t('pilotDeckConfig.panels.tools.custom.auth.bearer') },
 { value: 'bodyApiKey', label: t('pilotDeckConfig.panels.tools.custom.auth.bodyApiKey') },
 { value: 'queryApiKey', label: t('pilotDeckConfig.panels.tools.custom.auth.queryApiKey') },
 { value: 'none', label: t('pilotDeckConfig.panels.tools.custom.auth.none') },
 ]}
 onChange={(v) => setCustomField('auth', v)}
 />
 </FormRow>
 <FormRow
 label={t('pilotDeckConfig.panels.tools.custom.method.label')}
 description={t('pilotDeckConfig.panels.tools.custom.method.description')}
 >
 <Select
 value={custom.method ?? 'POST'}
 options={[
 { value: 'POST', label: 'POST' },
 { value: 'GET', label: 'GET' },
 ]}
 onChange={(v) => setCustomField('method', v)}
 />
 </FormRow>
 <FormRow
 label={t('pilotDeckConfig.panels.tools.custom.params.label')}
 description={t('pilotDeckConfig.panels.tools.custom.params.description')}
 >
 <div className="grid gap-2 md:grid-cols-2">
 <TextInput
 value={custom.queryParam ?? ''}
 placeholder="query"
 monospace
 onChange={(v) => setCustomField('queryParam', v)}
 />
 <TextInput
 value={custom.apiKeyParam ?? ''}
 placeholder="api_key"
 monospace
 onChange={(v) => setCustomField('apiKeyParam', v)}
 />
 </div>
 </FormRow>
 <FormRow
 label={t('pilotDeckConfig.panels.tools.custom.mapping.label')}
 description={t('pilotDeckConfig.panels.tools.custom.mapping.description')}
 >
 <div className="grid gap-2 md:grid-cols-2">
 <TextInput value={custom.resultsPath ?? ''} placeholder="data.items" monospace onChange={(v) => setCustomField('resultsPath', v)} />
 <TextInput value={custom.titleField ?? ''} placeholder="title" monospace onChange={(v) => setCustomField('titleField', v)} />
 <TextInput value={custom.urlField ?? ''} placeholder="url" monospace onChange={(v) => setCustomField('urlField', v)} />
 <TextInput value={custom.snippetField ?? ''} placeholder="snippet" monospace onChange={(v) => setCustomField('snippetField', v)} />
 <TextInput value={custom.sourceField ?? ''} placeholder="source" monospace onChange={(v) => setCustomField('sourceField', v)} />
 <TextInput value={custom.publishedAtField ?? ''} placeholder="publishedAt" monospace onChange={(v) => setCustomField('publishedAtField', v)} />
 </div>
 </FormRow>
 </>
 )}
 <div className="flex flex-col gap-2 px-4 py-3">
 <div className="flex items-center gap-2">
 <Button
 variant="outline"
 size="sm"
 onClick={handleTest}
 disabled={testStatus === 'testing' || !hasUsableSecret(apiKey)}
 >
 {testStatus === 'testing' ? (
 <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
 ) : (
 <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
 )}
 {testStatus === 'testing'
 ? t('pilotDeckConfig.panels.tools.test.testing')
 : t('pilotDeckConfig.panels.tools.test.button')}
 </Button>
 {testStatus === 'success' && (
 <span className="inline-flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
 <CheckCircle2 className="h-3.5 w-3.5" />
 {testMessage}
 </span>
 )}
 {testStatus === 'error' && (
 <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
 <XCircle className="h-3.5 w-3.5" />
 {testMessage}
 </span>
 )}
 </div>
 </div>
 <div className="px-4 pb-4">
   <WebSearchCapabilityFallbackEditor
     tool={ws}
     providerOptions={[
       { value: 'glm', label: t('pilotDeckConfig.panels.tools.provider.glm') },
       { value: 'tavily', label: t('pilotDeckConfig.panels.tools.provider.tavily') },
       { value: 'bocha', label: t('pilotDeckConfig.panels.tools.provider.bocha') },
       { value: 'custom', label: t('pilotDeckConfig.panels.tools.provider.custom') },
     ]}
     onChange={(next) => onChange(patch(config, ['tools', 'webSearch'], next))}
   />
 </div>
 </SettingsCard>
 </SettingsSection>
 );
}

function DocumentToolsHubSection({ config, onChange }: { config: PilotDeckConfig; onChange: (next: PilotDeckConfig) => void }) {
 const { t } = useTranslation('settings');
 const compose = config.tools?.documentCompose ?? {};
 const ocr = config.tools?.documentOcr ?? {};
 const baiduAi = config.tools?.baiduAi ?? {};
 const exportCfg = config.tools?.documentExport ?? {};
 const importCfg = config.tools?.documentImport ?? {};
 const qwenPoolKey = config.model?.providers?.qwen?.apiKey ?? '';
 const qwenInherited = isConfiguredApiKey(qwenPoolKey) && !hasUsableSecret(ocr.apiKey);
 const mineruConfigured = Boolean(
  isConfiguredApiKey(ocr.apiKey) &&
  (
    !hasUsableSecret(ocr.apiKey) ||
    /^eyJ/i.test((ocr.apiKey ?? '').trim()) ||
    (ocr.apiKey ?? '').trim().length >= 32
  ),
 );
 const baiduConfigured = Boolean(
  isConfiguredApiKey(baiduAi.apiKey) &&
  (
    !hasUsableSecret(baiduAi.apiKey) ||
    (baiduAi.apiKey ?? '').trim().startsWith('bce-v3/') ||
    isConfiguredApiKey(baiduAi.secretKey)
  ),
 );
 const extractorMethod = ocr.extractorMethod ?? 'hybrid';
 const ocrReady =
  (mineruConfigured && (extractorMethod === 'mineru' || baiduConfigured)) ||
  qwenInherited ||
  (ocr.provider === 'qwen-vl' && hasUsableSecret(ocr.apiKey));

 const setComposeField = (field: 'aspectRatio', value: string) => {
 const next = { ...(config.tools?.documentCompose ?? {}) };
 if (value === '') delete (next as any)[field];
 else (next as any)[field] = value;
 onChange(patch(config, ['tools', 'documentCompose'], next));
 };

 const setOcrField = (
 field: 'provider' | 'mode' | 'apiUrl' | 'apiKey' | 'model' | 'fallbackProvider' | 'extractorMethod' | 'inpaintMethod',
 value: string,
 ) => {
 const next = { ...(config.tools?.documentOcr ?? {}) };
 if (value === '') delete (next as any)[field];
 else (next as any)[field] = value;
 onChange(patch(config, ['tools', 'documentOcr'], next));
 };

 const setBaiduField = (field: 'apiKey' | 'secretKey', value: string) => {
 const next = { ...(config.tools?.baiduAi ?? {}) };
 if (value === '') delete (next as any)[field];
 else (next as any)[field] = value;
 onChange(patch(config, ['tools', 'baiduAi'], next));
 };

 const setExportField = (
 field: 'cloudPreference' | 'defaultQuality',
 value: string,
 ) => {
 const next = { ...(config.tools?.documentExport ?? {}) };
 if (value === '') delete (next as any)[field];
 else (next as any)[field] = value;
 onChange(patch(config, ['tools', 'documentExport'], next));
 };

 const setExportPoolSize = (value: string) => {
 const next = { ...(config.tools?.documentExport ?? {}) };
 const n = Number(value);
 if (!value.trim() || !Number.isFinite(n) || n < 1) {
 delete next.playwright;
 } else {
 next.playwright = { poolSize: Math.min(4, Math.floor(n)) };
 }
 onChange(patch(config, ['tools', 'documentExport'], next));
 };

 const setExportNutrientKey = (value: string) => {
 const next = { ...(config.tools?.documentExport ?? {}) };
 const block = { ...(next.nutrient ?? {}) };
 if (!value.trim()) delete block.apiKey;
 else block.apiKey = value;
 if (Object.keys(block).length === 0) delete next.nutrient;
 else next.nutrient = block;
 onChange(patch(config, ['tools', 'documentExport'], next));
 };

 const setImportField = (
 field: 'enabled' | 'cloudPreference' | 'workerConcurrency' | 'timeoutMs' | 'fallbackProvider',
 value: string | boolean,
 ) => {
 const next = { ...(config.tools?.documentImport ?? {}) };
 if (value === '' || value === undefined) delete (next as any)[field];
 else (next as any)[field] = value;
 onChange(patch(config, ['tools', 'documentImport'], next));
 };

 return (
 <>
      <div className="border-t border-border px-4 py-3">
      <CollapsibleHubBlock
        title={t('pilotDeckConfig.panels.providerHub.documentComposeTitle', {
          defaultValue: '图像合成 PDF/PPT',
        })}
        configured
        configuredLabel="本机可用"
      >
        <p className="text-[11px] text-muted-foreground">
 {t('pilotDeckConfig.panels.providerHub.documentComposeHint', {
 defaultValue: '无需 Key。把多张 PNG/JPG 合成 PDF（Node）或 PPTX（需本机 Python + python-pptx）。',
 })}
 </p>
 <FormRow
 label={t('pilotDeckConfig.panels.providerHub.documentComposeAspectRatio', {
 defaultValue: '默认宽高比（PPT）',
 })}
 >
          <TextInput
            value={compose.aspectRatio ?? '16:9'}
            placeholder="16:9"
            monospace
            onChange={(v) => setComposeField('aspectRatio', v)}
          />
        </FormRow>
      </CollapsibleHubBlock>
      </div>

      <div className="border-t border-border px-4 py-3">
      <CollapsibleHubBlock
        title={t('pilotDeckConfig.panels.providerHub.documentOcrTitle', {
          defaultValue: '图片识别成可编辑 PPT',
        })}
        configured={ocrReady}
      >
        <p className="text-[11px] text-muted-foreground">
 {t('pilotDeckConfig.panels.providerHub.documentOcrHint', {
 defaultValue:
 '填写 MinerU 云端 Token（JWT）优先；失败或未配置时可自动降级到通义视觉（需在模型池配置 DashScope Key）。',
 })}
 </p>
 <FormRow label={t('pilotDeckConfig.panels.providerHub.provider', { defaultValue: 'Provider' })}>
 <Select
 value={ocr.provider ?? 'mineru'}
 options={[
 { value: 'mineru', label: 'MinerU 版面识别' },
 { value: 'qwen-vl', label: '通义视觉 (Qwen-VL)' },
 ]}
 onChange={(v) => setOcrField('provider', v)}
 />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.providerHub.documentOcrMode', { defaultValue: '接入方式' })}>
 <Select
 value={ocr.mode ?? 'cloud'}
 options={[
 { value: 'cloud', label: 'MinerU 云端' },
 { value: 'local', label: 'MinerU 本地 API' },
 ]}
 onChange={(v) => setOcrField('mode', v)}
 />
 </FormRow>
 <FormRow
 label={t('pilotDeckConfig.panels.providerHub.documentOcrApiUrl', { defaultValue: 'API 地址' })}
 description={t('pilotDeckConfig.panels.providerHub.documentOcrApiUrlDescription', {
 defaultValue: '云端默认 https://mineru.net/api/v4；本地默认 http://127.0.0.1:8000',
 })}
 >
 <TextInput
 value={ocr.apiUrl ?? ''}
 placeholder={ocr.mode === 'local' ? 'http://127.0.0.1:8000' : 'https://mineru.net/api/v4'}
 monospace
 onChange={(v) => setOcrField('apiUrl', v)}
 />
 </FormRow>
 <FormRow
 label={t('pilotDeckConfig.panels.providerHub.documentOcrToken', { defaultValue: '版面识别 Token' })}
 description={t('pilotDeckConfig.panels.providerHub.documentOcrTokenDescription', {
 defaultValue: 'MinerU 用户中心 JWT，以 eyJ 开头；勿提交 Git。',
 })}
 >
 <SecretTextInput
 value={secretDisplayValue(ocr.apiKey)}
 emptyPlaceholder="eyJ..."
 maskedPlaceholder="********"
 monospace
 onChange={(v) => setOcrField('apiKey', v)}
 />
 </FormRow>
 <FormRow
 label={t('pilotDeckConfig.panels.providerHub.documentOcrModel', { defaultValue: '通义视觉模型' })}
 description={t('pilotDeckConfig.panels.providerHub.documentOcrModelDescription', {
 defaultValue: '降级或 provider=qwen-vl 时使用，默认 qwen-vl-max。',
 })}
 >
 <TextInput
 value={ocr.model ?? 'qwen-vl-max'}
 placeholder="qwen-vl-max"
 monospace
 onChange={(v) => setOcrField('model', v)}
 />
 </FormRow>
 <FormRow
 label={t('pilotDeckConfig.panels.providerHub.documentOcrFallback', { defaultValue: '失败时降级' })}
 >
 <Select
 value={ocr.fallbackProvider ?? 'qwen-vl'}
 options={[{ value: 'qwen-vl', label: '通义视觉 (Qwen-VL)' }]}
 onChange={(v) => setOcrField('fallbackProvider', v)}
 />
 </FormRow>
 <FormRow
 label={t('pilotDeckConfig.panels.providerHub.documentOcrExtractor', { defaultValue: '文字定位模式' })}
 description={t('pilotDeckConfig.panels.providerHub.documentOcrExtractorDescription', {
 defaultValue: '混合模式用 MinerU 版面 + 百度 OCR 细框，文字位置更准（推荐）。',
 })}
 >
 <Select
 value={ocr.extractorMethod ?? 'hybrid'}
 options={[
 { value: 'hybrid', label: '混合（MinerU + 百度 OCR，推荐）' },
 { value: 'mineru', label: '仅 MinerU' },
 ]}
 onChange={(v) => setOcrField('extractorMethod', v)}
 />
 </FormRow>
 <FormRow
 label={t('pilotDeckConfig.panels.providerHub.documentOcrInpaint', { defaultValue: '去字底图' })}
 description={t('pilotDeckConfig.panels.providerHub.documentOcrInpaintDescription', {
 defaultValue: '导出可编辑 PPT 时从背景去除文字；百度修复画质更好。',
 })}
 >
 <Select
 value={ocr.inpaintMethod ?? 'baidu'}
 options={[
 { value: 'baidu', label: '百度图像修复（推荐）' },
 { value: 'pil_fallback', label: '本地模糊（降级）' },
 ]}
 onChange={(v) => setOcrField('inpaintMethod', v)}
 />
 </FormRow>
        {extractorMethod === 'hybrid' && !baiduConfigured ? (
          <p className="text-[11px] text-amber-600 dark:text-amber-500">
            混合模式需在下方「百度智能云」填写 API Key 与 Secret Key。
          </p>
        ) : null}
        {qwenInherited ? (
          <p className="text-[11px] text-muted-foreground">
            通义 DashScope Key 已从模型池「qwen」继承，MinerU 失败时可自动降级。
          </p>
        ) : (
          <p className="text-[11px] text-amber-600 dark:text-amber-500">
            未检测到模型池 qwen Key；降级路径需在模型池配置 DashScope API Key。
          </p>
        )}
      </CollapsibleHubBlock>
      </div>

      <div className="border-t border-border px-4 py-3">
      <CollapsibleHubBlock
        title={t('pilotDeckConfig.panels.providerHub.baiduAiTitle', {
          defaultValue: '百度智能云（OCR / 图像修复）',
        })}
        configured={baiduConfigured}
      >
        <p className="text-[11px] text-muted-foreground">
          {t('pilotDeckConfig.panels.providerHub.baiduAiHint', {
            defaultValue:
              '用于可编辑 PPT 的文字精确定位与背景去字，全站共享。控制台新建的 BCE-v3 Key（以 bce-v3/ 开头）只需填 API Key，无需 Secret Key；与 MinerU Token 不同，勿混填。',
          })}
        </p>
        <FormRow
          label={t('pilotDeckConfig.panels.providerHub.baiduAiApiKey', { defaultValue: 'API Key' })}
          description={t('pilotDeckConfig.panels.providerHub.baiduAiApiKeyDescription', {
            defaultValue: '推荐 BCE-v3 格式（bce-v3/ALTAK-…），单 Key 即可用于 OCR 与图像修复。',
          })}
        >
          <SecretTextInput
            value={secretDisplayValue(baiduAi.apiKey)}
            emptyPlaceholder="百度控制台 API Key"
            maskedPlaceholder="********"
            monospace
            onChange={(v) => setBaiduField('apiKey', v)}
          />
        </FormRow>
        <FormRow
          label={t('pilotDeckConfig.panels.providerHub.baiduAiSecretKey', {
            defaultValue: 'Secret Key（可选）',
          })}
          description={t('pilotDeckConfig.panels.providerHub.baiduAiSecretKeyDescription', {
            defaultValue: '仅旧版「API Key + Secret Key」OAuth 接入需要；BCE-v3 单 Key 可留空。',
          })}
        >
          <SecretTextInput
            value={secretDisplayValue(baiduAi.secretKey)}
            emptyPlaceholder="百度控制台 Secret Key"
            maskedPlaceholder="********"
            monospace
            onChange={(v) => setBaiduField('secretKey', v)}
          />
        </FormRow>
      </CollapsibleHubBlock>
      </div>

      <div className="border-t border-border px-4 py-3">
      <CollapsibleHubBlock
        title={t('pilotDeckConfig.panels.providerHub.documentExportTitle', {
          defaultValue: '一键导出 PDF/Word/PPT/Excel',
        })}
        configured
        configuredLabel="本机可用"
      >
        <p className="text-[11px] text-muted-foreground">
          {t('pilotDeckConfig.panels.providerHub.documentExportHint', {
            defaultValue: 'Markdown/HTML → 办公格式；高保真 HTML 可填 Nutrient Key（可选，失败自动回退本机）。',
          })}
        </p>
        <FormRow label={t('pilotDeckConfig.panels.providerHub.documentExportCloud', { defaultValue: '云端优先' })}>
          <Select
            value={exportCfg.cloudPreference ?? 'cloud_first'}
            options={[
              { value: 'cloud_first', label: '云端优先，失败回退本机' },
              { value: 'local_only', label: '仅本机' },
            ]}
            onChange={(v) => setExportField('cloudPreference', v)}
          />
        </FormRow>
        <FormRow label={t('pilotDeckConfig.panels.providerHub.documentExportQuality', { defaultValue: '默认质量' })}>
          <Select
            value={exportCfg.defaultQuality ?? 'balanced'}
            options={[
              { value: 'fast', label: '快速' },
              { value: 'balanced', label: '均衡' },
              { value: 'fidelity', label: '高保真（可触发 Nutrient/minimax-pdf）' },
            ]}
            onChange={(v) => setExportField('defaultQuality', v)}
          />
        </FormRow>
        <FormRow
          label={t('pilotDeckConfig.panels.providerHub.documentExportPool', { defaultValue: 'Playwright 池大小' })}
          description="Gateway 进程内复用浏览器，1–4。"
        >
          <TextInput
            value={String(exportCfg.playwright?.poolSize ?? 1)}
            placeholder="1"
            monospace
            onChange={setExportPoolSize}
          />
        </FormRow>
        <FormRow
          label={t('pilotDeckConfig.panels.providerHub.documentExportNutrient', { defaultValue: 'Nutrient API Key（可选）' })}
          description="高保真 HTML→PDF/DOCX；也可在下方「Nutrient DWS」接入块中配置。"
        >
          <SecretTextInput
            value={secretDisplayValue(exportCfg.nutrient?.apiKey)}
            emptyPlaceholder="可选"
            maskedPlaceholder="********"
            monospace
            onChange={setExportNutrientKey}
          />
        </FormRow>
      </CollapsibleHubBlock>
      </div>

      <div className="border-t border-border px-4 py-3">
      <CollapsibleHubBlock
        title={t('pilotDeckConfig.panels.providerHub.documentImportTitle', {
          defaultValue: '对话附件解析（PDF/Word/Excel/PPT）',
        })}
        configured={importCfg.enabled !== false}
        configuredLabel={importCfg.enabled === false ? '已关闭' : '本机可用'}
      >
        <p className="text-[11px] text-muted-foreground">
          {t('pilotDeckConfig.panels.providerHub.documentImportHint', {
            defaultValue: '上传办公附件后自动注入可读文本；扫描件 fallback 共用上方 OCR/MinerU Token。',
          })}
        </p>
        <FormRow label={t('pilotDeckConfig.panels.providerHub.documentImportEnabled', { defaultValue: '启用附件解析' })}>
          <Select
            value={importCfg.enabled === false ? 'off' : 'on'}
            options={[
              { value: 'on', label: '开启' },
              { value: 'off', label: '关闭' },
            ]}
            onChange={(v) => setImportField('enabled', v !== 'off')}
          />
        </FormRow>
        <FormRow label={t('pilotDeckConfig.panels.providerHub.documentImportCloud', { defaultValue: '解析策略' })}>
          <Select
            value={importCfg.cloudPreference ?? 'local_first'}
            options={[
              { value: 'local_first', label: '本机优先，扫描件走云端' },
              { value: 'cloud_first', label: '云端优先' },
              { value: 'local_only', label: '仅本机' },
            ]}
            onChange={(v) => setImportField('cloudPreference', v)}
          />
        </FormRow>
        <FormRow
          label={t('pilotDeckConfig.panels.providerHub.documentImportConcurrency', { defaultValue: '并发数' })}
          description="同时解析的附件数，默认 4。"
        >
          <TextInput
            value={String(importCfg.workerConcurrency ?? 4)}
            placeholder="4"
            monospace
            onChange={(v) => setImportField('workerConcurrency', v.trim())}
          />
        </FormRow>
        <FormRow
          label={t('pilotDeckConfig.panels.providerHub.documentImportTimeout', { defaultValue: '单文件超时（毫秒）' })}
        >
          <TextInput
            value={String(importCfg.timeoutMs ?? 30000)}
            placeholder="30000"
            monospace
            onChange={(v) => setImportField('timeoutMs', v.trim())}
          />
        </FormRow>
      </CollapsibleHubBlock>
      </div>
    </>
  );
}

type SkillServiceId = keyof NonNullable<PilotDeckConfig['tools']>['skillServices'];

const SKILL_SERVICE_HUB_ROWS: Array<{
  id: SkillServiceId;
  title: string;
  /** 接入说明（折叠时亦显示为摘要） */
  description: string;
  hint?: string;
}> = [
  {
    id: 'fal',
    title: 'fal.ai',
    description: '接入 fal.ai 云端生成服务，提供 AI 生图、生视频、放大等能力，供 fal-* 创作技能调用。',
    hint: '保存后注入环境变量 FAL_KEY。',
  },
  {
    id: 'typefully',
    title: 'Typefully',
    description: '接入 Typefully 海外社媒排程平台，支持 X、LinkedIn、Threads 等长文撰写与定时发布。',
    hint: '供 mkt-typefully-* 等营销发布技能调用。',
  },
  {
    id: 'videodb',
    title: 'VideoDB',
    description: '接入 VideoDB 视频云，支持视频上传索引、语义搜索、剪辑与多模态理解。',
    hint: '供 video-db-* 视频检索与剪辑技能调用。',
  },
  {
    id: 'music',
    title: '音乐生成',
    description: '接入第三方 AI 音乐/音频生成服务，用于生成 BGM、配乐与短音效。',
    hint: '供 create-ai-music 等音频创作技能调用。',
  },
  {
    id: 'wonda',
    title: 'Wonda',
    description: '接入 Wonda 多模态创作编排服务，支持分镜规划、素材组合与复杂视频工作流。',
    hint: '供 create-wonda 等多模态编排技能调用。',
  },
  {
    id: 'nutrient',
    title: 'Nutrient DWS',
    description: '接入 Nutrient 文档 Web 服务，支持 PDF/DOCX 高保真转换、版面 OCR 与文档导出。',
    hint: '供 office-nutrient 及文档导出高保真路径使用；与上方「文档导出」Nutrient Key 可二选一填写。',
  },
  {
    id: 'sentry',
    title: 'Sentry',
    description: '接入 Sentry 错误与性能监控平台，可查询 Issue、配置告警并协助 SDK 接入排错。',
    hint: '填写 DSN 或组织 Token；供 dev-sentry-* 开发与运维技能调用。',
  },
];

function SkillServiceHubBlock({
  config,
  onChange,
  row,
  googleKeyConfigured,
}: {
  config: PilotDeckConfig;
  onChange: (next: PilotDeckConfig) => void;
  row: (typeof SKILL_SERVICE_HUB_ROWS)[number];
  googleKeyConfigured?: boolean;
}) {
  const { t } = useTranslation('settings');
  const services = config.tools?.skillServices ?? {};
  const configured =
    isConfiguredApiKey(services[row.id]?.apiKey) || hasUsableSecret(services[row.id]?.apiKey);

  const setServiceKey = (value: string) => {
    const next = { ...(config.tools?.skillServices ?? {}) };
    const block = { ...(next[row.id] ?? {}) };
    if (!value.trim()) delete block.apiKey;
    else block.apiKey = value;
    if (Object.keys(block).length === 0) delete next[row.id];
    else next[row.id] = block;
    onChange(patch(config, ['tools', 'skillServices'], next));
  };

  return (
    <div className="border-t border-border px-4 py-3">
      <CollapsibleHubBlock title={row.title} configured={configured} summary={row.description}>
        <p className="text-[11px] leading-relaxed text-foreground/90">{row.description}</p>
        {row.hint ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">{row.hint}</p>
        ) : null}
        {row.id === 'fal' ? (
          googleKeyConfigured ? (
            <p className="text-[11px] text-muted-foreground">
              已检测到 Google 模型池 Key，NanoBanana-PPT 生图可自动继承。
            </p>
          ) : (
            <p className="text-[11px] text-amber-600 dark:text-amber-500">
              未配置 Google 模型池 Key 时，NanoBanana 需在模型池中补充 AIza Key。
            </p>
          )
        ) : null}
        <FormRow
          label={t('pilotDeckConfig.panels.providerHub.apiKey', { defaultValue: 'API Key' })}
          description="与模型池同位写入配置，保存后重启生效。"
        >
          <SecretTextInput
            value={secretDisplayValue(services[row.id]?.apiKey)}
            emptyPlaceholder="sk-…"
            maskedPlaceholder="********"
            monospace
            onChange={setServiceKey}
          />
        </FormRow>
      </CollapsibleHubBlock>
    </div>
  );
}

function ProviderHubSection({ config, onChange }: { config: PilotDeckConfig; onChange: (next: PilotDeckConfig) => void }) {
 const { t } = useTranslation('settings');
 const modelSlices = config.model?.providers;
 const image = config.tools?.image ?? {};
 const video = config.tools?.video ?? {};
 const tts = config.tools?.tts ?? {};
 const speech = config.tools?.speech ?? {};
 const search = config.tools?.webSearch ?? {};
 const yixiaoer = config.tools?.yixiaoer ?? {};
 const effectiveImage = resolveMediaToolFromModelProviders(image, modelSlices, 'image');
 const effectiveVideo = resolveMediaToolFromModelProviders(video, modelSlices, 'video');
 const effectiveTts = resolveMediaToolFromModelProviders(tts, modelSlices, 'tts');
 const effectiveSpeech = resolveMediaToolFromModelProviders(speech, modelSlices, 'speech');
 const inheritedImage = findModelProviderForMedia(modelSlices, image.provider);
 const inheritedVideo = findModelProviderForMedia(modelSlices, video.provider);
 const imageUsesMain =
 Boolean(inheritedImage) && (!hasUsableSecret(image.apiKey) || isConfiguredApiKey(inheritedImage.provider.apiKey));
  const videoUsesMain =
    Boolean(inheritedVideo) && (!hasUsableSecret(video.apiKey) || isConfiguredApiKey(inheritedVideo.provider.apiKey));
  // PD-SAAS-FORK: configured flags drive the collapsed-by-default hub blocks
  const imageConfigured = imageUsesMain || isConfiguredApiKey(image.apiKey) || hasUsableSecret(image.apiKey);
  const videoConfigured = videoUsesMain || isConfiguredApiKey(video.apiKey) || hasUsableSecret(video.apiKey);
  const ttsConfigured =
    isConfiguredApiKey(modelSlices?.qwen?.apiKey) || isConfiguredApiKey(tts.apiKey) || hasUsableSecret(tts.apiKey);
  const speechConfigured =
    isConfiguredApiKey(modelSlices?.qwen?.apiKey) || isConfiguredApiKey(speech.apiKey) || hasUsableSecret(speech.apiKey);
  const yixiaoerConfigured = isConfiguredApiKey(yixiaoer.apiKey) || hasUsableSecret(yixiaoer.apiKey);
  const googlePoolKeyConfigured = isConfiguredApiKey(config.model?.providers?.google?.apiKey);

 const [loadingImageModels, setLoadingImageModels] = useState(false);
 const [loadingVideoModels, setLoadingVideoModels] = useState(false);
 const [imageHint, setImageHint] = useState('');
 const [videoHint, setVideoHint] = useState('');
 const [fetchedImageModelOptions, setFetchedImageModelOptions] = useState<Array<{ value: string; label: string }>>([]);
 const [fetchedVideoModelOptions, setFetchedVideoModelOptions] = useState<Array<{ value: string; label: string }>>([]);

 const imageMediaProvider = (image.provider || effectiveImage?.provider || 'openai-compatible') as MediaProvider;
 const videoMediaProvider = (video.provider || effectiveVideo?.provider || 'openai-compatible') as MediaProvider;
 const imagePoolBinding = useMemo(
 () => findBestModelPoolProviderForKind(modelSlices, 'image'),
 [modelSlices],
 );
 const videoPoolBinding = useMemo(
 () => findBestModelPoolProviderForKind(modelSlices, 'video'),
 [modelSlices],
 );
 const poolImageEntries = useMemo(
 () => listEnabledMediaModelsFromPool(modelSlices, 'image', { allProviders: true }),
 [modelSlices],
 );
 const poolVideoEntries = useMemo(
 () => listEnabledMediaModelsFromPool(modelSlices, 'video', { allProviders: true }),
 [modelSlices],
 );
 const poolImageOptions = useMemo(
 () => buildMediaSelectOptionsFromPool(modelSlices, 'image', { allProviders: true }),
 [modelSlices],
 );
 const poolVideoOptions = useMemo(
 () => buildMediaSelectOptionsFromPool(modelSlices, 'video', { allProviders: true }),
 [modelSlices],
 );
 const mergedImageOptions = useMemo(
 () => mergeMediaSelectOptions(poolImageOptions, fetchedImageModelOptions),
 [poolImageOptions, fetchedImageModelOptions],
 );
 const mergedVideoOptions = useMemo(
 () => mergeMediaSelectOptions(poolVideoOptions, fetchedVideoModelOptions),
 [poolVideoOptions, fetchedVideoModelOptions],
 );

 const imagePoolSummary = useMemo(() => {
 const source = imagePoolBinding ?? inheritedImage ?? findModelProviderForMedia(modelSlices, imageMediaProvider);
 if (!source) return null;
 const providerId = source.providerId;
 const enabled = listAllEnabledModelsFromPoolProvider(modelSlices, source.mediaProvider);
 const byKind = enabled.reduce(
 (acc, item) => {
 const kind = item.kinds.includes('image') ? 'image' : item.kinds[0] || 'chat';
 acc[kind] = (acc[kind] || 0) + 1;
 return acc;
 },
 {} as Record<string, number>,
 );
 return {
 providerId,
 bindProviderId: imagePoolBinding?.providerId,
 enabledTotal: enabled.length,
 imageCount: poolImageEntries.length,
 byKind,
 };
 }, [modelSlices, imageMediaProvider, inheritedImage, imagePoolBinding, poolImageEntries.length]);

 const videoPoolSummary = useMemo(() => {
 const source = videoPoolBinding ?? inheritedVideo ?? findModelProviderForMedia(modelSlices, videoMediaProvider);
 if (!source) return null;
 const providerId = source.providerId;
 const enabled = listAllEnabledModelsFromPoolProvider(modelSlices, source.mediaProvider);
 const byKind = enabled.reduce(
 (acc, item) => {
 const kind = item.kinds.includes('video') ? 'video' : item.kinds[0] || 'chat';
 acc[kind] = (acc[kind] || 0) + 1;
 return acc;
 },
 {} as Record<string, number>,
 );
 return {
 providerId,
 bindProviderId: videoPoolBinding?.providerId,
 enabledTotal: enabled.length,
 videoCount: poolVideoEntries.length,
 byKind,
 };
 }, [modelSlices, videoMediaProvider, inheritedVideo, videoPoolBinding, poolVideoEntries.length]);

 const providerOptions = [
 { value: 'openai-compatible', label: 'OpenAI Compatible' },
 { value: 'google', label: 'Google' },
 { value: 'qwen', label: '通义千问 (DashScope)' },
 { value: 'volcengine', label: '火山方舟 (Volcengine)' },
 { value: 'baidu', label: 'Baidu Qianfan' },
 { value: 'cloud', label: 'Cloud / Proxy' },
 { value: 'azure', label: 'Azure OpenAI' },
 ];

 const setImageField = (field: 'provider' | 'apiKey' | 'baseUrl' | 'model', value: string) => {
 const nextImage = { ...(config.tools?.image ?? {}) };
 if (value === '') {
 delete (nextImage as any)[field];
 } else {
 (nextImage as any)[field] = value;
 }
 onChange(patch(config, ['tools', 'image'], nextImage));
 setImageHint('');
 };

 const setVideoField = (field: 'provider' | 'apiKey' | 'baseUrl' | 'model', value: string) => {
 const nextVideo = { ...(config.tools?.video ?? {}) };
 if (value === '') {
 delete (nextVideo as any)[field];
 } else {
 (nextVideo as any)[field] = value;
 }
 onChange(patch(config, ['tools', 'video'], nextVideo));
 setVideoHint('');
 };

 const setAudioToolField = (
   toolKey: 'tts' | 'speech',
   field: 'provider' | 'apiKey' | 'baseUrl' | 'model',
   value: string,
 ) => {
   const next = { ...(config.tools?.[toolKey] ?? {}) };
   if (value === '') delete (next as any)[field];
   else (next as any)[field] = value;
   onChange(patch(config, ['tools', toolKey], next));
 };

 const applyQwenPoolToAudioTool = (toolKey: 'tts' | 'speech', defaultModel: string) => {
   const poolKey = modelSlices?.qwen?.apiKey;
   if (!isConfiguredApiKey(poolKey)) return;
   const effective = toolKey === 'tts' ? effectiveTts : effectiveSpeech;
   onChange(
     patch(config, ['tools', toolKey], {
       provider: 'qwen',
       model: (toolKey === 'tts' ? tts.model : speech.model) || effective?.model || defaultModel,
     }),
   );
 };

 const setYixiaoerField = (field: 'apiKey' | 'apiUrl', value: string) => {
 const nextYixiaoer = { ...(config.tools?.yixiaoer ?? {}) };
 if (value === '') {
 delete (nextYixiaoer as any)[field];
 } else {
 (nextYixiaoer as any)[field] = value;
 }
 onChange(patch(config, ['tools', 'yixiaoer'], nextYixiaoer));
 };

 const credentialsFor = (kind: 'image' | 'video') => {
 const current = kind === 'image' ? image : video;
 const effective = kind === 'image' ? effectiveImage : effectiveVideo;
 const binding = kind === 'image' ? imagePoolBinding : videoPoolBinding;
 const inherited = kind === 'image' ? inheritedImage : inheritedVideo;
 const mediaProvider = (binding?.mediaProvider ||
 current.provider ||
 effective?.provider ||
 'openai-compatible') as MediaProvider;
 const poolProviderId = binding?.providerId ?? inherited?.providerId;
 return {
 provider: mediaProvider,
 apiKey: (current.apiKey || effective?.apiKey || '').trim(),
 baseUrl: coalesceMediaBaseUrl(current.baseUrl, effective?.baseUrl, mediaProvider),
 model: current.model || effective?.model || '',
 modelPoolProviderId: poolProviderId,
 keyFromPool: Boolean(
 poolProviderId &&
 isConfiguredApiKey(
 modelSlices?.[poolProviderId]?.apiKey ?? inherited?.provider.apiKey,
 ) &&
 !hasUsableSecret(current.apiKey),
 ),
 };
 };

 const applyMainProviderCredentials = (kind: 'image' | 'video') => {
 const effective = kind === 'image' ? effectiveImage : effectiveVideo;
 const binding = kind === 'image' ? imagePoolBinding : videoPoolBinding;
 const poolId = binding?.providerId;
 if (!poolId || !isConfiguredApiKey(modelSlices?.[poolId]?.apiKey)) {
 if (kind === 'image') setImageHint('请先在「模型池」配置通义/火山等供应商的 API Key');
 else setVideoHint('请先在「模型池」配置通义/火山等供应商的 API Key');
 return;
 }
 const next = {
 provider: effective.provider,
 ...(hasUsableSecret(effective.apiKey) ? { apiKey: effective.apiKey } : {}),
 ...(effective.baseUrl ? { baseUrl: effective.baseUrl } : {}),
 ...(effective.model ? { model: effective.model } : {}),
 };
 onChange(patch(config, ['tools', kind], next));
 if (kind === 'image') setImageHint('已写入主模型供应商凭据（可再改模型 ID）');
 else setVideoHint('已写入主模型供应商凭据（可再改模型 ID）');
 };

 const fetchModels = async (kind: 'image' | 'video') => {
 const creds = credentialsFor(kind);
 const provider = creds.provider;
 const poolId = creds.modelPoolProviderId;
 const poolSlice = poolId ? modelSlices?.[poolId] : undefined;
 const poolKey = (poolSlice?.apiKey || '').trim();
 const poolBase = (poolSlice?.url || '').trim();
 const poolConfigured = Boolean(poolId && isConfiguredApiKey(poolSlice?.apiKey));
 const inheritPoolKey = Boolean(poolId && (poolConfigured || hasUsableSecret(poolKey)));
 const apiKey = inheritPoolKey
 ? hasUsableSecret(poolKey) && !poolConfigured
 ? poolKey
 : ''
 : hasUsableSecret(creds.apiKey)
 ? creds.apiKey
 : poolKey;
 const baseUrl = (inheritPoolKey && poolBase) || creds.baseUrl || poolBase || '';
 if (!inheritPoolKey && !hasUsableSecret(apiKey) && !poolConfigured) {
 if (kind === 'image') setImageHint('请先在「模型池」填写 API Key 并保存');
 else setVideoHint('请先在「模型池」填写 API Key 并保存');
 return;
 }

 const setLoading = kind === 'image' ? setLoadingImageModels : setLoadingVideoModels;
 const setHint = kind === 'image' ? setImageHint : setVideoHint;
 setLoading(true);
 setHint('');
 try {
 const kinds = kind === 'image' ? ['image'] : ['video'];
 const res = await authenticatedFetch('/api/providers/list-models', {
 method: 'POST',
 body: JSON.stringify({
 provider,
 apiKey,
 baseUrl,
 kinds,
 ...(poolId ? { modelPoolProviderId: poolId } : {}),
 }),
 });
 const data = await res.json();
 if (!data.ok || !Array.isArray(data.models) || data.models.length === 0) {
 setHint(
 data.error
 || '未获取到模型列表。请先在模型池填写 API Key 并点右上角保存；通义图片模型也可能只在本地补充清单中，可先从下方下拉选择。',
 );
 return;
 }
 const options = data.models
 .map((entry: { id?: string; label?: string; kinds?: string[] }) => formatListModelOption(entry))
 .filter((item: { value: string }) => item.value.length > 0);
 const total = Number.isFinite(data.total) ? data.total : options.length;
 const remoteCount = Number(data.remoteCount) || 0;
 const remoteNote =
 typeof data.hint === 'string' && data.hint.trim()
 ? data.hint
 : remoteCount === 0 && data.supplemented
 ? '远程未返回列表，已使用内置图片模型清单（可正常选用）'
 : '';
 const successPrefix =
 kind === 'image'
 ? `已成功拉取 ${total} 个图片模型`
 : `已成功拉取 ${total} 个视频模型`;
 if (kind === 'image') {
 setFetchedImageModelOptions(options);
 const pick = poolImageOptions[0]?.value || options[0]?.value || creds.model;
 if (!image.model?.trim() && pick) {
 setImageField('model', pick);
 }
 setImageHint(
 remoteNote ? `${successPrefix}。${remoteNote}` : `${successPrefix}（已与模型池合并显示）`,
 );
 } else {
 setFetchedVideoModelOptions(options);
 const pick = poolVideoOptions[0]?.value || options[0]?.value || creds.model;
 if (!video.model?.trim() && pick) {
 setVideoField('model', pick);
 }
 setVideoHint(
 remoteNote ? `${successPrefix}。${remoteNote}` : `${successPrefix}（已与模型池合并显示）`,
 );
 }
 } catch (error) {
 setHint(error instanceof Error ? error.message : String(error));
 } finally {
 setLoading(false);
 }
 };

 return (
 <SettingsSection
 title={t('pilotDeckConfig.panels.providerHub.title', { defaultValue: '能力接入中心' })}
 description={t('pilotDeckConfig.panels.providerHub.description', {
 defaultValue: '出图/出片自动继承「模型池」里已配置的通义、火山等密钥；此处只需选择默认图片/视频模型。',
 })}
 >
 <SettingsCard divided>
        <div className="px-4 py-3">
        <CollapsibleHubBlock
          title={t('pilotDeckConfig.panels.providerHub.imageTitle', { defaultValue: '图片能力（generate_image）' })}
          configured={imageConfigured}
          summary={imagePoolSummary ? `${imagePoolSummary.providerId} · ${poolImageEntries.length || mergedImageOptions.length}` : undefined}
        >
          {imagePoolSummary ? (
 <div className="rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
 <div>
 模型池来源：<span className="font-mono text-foreground">{imagePoolSummary.providerId}</span>
 {imageUsesMain ? ' · API Key / 地址已继承' : ''}
 </div>
 <div className="mt-1">
 已启用 {imagePoolSummary.enabledTotal} 个模型
 {Object.entries(imagePoolSummary.byKind)
 .map(([kind, count]) => `${MODEL_KIND_LABELS[kind] || kind} ${count}`)
 .join(' · ')}
 {poolImageEntries.length > 0
 ? ` → 已从模型池载入 ${poolImageEntries.length} 个图片模型${
 imagePoolSummary.bindProviderId ? `（主供应商 ${imagePoolSummary.bindProviderId}）` : ''
 }`
 : mergedImageOptions.length > 0
 ? ` → 下拉共 ${mergedImageOptions.length} 项（含远程拉取）`
 : ' → 请在模型池「图片」分组启用 qwen-image / Seedream 等，或点拉取列表'}
 </div>
 </div>
 ) : (
 <p className="text-[11px] text-amber-600 dark:text-amber-500">
 请先在「模型池」添加通义/火山等供应商并填写 API Key。
 </p>
 )}
 <FormRow label={t('pilotDeckConfig.panels.providerHub.provider', { defaultValue: 'Provider' })}>
 <Select
 value={image.provider || effectiveImage?.provider || 'openai-compatible'}
 options={providerOptions}
 onChange={(v) => setImageField('provider', v)}
 />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.providerHub.baseUrl', { defaultValue: 'Base URL' })}>
 <TextInput
 value={coalesceMediaBaseUrl(image.baseUrl, effectiveImage?.baseUrl, imageMediaProvider)}
 placeholder={
 imageUsesMain
 ? effectiveImage?.baseUrl || '（继承自模型池）'
 : 'https://dashscope.aliyuncs.com/compatible-mode/v1'
 }
 monospace
 onChange={(v) => setImageField('baseUrl', v)}
 />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.providerHub.apiKey', { defaultValue: 'API Key' })}>
 <SecretTextInput
 value={secretDisplayValue(image.apiKey)}
 emptyPlaceholder={
 imageUsesMain || isConfiguredApiKey(inheritedImage?.provider.apiKey)
 ? '（已配置于模型池，拉取列表将自动使用）'
 : 'sk-...'
 }
 maskedPlaceholder="********"
 monospace
 onChange={(v) => setImageField('apiKey', v)}
 />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.providerHub.model', { defaultValue: 'Model' })}>
 <div className="space-y-2">
 {mergedImageOptions.length > 0 ? (
 <Select
 value={
 image.model ||
 effectiveImage?.model ||
 mergedImageOptions[0]?.value ||
 ''
 }
 options={mergedImageOptions}
 onChange={(v) => setImageField('model', v)}
 />
 ) : (
 <TextInput
 value={image.model ?? effectiveImage?.model ?? ''}
 placeholder={effectiveImage?.model || 'qwen-image-plus'}
 monospace
 onChange={(v) => setImageField('model', v)}
 />
 )}
 {poolImageEntries.length > 0 ? (
 <div>
 <div className="mb-1 text-[10px] text-muted-foreground">模型池已启用（图片类，点击写入上方 Model）：</div>
 <div className="flex flex-wrap gap-1">
 {poolImageEntries.map((entry) => {
 const catalog = findCatalogProviderById(entry.providerId);
 const displayName =
 catalog?.models.find((m) => m.id === entry.id)?.displayName ?? entry.id;
 const active = (image.model || effectiveImage?.model) === entry.id;
 return (
 <button
 key={`${entry.providerId}:${entry.id}`}
 type="button"
 onClick={() => {
 setImageField('model', entry.id);
 if (entry.mediaProvider) setImageField('provider', entry.mediaProvider);
 }}
 className={cn(
 'rounded-md border px-2 py-0.5 text-[10px] transition-colors',
 active
 ? 'border-foreground/40 bg-muted text-foreground'
 : 'border-border bg-muted/40 text-muted-foreground hover:border-foreground/30',
 )}
 >
 {displayName}
 <span className="ml-1 font-mono text-[9px] opacity-60">{entry.providerId}</span>
 </button>
 );
 })}
 </div>
 </div>
 ) : null}
 </div>
 </FormRow>
 <div className="flex flex-wrap items-center gap-2">
 {imageUsesMain ? (
 <Button variant="ghost" size="sm" onClick={() => applyMainProviderCredentials('image')}>
 写入 tools.image
 </Button>
 ) : null}
 <Button variant="outline" size="sm" onClick={() => void fetchModels('image')} disabled={loadingImageModels}>
 {loadingImageModels ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
 {t('pilotDeckConfig.panels.providerHub.fetchModels', { defaultValue: '拉取模型列表' })}
 </Button>
            {imageHint ? <span className="text-xs text-muted-foreground">{imageHint}</span> : null}
          </div>
          <MediaCapabilityFallbackEditor
            title={t('pilotDeckConfig.panels.providerHub.imageFallbackTitle', { defaultValue: '图片降级（2 组）' })}
            tool={image}
            providerOptions={providerOptions}
            modelOptions={mergedImageOptions}
            onChange={(next) => onChange(patch(config, ['tools', 'image'], next))}
          />
        </CollapsibleHubBlock>
        </div>

        <div className="px-4 py-3">
        <CollapsibleHubBlock
          title={t('pilotDeckConfig.panels.providerHub.videoTitle', { defaultValue: '视频能力（generate_video）' })}
          configured={videoConfigured}
          summary={videoPoolSummary ? `${videoPoolSummary.providerId} · ${poolVideoEntries.length || mergedVideoOptions.length}` : undefined}
        >
          {videoPoolSummary ? (
 <div className="rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
 <div>
 模型池来源：<span className="font-mono text-foreground">{videoPoolSummary.providerId}</span>
 {videoUsesMain ? ' · API Key / 地址已继承' : ''}
 </div>
 <div className="mt-1">
 已启用 {videoPoolSummary.enabledTotal} 个模型
 {Object.entries(videoPoolSummary.byKind)
 .map(([kind, count]) => `${MODEL_KIND_LABELS[kind] || kind} ${count}`)
 .join(' · ')}
 {poolVideoEntries.length > 0
 ? ` → 已从模型池载入 ${poolVideoEntries.length} 个视频模型${
 videoPoolSummary.bindProviderId ? `（主供应商 ${videoPoolSummary.bindProviderId}）` : ''
 }`
 : mergedVideoOptions.length > 0
 ? ` → 下拉共 ${mergedVideoOptions.length} 项（含远程拉取）`
 : ' → 请在模型池「视频」分组启用 Seedance / Happy Horse 等，或点拉取列表'}
 </div>
 </div>
 ) : (
 <p className="text-[11px] text-amber-600 dark:text-amber-500">
 请先在「模型池」添加通义/火山等供应商并填写 API Key。
 </p>
 )}
 <FormRow label={t('pilotDeckConfig.panels.providerHub.provider', { defaultValue: 'Provider' })}>
 <Select
 value={video.provider || effectiveVideo?.provider || 'openai-compatible'}
 options={providerOptions}
 onChange={(v) => setVideoField('provider', v)}
 />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.providerHub.baseUrl', { defaultValue: 'Base URL' })}>
 <TextInput
 value={coalesceMediaBaseUrl(video.baseUrl, effectiveVideo?.baseUrl, videoMediaProvider)}
 placeholder={
 videoUsesMain
 ? effectiveVideo?.baseUrl || '（继承自模型池）'
 : 'https://ark.cn-beijing.volces.com/api/v3'
 }
 monospace
 onChange={(v) => setVideoField('baseUrl', v)}
 />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.providerHub.apiKey', { defaultValue: 'API Key' })}>
 <SecretTextInput
 value={secretDisplayValue(video.apiKey)}
 emptyPlaceholder={
 videoUsesMain || isConfiguredApiKey(inheritedVideo?.provider.apiKey)
 ? '（已配置于模型池，拉取列表将自动使用）'
 : 'sk-...'
 }
 maskedPlaceholder="********"
 monospace
 onChange={(v) => setVideoField('apiKey', v)}
 />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.providerHub.model', { defaultValue: 'Model' })}>
 <div className="space-y-2">
 {mergedVideoOptions.length > 0 ? (
 <Select
 value={
 video.model ||
 effectiveVideo?.model ||
 mergedVideoOptions[0]?.value ||
 ''
 }
 options={mergedVideoOptions}
 onChange={(v) => setVideoField('model', v)}
 />
 ) : (
 <TextInput
 value={video.model ?? effectiveVideo?.model ?? ''}
 placeholder={effectiveVideo?.model || 'doubao-seedance-1-5-pro-251215'}
 monospace
 onChange={(v) => setVideoField('model', v)}
 />
 )}
 {poolVideoEntries.length > 0 ? (
 <div>
 <div className="mb-1 text-[10px] text-muted-foreground">模型池已启用（视频类，点击写入上方 Model）：</div>
 <div className="flex flex-wrap gap-1">
 {poolVideoEntries.map((entry) => {
 const catalog = findCatalogProviderById(entry.providerId);
 const displayName =
 catalog?.models.find((m) => m.id === entry.id)?.displayName ?? entry.id;
 const active = (video.model || effectiveVideo?.model) === entry.id;
 return (
 <button
 key={`${entry.providerId}:${entry.id}`}
 type="button"
 onClick={() => {
 setVideoField('model', entry.id);
 if (entry.mediaProvider) setVideoField('provider', entry.mediaProvider);
 }}
 className={cn(
 'rounded-md border px-2 py-0.5 text-[10px] transition-colors',
 active
 ? 'border-foreground/40 bg-muted text-foreground'
 : 'border-border bg-muted/40 text-muted-foreground hover:border-foreground/30',
 )}
 >
 {displayName}
 <span className="ml-1 font-mono text-[9px] opacity-60">{entry.providerId}</span>
 </button>
 );
 })}
 </div>
 </div>
 ) : null}
 </div>
 </FormRow>
 <div className="flex flex-wrap items-center gap-2">
 {videoUsesMain ? (
 <Button variant="ghost" size="sm" onClick={() => applyMainProviderCredentials('video')}>
 写入 tools.video
 </Button>
 ) : null}
 <Button variant="outline" size="sm" onClick={() => void fetchModels('video')} disabled={loadingVideoModels}>
 {loadingVideoModels ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
 {t('pilotDeckConfig.panels.providerHub.fetchModels', { defaultValue: '拉取模型列表' })}
 </Button>
            {videoHint ? <span className="text-xs text-muted-foreground">{videoHint}</span> : null}
          </div>
          <MediaCapabilityFallbackEditor
            title={t('pilotDeckConfig.panels.providerHub.videoFallbackTitle', { defaultValue: '视频降级（2 组）' })}
            tool={video}
            providerOptions={providerOptions}
            modelOptions={mergedVideoOptions}
            onChange={(next) => onChange(patch(config, ['tools', 'video'], next))}
          />
        </CollapsibleHubBlock>
        </div>

        <div className="px-4 py-3">
        <CollapsibleHubBlock title="语音合成（generate_speech）" configured={ttsConfigured}>
          <p className="text-[11px] text-muted-foreground px-4 pb-2">
            默认通义 CosyVoice（cosyvoice-v3-flash），与模型池共用 DashScope Key。
          </p>
          <FormRow label="Provider">
            <Select
              value={tts.provider || effectiveTts?.provider || 'qwen'}
              options={providerOptions}
              onChange={(v) => setAudioToolField('tts', 'provider', v)}
            />
          </FormRow>
          <FormRow label="Model">
            <TextInput
              value={tts.model || effectiveTts?.model || 'cosyvoice-v3-flash'}
              placeholder="cosyvoice-v3-flash"
              monospace
              onChange={(v) => setAudioToolField('tts', 'model', v)}
            />
          </FormRow>
          <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
            <Button variant="ghost" size="sm" onClick={() => applyQwenPoolToAudioTool('tts', 'cosyvoice-v3-flash')}>
              写入 tools.tts
            </Button>
          </div>
          <div className="px-4 pb-3">
            <MediaCapabilityFallbackEditor
              title={t('pilotDeckConfig.panels.providerHub.ttsFallbackTitle', { defaultValue: '语音合成降级（2 组）' })}
              tool={tts}
              providerOptions={providerOptions}
              modelOptions={[]}
              onChange={(next) => onChange(patch(config, ['tools', 'tts'], next))}
            />
          </div>
        </CollapsibleHubBlock>
        </div>

        <div className="px-4 py-3">
        <CollapsibleHubBlock title="语音识别（transcribe_audio）" configured={speechConfigured}>
          <p className="text-[11px] text-muted-foreground px-4 pb-2">
            默认通义 Fun-ASR（fun-asr），与模型池共用 DashScope Key。
          </p>
          <FormRow label="Provider">
            <Select
              value={speech.provider || effectiveSpeech?.provider || 'qwen'}
              options={providerOptions}
              onChange={(v) => setAudioToolField('speech', 'provider', v)}
            />
          </FormRow>
          <FormRow label="Model">
            <TextInput
              value={speech.model || effectiveSpeech?.model || 'fun-asr'}
              placeholder="fun-asr"
              monospace
              onChange={(v) => setAudioToolField('speech', 'model', v)}
            />
          </FormRow>
          <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
            <Button variant="ghost" size="sm" onClick={() => applyQwenPoolToAudioTool('speech', 'fun-asr')}>
              写入 tools.speech
            </Button>
          </div>
          <div className="px-4 pb-3">
            <MediaCapabilityFallbackEditor
              title={t('pilotDeckConfig.panels.providerHub.speechFallbackTitle', { defaultValue: '语音识别降级（2 组）' })}
              tool={speech}
              providerOptions={providerOptions}
              modelOptions={[]}
              onChange={(next) => onChange(patch(config, ['tools', 'speech'], next))}
            />
          </div>
        </CollapsibleHubBlock>
        </div>

        <div className="border-t border-border px-4 py-3">
        <CollapsibleHubBlock
          title={t('pilotDeckConfig.panels.providerHub.yixiaoerTitle', {
            defaultValue: '社媒发布（蚁小二）',
          })}
          configured={yixiaoerConfigured}
        >
          <p className="text-[11px] text-muted-foreground">
 {t('pilotDeckConfig.panels.providerHub.yixiaoerHint', {
 defaultValue:
 '用于国内多平台草稿/发布。与模型池凭据独立；保存后自动注入 YIXIAOER_API_KEY，Agent 可通过 scripts/yixiaoer-api.mjs 调用。',
 })}
 </p>
 <FormRow
 label={t('pilotDeckConfig.panels.providerHub.apiKey', { defaultValue: 'API Key' })}
 description={t('pilotDeckConfig.panels.providerHub.yixiaoerApiKeyDescription', {
 defaultValue: '在蚁小二网页「Open API」获取，勿提交到 Git。',
 })}
 >
 <SecretTextInput
 value={secretDisplayValue(yixiaoer.apiKey)}
 emptyPlaceholder="your-yixiaoer-api-key"
 maskedPlaceholder="********"
 monospace
 onChange={(v) => setYixiaoerField('apiKey', v)}
 />
 </FormRow>
 <FormRow
 label={t('pilotDeckConfig.panels.providerHub.yixiaoerApiUrl', {
 defaultValue: 'API 地址（可选）',
 })}
 description={t('pilotDeckConfig.panels.providerHub.yixiaoerApiUrlDescription', {
 defaultValue: '留空使用默认 https://www.yixiaoer.cn/api',
 })}
 >
            <TextInput
              value={yixiaoer.apiUrl ?? ''}
              placeholder="https://www.yixiaoer.cn/api"
              monospace
              onChange={(v) => setYixiaoerField('apiUrl', v)}
            />
          </FormRow>
        </CollapsibleHubBlock>
        </div>

        {SKILL_SERVICE_HUB_ROWS.map((row) => (
          <SkillServiceHubBlock
            key={row.id}
            config={config}
            onChange={onChange}
            row={row}
            googleKeyConfigured={row.id === 'fal' ? googlePoolKeyConfigured : undefined}
          />
        ))}

        <DocumentToolsHubSection config={config} onChange={onChange} />

 <div className="space-y-2 px-4 py-3 text-xs text-muted-foreground">
 <div className="font-semibold text-foreground">
 {t('pilotDeckConfig.panels.providerHub.searchTitle', { defaultValue: '搜索能力（web_search）' })}
 </div>
 <div>
 {t('pilotDeckConfig.panels.providerHub.searchCurrent', {
 defaultValue: '当前搜索 Provider：{{provider}}',
 provider: search.provider || 'glm',
 })}
 </div>
 <div>
 {t('pilotDeckConfig.panels.providerHub.searchHint', {
 defaultValue: '搜索详细参数仍在「Tools / Web Search」中编辑。',
 })}
 </div>
 </div>
 </SettingsCard>
 </SettingsSection>
 );
}

function ModelPricingEditor({ config, onChange }: { config: PilotDeckConfig; onChange: (next: PilotDeckConfig) => void }) {
 const { t } = useTranslation('settings');
 const pricing = config.router?.stats?.modelPricing ?? {};
 const keys = Object.keys(pricing);
 const [newKey, setNewKey] = useState('');

 const setPricing = (key: string, field: 'input' | 'output' | 'cacheRead', value: number | undefined) => {
 const entry = pricing[key] ?? {};
 onChange(patch(config, ['router', 'stats', 'modelPricing', key], { ...entry, [field]: value }));
 };
 const removePricing = (key: string) => {
 const next = { ...pricing };
 delete next[key];
 onChange(patch(config, ['router', 'stats', 'modelPricing'], next));
 };
 const addPricing = () => {
 const key = newKey.trim();
 if (!key || pricing[key]) return;
 onChange(patch(config, ['router', 'stats', 'modelPricing', key], { input: 0, output: 0 }));
 setNewKey('');
 };

 return (
 <SettingsCard className="space-y-3 p-4">
 <div>
 <div className="text-sm font-semibold text-foreground">{t('pilotDeckConfig.panels.router.pricing.title')}</div>
 <div className="mt-0.5 text-xs text-muted-foreground">
 {t('pilotDeckConfig.panels.router.pricing.description')}
 </div>
 </div>

 {keys.length === 0 && (
 <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
 {t('pilotDeckConfig.panels.router.pricing.empty')}
 </div>
 )}

 {keys.map((key) => {
 const entry = pricing[key] ?? {};
 return (
 <div key={key} className="space-y-2 rounded-lg border border-border bg-background/50 p-3">
 <div className="flex items-center gap-2">
 <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs text-foreground">{key}</code>
 <button
 type="button"
 onClick={() => removePricing(key)}
 className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
 title={t('pilotDeckConfig.actions.remove')}
 >
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </div>
 <div className="grid grid-cols-3 gap-2">
 <label className="text-xs text-muted-foreground">
 <span className="mb-1 block">{t('pilotDeckConfig.panels.router.pricing.inputPerM')}</span>
 <NumberInput value={entry.input} placeholder="0.50" onChange={(v) => setPricing(key, 'input', v)} />
 </label>
 <label className="text-xs text-muted-foreground">
 <span className="mb-1 block">{t('pilotDeckConfig.panels.router.pricing.outputPerM')}</span>
 <NumberInput value={entry.output} placeholder="1.50" onChange={(v) => setPricing(key, 'output', v)} />
 </label>
 <label className="text-xs text-muted-foreground">
 <span className="mb-1 block">{t('pilotDeckConfig.panels.router.pricing.cachePerM')}</span>
 <NumberInput value={entry.cacheRead} placeholder="0" onChange={(v) => setPricing(key, 'cacheRead', v)} />
 </label>
 </div>
 </div>
 );
 })}

 <div className="border-t border-border pt-3">
 <div className="mb-2 text-xs font-medium text-foreground">{t('pilotDeckConfig.panels.router.pricing.addTitle')}</div>
 <div className="flex items-center gap-2">
 <input
 value={newKey}
 onChange={(e) => setNewKey(e.target.value)}
 placeholder="provider/model-name"
 className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
 onKeyDown={(e) => { if (e.key === 'Enter' && !isImeEnterEvent(e)) addPricing(); }}
 />
 <Button variant="outline" size="sm" className="shrink-0" onClick={addPricing} disabled={!newKey.trim()}>
 <Plus className="mr-1 h-3.5 w-3.5" />
 {t('pilotDeckConfig.panels.router.pricing.add')}
 </Button>
 </div>
 </div>
 </SettingsCard>
 );
}

function RouterScenarioEditor({ config, onChange }: { config: PilotDeckConfig; onChange: (next: PilotDeckConfig) => void }) {
 const { t } = useTranslation('settings');
 const scenarios = config.router?.scenarios ?? {};
 const entries = Object.entries(scenarios);
 const modelOpts = buildModelRefOptions(config);
 const [newKey, setNewKey] = useState('');

 const setScenario = (key: string, value: string) =>
 onChange(patch(ensureModelRefConfigured(config, value), ['router', 'scenarios', key], value));
 const removeScenario = (key: string) => {
 const next = { ...scenarios };
 delete next[key];
 onChange(patch(config, ['router', 'scenarios'], next));
 };
 const addScenario = () => {
 const key = newKey.trim();
 if (!key || scenarios[key]) return;
 const value = modelOpts[0]?.value ?? '';
 onChange(patch(ensureModelRefConfigured(config, value), ['router', 'scenarios', key], value));
 setNewKey('');
 };

 return (
 <SettingsCard className="space-y-3 p-4">
 <div>
 <div className="text-sm font-semibold text-foreground">{t('pilotDeckConfig.panels.router.scenarios.title')}</div>
 <div className="mt-0.5 text-xs text-muted-foreground">
 {t('pilotDeckConfig.panels.router.scenarios.description')}
 </div>
 </div>
 {entries.length === 0 && (
 <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
 {t('pilotDeckConfig.panels.router.scenarios.empty')}
 </div>
 )}
 {entries.map(([key, model]) => (
 <div key={key} className="flex items-center gap-2">
 <code className="w-28 shrink-0 truncate rounded bg-muted px-2 py-1.5 text-xs text-foreground">{key}</code>
 <div className="min-w-0 flex-1">
 <ModelRefInput value={model} options={modelOpts} onChange={(v) => setScenario(key, v)} />
 </div>
 <button
 type="button"
 onClick={() => removeScenario(key)}
 className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
 title={t('pilotDeckConfig.actions.remove')}
 >
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </div>
 ))}
 <div className="border-t border-border pt-3">
 <div className="flex items-center gap-2">
 <input
 value={newKey}
 onChange={(e) => setNewKey(e.target.value)}
 placeholder="scenario name"
 className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
 onKeyDown={(e) => { if (e.key === 'Enter' && !isImeEnterEvent(e)) addScenario(); }}
 />
 <Button variant="outline" size="sm" className="shrink-0" onClick={addScenario} disabled={!newKey.trim()}>
 <Plus className="mr-1 h-3.5 w-3.5" />
 {t('pilotDeckConfig.panels.router.scenarios.add')}
 </Button>
 </div>
 </div>
 </SettingsCard>
 );
}

function RouterFallbackEditor({ config, onChange }: { config: PilotDeckConfig; onChange: (next: PilotDeckConfig) => void }) {
 const { t } = useTranslation('settings');
 const fallback = config.router?.fallback ?? {};
 const entries = Object.entries(fallback);
 const modelOpts = buildModelRefOptions(config);
 const [newKey, setNewKey] = useState('');

 const setChain = (scenario: string, chain: string[]) =>
 onChange(patch(ensureModelRefsConfigured(config, chain), ['router', 'fallback', scenario], chain));
 const removeChain = (scenario: string) => {
 const next = { ...fallback };
 delete next[scenario];
 onChange(patch(config, ['router', 'fallback'], next));
 };
 const addChain = () => {
 const key = newKey.trim();
 if (!key || fallback[key]) return;
 const value = modelOpts[0]?.value ?? '';
 onChange(patch(ensureModelRefConfigured(config, value), ['router', 'fallback', key], [value]));
 setNewKey('');
 };

 return (
 <SettingsCard className="space-y-3 p-4">
 <div>
 <div className="text-sm font-semibold text-foreground">{t('pilotDeckConfig.panels.router.fallback.title')}</div>
 <div className="mt-0.5 text-xs text-muted-foreground">
 {t('pilotDeckConfig.panels.router.fallback.description')}
 </div>
 </div>
 {entries.length === 0 && (
 <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
 {t('pilotDeckConfig.panels.router.fallback.empty')}
 </div>
 )}
 {entries.map(([scenario, chain]) => (
 <div key={scenario} className="space-y-2 rounded-lg border border-border bg-background/50 p-3">
 <div className="flex items-center gap-2">
 <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs text-foreground">{scenario}</code>
 <button
 type="button"
 onClick={() => removeChain(scenario)}
 className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
 title={t('pilotDeckConfig.actions.remove')}
 >
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </div>
 <div className="space-y-1.5">
 {(chain ?? []).map((model, idx) => (
 <div key={idx} className="flex items-center gap-2">
 <span className="w-5 shrink-0 text-right text-[10px] font-semibold text-muted-foreground">{idx + 1}</span>
 <div className="min-w-0 flex-1">
 <ModelRefInput
 value={model}
 options={modelOpts}
 onChange={(v) => {
 const next = [...chain];
 next[idx] = v;
 setChain(scenario, next);
 }}
 />
 </div>
 <button
 type="button"
 onClick={() => setChain(scenario, chain.filter((_, i) => i !== idx))}
 className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
 title={t('pilotDeckConfig.actions.removeModel')}
 >
 <Trash2 className="h-3 w-3" />
 </button>
 </div>
 ))}
 <button
 type="button"
 onClick={() => setChain(scenario, [...(chain ?? []), modelOpts[0]?.value ?? ''])}
 className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
 >
 <Plus className="h-3 w-3" />
 {t('pilotDeckConfig.panels.router.fallback.addModel')}
 </button>
 </div>
 </div>
 ))}
 <div className="border-t border-border pt-3">
 <div className="flex items-center gap-2">
 <input
 value={newKey}
 onChange={(e) => setNewKey(e.target.value)}
 placeholder="scenario name (e.g. default)"
 className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
 onKeyDown={(e) => { if (e.key === 'Enter' && !isImeEnterEvent(e)) addChain(); }}
 />
 <Button variant="outline" size="sm" className="shrink-0" onClick={addChain} disabled={!newKey.trim()}>
 <Plus className="mr-1 h-3.5 w-3.5" />
 {t('pilotDeckConfig.panels.router.fallback.add')}
 </Button>
 </div>
 </div>
 </SettingsCard>
 );
}

const ROUTER_TIER_KEYS = ['simple', 'medium', 'complex', 'reasoning'] as const;
type RouterTierKey = typeof ROUTER_TIER_KEYS[number];

const DEFAULT_TIERS: Record<RouterTierKey, { description: string }> = {
 simple: { description: 'Simple greetings, confirmations, single-step Q&A, trivial file writes, remembering rules' },
 medium: { description: 'Single tool call, short text generation, 1-2 file read/write, code generation' },
 complex: { description: 'Needs sub-agent orchestration: parallel workstreams, delegation to specialized agents' },
 reasoning: { description: 'Deep single-agent work: multi-file operations, data analysis, multi-step workflows, web research, structured reports from many sources' },
};

const DEFAULT_RULES: string[] = [
 'complex is ONLY for tasks that need sub-agent orchestration or parallel delegation — do NOT use it for single-agent multi-step work',
 'Multi-file operations, data analysis, and multi-step workflows without orchestration should be reasoning',
 'Simple file creation (1-2 files) or single code generation is medium',
 'Trivial greetings, confirmations, remembering rules, or reading one file and answering a short question is simple',
];

function TokenSaverTierEditor({ config, onChange }: { config: PilotDeckConfig; onChange: (next: PilotDeckConfig) => void }) {
 const { t } = useTranslation('settings');
 const tiers = config.router?.tokenSaver?.tiers ?? {};
 const entries = Object.entries(tiers);
 const modelOpts = buildModelRefOptions(config);
 const [newKey, setNewKey] = useState('');

 const setTier = (key: string, field: 'model' | 'description', value: string) =>
 onChange(patch(
 field === 'model' ? ensureModelRefConfigured(config, value) : config,
 ['router', 'tokenSaver', 'tiers', key, field],
 value,
 ));
 const removeTier = (key: string) => {
 const next = { ...tiers };
 delete next[key];
 onChange(patch(config, ['router', 'tokenSaver', 'tiers'], next));
 };
 const addTier = () => {
 const key = newKey.trim();
 if (!key || tiers[key]) return;
 const preset = DEFAULT_TIERS[key];
 const model = modelOpts[0]?.value ?? '';
 onChange(patch(ensureModelRefConfigured(config, model), ['router', 'tokenSaver', 'tiers', key], {
 model,
 description: preset?.description ?? '',
 }));
 setNewKey('');
 };

 return (
 <div className="space-y-3">
 <div>
 <div className="text-xs font-semibold text-foreground">{t('pilotDeckConfig.panels.router.tiers.title')}</div>
 <div className="mt-0.5 text-[11px] text-muted-foreground">
 {t('pilotDeckConfig.panels.router.tiers.description')}
 </div>
 </div>
 {entries.map(([key, tier]) => (
 <div key={key} className="space-y-2 rounded-lg border border-border bg-background/50 p-3">
 <div className="flex items-center gap-2">
 <code className="shrink-0 rounded bg-muted px-2 py-1 text-xs font-semibold text-foreground">{key}</code>
 <div className="min-w-0 flex-1">
 <ModelRefInput value={tier.model ?? ''} options={modelOpts} onChange={(v) => setTier(key, 'model', v)} />
 </div>
 <button
 type="button"
 onClick={() => removeTier(key)}
 className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
 title={t('pilotDeckConfig.actions.remove')}
 >
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </div>
 <textarea
 value={tier.description ?? ''}
 onChange={(e) => setTier(key, 'description', e.target.value)}
 placeholder={t('pilotDeckConfig.panels.router.tiers.placeholder')}
 rows={2}
 className="w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
 />
 </div>
 ))}
 <div className="border-t border-border pt-3">
 <div className="flex items-center gap-2">
 <input
 value={newKey}
 onChange={(e) => setNewKey(e.target.value)}
 placeholder="tier name (e.g. simple, medium, complex)"
 className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
 onKeyDown={(e) => { if (e.key === 'Enter' && !isImeEnterEvent(e)) addTier(); }}
 />
 <Button variant="outline" size="sm" className="shrink-0" onClick={addTier} disabled={!newKey.trim()}>
 <Plus className="mr-1 h-3.5 w-3.5" />
 {t('pilotDeckConfig.panels.router.tiers.add')}
 </Button>
 </div>
 </div>
 </div>
 );
}

function TokenSaverRulesEditor({ config, onChange }: { config: PilotDeckConfig; onChange: (next: PilotDeckConfig) => void }) {
 const { t } = useTranslation('settings');
 const rules = config.router?.tokenSaver?.rules ?? [];
 const [newRule, setNewRule] = useState('');

 const setRule = (idx: number, value: string) => {
 const next = [...rules];
 next[idx] = value;
 onChange(patch(config, ['router', 'tokenSaver', 'rules'], next));
 };
 const removeRule = (idx: number) =>
 onChange(patch(config, ['router', 'tokenSaver', 'rules'], rules.filter((_, i) => i !== idx)));
 const addRule = () => {
 const r = newRule.trim();
 if (!r) return;
 onChange(patch(config, ['router', 'tokenSaver', 'rules'], [...rules, r]));
 setNewRule('');
 };

 return (
 <div className="space-y-2">
 <div className="text-xs font-semibold text-foreground">{t('pilotDeckConfig.panels.router.rules.title')}</div>
 {rules.length === 0 && (
 <div className="rounded-md border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
 {t('pilotDeckConfig.panels.router.rules.empty')}
 </div>
 )}
 {rules.map((rule, idx) => (
 <div key={idx} className="flex items-start gap-2">
 <textarea
 value={rule}
 onChange={(e) => setRule(idx, e.target.value)}
 rows={2}
 className="min-w-0 flex-1 resize-y rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
 />
 <button
 type="button"
 onClick={() => removeRule(idx)}
 className="mt-1 shrink-0 rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
 title={t('pilotDeckConfig.actions.remove')}
 >
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </div>
 ))}
 <div className="flex items-center gap-2">
 <input
 value={newRule}
 onChange={(e) => setNewRule(e.target.value)}
 placeholder={t('pilotDeckConfig.panels.router.rules.placeholder')}
 className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
 onKeyDown={(e) => { if (e.key === 'Enter' && !isImeEnterEvent(e)) addRule(); }}
 />
 <Button variant="outline" size="sm" className="shrink-0" onClick={addRule} disabled={!newRule.trim()}>
 <Plus className="mr-1 h-3.5 w-3.5" />
 {t('pilotDeckConfig.panels.router.rules.add')}
 </Button>
 </div>
 </div>
 );
}

function RouterLevelEditor({ config, onChange }: { config: PilotDeckConfig; onChange: (next: PilotDeckConfig) => void }) {
 const { t } = useTranslation('settings');
 const modelOpts = buildModelRefOptions(config);
 const defaultValue = config.router?.scenarios?.default ?? '';
 const judgeValue = config.router?.tokenSaver?.judge ?? '';
 const tiers = config.router?.tokenSaver?.tiers ?? {};

 const setDefault = (value: string) => {
 let next = patch(ensureModelRefConfigured(config, value), ['router', 'scenarios', 'default'], value);
 const fallbackDefault = config.router?.fallback?.default ?? [];
 if (
 fallbackDefault.length === 0 ||
 (fallbackDefault.length === 1 && fallbackDefault[0] === defaultValue)
 ) {
 next = patch(next, ['router', 'fallback', 'default'], value ? [value] : []);
 }
 onChange(next);
 };

 const setTierModel = (key: RouterTierKey, model: string) => {
 const existing = tiers[key] ?? {};
 onChange(patch(ensureModelRefConfigured(config, model), ['router', 'tokenSaver', 'tiers', key], {
 ...existing,
 model,
 description: existing.description ?? DEFAULT_TIERS[key].description,
 }));
 };

 const setJudgeModel = (value: string) => {
 onChange(patch(ensureModelRefConfigured(config, value), ['router', 'tokenSaver', 'judge'], value));
 };

 return (
 <SettingsCard divided>
 <FormRow
 label={t('pilotDeckConfig.panels.router.levels.default.label')}
 description={t('pilotDeckConfig.panels.router.levels.default.description')}
 >
 <ModelRefInput
 value={defaultValue}
 options={modelOpts}
 placeholder={t('pilotDeckConfig.panels.router.levels.modelPlaceholder')}
 onChange={setDefault}
 />
 </FormRow>

 <FormRow
 label={t('pilotDeckConfig.panels.router.levels.judge.label')}
 description={t('pilotDeckConfig.panels.router.levels.judge.description')}
 >
 <ModelRefInput
 value={judgeValue}
 options={modelOpts}
 placeholder={t('pilotDeckConfig.panels.router.levels.modelPlaceholder')}
 onChange={setJudgeModel}
 />
 </FormRow>

 {ROUTER_TIER_KEYS.map((key) => (
 <FormRow
 key={key}
 label={t(`pilotDeckConfig.panels.router.levels.${key}.label`)}
 description={t(`pilotDeckConfig.panels.router.levels.${key}.description`)}
 >
 <ModelRefInput
 value={tiers[key]?.model ?? ''}
 options={modelOpts}
 placeholder={t('pilotDeckConfig.panels.router.levels.modelPlaceholder')}
 onChange={(v) => setTierModel(key, v)}
 />
 </FormRow>
 ))}
 </SettingsCard>
 );
}

function RouterSection({ config, onChange }: { config: PilotDeckConfig; onChange: (next: PilotDeckConfig) => void }) {
 const { t } = useTranslation('settings');
 const [showAdvanced, setShowAdvanced] = useState(false);
 const r = config.router ?? {};
 const enabled = r.enabled !== false;
 const modelOpts = buildModelRefOptions(config);

 const ts = r.tokenSaver ?? {};
 const ao = r.autoOrchestrate ?? {};
 const zr = r.zeroUsageRetry ?? {};
 const statsEnabled = r.stats?.enabled !== false;
 const zeroUsageEnabled = zr.enabled !== false;
 const tokenSaverEnabled = ts.enabled !== false;
 const autoOrchestrateEnabled = ao.enabled !== false;

 const availableTierNames = Object.keys(ts.tiers ?? {});

 const getDefaultModel = (base: PilotDeckConfig) =>
 (typeof base.router?.scenarios?.default === 'string' && base.router.scenarios.default.trim())
 || (typeof base.agent?.model === 'string' && base.agent.model.trim())
 || modelOpts[0]?.value
 || '';

 const seedRouterDefaults = (base: PilotDeckConfig) => {
 let next = base;
 const defaultModel = getDefaultModel(next);
 next = ensureModelRefConfigured(next, defaultModel);

 if (defaultModel && !next.router?.scenarios?.default) {
 next = patch(next, ['router', 'scenarios', 'default'], defaultModel);
 }
 if (defaultModel && !(next.router?.fallback?.default?.length)) {
 next = patch(next, ['router', 'fallback', 'default'], [defaultModel]);
 }
 if (next.router?.zeroUsageRetry?.enabled !== true) {
 next = patch(next, ['router', 'zeroUsageRetry', 'enabled'], true);
 }
 if (next.router?.zeroUsageRetry?.maxAttempts == null) {
 next = patch(next, ['router', 'zeroUsageRetry', 'maxAttempts'], 2);
 }
 if (next.router?.tokenSaver?.enabled !== true) {
 next = patch(next, ['router', 'tokenSaver', 'enabled'], true);
 }
 if (defaultModel && !next.router?.tokenSaver?.judge) {
 next = patch(next, ['router', 'tokenSaver', 'judge'], defaultModel);
 }
 if (!next.router?.tokenSaver?.defaultTier) {
 next = patch(next, ['router', 'tokenSaver', 'defaultTier'], 'medium');
 }
 if (!next.router?.tokenSaver?.judgeTimeoutMs) {
 next = patch(next, ['router', 'tokenSaver', 'judgeTimeoutMs'], 15000);
 }
 for (const key of ROUTER_TIER_KEYS) {
 const existing = next.router?.tokenSaver?.tiers?.[key] ?? {};
 if (!existing.model || !existing.description) {
 next = patch(next, ['router', 'tokenSaver', 'tiers', key], {
 ...existing,
 model: existing.model ?? defaultModel,
 description: existing.description ?? DEFAULT_TIERS[key].description,
 });
 }
 }
 if ((next.router?.tokenSaver?.rules ?? []).length === 0) {
 next = patch(next, ['router', 'tokenSaver', 'rules'], [...DEFAULT_RULES]);
 }
 if (next.router?.autoOrchestrate?.enabled !== true) {
 next = patch(next, ['router', 'autoOrchestrate', 'enabled'], true);
 }
 if ((next.router?.autoOrchestrate?.triggerTiers ?? []).length === 0) {
 next = patch(next, ['router', 'autoOrchestrate', 'triggerTiers'], ['complex']);
 }
 if (next.router?.autoOrchestrate?.slimSystemPrompt == null) {
 next = patch(next, ['router', 'autoOrchestrate', 'slimSystemPrompt'], true);
 }
 if (next.router?.stats?.enabled !== true) {
 next = patch(next, ['router', 'stats', 'enabled'], true);
 }

 return next;
 };

 return (
 <SettingsSection
 title={t('pilotDeckConfig.panels.router.title')}
 description={t('pilotDeckConfig.panels.router.description')}
 >
 <div className="space-y-4">
 {/* ── Master toggle ─────────────────────────────────────────── */}
 <SettingsCard divided>
 <SettingsRow
 label={t('pilotDeckConfig.panels.router.enabled.label')}
 description={t('pilotDeckConfig.panels.router.enabled.description')}
 >
 <SettingsToggle
 checked={enabled}
 ariaLabel={t('pilotDeckConfig.panels.router.enabled.label')}
 onChange={(v) => {
 let next = patch(config, ['router', 'enabled'], v);
 if (v) {
 next = seedRouterDefaults(next);
 }
 onChange(next);
 }}
 />
 </SettingsRow>
 </SettingsCard>

 {enabled && (
 <>
 <RouterLevelEditor config={config} onChange={onChange} />

 <button
 type="button"
 onClick={() => setShowAdvanced((next) => !next)}
 aria-expanded={showAdvanced}
 className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium leading-5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
 >
 <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showAdvanced && 'rotate-180')} />
 {t('pilotDeckConfig.panels.router.advancedToggle')}
 </button>

 {showAdvanced && (
 <>
 {/* ── Fallback chains ────────────────────────────────────── */}
 <RouterFallbackEditor config={config} onChange={onChange} />

 {/* ── Zero-usage retry ───────────────────────────────────── */}
 <SettingsCard divided>
 <SettingsRow
 label={t('pilotDeckConfig.panels.router.zeroUsageRetry.label')}
 description={t('pilotDeckConfig.panels.router.zeroUsageRetry.description')}
 >
 <SettingsToggle
 checked={zeroUsageEnabled}
 ariaLabel={t('pilotDeckConfig.panels.router.zeroUsageRetry.label')}
 onChange={(v) => onChange(patch(config, ['router', 'zeroUsageRetry', 'enabled'], v))}
 />
 </SettingsRow>
 {zeroUsageEnabled && (
 <FormRow label={t('pilotDeckConfig.panels.router.zeroUsageRetry.maxAttempts.label')} description={t('pilotDeckConfig.panels.router.zeroUsageRetry.maxAttempts.description')}>
 <NumberInput
 value={zr.maxAttempts}
 placeholder="2"
 onChange={(v) => onChange(patch(config, ['router', 'zeroUsageRetry', 'maxAttempts'], v))}
 />
 </FormRow>
 )}
 </SettingsCard>

 {/* ── TokenSaver ─────────────────────────────────────────── */}
 <SettingsCard className="space-y-4 p-4">
 <div className="flex items-center justify-between">
 <div>
 <div className="text-sm font-semibold text-foreground">{t('pilotDeckConfig.panels.router.tokenSaver.title')}</div>
 <div className="mt-0.5 text-xs text-muted-foreground">
 {t('pilotDeckConfig.panels.router.tokenSaver.description')}
 </div>
 </div>
 <SettingsToggle
 checked={tokenSaverEnabled}
 ariaLabel={t('pilotDeckConfig.panels.router.tokenSaver.title')}
 onChange={(v) => {
 let next = patch(config, ['router', 'tokenSaver', 'enabled'], v);
 if (v) {
 next = seedRouterDefaults(next);
 }
 onChange(next);
 }}
 />
 </div>

 {tokenSaverEnabled && (
 <div className="space-y-4 border-t border-border pt-4">
 <div>
 <label className="mb-1 block text-xs font-medium text-foreground">{t('pilotDeckConfig.panels.router.tokenSaver.defaultTier')}</label>
 <Select
 value={ts.defaultTier ?? 'medium'}
 options={
 availableTierNames.length > 0
 ? availableTierNames.map((t) => ({ value: t, label: t }))
 : ROUTER_TIER_KEYS.map((t) => ({ value: t, label: t }))
 }
 onChange={(v) => onChange(patch(config, ['router', 'tokenSaver', 'defaultTier'], v))}
 />
 </div>
 <FormRow label={t('pilotDeckConfig.panels.router.tokenSaver.judgeTimeout.label')} description={t('pilotDeckConfig.panels.router.tokenSaver.judgeTimeout.description')}>
 <NumberInput
 value={ts.judgeTimeoutMs}
 placeholder="15000"
 onChange={(v) => onChange(patch(config, ['router', 'tokenSaver', 'judgeTimeoutMs'], v))}
 />
 </FormRow>
 <FormRow label={t('pilotDeckConfig.panels.router.tokenSaver.subagentPolicy.label')} description={t('pilotDeckConfig.panels.router.tokenSaver.subagentPolicy.description')}>
 <Select
 value={ts.subagent?.policy ?? 'judge'}
 options={[
 { value: 'judge', label: 'judge' },
 { value: 'skip', label: 'skip' },
 ]}
 onChange={(v) => onChange(patch(config, ['router', 'tokenSaver', 'subagent', 'policy'], v))}
 />
 </FormRow>

 <TokenSaverTierEditor config={config} onChange={onChange} />
 <TokenSaverRulesEditor config={config} onChange={onChange} />
 </div>
 )}
 </SettingsCard>

 {/* ── Auto-orchestrate ───────────────────────────────────── */}
 <SettingsCard className="space-y-4 p-4">
 <div className="flex items-center justify-between">
 <div>
 <div className="text-sm font-semibold text-foreground">{t('pilotDeckConfig.panels.router.autoOrchestrate.title')}</div>
 <div className="mt-0.5 text-xs text-muted-foreground">
 {t('pilotDeckConfig.panels.router.autoOrchestrate.description')}
 </div>
 </div>
 <SettingsToggle
 checked={autoOrchestrateEnabled}
 ariaLabel={t('pilotDeckConfig.panels.router.autoOrchestrate.title')}
 onChange={(v) => onChange(patch(config, ['router', 'autoOrchestrate', 'enabled'], v))}
 />
 </div>

 {autoOrchestrateEnabled && (
 <div className="space-y-3 border-t border-border pt-4">
 <div>
 <label className="mb-1 block text-xs font-medium text-foreground">{t('pilotDeckConfig.panels.router.autoOrchestrate.triggerTiers')}</label>
 <div className="mt-1 flex flex-wrap gap-2">
 {(availableTierNames.length > 0 ? availableTierNames : [...ROUTER_TIER_KEYS]).map((tier) => {
 const active = (ao.triggerTiers ?? ['complex']).includes(tier);
 return (
 <button
 key={tier}
 type="button"
 className={cn(
 'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
 active
 ? 'border-primary bg-primary/10 text-primary'
 : 'border-border bg-background text-muted-foreground hover:bg-muted',
 )}
 onClick={() => {
 const prev = ao.triggerTiers ?? ['complex'];
 const next = active ? prev.filter((t) => t !== tier) : [...prev, tier];
 onChange(patch(config, ['router', 'autoOrchestrate', 'triggerTiers'], next));
 }}
 >
 {tier}
 </button>
 );
 })}
 </div>
 </div>
 <SettingsRow
 label={t('pilotDeckConfig.panels.router.autoOrchestrate.slimPrompt.label')}
 description={t('pilotDeckConfig.panels.router.autoOrchestrate.slimPrompt.description')}
 >
 <SettingsToggle
 checked={ao.slimSystemPrompt !== false}
 ariaLabel={t('pilotDeckConfig.panels.router.autoOrchestrate.slimPrompt.label')}
 onChange={(v) => onChange(patch(config, ['router', 'autoOrchestrate', 'slimSystemPrompt'], v))}
 />
 </SettingsRow>
 </div>
 )}
 </SettingsCard>

 {/* ── Stats ──────────────────────────────────────────────── */}
 <SettingsCard divided>
 <SettingsRow
 label={t('pilotDeckConfig.panels.router.stats.label')}
 description={t('pilotDeckConfig.panels.router.stats.description')}
 >
 <SettingsToggle
 checked={statsEnabled}
 ariaLabel={t('pilotDeckConfig.panels.router.stats.label')}
 onChange={(v) => onChange(patch(config, ['router', 'stats', 'enabled'], v))}
 />
 </SettingsRow>
 </SettingsCard>

 {statsEnabled && <ModelPricingEditor config={config} onChange={onChange} />}
 </>
 )}
 </>
 )}
 </div>
 </SettingsSection>
 );
}

function GatewaySection({ config, onChange }: { config: PilotDeckConfig; onChange: (next: PilotDeckConfig) => void }) {
 const { t } = useTranslation('settings');
 const g = config.gateway ?? {};
 return (
 <SettingsSection
 title={t('pilotDeckConfig.panels.gateway.title')}
 description={t('pilotDeckConfig.panels.gateway.description')}
 >
 <SettingsCard divided>
 <SettingsRow label={t('pilotDeckConfig.panels.gateway.enabled.label')} description={t('pilotDeckConfig.panels.gateway.enabled.description')}>
 <SettingsToggle
 checked={Boolean(g.enabled)}
 ariaLabel={t('pilotDeckConfig.panels.gateway.enabled.label')}
 onChange={(v) => onChange(patch(config, ['gateway', 'enabled'], v))}
 />
 </SettingsRow>
 {g.enabled && (
 <FormRow label={t('pilotDeckConfig.panels.gateway.home.label')} description={t('pilotDeckConfig.panels.gateway.home.description')}>
 <TextInput value={g.home} placeholder="~/.pilotdeck/gateway" monospace onChange={(v) => onChange(patch(config, ['gateway', 'home'], v))} />
 </FormRow>
 )}
 </SettingsCard>
 </SettingsSection>
 );
}

function ConfigSectionGroup({ title, description, children }: { title: ReactNode; description?: ReactNode; children: ReactNode }) {
 return (
 <section className="space-y-2.5">
 <div>
 <h3 className="text-[15px] font-semibold leading-5 text-foreground">{title}</h3>
 {description && (
 <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
 )}
 </div>
 {children}
 </section>
 );
}

function ConfigGroupedCard({ children, divided }: { children: ReactNode; divided?: boolean }) {
 return (
 <div
 className={cn(
 'overflow-hidden rounded-lg border border-border bg-card/60',
 divided && 'divide-y divide-border',
 )}
 >
 {children}
 </div>
 );
}

function ConfigNavigationRow({
 section,
 onSelect,
}: {
 section: SectionId;
 onSelect: (section: SectionId) => void;
}) {
 const { t } = useTranslation('settings');
 const Icon = SECTION_ICONS[section];
 const meta = SECTIONS.find((item) => item.id === section);
 if (!meta) return null;

 return (
 <button
 type="button"
 onClick={() => onSelect(section)}
 className="flex min-h-[66px] w-full items-center gap-3.5 px-5 py-3 text-left transition-colors hover:bg-accent/35 active:bg-accent/50"
 >
 <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
 <div className="min-w-0 flex-1">
 <div className="text-[15px] font-semibold leading-5 text-foreground">
 {t(`pilotDeckConfig.sections.${meta.labelKey}.label`)}
 </div>
 <div className="mt-0.5 text-xs leading-5 text-muted-foreground">
 {t(`pilotDeckConfig.sections.${meta.descriptionKey}.description`)}
 </div>
 </div>
 <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
 </button>
 );
}

function ConfigSectionHome({ onSelect }: { onSelect: (section: SectionId) => void }) {
 const { t } = useTranslation('settings');

 return (
 <div className="space-y-8">
 {SECTION_GROUPS.map((group) => (
 <ConfigSectionGroup
 key={group.id}
 title={t(`pilotDeckConfig.sectionGroups.${group.id}`)}
 description={group.id === 'basic' ? t('pilotDeckConfig.sectionGroups.basicDescription') : undefined}
 >
 <ConfigGroupedCard divided={group.sections.length > 1}>
 {group.sections.map((section) => (
 <ConfigNavigationRow key={section} section={section} onSelect={onSelect} />
 ))}
 </ConfigGroupedCard>
 </ConfigSectionGroup>
 ))}
 </div>
 );
}

// ── Main tab ───────────────────────────────────────────────────────────

export type PilotDeckConfigTabProps = {
 projects?: SettingsProject[];
 /** PD-SAAS-FORK: 后台左栏树驱动子面板，隐藏卡片式首页与返回 */
 externalNav?: boolean;
 activeSection?: PilotDeckConfigSectionId | null;
 onActiveSectionChange?: (section: PilotDeckConfigSectionId) => void;
};

export default function PilotDeckConfigTab({
 projects = [],
 externalNav = false,
 activeSection: controlledSection = null,
 onActiveSectionChange,
}: PilotDeckConfigTabProps) {
 const { t } = useTranslation('settings');
 const {
 path,
 raw,
 setRaw,
	 exists,
	 validation,
	 reload,
	 isDirty,
	 externalChangeNotice,
	 dismissExternalNotice,
	 loading,
	 saving,
	 opening,
	 error,
	 refresh,
	 save,
	 reloadConfig,
	 openFile,
	 } = usePilotDeckConfig();

	 // Active form section. Null means the config page is showing its grouped
 // navigation home, matching the outer Settings page interaction model.
 const [internalSection, setInternalSection] = useState<SectionId | null>(null);
 const activeSection = externalNav ? controlledSection : internalSection;
 const setActiveSection = externalNav
   ? (section: SectionId | null) => {
       if (section && onActiveSectionChange) onActiveSectionChange(section);
     }
   : setInternalSection;
 const [showConfigDetails, setShowConfigDetails] = useState(false);

 // Parse `raw` into a typed config for the form. Memoised so we don't
 // reparse on every keystroke unrelated to YAML, but raw IS the source of
 // truth — every form patch reserialises back into raw, which keeps the
 // existing save/watcher pipeline (and hot-reload) functional unchanged.
 const parsedConfig = useMemo(() => safeParseYaml(raw), [raw]);
 const parseError = !parsedConfig && raw.trim().length > 0;

 // Form patches: take the next config, stringify back into YAML, push into
 // the existing `setRaw`. This is what keeps the save+reload pipeline a
 // single code path: server-side validation, watcher debouncing, and
 // subsystem hot-reload all work whether the edit came from the form, the
 // textarea, or an external editor.
 const onFormChange = (next: PilotDeckConfig) => {
 try {
 setRaw(configToYamlString(next));
 } catch (caught) {
 // Should be unreachable — every patch produces a serializable shape.
 // Fall through silently; the existing error banner will surface any
 // server-side problem on save.
 console.error('Failed to serialise config patch', caught);
 }
 };

 const configHasErrors = parseError || validation?.valid === false;
 const configStatusLabel = configHasErrors
 ? t('pilotDeckConfig.rawYaml.configInvalid')
 : isDirty
 ? t('pilotDeckConfig.status.unsavedChanges')
 : t('pilotDeckConfig.status.noUnsavedChanges');

 if (loading) {
 return (
 <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
 {t('pilotDeckConfig.loading')}
 </div>
 );
 }

 return (
 <div className="space-y-6">
 <SettingsCard className="p-3">
 <div className="flex flex-col gap-3 md:flex-row md:items-center">
 <button
 type="button"
 onClick={() => setShowConfigDetails((next) => !next)}
 className="flex min-w-0 flex-1 items-start gap-3 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-accent/35"
 aria-expanded={showConfigDetails}
 >
 <FileCog className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
 <div className="min-w-0 flex-1">
 <div className="text-[15px] font-semibold leading-5 text-foreground">
 {exists ? t('pilotDeckConfig.header.configFile') : t('pilotDeckConfig.header.configPreview')}
 </div>
 <code className="mt-1.5 block truncate rounded-md bg-muted px-2.5 py-1.5 font-mono text-[11px] leading-4 text-muted-foreground">
 {path}
 </code>
 </div>
 </button>

 <div className="flex flex-wrap items-center gap-2 md:justify-end">
 <span
 className={cn(
 'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium leading-4',
 configHasErrors
 ? 'bg-destructive/10 text-destructive'
 : isDirty
 ? 'bg-amber-500/10 text-amber-700'
 : 'bg-muted text-muted-foreground',
 )}
 >
 <span
 className={cn(
 'h-2 w-2 rounded-full',
 configHasErrors ? 'bg-destructive' : isDirty ? 'bg-amber-500' : 'bg-green-500',
 )}
 />
 {configStatusLabel}
 </span>
 <Button type="button" size="sm" onClick={save} disabled={saving || !isDirty} className="h-8 gap-1.5 px-2.5 text-xs">
 <Save className="mr-1.5 h-3.5 w-3.5" />
 {saving ? t('pilotDeckConfig.actions.saving') : t('pilotDeckConfig.actions.saveAndReloadShort')}
 </Button>
 <button
 type="button"
 onClick={() => setShowConfigDetails((next) => !next)}
 className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
 aria-label={showConfigDetails ? t('pilotDeckConfig.actions.hideDetails') : t('pilotDeckConfig.actions.showDetails')}
 title={showConfigDetails ? t('pilotDeckConfig.actions.hideDetails') : t('pilotDeckConfig.actions.showDetails')}
 >
 <ChevronDown className={cn('h-4 w-4 transition-transform', showConfigDetails && 'rotate-180')} />
 </button>
 </div>
 </div>

 {showConfigDetails && (
 <>
 <div className="mt-3 space-y-3 border-t border-border pt-3">
 <div className="flex flex-wrap items-center gap-2">
 <Button variant="outline" size="sm" onClick={openFile} disabled={opening} className="h-8 gap-1.5 px-2.5 text-xs">
 <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
 {opening ? t('pilotDeckConfig.actions.opening') : t('pilotDeckConfig.actions.revealFile')}
 </Button>
 <Button variant="outline" size="sm" onClick={() => void refresh()} className="h-8 gap-1.5 px-2.5 text-xs">
 <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
 {t('pilotDeckConfig.actions.refresh')}
 </Button>
 <Button type="button" variant="outline" size="sm" onClick={reloadConfig} disabled={saving} className="h-8 gap-1.5 px-2.5 text-xs">
 <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
 {t('pilotDeckConfig.actions.reloadCurrent')}
 </Button>
 </div>

 {validation?.valid ? (
 <div className="rounded-lg bg-muted/30 px-3.5 py-2.5">
 <div className="flex items-center gap-2 text-[13px] font-semibold leading-5 text-foreground">
 <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
 {t('pilotDeckConfig.rawYaml.configValid')}
 </div>
 <div className="mt-0.5 pl-4 text-[11px] leading-4 text-muted-foreground">
 {isDirty ? t('pilotDeckConfig.status.unsavedChanges') : t('pilotDeckConfig.status.noUnsavedChanges')}
 </div>
 </div>
 ) : (
 <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-destructive">
 <div className="flex items-center gap-2 text-[13px] font-semibold leading-5">
 <AlertCircle className="h-4 w-4" />
 {t('pilotDeckConfig.rawYaml.configInvalid')}
 </div>
 <div className="mt-0.5 pl-6 text-[11px] leading-4">
 {t('pilotDeckConfig.status.fixYamlInFilesystem')}
 </div>
 </div>
 )}
 <ConfigStatusGrid config={parsedConfig} reload={reload} />
 {validation && validation.errors.length > 0 && (
 <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
 <div className="mb-1 font-semibold">{t('pilotDeckConfig.rawYaml.errors')}</div>
 <ul className="list-disc space-y-1 pl-4">
 {validation.errors.map((item) => <li key={item}>{item}</li>)}
 </ul>
 </div>
 )}
 {validation && validation.warnings.length > 0 && (
 <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700">
 <div className="mb-1 font-semibold">{t('pilotDeckConfig.rawYaml.warnings')}</div>
 <ul className="list-disc space-y-1 pl-4">
 {validation.warnings.map((item) => <li key={item}>{item}</li>)}
 </ul>
 </div>
 )}
 {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}
 </div>

 {externalChangeNotice && (
 <div className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700">
 <div className="flex-1">{externalChangeNotice}</div>
 <button
 type="button"
 onClick={dismissExternalNotice}
 className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide hover:bg-amber-500/20"
 >
 {t('pilotDeckConfig.actions.dismiss')}
 </button>
 </div>
 )}
 {parseError && (
 <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
 {t('pilotDeckConfig.rawYaml.yamlParseError')}
 </div>
 )}
 </>
 )}
 </SettingsCard>

 {parsedConfig ? (
 activeSection ? (
 <div className="space-y-4">
 {!externalNav ? (
 <button
 type="button"
 onClick={() => setActiveSection(null)}
 className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
 >
 <ChevronLeft className="h-4 w-4" />
 {t('pilotDeckConfig.sections.backToMenu')}
 </button>
 ) : null}
 <div className="min-w-0 space-y-6">
 {(activeSection === 'agents' || activeSection === 'router' || activeSection === 'memory') && (
 <ModelRoutingTemplateBar config={parsedConfig} onApply={onFormChange} />
 )}
 {activeSection === 'models' && <ModelsSection config={parsedConfig} onChange={onFormChange} />}
 {activeSection === 'agents' && <AgentsSection config={parsedConfig} onChange={onFormChange} />}
 {activeSection === 'memory' && <MemorySection config={parsedConfig} onChange={onFormChange} />}
 {activeSection === 'providerHub' && <ProviderHubSection config={parsedConfig} onChange={onFormChange} />}
 {activeSection === 'tools' && <ToolsSection config={parsedConfig} onChange={onFormChange} />}
 {activeSection === 'router' && <RouterSection config={parsedConfig} onChange={onFormChange} />}
 {activeSection === 'gateway' && <GatewaySection config={parsedConfig} onChange={onFormChange} />}
 {activeSection === 'customEnv' && <CustomEnvSection config={parsedConfig} onChange={onFormChange} />}
 {activeSection === 'alwaysOn' && <AlwaysOnSection config={parsedConfig} projects={projects} onChange={onFormChange} />}
 {activeSection === 'cron' && <CronSection config={parsedConfig} onChange={onFormChange} />}
 {activeSection === 'advanced' && <ServiceSection config={parsedConfig} onChange={onFormChange} />}
 </div>
 </div>
 ) : externalNav ? (
 <SettingsCard className="p-5 text-xs text-muted-foreground">
 请从左侧选择配置项
 </SettingsCard>
 ) : (
 <ConfigSectionHome onSelect={setActiveSection} />
 )
 ) : (
 <SettingsCard className="p-5 text-xs text-muted-foreground">
 {t('pilotDeckConfig.rawYaml.cannotParse')}
 </SettingsCard>
 )}

 </div>
 );
}
