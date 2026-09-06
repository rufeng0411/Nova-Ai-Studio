// PD-SAAS-FORK: unified live + completed process timeline steps
import type { TFunction } from 'i18next';
import type { ChatMessage } from '../components/chat/types/types';
import type { ProcessAttachment } from '../components/chat-v2/processGrouping';
import { processSummaryToTrace } from '../components/chat-v2/processGrouping';
import type { ProcessTraceStep } from '../components/chat-v2/ProcessTrace';
import { buildKeySteps } from './processNarrative';
import { formatToolDisplayName, localizeProcessTraceStep, localizeRawProcessLabel } from './processStepLabels';
import { isDeliverableSlotProcessUxEnabled } from './perfFeatureFlags';
import { resolveDeliverableSlotFromToolPath } from './resolveDeliverableSlotFromToolPath';
import type { SessionDeliverableManifestUi } from './resolveSessionDeliverableManifest';
import type { AudienceMode } from './audienceMode';
import { hasCjk, isEnglishProcessNarration } from './englishProcessNarration';
import { resolveThinkingStepPresentation } from './resolveThinkingStepPresentation';

export { isEnglishProcessNarration } from './englishProcessNarration';

export type ProcessTimelineBuilderOptions = {
  processDetailLevel?: 'minimal' | 'standard' | 'detailed';
  showThinking?: boolean;
  maxVisibleSteps?: number;
  localeIsZh?: boolean;
  audienceMode?: import('./audienceMode').AudienceMode;
  sessionDeliverableManifest?: SessionDeliverableManifestUi;
  sessionTaskPhase?: import('./sessionTaskLifecycle').SessionTaskPhase;
  sdmProgressDone?: number;
  sdmProgressTotal?: number;
  latestToolName?: string | null;
  workingStatusKind?: string | null;
};

const RAW_RECOVERY_REASON = /^(next_turn|model_error|max_turns|aborted_streaming|aborted_tools|auto_compact|tool_recovery|auto_continue|soft_fetch_recovery|deliverable_validate_failed|retry_alternate|stage_hint)$/i;

const STAGE_HINT_TITLES = new Set([
  '正在准备会话…',
  '正在准备会话...',
  'Preparing session…',
  'Preparing session...',
]);

function safeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeThinkingDetail(
  detail: string | undefined,
  t: TFunction<'chat'>,
  localeIsZh: boolean,
): string | undefined {
  const raw = safeString(detail);
  if (!raw) return undefined;
  if (!localeIsZh) return raw;
  if (hasCjk(raw) && !isEnglishProcessNarration(raw)) return raw;
  if (isEnglishProcessNarration(raw)) {
    return t('process.thinking.placeholder', { defaultValue: '正在整理思路…' });
  }
  return raw;
}

function localizeStep(raw: ProcessTraceStep, t: TFunction<'chat'>): ProcessTraceStep {
  const localized = localizeProcessTraceStep(raw, t);
  return {
    ...raw,
    title: localized.title || raw.title,
    detail: Object.prototype.hasOwnProperty.call(localized, 'detail') ? localized.detail : raw.detail,
  };
}

function humanizeLiveStep(
  step: ProcessTraceStep,
  t: TFunction<'chat'>,
  audienceMode?: AudienceMode,
  options?: ProcessTimelineBuilderOptions,
): ProcessTraceStep {
  const localized = localizeStep(step, t);
  const kind = String(localized.kind || '');
  if (
    isDeliverableSlotProcessUxEnabled()
    && (kind === 'write' || kind === 'edit')
    && options?.sessionDeliverableManifest
  ) {
    const targetPath = safeString(localized.target || localized.detail);
    const slotHint = resolveDeliverableSlotFromToolPath(
      targetPath,
      options.sessionDeliverableManifest,
    );
    if (slotHint) {
      return {
        ...localized,
        title: t('process.deliverable.activeWrite', {
          index: slotHint.slotIndex,
          total: slotHint.slotTotal,
          basename: slotHint.basename,
          defaultValue: '正在写入 {{basename}}（{{index}}/{{total}}）',
        }),
        detail: slotHint.label,
      };
    }
  }
  if (kind === 'recovery') {
    const recoveryTitle =
      localizeRawProcessLabel(step.title, t)
      || localizeRawProcessLabel(step.detail, t)
      || localizeRawProcessLabel(step.target, t)
      || localized.title;
    return {
      ...localized,
      title: recoveryTitle || t('process.recovery.adjusting', { defaultValue: '调整中' }),
      detail: undefined,
    };
  }
  if (RAW_RECOVERY_REASON.test(safeString(step.title)) || RAW_RECOVERY_REASON.test(safeString(step.detail))) {
    return {
      ...localized,
      title:
        localizeRawProcessLabel(step.title, t)
        || localizeRawProcessLabel(step.detail, t)
        || t('process.recovery.adjusting', { defaultValue: '调整中' }),
      detail: undefined,
    };
  }
  if (kind === 'thinking') {
    const presentation = resolveThinkingStepPresentation({
      sessionTaskPhase: options?.sessionTaskPhase,
      latestToolName: options?.latestToolName ?? localized.toolName,
      workingStatusKind: options?.workingStatusKind,
      done: options?.sdmProgressDone,
      total: options?.sdmProgressTotal,
    });
    return {
      ...localized,
      title: t(presentation.titleKey, {
        defaultValue: presentation.kind === 'planning'
          ? '正在整理执行方案'
          : presentation.kind === 'repair'
            ? `正在核对第 ${presentation.values?.done ?? 0}/${presentation.values?.total ?? 0} 项成果`
            : '正在思考任务方案',
        ...presentation.values,
      }),
    };
  }
  if (localized.toolName && !localized.title) {
    return {
      ...localized,
      title: formatToolDisplayName(localized.toolName, t, audienceMode),
    };
  }
  return localized;
}

