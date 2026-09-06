// PD-SAAS-FORK: auto-continue after engine recovery_pause / infra_interrupt / deliverable_repair
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  DEFAULT_MAX_RECOVERY_ATTEMPTS,
  buildAutoRecoveryContinueMessage,
  looksLikeTaskDelivered,
  shouldAutoContinueAfterTurnOutcome,
  type TurnCompleteOutcome,
} from '../../../shared/userFacingErrors';

import { getPilotDeckSettings } from '../../chat/utils/chatStorage';
import {
  buildTaskResumeMessage,
  markTaskResumeFired,
  tryTaskResumeSchedule,
  type TaskResumeKind,
} from './taskResumeCoordinator';
import { fetchTaskResumeContext } from '../../../shared/fetchTaskResumeContext';
import { readDefaultAutoContinueEnabled } from '../../../shared/manualContinuePolicy';

const AUTO_CONTINUE_KEY = 'autoRecoveryContinue';
const MAX_AUTO_CONTINUES = DEFAULT_MAX_RECOVERY_ATTEMPTS;
const DEFAULT_UI_GRACE_AFTER_ENGINE_EXHAUST = 1;
const CONTINUE_DELAY_MS = 800;

/** PD-SAAS-FORK: env rollback for UI grace after engine budget exhaust (default 1, was 2). */
export function resolveUiGraceAfterEngineExhaust(): number {
  const fromVite = import.meta.env?.VITE_UI_RECOVERY_GRACE;
  if (fromVite != null && fromVite !== '') {
    const parsed = Number(fromVite);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  if (typeof process !== 'undefined') {
    const raw = process.env?.PILOTDECK_UI_RECOVERY_GRACE;
    if (raw != null && raw !== '') {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  }
  return DEFAULT_UI_GRACE_AFTER_ENGINE_EXHAUST;
}

function countVerifiedPaths(status: AutoRecoveryStatus): number {
  return Array.isArray(status?.verifiedPaths) ? status.verifiedPaths.length : 0;
}

export type UiBudgetCapOptions = {
  /** Verified path count captured when engine first reported budgetRemaining=0. */
  exhaustVerifiedBaseline?: number;
};

/** PD-SAAS-FORK: UI grace after engine exhaust — infra/auth always allow grace; no verified progress → 0. */
export function resolveUiBudgetCap(
  status: AutoRecoveryStatus,
  options?: UiBudgetCapOptions,
): number {
  if (typeof status?.budgetRemaining === 'number') {
    if (status.budgetRemaining <= 0) {
      if (isInfraInterruptStatus(status)) {
        return Math.max(1, resolveUiGraceAfterEngineExhaust());
      }
      const grace = resolveUiGraceAfterEngineExhaust();
      if (grace <= 0) return 0;
      const baseline = options?.exhaustVerifiedBaseline;
      const current = countVerifiedPaths(status);
      if (typeof baseline === 'number' && current <= baseline) {
        return 0;
      }
      return grace;
    }
    return status.budgetRemaining;
  }
  const max = typeof status?.recoveryMax === 'number' ? status.recoveryMax : MAX_AUTO_CONTINUES;
  const attempt = typeof status?.recoveryAttempt === 'number' ? status.recoveryAttempt : 0;
  return Math.max(0, max - attempt);
}

export type AutoRecoveryStatus = {
  statusKind?: string;
  text?: string;
  recoveryAttempt?: number;
  recoveryMax?: number;
  budgetRemaining?: number;
  interruptKind?: string;
  lastRunId?: string;
  lastTurnId?: string;
  missingPaths?: string[];
  verifiedPaths?: string[];
  recoveryOwner?: TaskResumeKind | string;
} | null;

export type UseAutoRecoveryContinueOptions = {
  sessionId: string | null | undefined;
  turnBoundaryKey: string;
  status: AutoRecoveryStatus;
  isLoading: boolean;
  /** PD-SAAS-FORK: block auto-resume until transcript fetch completes (avoids gateway WS contention). */
  isLoadingSessionMessages?: boolean;
  isConnected?: boolean;
  enabled?: boolean;
  turnCompleteSignal?: number;
  turnCompleteMeta?: TurnCompleteOutcome;
  lastAssistantText?: string;
  userGoal?: string;
  projectName?: string;
  projectPath?: string;
  /** PD-SAAS-FORK: block UI auto-continue while user_action_required card awaits Key/attachment. */
  userActionBlocked?: boolean;
  /** PD-SAAS-FORK: sidebar「任务完成」或用户口头确认后禁止续跑。 */
  userAcknowledgedComplete?: boolean;
  /** PD-SAAS-FORK (P0-D): engine passed / circuit / certificate terminal gate. */
  sessionTerminalComplete?: boolean;
  /** PD-SAAS-FORK: paused / 24h-stale — block UI-initiated auto-continue until user sends a message. */
  autoContinueBlocked?: boolean;
  onContinue: (message: string) => void;
  onResumeHint?: (message: string) => void;
};

export type UseAutoRecoveryContinueResult = {
  autoContinueCount: number;
  resumeHintVisible: boolean;
  resumeHintMessage: string;
  dismissResumeHint: () => void;
  /** PD-SAAS-FORK: recovery_pause/infra continue scheduled — stale watchdog must not double-abort. */
  recoveryContinuePending: boolean;
};

function resolveResumeHintMessage(lang: 'en' | 'zh'): string {
  return lang === 'en' ? 'Resuming from last step…' : '已从上次步骤继续';
}

export function readAutoContinueEnabled(): boolean {
  const settings = getPilotDeckSettings();
  if (typeof settings.autoRecoveryContinue === 'boolean') {
    return settings.autoRecoveryContinue;
  }
  return readDefaultAutoContinueEnabled();
}

function isRecoveryPauseStatus(status: AutoRecoveryStatus): boolean {
  return (
    status?.statusKind === 'recovery_pause'
    || String(status?.text || '').toLowerCase() === 'recovery_pause'
  );
}

function isInfraInterruptStatus(status: AutoRecoveryStatus): boolean {
  return (
    status?.statusKind === 'infra_interrupt'
    || status?.interruptKind === 'infra'
  );
}

function isDeliverableRepairStatus(status: AutoRecoveryStatus): boolean {
  return status?.statusKind === 'deliverable_repair';
}

function resolveResumeKind(status: AutoRecoveryStatus): TaskResumeKind | null {
  if (
    status?.recoveryOwner === 'infra_interrupt'
    || status?.recoveryOwner === 'deliverable_repair'
    || status?.recoveryOwner === 'engine_auto_continue'
    || status?.recoveryOwner === 'ui_incomplete_deliverable'
    || status?.recoveryOwner === 'stale_turn'
    || status?.recoveryOwner === 'recovery_pause'
  ) {
    return status.recoveryOwner;
  }
  if (isInfraInterruptStatus(status)) return 'infra_interrupt';
  if (isDeliverableRepairStatus(status)) return 'deliverable_repair';
  if (isRecoveryPauseStatus(status)) return 'recovery_pause';
  return null;
}

function isRecoveryHandlingStatus(status: AutoRecoveryStatus): boolean {
  return (
    status?.statusKind === 'recovery_handling'
    || String(status?.text || '').toLowerCase() === 'recovery_handling'
  );
}

function isBridgeStaleIdleStatus(status: AutoRecoveryStatus): boolean {
  return status?.interruptKind === 'stale_idle';
}

function buildContinueMessage(status: AutoRecoveryStatus, userGoal?: string): string {
  const kind = resolveResumeKind(status);
  if (kind === 'infra_interrupt' || kind === 'deliverable_repair') {
    return buildTaskResumeMessage({
      context: kind,
      lastTurnId: status?.lastTurnId,
      userGoal,
      verifiedPaths: status?.verifiedPaths,
      missingPaths: status?.missingPaths,
      instruction: kind === 'deliverable_repair'
        ? '修复缺失成果或更新正文为真实路径；勿重复已 verified 文件'
        : '从上次未完成步骤继续，勿重复已完成成果',
    });
  }
  try {
    const lang = typeof document !== 'undefined'
      ? document.documentElement.lang
      : '';
    return buildAutoRecoveryContinueMessage(lang.startsWith('en') ? 'en' : 'zh');
  } catch {
    return buildAutoRecoveryContinueMessage('zh');
  }
}

async function resolveContinuePayload(
  status: AutoRecoveryStatus,
  userGoal: string | undefined,
  sessionId: string,
  projectName?: string,
  projectPath?: string,
): Promise<string> {
  const kind = resolveResumeKind(status);
  if (kind === 'infra_interrupt') {
    try {
      const fromTranscript = await fetchTaskResumeContext(sessionId, projectName, projectPath);
      if (fromTranscript) return fromTranscript;
    } catch {
      // fall through to coordinator message
    }
  }
  return buildContinueMessage(status, userGoal);
}

/** UI 仅在引擎 recovery 暂停 / infra / deliverable_repair 后兜底续跑 */
function shouldScheduleAutoContinue(status: AutoRecoveryStatus): boolean {
  return resolveResumeKind(status) !== null;
}

/** 回合已成功或助手已交付成果时，不再触发 UI 兜底续跑（deliverable_repair 除外） */
export function shouldSuppressUiRecoveryContinue(
  meta: TurnCompleteOutcome | undefined,
  assistantText: string | undefined,
  status?: AutoRecoveryStatus,
): boolean {
  if (isDeliverableRepairStatus(status ?? null)) {
    return false;
  }
  if (meta && !shouldAutoContinueAfterTurnOutcome(meta)) {
    return true;
  }
  if (assistantText && looksLikeTaskDelivered(assistantText, { userGoal: meta?.userGoalText })) {
    return true;
  }
  return false;
}

/**
 * PD-SAAS-FORK: 重连后是否需要补发 turn-complete 信号。
 *
 * 当 WS 在某个回合进行中被掐断（Gateway 重编译、断网、代理抖动、开发期重启），引擎会把
 * 该回合以 `aborted_streaming` 收尾并落盘，但 UI 因断连收不到 `complete` 事件，于是
 * `turnCompleteSignal` 不变、两个续跑 hook 都不评估，任务就停在原地等用户手动「继续」。
 *
 * 重连时我们会发 `check-session-status`：若断连前该会话确实在跑、而重连后后端报已不在
 * 处理，说明该回合是在断连窗口内结束的（绝大多数是 aborted）。这种情况下补发一次
 * turn-complete，交给 useIncompleteDeliverableAutoContinue 基于真实助手文本与用户目标
 * 判断是否软续跑——已交付或用户曾主动停止（userAborted）则不会续跑。
 */
export function shouldRefireTurnCompleteAfterReconnect(args: {
  armedWhileLoading: boolean;
  sessionStillProcessing: boolean;
}): boolean {
  return args.armedWhileLoading && !args.sessionStillProcessing;
}

export function useAutoRecoveryContinue({
  sessionId,
  turnBoundaryKey,
  status,
  isLoading,
  isLoadingSessionMessages = false,
  isConnected = true,
  enabled = true,
  userActionBlocked = false,
  userAcknowledgedComplete = false,
  sessionTerminalComplete = false,
  autoContinueBlocked = false,
  turnCompleteSignal = 0,
  turnCompleteMeta,
  lastAssistantText,
  userGoal,
  projectName,
  projectPath,
  onContinue,
  onResumeHint,
}: UseAutoRecoveryContinueOptions): UseAutoRecoveryContinueResult {
  const countRef = useRef(0);
  const lastTurnKeyRef = useRef(turnBoundaryKey);
  const scheduledRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pauseGenerationRef = useRef(0);
  const lastFiredGenerationRef = useRef(-1);
  const pendingPauseRef = useRef(false);
  const lastTurnCompleteSignalRef = useRef(turnCompleteSignal);
  const statusRef = useRef(status);
  statusRef.current = status;
  const exhaustVerifiedBaselineRef = useRef<number | undefined>(undefined);
  const [resumeHintVisible, setResumeHintVisible] = useState(false);
  const [resumeHintMessage, setResumeHintMessage] = useState('');
  const [recoveryContinuePending, setRecoveryContinuePending] = useState(false);

  const dismissResumeHint = useCallback(() => {
    setResumeHintVisible(false);
  }, []);

  const showResumeHint = useCallback(() => {
    const lang = typeof document !== 'undefined' && document.documentElement.lang.startsWith('en')
      ? 'en' as const
      : 'zh' as const;
    const message = resolveResumeHintMessage(lang);
    setResumeHintMessage(message);
    setResumeHintVisible(true);
    onResumeHint?.(message);
  }, [onResumeHint]);

  useEffect(() => {
    if (lastTurnKeyRef.current !== turnBoundaryKey) {
      lastTurnKeyRef.current = turnBoundaryKey;
      countRef.current = 0;
      pendingPauseRef.current = false;
      exhaustVerifiedBaselineRef.current = undefined;
      setRecoveryContinuePending(false);
    }
  }, [turnBoundaryKey]);

  useEffect(() => {
    const current = statusRef.current;
    if (typeof current?.budgetRemaining === 'number' && current.budgetRemaining <= 0) {
      if (exhaustVerifiedBaselineRef.current === undefined) {
        exhaustVerifiedBaselineRef.current = countVerifiedPaths(current);
      }
    } else if (typeof current?.budgetRemaining === 'number' && current.budgetRemaining > 0) {
      exhaustVerifiedBaselineRef.current = undefined;
    }
  }, [status?.budgetRemaining, status?.verifiedPaths]);

  const clearScheduled = useCallback(() => {
    if (scheduledRef.current) {
      clearTimeout(scheduledRef.current);
      scheduledRef.current = null;
    }
  }, []);

  const scheduleContinue = useCallback(() => {
    if (!enabled || !sessionId || !readAutoContinueEnabled() || !isConnected) return;
    if (userActionBlocked || userAcknowledgedComplete || sessionTerminalComplete || autoContinueBlocked) return;
    if (isLoading || isLoadingSessionMessages) return;
    if (isRecoveryHandlingStatus(statusRef.current)) return;

    const budgetCap = resolveUiBudgetCap(statusRef.current, {
      exhaustVerifiedBaseline: exhaustVerifiedBaselineRef.current,
    });
    if (budgetCap <= 0 || countRef.current >= budgetCap) return;

    const resumeKind = resolveResumeKind(statusRef.current);
    if (!resumeKind) return;
    if (!tryTaskResumeSchedule(turnBoundaryKey, resumeKind)) return;

    const generation = pauseGenerationRef.current;
    if (generation === lastFiredGenerationRef.current) return;

    clearScheduled();
    scheduledRef.current = setTimeout(() => {
      scheduledRef.current = null;
      if (generation !== pauseGenerationRef.current) return;
      if (generation === lastFiredGenerationRef.current) return;
      if (!isConnected || isLoading || isLoadingSessionMessages) return;
      if (isRecoveryHandlingStatus(statusRef.current)) return;

      const cap = resolveUiBudgetCap(statusRef.current, {
        exhaustVerifiedBaseline: exhaustVerifiedBaselineRef.current,
      });
      if (cap <= 0 || countRef.current >= cap) return;
      if (!markTaskResumeFired(turnBoundaryKey, resumeKind)) return;

      lastFiredGenerationRef.current = generation;
      pendingPauseRef.current = false;
      setRecoveryContinuePending(false);
      countRef.current += 1;
      showResumeHint();
      void resolveContinuePayload(
        statusRef.current,
        userGoal,
        sessionId,
        projectName,
        projectPath,
      ).then((message) => {
        try {
          onContinue(message);
        } catch (error) {
          console.warn('[autoRecoveryContinue] skipped:', error);
        }
      }).catch((error) => {
        console.warn('[autoRecoveryContinue] payload failed:', error);
      });
    }, CONTINUE_DELAY_MS);
  }, [clearScheduled, enabled, isConnected, isLoading, isLoadingSessionMessages, onContinue, projectName, projectPath, sessionId, showResumeHint, turnBoundaryKey, userActionBlocked, userAcknowledgedComplete, sessionTerminalComplete, autoContinueBlocked, userGoal]);

  useEffect(() => {
    if (!enabled || !sessionId || !readAutoContinueEnabled() || !isConnected) {
      clearScheduled();
      return;
    }
    if (userActionBlocked || userAcknowledgedComplete || sessionTerminalComplete || autoContinueBlocked) {
      pendingPauseRef.current = false;
      setRecoveryContinuePending(false);
      clearScheduled();
      return;
    }

    if (shouldSuppressUiRecoveryContinue(turnCompleteMeta, lastAssistantText, status)) {
      pendingPauseRef.current = false;
      setRecoveryContinuePending(false);
      clearScheduled();
      return;
    }

    if (shouldScheduleAutoContinue(status)) {
      pauseGenerationRef.current += 1;
      pendingPauseRef.current = true;
      setRecoveryContinuePending(true);
      if (!isLoading && !isLoadingSessionMessages) {
        scheduleContinue();
      }
      return;
    }

    if (pendingPauseRef.current && !isLoading && !isLoadingSessionMessages) {
      scheduleContinue();
      return undefined;
    }

    pendingPauseRef.current = false;
    setRecoveryContinuePending(false);

    if (!shouldScheduleAutoContinue(status) && (isLoading || isLoadingSessionMessages)) {
      pendingPauseRef.current = false;
    }

    return clearScheduled;
  }, [
    clearScheduled,
    enabled,
    isConnected,
    isLoading,
    isLoadingSessionMessages,
    scheduleContinue,
    sessionId,
    userActionBlocked,
    userAcknowledgedComplete,
    sessionTerminalComplete,
    autoContinueBlocked,
    status?.statusKind,
    status?.text,
    status?.budgetRemaining,
    status?.recoveryAttempt,
    status?.recoveryMax,
    status?.interruptKind,
    lastAssistantText,
    turnCompleteMeta,
  ]);

  useEffect(() => {
    if (!enabled || !sessionId || !readAutoContinueEnabled() || !isConnected) return;
    if (userActionBlocked || userAcknowledgedComplete || sessionTerminalComplete || autoContinueBlocked) return;
    if (turnCompleteSignal === lastTurnCompleteSignalRef.current) return;
    lastTurnCompleteSignalRef.current = turnCompleteSignal;
    if (isLoading || isLoadingSessionMessages) return;

    if (shouldSuppressUiRecoveryContinue(turnCompleteMeta, lastAssistantText, status)) {
      pendingPauseRef.current = false;
      clearScheduled();
      return;
    }

    if (!shouldScheduleAutoContinue(status)) {
      return;
    }

    pauseGenerationRef.current += 1;
    pendingPauseRef.current = true;
    scheduleContinue();
  }, [
    clearScheduled,
    enabled,
    isConnected,
    isLoading,
    isLoadingSessionMessages,
    lastAssistantText,
    scheduleContinue,
    sessionId,
    userActionBlocked,
    userAcknowledgedComplete,
    sessionTerminalComplete,
    autoContinueBlocked,
    status,
    turnCompleteMeta,
    turnCompleteSignal,
  ]);

  useEffect(() => () => clearScheduled(), [clearScheduled]);

  return {
    autoContinueCount: countRef.current,
    resumeHintVisible,
    resumeHintMessage,
    dismissResumeHint,
    recoveryContinuePending,
  };
}

export {
  AUTO_CONTINUE_KEY,
  MAX_AUTO_CONTINUES,
  isRecoveryPauseStatus,
  isInfraInterruptStatus,
  isDeliverableRepairStatus,
  isBridgeStaleIdleStatus,
};
