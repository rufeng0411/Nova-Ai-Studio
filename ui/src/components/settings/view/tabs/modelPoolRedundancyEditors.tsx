// PD-SAAS-FORK: admin editors for model pool redundancy (keys, standby models, capability fallbacks)

import { useTranslation } from 'react-i18next';
import {
  MAX_PROVIDER_API_KEYS,
  MAX_STANDBY_MODEL_SLOTS,
  MAX_TOOL_CAPABILITY_FALLBACKS,
  normalizeProviderApiKeySlots,
  normalizeStandbyModelSlots,
} from '../../../../../shared/providerApiKeys.mjs';
import { isConfiguredApiKey, hasUsableSecret } from '../../../../shared/resolveMediaFromModelProviders';

type ModelRefOption = { value: string; label: string };

function SecretField({
  value,
  emptyPlaceholder,
  maskedPlaceholder,
  onChange,
}: {
  value: string;
  emptyPlaceholder: string;
  maskedPlaceholder: string;
  onChange: (value: string) => void;
}) {
  const masked = /^\*+$/.test(value.trim());
  return (
    <input
      type="password"
      value={masked ? '' : value}
      placeholder={masked ? maskedPlaceholder : emptyPlaceholder}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
    />
  );
}

function TextField({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
    />
  );
}

function SimpleSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: ModelRefOption[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
    >
      {options.map((option) => (
        <option key={option.value || '__empty'} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export type V2ProviderWithKeys = {
  apiKey?: string;
  apiKeys?: string[];
  [key: string]: unknown;
};

export type MediaToolShape = {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  fallbacks?: MediaToolShape[];
};

export type WebSearchToolShape = {
  provider?: string;
  apiKey?: string;
  endpoint?: string;
  fallbacks?: WebSearchToolShape[];
};

function secretDisplayValue(value: string | undefined): string {
  return value ?? '';
}

export function ProviderApiKeySlotsEditor({
  provider,
  onChange,
}: {
  provider: V2ProviderWithKeys;
  onChange: (next: V2ProviderWithKeys) => void;
}) {
  const { t } = useTranslation('settings');
  const slots = normalizeProviderApiKeySlots(provider);
  while (slots.length < MAX_PROVIDER_API_KEYS) slots.push('');

  const setSlot = (index: number, value: string) => {
    const nextSlots = [...slots];
    nextSlots[index] = value;
    const [apiKey, ...apiKeys] = nextSlots.filter((entry, idx) => entry.trim() || idx === 0);
    onChange({
      ...provider,
      apiKey: apiKey?.trim() || '',
      ...(apiKeys.some((entry) => entry.trim()) ? { apiKeys: apiKeys.map((entry) => entry.trim()) } : {}),
    });
  };

  return (
    <div className="space-y-2">
      <div className="text-[11px] text-muted-foreground">
        {t('pilotDeckConfig.panels.models.apiKeySlotsHint', {
          defaultValue: '主 Key 失败时按顺序自动切换备用 Key（最多 4 组）。',
        })}
      </div>
      {slots.map((slot, index) => (
        <label key={index} className="block text-xs text-muted-foreground">
          <span className="mb-1 block">
            {index === 0
              ? t('pilotDeckConfig.panels.models.apiKeyPrimary', { defaultValue: '主 API Key' })
              : t('pilotDeckConfig.panels.models.apiKeyBackup', {
                  defaultValue: '备用 API Key {{index}}',
                  index: index,
                })}
          </span>
          <SecretField
            value={slot}
            emptyPlaceholder={index === 0 ? 'sk-...' : t('pilotDeckConfig.panels.models.optionalKey', { defaultValue: '可选' })}
            maskedPlaceholder={t('pilotDeckConfig.panels.models.maskedKeyPlaceholder')}
            onChange={(value) => setSlot(index, value)}
          />
        </label>
      ))}
    </div>
  );
}

export function StandbyModelsEditor({
  slots,
  modelOptions,
  onChange,
}: {
  slots: string[];
  modelOptions: ModelRefOption[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useTranslation('settings');
  const normalized = normalizeStandbyModelSlots(slots);

  const setSlot = (index: number, value: string) => {
    const next = [...normalized];
    next[index] = value;
    onChange(next);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background/40 p-3">
      <div>
        <div className="text-sm font-semibold text-foreground">
          {t('pilotDeckConfig.panels.models.standbyTitle', { defaultValue: '备用模型（4 组）' })}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {t('pilotDeckConfig.panels.models.standbyDescription', {
            defaultValue: '写入 router.fallback.default，主模型不可用时按顺序降级。',
          })}
        </div>
      </div>
      {normalized.map((slot, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-right text-[10px] font-semibold text-muted-foreground">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <SimpleSelect
              value={slot}
              options={[{ value: '', label: '—' }, ...modelOptions]}
              onChange={(value) => setSlot(index, value)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

type MediaProviderOption = { value: string; label: string };

export function MediaCapabilityFallbackEditor({
  title,
  tool,
  providerOptions,
  modelOptions,
  onChange,
}: {
  title: string;
  tool: MediaToolShape;
  providerOptions: MediaProviderOption[];
  modelOptions: ModelRefOption[];
  onChange: (next: MediaToolShape) => void;
}) {
  const { t } = useTranslation('settings');
  const fallbacks = Array.isArray(tool.fallbacks) ? [...tool.fallbacks] : [];
  while (fallbacks.length < MAX_TOOL_CAPABILITY_FALLBACKS) fallbacks.push({});

  const setFallbackField = (
    index: number,
    field: keyof MediaToolShape,
    value: string,
  ) => {
    const next = [...fallbacks];
    const entry = { ...(next[index] ?? {}) };
    if (!value.trim()) delete entry[field];
    else entry[field] = value;
    next[index] = entry;
    onChange({ ...tool, fallbacks: next.filter((entry) => Object.keys(entry).length > 0) });
  };

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="text-xs font-semibold text-foreground">
        {title}
      </div>
      {fallbacks.map((entry, index) => (
        <div key={index} className="space-y-2 rounded-md border border-border/80 bg-muted/20 p-3">
          <div className="text-[11px] font-medium text-muted-foreground">
            {t('pilotDeckConfig.panels.providerHub.fallbackSlot', {
              defaultValue: '降级 {{index}}',
              index: index + 1,
            })}
          </div>
          <SimpleSelect
            value={entry.provider || ''}
            options={[{ value: '', label: '— inherit —' }, ...providerOptions]}
            onChange={(value) => setFallbackField(index, 'provider', value)}
          />
          <TextField
            value={entry.model || ''}
            placeholder={t('pilotDeckConfig.panels.providerHub.model', { defaultValue: 'Model' })}
            onChange={(value) => setFallbackField(index, 'model', value)}
          />
          <SecretField
            value={secretDisplayValue(entry.apiKey)}
            emptyPlaceholder={t('pilotDeckConfig.panels.providerHub.optionalKey', { defaultValue: '可选 Key' })}
            maskedPlaceholder="********"
            onChange={(value) => setFallbackField(index, 'apiKey', value)}
          />
        </div>
      ))}
    </div>
  );
}

export function WebSearchCapabilityFallbackEditor({
  tool,
  providerOptions,
  onChange,
}: {
  tool: WebSearchToolShape;
  providerOptions: MediaProviderOption[];
  onChange: (next: WebSearchToolShape) => void;
}) {
  const { t } = useTranslation('settings');
  const fallbacks = Array.isArray(tool.fallbacks) ? [...tool.fallbacks] : [];
  while (fallbacks.length < MAX_TOOL_CAPABILITY_FALLBACKS) fallbacks.push({});

  const setFallbackField = (
    index: number,
    field: keyof WebSearchToolShape,
    value: string,
  ) => {
    const next = [...fallbacks];
    const entry = { ...(next[index] ?? {}) };
    if (!value.trim()) delete entry[field];
    else entry[field] = value;
    next[index] = entry;
    onChange({ ...tool, fallbacks: next.filter((entry) => Object.keys(entry).length > 0) });
  };

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="text-xs font-semibold text-foreground">
        {t('pilotDeckConfig.panels.providerHub.webSearchFallbackTitle', { defaultValue: '联网搜索降级（2 组）' })}
      </div>
      {fallbacks.map((entry, index) => (
        <div key={index} className="space-y-2 rounded-md border border-border/80 bg-muted/20 p-3">
          <SimpleSelect
            value={entry.provider || ''}
            options={[{ value: '', label: '—' }, ...providerOptions]}
            onChange={(value) => setFallbackField(index, 'provider', value)}
          />
          <SecretField
            value={secretDisplayValue(entry.apiKey)}
            emptyPlaceholder={t('pilotDeckConfig.panels.providerHub.optionalKey', { defaultValue: '可选 Key' })}
            maskedPlaceholder="********"
            onChange={(value) => setFallbackField(index, 'apiKey', value)}
          />
          <TextField
            value={entry.endpoint || ''}
            placeholder="endpoint"
            onChange={(value) => setFallbackField(index, 'endpoint', value)}
          />
        </div>
      ))}
    </div>
  );
}

export function isProviderConfigured(provider: V2ProviderWithKeys): boolean {
  return normalizeProviderApiKeySlots(provider).some(
    (key) => isConfiguredApiKey(key) || hasUsableSecret(key),
  );
}

export { MAX_PROVIDER_API_KEYS, MAX_STANDBY_MODEL_SLOTS, MAX_TOOL_CAPABILITY_FALLBACKS };