function dedupeRecoverySteps(steps: ProcessTraceStep[]): ProcessTraceStep[] {
  const out: ProcessTraceStep[] = [];
  for (const step of steps) {
    const isRecovery = step.kind === 'recovery' || step.phase === 'recovery';
    const prev = out[out.length - 1];
    if (isRecovery && prev && (prev.kind === 'recovery' || prev.phase === 'recovery')) {
      out[out.length - 1] = {
        ...prev,
        ...step,
        id: prev.id || step.id,
        state: step.state || prev.state,
      };
      continue;
    }
    out.push(step);
  }
  return out;
}

function dedupeStageHints(steps: ProcessTraceStep[]): ProcessTraceStep[] {
  const seen = new Set<string>();
  const out: ProcessTraceStep[] = [];
  for (const step of steps) {
    const title = safeString(step.title);
    if (STAGE_HINT_TITLES.has(title)) {
      if (seen.has('stage-hint')) continue;
      seen.add('stage-hint');
    }
    out.push(step);
  }
  return out;
}

const ENGLISH_NARRATION_PRESERVE_KINDS = new Set([
  'search',
  'fetch',
  'read',
  'milestone',
  'recovery',
  'activity',
  'command',
  'local_search',
  'tool',
  'subagent',
]);

function filterEnglishNarrationSteps(
  steps: ProcessTraceStep[],
  localeIsZh: boolean,
): ProcessTraceStep[] {
  if (!localeIsZh) return steps;
  return steps.filter((step) => {
    const title = safeString(step.title);
    const detail = safeString(step.detail);
    if (step.kind === 'thinking') return true;
    if (ENGLISH_NARRATION_PRESERVE_KINDS.has(String(step.kind || ''))) return true;
    if (isEnglishProcessNarration(title) && !hasCjk(title)) return false;
    if (isEnglishProcessNarration(detail) && !hasCjk(detail)) return false;
    return true;
  });
}

/** Keep dock progress visible when tool/thinking rows are temporarily empty. */
export function coalesceLiveDockTimelineSteps(
  steps: ProcessTraceStep[],
  fallbackStep?: ProcessTraceStep | null,
): ProcessTraceStep[] {
  if (steps.length > 0) return steps;
  if (!fallbackStep) return [];
  const title = safeString(fallbackStep.title);
  const detail = safeString(fallbackStep.detail);
  const target = safeString(fallbackStep.target);
  if (!title && !detail && !target) return [];
  return [{
    ...fallbackStep,
    state: fallbackStep.state || 'running',
  }];
}

function applyThinkingSanitize(
  steps: ProcessTraceStep[],
  t: TFunction<'chat'>,
  options: ProcessTimelineBuilderOptions,
): ProcessTraceStep[] {
  const localeIsZh = options.localeIsZh !== false;
  const showThinking = Boolean(options.showThinking || options.processDetailLevel === 'detailed');
  return steps.map((step) => {
    if (step.kind !== 'thinking' && step.phase !== 'thinking') return step;
    if (!showThinking && options.processDetailLevel === 'minimal') {
      return { ...step, detail: undefined };
    }
    return {
      ...step,
      detail: sanitizeThinkingDetail(step.detail, t, localeIsZh),
    };
  });
}

