// PD-SAAS-FORK: Creation launcher sheet — html-ppt pilot
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Loader2, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils.js';
import { api, appendAuthToken } from '../../utils/api.js';
import type { CapabilityBindingContext } from '../../shared/capabilityBinding.js';
import type { CapabilityTryHandlers } from '../../shared/capabilityTryBridge.js';
import { requestCapabilityTry } from '../../shared/capabilityTryBridge.js';
import { storePendingLaunchContext } from '../../shared/launchContextStorage.js';
import type { LaunchSheetRequest } from '../../shared/launchSheetBridge.js';
import { LAUNCH_SHEET_TRANSITION } from './launchMotion.js';

type LaunchOption = {
  id: string;
  label: string;
  description?: string;
  previewUrl?: string;
  previewImageUrl?: string;
  previewKind?: 'deck' | 'layout' | 'theme';
};

function LaunchOptionPreview({ option }: { option: LaunchOption }) {
  if (option.previewImageUrl) {
    return (
      <img
        src={appendAuthToken(option.previewImageUrl)}
        alt=""
        className="h-28 w-full object-cover object-top bg-muted"
        loading="lazy"
        decoding="async"
      />
    );
  }

  if (!option.previewUrl) {
    return <div className="h-28 w-full bg-muted" />;
  }

  const scaledDeck =
    option.previewKind === 'deck' ||
    option.previewKind === 'layout' ||
    /\/full-decks\//.test(option.previewUrl) ||
    /\/single-page\//.test(option.previewUrl);

  if (scaledDeck) {
    return (
      <div className="relative h-28 w-full overflow-hidden bg-[#0b0c10]">
        <iframe
          title={option.label}
          src={appendAuthToken(option.previewUrl)}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[1080px] w-[1920px] -translate-x-1/2 -translate-y-1/2 origin-center scale-[0.14] border-0"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    );
  }

  return (
    <iframe
      title={option.label}
      src={appendAuthToken(option.previewUrl)}
      className="pointer-events-none h-28 w-full border-0 bg-muted"
      sandbox="allow-scripts allow-same-origin"
    />
  );
}

type LaunchStep = {
  id: string;
  type: string;
  title: string;
  required?: boolean;
  optional?: boolean;
  options?: LaunchOption[];
  fields?: Array<{
    key: string;
    label: string;
    type?: string;
    placeholder?: string;
    default?: string;
    min?: number;
    max?: number;
  }>;
};

type LaunchProfile = {
  slug: string;
  display_name?: string;
  steps: LaunchStep[];
};

type LaunchSheetProps = {
  open: boolean;
  request: LaunchSheetRequest | null;
  onClose: () => void;
};

function stepSelectionsFromState(
  steps: LaunchStep[],
  picks: Record<string, string>,
  form: Record<string, string>,
) {
  return steps.flatMap((step) => {
    if (step.type === 'form') {
      return (step.fields ?? []).map((field) => ({
        stepId: step.id,
        key: field.key,
        value: form[field.key] ?? field.default ?? '',
      }));
    }
    const optionId = picks[step.id];
    if (!optionId) return [];
    return [{ stepId: step.id, optionId }];
  });
}

export default function LaunchSheet({ open, request, onClose }: LaunchSheetProps) {
  const { t } = useTranslation('capabilities');
  const reduceMotion = useReducedMotion();
  const [profile, setProfile] = useState<LaunchProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [form, setForm] = useState<Record<string, string>>({ brief: '', page_count: '8' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  useEffect(() => {
    if (!open || !request?.slug) return;
    setStepIndex(0);
    setPicks({});
    setForm({ brief: '', page_count: '8' });
    setLoadError(false);
    setSubmitError(false);
    setLoading(true);
    api
      .get(`/launch/profile/${encodeURIComponent(request.slug)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('launch_profile_failed');
        return response.json() as Promise<LaunchProfile>;
      })
      .then((data) => setProfile(data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [open, request?.slug]);

  const steps = profile?.steps ?? [];
  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex >= steps.length - 1;

  const fallbackTry = useCallback(() => {
    if (!request) return;
    requestCapabilityTry(request.fallbackPrompt, request.capability, request.handlers);
    onClose();
  }, [onClose, request]);

  const handleCompile = useCallback(async () => {
    if (!request || !profile) return;
    setSubmitting(true);
    setSubmitError(false);
    const selections = stepSelectionsFromState(steps, picks, form);
    try {
      const response = await api.post('/launch/compile', {
        slug: request.slug,
        selections,
        brief: form.brief,
        page_count: form.page_count,
      });
      if (!response.ok) throw new Error('launch_compile_failed');
      const result = (await response.json()) as {
        compiledPrompt: string;
        launchContext: string;
        capability?: CapabilityBindingContext;
      };

      storePendingLaunchContext(result.launchContext ?? '');
      requestCapabilityTry(
        result.compiledPrompt || request.fallbackPrompt,
        result.capability ?? request.capability,
        request.handlers,
      );
      onClose();
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }, [form, onClose, picks, profile, request, steps]);

  const canAdvance = useMemo(() => {
    if (!currentStep) return false;
    if (currentStep.type === 'form') return true;
    if (currentStep.optional) return true;
    return Boolean(picks[currentStep.id]);
  }, [currentStep, picks]);

  if (!open || !request) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/30 p-4 backdrop-blur-[2px] max-md:p-0 sm:items-center"
      data-testid="launch-sheet"
      initial={false}
      animate={{ opacity: 1 }}
      transition={reduceMotion ? { duration: 0 } : LAUNCH_SHEET_TRANSITION}
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg max-md:max-h-[100dvh] max-md:rounded-none"
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : LAUNCH_SHEET_TRANSITION}
      >
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          {stepIndex > 0 ? (
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              aria-label="back"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {request.displayName}
              {currentStep?.title ? ` · ${currentStep.title}` : ''}
            </p>
            {steps.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {stepIndex + 1} / {steps.length}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
            aria-label="close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-[280px] flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : null}
          {loadError ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>{t('launchLoadHint', { defaultValue: '启动器暂时不可用' })}</p>
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
                onClick={fallbackTry}
              >
                {t('launchSkipTry', { defaultValue: '跳过，直接试一下' })}
              </button>
            </div>
          ) : null}
          {!loading && !loadError && currentStep?.type === 'form' ? (
            <div className="space-y-4">
              {(currentStep.fields ?? []).map((field) => (
                <label key={field.key} className="block space-y-1.5">
                  <span className="text-xs font-medium text-foreground">{field.label}</span>
                  {field.type === 'textarea' ? (
                    <textarea
                      className="min-h-[100px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={field.placeholder}
                      value={form[field.key] ?? ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    />
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                      value={form[field.key] ?? field.default ?? ''}
                      min={field.min}
                      max={field.max}
                      onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    />
                  )}
                </label>
              ))}
            </div>
          ) : null}
          {!loading && !loadError && currentStep && currentStep.type !== 'form' ? (
            (currentStep.options ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('launchNoTemplates', { defaultValue: '暂无可用模板，可展开到输入框继续' })}
              </p>
            ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {(currentStep.options ?? []).map((option) => {
                const selected = picks[currentStep.id] === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={cn(
                      'flex min-h-[148px] flex-col overflow-hidden rounded-lg border border-border/60 bg-card text-left transition hover:border-primary/40',
                      selected && 'border-primary ring-1 ring-primary/30',
                    )}
                    onClick={() => setPicks((prev) => ({ ...prev, [currentStep.id]: option.id }))}
                  >
                    <LaunchOptionPreview option={option} />
                    <div className="flex flex-1 flex-col gap-0.5 p-2">
                      <span className="text-xs font-medium text-foreground">{option.label}</span>
                      {option.description ? (
                        <span className="line-clamp-2 text-[10px] text-muted-foreground">{option.description}</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
            )
          ) : null}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={fallbackTry}
          >
            {t('launchExpandComposer', { defaultValue: '展开到输入框' })}
          </button>
          <div className="flex items-center gap-2">
            {submitError ? (
              <span className="text-xs text-muted-foreground">
                {t('launchCompileHint', { defaultValue: '生成预览失败，可展开到输入框' })}
              </span>
            ) : null}
            {!isLastStep ? (
              <button
                type="button"
                disabled={!canAdvance}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                onClick={() => setStepIndex((i) => i + 1)}
              >
                {t('launchNext', { defaultValue: '下一步' })}
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting || !canAdvance}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                onClick={() => void handleCompile()}
              >
                {submitting ? (
                  <Loader2 className="inline h-4 w-4 animate-spin" />
                ) : (
                  t('launchStart', { defaultValue: '开始生成' })
                )}
              </button>
            )}
          </div>
        </footer>
      </motion.div>
    </motion.div>
  );
}