function maskTechnicalDetail(
  step: ProcessTraceStep,
  options: ProcessTimelineBuilderOptions,
): ProcessTraceStep {
  if (options.processDetailLevel === 'detailed') return step;
  const kind = String(step.kind || '');
  if (kind === 'command' || kind === 'local_search') {
    return { ...step, detail: undefined };
  }
  if (kind === 'read' || kind === 'milestone' || kind === 'fetch') {
    const target = safeString(step.target || step.detail);
    if (!target) return step;
    const base = target.replace(/\\/g, '/').split('/').filter(Boolean).pop() || target;
    return { ...step, detail: base, title: step.title || base };
  }
  return step;
}

export function normalizeProcessSteps(
  steps: ProcessTraceStep[],
  t: TFunction<'chat'>,
  options: ProcessTimelineBuilderOptions = {},
): ProcessTraceStep[] {
  try {
    if (!Array.isArray(steps) || steps.length === 0) return [];
    const localeIsZh = options.localeIsZh !== false;
    let normalized = steps
      .filter((step) => step && typeof step === 'object')
      .map((step) => humanizeLiveStep(step, t, options.audienceMode, options))
      .map((step) => maskTechnicalDetail(step, options));
    normalized = dedupeRecoverySteps(normalized);
    normalized = dedupeStageHints(normalized);
    normalized = filterEnglishNarrationSteps(normalized, localeIsZh);
    normalized = applyThinkingSanitize(normalized, t, options);
    const max = options.maxVisibleSteps;
    if (typeof max === 'number' && max > 0 && normalized.length > max) {
      return normalized.slice(-max);
    }
    return normalized;
  } catch (error) {
    console.warn('[processTimelineBuilder] normalizeProcessSteps failed:', error);
    return [];
  }
}

export function mergeCompletedTimelineSteps(
  attachments: ProcessAttachment[],
  t: TFunction<'chat'>,
  options: ProcessTimelineBuilderOptions = {},
): ProcessTraceStep[] {
  try {
    const merged: ProcessTraceStep[] = [];
    for (const attachment of attachments) {
      const trace = processSummaryToTrace(attachment.processSummary, t);
      merged.push(...trace.steps);
    }
    return normalizeProcessSteps(merged, t, options);
  } catch (error) {
    console.warn('[processTimelineBuilder] mergeCompletedTimelineSteps failed:', error);
    return [];
  }
}

export function buildLiveTimelineSteps(
  messages: ChatMessage[],
  activityMessages: ChatMessage[],
  t: TFunction<'chat'>,
  options: ProcessTimelineBuilderOptions = {},
): ProcessTraceStep[] {
  try {
    const includeThinking = options.processDetailLevel !== 'minimal';
    const raw = buildKeySteps(messages, activityMessages, {
      includeThinkingInSteps: includeThinking,
      maxClues: 999,
    });
    const audienceMode = options.audienceMode;
    const localized = raw.map((step) => {
      const withTitle = step.title
        ? step
        : {
            ...step,
            title: step.toolName
              ? formatToolDisplayName(step.toolName, t, audienceMode)
              : undefined,
          };
      return localizeStep(withTitle, t);
    });
    return normalizeProcessSteps(localized, t, {
      ...options,
      audienceMode,
      maxVisibleSteps: options.maxVisibleSteps ?? 5,
    });
  } catch (error) {
    console.warn('[processTimelineBuilder] buildLiveTimelineSteps failed:', error);
    return [];
  }
}

export type ProcessActivityCounts = {
  readCount: number;
  commandCount: number;
  editCount: number;
  searchCount: number;
};

export function summarizeProcessActivity(
  messages: ChatMessage[],
): ProcessActivityCounts {
  const counts: ProcessActivityCounts = {
    readCount: 0,
    commandCount: 0,
    editCount: 0,
    searchCount: 0,
  };
  const seenReads = new Set<string>();
  for (const message of messages) {
    if (!message.isToolUse) continue;
    const name = String(message.toolName || '').toLowerCase();
    if (name === 'web_search') {
      counts.searchCount += 1;
      continue;
    }
    if (/^read/.test(name) || name === 'read_file') {
      const path = safeString(
        (message.toolInput as { file_path?: string; path?: string } | undefined)?.file_path
        || (message.toolInput as { path?: string } | undefined)?.path,
      );
      const key = path.toLowerCase();
      if (!seenReads.has(key)) {
        seenReads.add(key);
        counts.readCount += 1;
      }
      continue;
    }
    if (name === 'bash') {
      counts.commandCount += 1;
      continue;
    }
    if (name === 'write_file' || name === 'edit_file' || name === 'write' || name === 'edit') {
      counts.editCount += 1;
    }
  }
  return counts;
}
