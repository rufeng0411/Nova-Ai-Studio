import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ClaudeWorkStatus, CompactProgress, PendingPermissionRequest, PilotDeckWorkStatus } from '../types/types';
import type { Project, ProjectSession, SessionProvider } from '../../../types/app';
import type { SessionStore, NormalizedMessage } from '../../../stores/useSessionStore';
import { useWebSocket } from '../../../contexts/WebSocketContext';
import { SmoothTextStream } from './streamSmoother';
import { isMessageForActiveChatView, isInteractiveElicitationToolName } from '../../../shared/pendingElicitation';
import { isTemporarySessionId } from '../utils/sessionLauncher';
import { stampPendingSessionRealId, updatePendingSessionExecutionStatus } from '../../../shared/pendingSessionIntent';
import { isSessionBusyInternalError } from '../../../shared/userFacingErrors';

type PendingViewSession = {
  sessionId: string | null;
  startedAt: number;
};

type LatestChatMessage = {
  type?: string;
  kind?: string;
  data?: any;
  message?: any;
  delta?: string;
  sessionId?: string;
  session_id?: string;
  requestId?: string;
  toolName?: string;
  input?: unknown;
  context?: unknown;
  error?: string;
  tool?: any;
  toolId?: string;
  result?: any;
  exitCode?: number;
  isProcessing?: boolean;
  actualSessionId?: string;
  event?: string;
  status?: any;
  isNewSession?: boolean;
  activeTurnMessages?: LatestChatMessage[];
  activitySnapshot?: LatestChatMessage[];
  compactProgress?: CompactProgress;
  compact_progress?: CompactProgress;
  resultText?: string;
  isError?: boolean;
  success?: boolean;
  reason?: string;
  provider?: string;
  content?: string;
  text?: string;
  tokens?: number;
  canInterrupt?: boolean;
  tokenBudget?: unknown;
  newSessionId?: string;
  aborted?: boolean;
  [key: string]: any;
};

type StreamSmootherMap = Map<string, SmoothTextStream>;

export type RecoveryTurnCompleteOutcome = {
  exitCode?: number;
  aborted?: boolean;
  userAborted?: boolean;
  success?: boolean;
  budgetRemaining?: number;
  interruptKind?: string;
  missingPaths?: string[];
  verifiedPaths?: string[];
  lastTurnId?: string;
  recoveryOwner?: string;
  errorCode?: string;
  errorRecoverable?: boolean;
};

function getExplicitSessionId(msg: LatestChatMessage): string | null {
  const value = msg.sessionId ?? msg.session_id ?? msg.actualSessionId ?? msg.newSessionId;
  return typeof value === 'string' && value.trim() ? value : null;
}

export function buildRecoveryTurnCompleteOutcome(
  msg: LatestChatMessage,
  fallbackTurnId?: string | null,
): RecoveryTurnCompleteOutcome {
  return {
    exitCode: msg.exitCode,
    aborted: msg.aborted,
    userAborted: msg.userAborted,
    success: msg.success,
    budgetRemaining: typeof msg.budgetRemaining === 'number' ? msg.budgetRemaining : undefined,
    interruptKind: typeof msg.interruptKind === 'string' ? msg.interruptKind : undefined,
    missingPaths: Array.isArray(msg.missingPaths) ? msg.missingPaths : undefined,
    verifiedPaths: Array.isArray(msg.verifiedPaths) ? msg.verifiedPaths : undefined,
    lastTurnId: typeof msg.lastTurnId === 'string' ? msg.lastTurnId : fallbackTurnId ?? undefined,
    recoveryOwner: typeof msg.recoveryOwner === 'string' ? msg.recoveryOwner : undefined,
    errorCode: typeof (msg as { errorCode?: string }).errorCode === 'string'
      ? (msg as { errorCode?: string }).errorCode
      : undefined,
    errorRecoverable: (msg as { errorRecoverable?: boolean }).errorRecoverable === false
      ? false
      : undefined,
  };
}

export function shouldSuppressRecoveryForRealtimeError(msg: LatestChatMessage): boolean {
  return isSessionBusyInternalError(
    typeof msg.code === 'string' ? msg.code : undefined,
    typeof msg.message === 'string' ? msg.message : typeof msg.content === 'string' ? msg.content : undefined,
  );
}

function resolveSessionId(
  msg: LatestChatMessage,
  fallbackSessionId?: string | null,
): string | null {
  const explicit = getExplicitSessionId(msg);
  if (explicit) return explicit;
  if (typeof fallbackSessionId === 'string' && fallbackSessionId.trim()) {
    return fallbackSessionId.trim();
  }
  return null;
}

function warnDroppedFrame(msg: LatestChatMessage): void {
  console.warn('[chat] Dropped WS frame without sessionId', {
    kind: msg.kind,
    type: msg.type,
  });
}

function warnResolvedSessionId(msg: LatestChatMessage, fallbackSessionId: string): void {
  console.warn('[chat] Resolved missing sessionId from parent context', {
    kind: msg.kind,
    type: msg.type,
    fallbackSessionId,
  });
}

function getOrCreateSmoother(
  map: StreamSmootherMap,
  sessionId: string,
  create: () => SmoothTextStream,
): SmoothTextStream {
  let state = map.get(sessionId);
  if (!state) {
    state = create();
    map.set(sessionId, state);
  }
  return state;
}

/** PD-SAAS-FORK: failed/aborted turns must not promote partial stream text into chat bubbles. */
function shouldDiscardStreamingForBoundary(msg: LatestChatMessage): boolean {
  if (!msg || typeof msg !== 'object') return false;
  const kind = String(msg.kind || '');
  if (kind === 'error') return true;
  if (kind !== 'complete') return false;
  const complete = msg as { aborted?: boolean; success?: boolean; exitCode?: number };
  if (complete.aborted === true) return true;
  const succeeded = complete.success !== false
    && (complete.exitCode === undefined || complete.exitCode === 0);
  return !succeeded;
}

interface UseChatRealtimeHandlersArgs {
  provider: SessionProvider;
  selectedProject: Project | null;
  selectedSession: ProjectSession | null;
  currentSessionId: string | null;
  setCurrentSessionId: (sessionId: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  setCanAbortSession: (canAbort: boolean) => void;
  setIsAborting: (aborting: boolean) => void;
  setClaudeStatus: (status: ClaudeWorkStatus | null) => void;
  setPilotDeckStatus: (status: PilotDeckWorkStatus | null) => void;
  setTokenBudget: (budget: Record<string, unknown> | null) => void;
  setPendingPermissionRequests: Dispatch<SetStateAction<PendingPermissionRequest[]>>;
  pendingViewSessionRef: MutableRefObject<PendingViewSession | null>;
  onSessionInactive?: (sessionId?: string | null) => void;
  onSessionProcessing?: (sessionId?: string | null) => void;
  onSessionNotProcessing?: (sessionId?: string | null) => void;
  onReplaceTemporarySession?: (sessionId?: string | null) => void;
  onNavigateToSession?: (sessionId: string) => void;
  onWebSocketReconnect?: () => void;
  sessionStore: SessionStore;
  onTurnComplete?: (outcome: {
    exitCode?: number;
    aborted?: boolean;
    userAborted?: boolean;
    success?: boolean;
    budgetRemaining?: number;
    interruptKind?: string;
    missingPaths?: string[];
    verifiedPaths?: string[];
    lastTurnId?: string;
    recoveryOwner?: string;
  }) => void;
  onTurnRejected?: (payload: { reason?: string }) => void;
  onTurnAccepted?: (payload: {
    sessionId: string;
    executionStatus?: string;
    queuePosition?: number;
  }) => void;
  onExecutionStatusChange?: (payload: {
    sessionId: string;
    executionStatus?: string;
    pausedReason?: string | null;
    queuePosition?: number | null;
  }) => void;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useChatRealtimeHandlers({
  provider,
  selectedSession,
  currentSessionId,
  setCurrentSessionId,
  setIsLoading,
  setCanAbortSession,
  setIsAborting,
  setClaudeStatus,
  setPilotDeckStatus,
  setTokenBudget,
  setPendingPermissionRequests,
  pendingViewSessionRef,
  onSessionInactive,
  onSessionProcessing,
  onSessionNotProcessing,
  onReplaceTemporarySession,
  onNavigateToSession,
  onWebSocketReconnect,
  sessionStore,
  onTurnComplete,
  onTurnRejected,
  onTurnAccepted,
  onExecutionStatusChange,
}: UseChatRealtimeHandlersArgs) {
  const { subscribe } = useWebSocket();

  const streamBySessionRef = useRef<StreamSmootherMap>(new Map());
  const thinkingBySessionRef = useRef<StreamSmootherMap>(new Map());
  // PD-SAAS-FORK: dedupe activeTurn replay after reconnect
  const seenActiveTurnFrameRef = useRef<Set<string>>(new Set());

  const handleMessage = useCallback((latestMessage: LatestChatMessage, fallbackSessionId?: string | null) => {
    if (!latestMessage) return;

    const pendingSessionId = pendingViewSessionRef.current?.sessionId ?? null;
    const activeCurrentSessionId =
      pendingSessionId === currentSessionId ? currentSessionId : null;
    const activeViewSessionId =
      selectedSession?.id || activeCurrentSessionId || pendingSessionId || null;

    /* ---------------------------------------------------------------- */
    /*  Legacy messages (no `kind` field) — handle and return           */
    /* ---------------------------------------------------------------- */

    const msg = latestMessage as any;
    const clearAccumulators = () => {
      for (const state of streamBySessionRef.current.values()) {
        state.cancel();
      }
      for (const state of thinkingBySessionRef.current.values()) {
        state.cancel();
      }
      streamBySessionRef.current.clear();
      thinkingBySessionRef.current.clear();
    };
    const flushStream = (sessionId: string, finalize = false) => {
      const state = streamBySessionRef.current.get(sessionId);
      if (!state) return;
      state.flush(finalize);
      if (finalize) {
        streamBySessionRef.current.delete(sessionId);
      }
    };
    const flushThinking = (sessionId: string, finalize = false) => {
      const state = thinkingBySessionRef.current.get(sessionId);
      if (!state) return;
      state.flush(finalize);
      if (finalize) {
        thinkingBySessionRef.current.delete(sessionId);
      }
    };

    if (!msg.kind) {
      const messageType = String(msg.type || '');

      switch (messageType) {
        case 'websocket-reconnected':
          clearAccumulators();
          onWebSocketReconnect?.();
          return;

        case 'pending-permissions-response': {
          const permSessionId = msg.sessionId;
          const isCurrentPermSession =
            permSessionId === currentSessionId || (selectedSession && permSessionId === selectedSession.id);
          if (permSessionId && !isCurrentPermSession) return;
          setPendingPermissionRequests(msg.data || []);
          return;
        }

        case 'session-status': {
          const statusSessionId = msg.sessionId;
          if (!statusSessionId) return;
          const isCurrentSession =
            statusSessionId === currentSessionId || (selectedSession && statusSessionId === selectedSession.id);

          if (isCurrentSession && Array.isArray(msg.activeTurnMessages) && msg.activeTurnMessages.length > 0) {
            for (let index = 0; index < msg.activeTurnMessages.length; index += 1) {
              const activeTurnMessage = msg.activeTurnMessages[index];
              const frameKey = [
                statusSessionId,
                (msg as { runId?: string }).runId ?? 'run',
                (activeTurnMessage as { id?: string }).id
                  ?? (activeTurnMessage as { messageId?: string }).messageId
                  ?? `${index}:${String((activeTurnMessage as { kind?: string }).kind ?? '')}`,
              ].join(':');
              if (seenActiveTurnFrameRef.current.has(frameKey)) continue;
              seenActiveTurnFrameRef.current.add(frameKey);
              handleMessage(activeTurnMessage, statusSessionId);
            }
          }

          if (isCurrentSession && Array.isArray(msg.activitySnapshot)) {
            const activities = msg.activitySnapshot.map((activity) => {
              const normalized = activity as NormalizedMessage;
              if (getExplicitSessionId(normalized)) return normalized;
              return { ...normalized, sessionId: statusSessionId };
            });
            sessionStore.setActivities?.(statusSessionId, activities);
          }

          const status = msg.status;
          if (status) {
            if (!isCurrentSession) return;
            const statusInfo = {
              text: status.text || 'Working...',
              tokens: status.tokens || 0,
              can_interrupt: status.can_interrupt !== undefined ? status.can_interrupt : true,
              compactProgress: status.compactProgress || status.compact_progress || null,
            };
            setClaudeStatus(statusInfo);
            setPilotDeckStatus(statusInfo);
            setIsLoading(true);
            setCanAbortSession(statusInfo.can_interrupt);
            return;
          }

          if (isCurrentSession && msg.tokenBudget) {
            setTokenBudget(msg.tokenBudget as Record<string, unknown>);
          }

          // Legacy isProcessing format from check-session-status
          if (msg.isProcessing) {
            onSessionProcessing?.(statusSessionId);
            if (isCurrentSession) { setIsLoading(true); setCanAbortSession(true); }
            return;
          }
          onSessionInactive?.(statusSessionId);
          onSessionNotProcessing?.(statusSessionId);
          if (isCurrentSession) {
            setIsLoading(false);
            setCanAbortSession(false);
            setClaudeStatus(null);
            setPilotDeckStatus(null);
          }
          return;
        }

        case 'turn_accepted': {
          const acceptedSessionId = typeof msg.sessionId === 'string' ? msg.sessionId : null;
          if (!acceptedSessionId) return;
          const optimisticId =
            isTemporarySessionId(currentSessionId)
              ? currentSessionId
              : isTemporarySessionId(selectedSession?.id ?? null)
                ? selectedSession!.id
                : undefined;
          stampPendingSessionRealId(acceptedSessionId, optimisticId);
          const executionStatus = typeof msg.executionStatus === 'string' ? msg.executionStatus : 'running';
          updatePendingSessionExecutionStatus(acceptedSessionId, executionStatus as 'queued' | 'running' | 'paused' | 'idle');
          onReplaceTemporarySession?.(acceptedSessionId);
          onTurnAccepted?.({
            sessionId: acceptedSessionId,
            executionStatus,
            queuePosition: typeof msg.queuePosition === 'number' ? msg.queuePosition : undefined,
          });
          onExecutionStatusChange?.({
            sessionId: acceptedSessionId,
            executionStatus,
            queuePosition: executionStatus === 'queued'
              ? (typeof msg.queuePosition === 'number' ? msg.queuePosition : null)
              : null,
          });
          const isAcceptedForActiveView =
            acceptedSessionId === activeViewSessionId
            || isTemporarySessionId(currentSessionId)
            || isTemporarySessionId(selectedSession?.id ?? null);
          if (executionStatus === 'queued') {
            if (isAcceptedForActiveView) {
              setIsLoading(false);
              setCanAbortSession(false);
              setIsAborting(false);
              setClaudeStatus(null);
              setPilotDeckStatus(null);
            }
            onSessionNotProcessing?.(acceptedSessionId);
          } else if (executionStatus === 'running') {
            onSessionProcessing?.(acceptedSessionId);
            if (isAcceptedForActiveView) {
              setIsLoading(true);
              setCanAbortSession(true);
            }
          }
          if (window.refreshProjects) {
            setTimeout(() => window.refreshProjects?.(), 300);
          }
          return;
        }

        case 'turn_started': {
          const startedSessionId = typeof msg.sessionId === 'string' ? msg.sessionId : null;
          if (!startedSessionId) return;
          updatePendingSessionExecutionStatus(startedSessionId, 'running');
          onExecutionStatusChange?.({
            sessionId: startedSessionId,
            executionStatus: 'running',
            queuePosition: null,
          });
          onSessionProcessing?.(startedSessionId);
          if (startedSessionId === activeViewSessionId) {
            setIsLoading(true);
            setCanAbortSession(true);
          }
          if (window.refreshProjects) {
            setTimeout(() => window.refreshProjects?.(), 300);
          }
          return;
        }

        case 'turn_paused': {
          const pausedSessionId = typeof msg.sessionId === 'string' ? msg.sessionId : null;
          if (!pausedSessionId) return;
          updatePendingSessionExecutionStatus(pausedSessionId, 'paused');
          onExecutionStatusChange?.({
            sessionId: pausedSessionId,
            executionStatus: 'paused',
            pausedReason: typeof msg.reason === 'string' ? msg.reason : 'user_pause',
          });
          if (pausedSessionId === activeViewSessionId) {
            setIsLoading(false);
            setCanAbortSession(false);
            setIsAborting(false);
            setClaudeStatus(null);
            setPilotDeckStatus(null);
          }
          onSessionNotProcessing?.(pausedSessionId);
          if (window.refreshProjects) {
            setTimeout(() => window.refreshProjects?.(), 300);
          }
          return;
        }

        case 'queue_updated': {
          const updatedSessionId = typeof msg.sessionId === 'string' ? msg.sessionId : null;
          if (!updatedSessionId) return;
          const nextStatus = msg.cancelled
            ? 'idle'
            : typeof msg.executionStatus === 'string'
              ? msg.executionStatus
              : 'queued';
          updatePendingSessionExecutionStatus(updatedSessionId, nextStatus as 'queued' | 'running' | 'paused' | 'idle');
          onExecutionStatusChange?.({
            sessionId: updatedSessionId,
            executionStatus: nextStatus,
            queuePosition: nextStatus === 'idle' || nextStatus === 'running' ? null : undefined,
          });
          if (window.refreshProjects) {
            setTimeout(() => window.refreshProjects?.(), 300);
          }
          return;
        }

        case 'turn_queue_repaired': {
          if (window.refreshProjects) {
            setTimeout(() => window.refreshProjects?.(), 300);
          }
          return;
        }

        case 'turn_rejected': {
          const rejectedSessionId = typeof msg.sessionId === 'string' ? msg.sessionId : null;
          const isRejectedForActiveView =
            !rejectedSessionId
            || rejectedSessionId === activeViewSessionId
            || isTemporarySessionId(currentSessionId);
          if (isRejectedForActiveView) {
            setIsLoading(false);
            setCanAbortSession(false);
            setIsAborting(false);
            setClaudeStatus(null);
            setPilotDeckStatus(null);
            onTurnRejected?.({ reason: typeof msg.reason === 'string' ? msg.reason : undefined });
          }
          return;
        }

        default:
          // Unknown legacy message type — ignore
          return;
      }
    }

    const sid = resolveSessionId(msg, fallbackSessionId);
    if (!sid) {
      warnDroppedFrame(msg);
      return;
    }
    if (!getExplicitSessionId(msg) && fallbackSessionId) {
      warnResolvedSessionId(msg, sid);
    }

    const isForActiveView = isMessageForActiveChatView(sid, {
      currentSessionId,
      selectedSessionId: selectedSession?.id ?? null,
      pendingViewSessionId: pendingSessionId,
    }) || sid === activeViewSessionId;

    if (msg.kind === 'agent_activity') {
      sessionStore.upsertActivity?.(sid, msg as NormalizedMessage);
      return;
    }

    if (msg.kind === 'turn_acceptance_snapshot') {
      sessionStore.applyTurnAcceptanceSnapshot?.(sid, msg as NormalizedMessage);
      return;
    }

    if (msg.kind === 'session_manifest_updated') {
      sessionStore.applySessionManifestUpdate?.(sid, msg as NormalizedMessage);
      return;
    }

    // --- Streaming: buffer for performance ---
    if (msg.kind === 'stream_delta') {
      const text = msg.content || '';
      if (!text) return;
      // Flush this session's thinking before its assistant text starts.
      flushThinking(sid, true);
      const state = getOrCreateSmoother(
        streamBySessionRef.current,
        sid,
        () => new SmoothTextStream({
          emit: (content) => sessionStore.updateStreaming(sid, content, provider),
          finalize: () => sessionStore.finalizeStreaming(sid),
          frameMs: 50,
        }),
      );
      state.append(text);
      return;
    }

    // --- Thinking: accumulate into a single message like stream_delta ---
    if (msg.kind === 'thinking') {
      const text = msg.content || '';
      if (!text) return;
      const state = getOrCreateSmoother(
        thinkingBySessionRef.current,
        sid,
        () => new SmoothTextStream({
          emit: (content) => sessionStore.updateStreamingThinking(sid, content, provider),
          finalize: () => sessionStore.finalizeStreamingThinking(sid),
          frameMs: 50,
        }),
      );
      state.append(text);
      return;
    }

    if (msg.kind === 'stream_end') {
      flushStream(sid, true);
      return;
    }

    // --- Turn boundary: finalize or discard in-flight streaming before non-stream msgs ---
    flushThinking(sid, true);
    if (shouldDiscardStreamingForBoundary(msg)) {
      const streamState = streamBySessionRef.current.get(sid);
      streamState?.cancel();
      streamBySessionRef.current.delete(sid);
      sessionStore.cancelStreaming?.(sid);
    } else {
      flushStream(sid, true);
    }

    // --- All other messages: route to store ---
    // Skip assistant text messages that duplicate finalized streaming content.
    // The streaming pipeline (stream_delta → stream_end → finalizeStreaming)
    // already creates a text message in realtimeMessages. If the backend also
    // sends a standalone 'text' message with the same content, skip it.
    const isDuplicateStreamText =
      msg.kind === 'text' && msg.role === 'assistant' &&
      sessionStore.getSessionSlot?.(sid)?.realtimeMessages.some(
        (m) => m.kind === 'text' && m.role === 'assistant' && m.content === (msg as NormalizedMessage).content,
      );
    if (!isDuplicateStreamText) {
      sessionStore.appendRealtime(sid, msg as NormalizedMessage);
    }

    // --- UI side effects for specific kinds ---
    switch (msg.kind) {
      case 'session_created': {
        const newSessionId = msg.newSessionId;
        if (!newSessionId) break;

        const optimisticId = currentSessionId?.startsWith('new-session-') ? currentSessionId : undefined;
        stampPendingSessionRealId(newSessionId, optimisticId);

        if (!currentSessionId || currentSessionId.startsWith('new-session-')) {
          sessionStorage.setItem('pendingSessionId', newSessionId);
          if (pendingViewSessionRef.current && !pendingViewSessionRef.current.sessionId) {
            pendingViewSessionRef.current.sessionId = newSessionId;
          }
          setCurrentSessionId(newSessionId);
          // Eagerly set activeSession so that notify() works for
          // stream_delta events that arrive before React re-renders.
          sessionStore.setActiveSession(newSessionId);
          onReplaceTemporarySession?.(newSessionId);
          setPendingPermissionRequests((prev) =>
            prev.map((r) => (r.sessionId ? r : { ...r, sessionId: newSessionId })),
          );
          onNavigateToSession?.(newSessionId);
        }
        if (window.refreshProjects) {
          void window.refreshProjects();
        }
        break;
      }

      case 'complete': {
        if (sid) {
          flushThinking(sid, true);
          flushStream(sid, true);
        }

        if (isForActiveView) {
          setIsLoading(false);
          setCanAbortSession(false);
          setIsAborting(false);
          // PD-SAAS-FORK: mid-turn recovery_exhausted can set recovery_pause while the
          // engine still finishes successfully — clear stale pause on success.
          const turnSucceeded = msg.aborted !== true
            && msg.success !== false
            && (msg.exitCode === undefined || msg.exitCode === 0);
          if (turnSucceeded) {
            setClaudeStatus(null);
            setPilotDeckStatus(null);
          } else {
            setClaudeStatus((prev) => {
              const pause =
                prev?.statusKind === 'recovery_pause'
                || String(prev?.text || '').toLowerCase() === 'recovery_pause';
              return pause ? prev : null;
            });
            setPilotDeckStatus((prev) => {
              const pause =
                prev?.statusKind === 'recovery_pause'
                || String(prev?.text || '').toLowerCase() === 'recovery_pause';
              return pause ? prev : null;
            });
          }
        }
        if (sid) {
          setPendingPermissionRequests((prev) =>
            prev.filter((r) => r.sessionId !== sid),
          );
          onSessionInactive?.(sid);
          onSessionNotProcessing?.(sid);
        }

        onTurnComplete?.(buildRecoveryTurnCompleteOutcome(msg, sid));

        // Handle aborted case
        if (msg.aborted) {
          // Abort was requested — the complete event confirms it
          // No special UI action needed beyond clearing loading state above
          // The backend already sent any abort-related messages
          break;
        }

        // Clear pending session
        const pendingSessionId = sessionStorage.getItem('pendingSessionId');
        if (pendingSessionId && sid === pendingSessionId && msg.exitCode === 0) {
          const actualId = msg.actualSessionId || pendingSessionId;
          if (!currentSessionId) {
            setCurrentSessionId(actualId);
          }
          if (msg.actualSessionId) {
            onNavigateToSession?.(actualId);
          }
          sessionStorage.removeItem('pendingSessionId');
          if (window.refreshProjects) {
            setTimeout(() => window.refreshProjects?.(), 500);
          }
        }
        break;
      }

      case 'error': {
        const suppressRecovery = shouldSuppressRecoveryForRealtimeError(msg);
        if (isForActiveView) {
          if (!suppressRecovery) {
            setIsLoading(false);
            setCanAbortSession(false);
            setIsAborting(false);
          }
          const recoverable = Boolean((msg as { recoverable?: boolean }).recoverable);
          if (recoverable && !suppressRecovery) {
            const recoveryStatus = {
              text: 'recovery_pause',
              tokens: 0,
              can_interrupt: false,
              statusKind: 'recovery_pause',
            };
            setClaudeStatus(recoveryStatus);
            setPilotDeckStatus(recoveryStatus);
          } else {
            setClaudeStatus(null);
            setPilotDeckStatus(null);
          }
        }
        if (sid) {
          if (!suppressRecovery) {
            onSessionInactive?.(sid);
            onSessionNotProcessing?.(sid);
          }
        }
        if (Boolean((msg as { recoverable?: boolean }).recoverable) && !suppressRecovery) {
          onTurnComplete?.(buildRecoveryTurnCompleteOutcome({
            ...msg,
            exitCode: 1,
            success: false,
          }, sid));
        }
        break;
      }

      case 'permission_request': {
        if (!msg.requestId) break;
        const isForCurrentSession = isForActiveView || (
          pendingSessionId
          && sid === pendingSessionId
          && (isTemporarySessionId(currentSessionId) || isTemporarySessionId(selectedSession?.id ?? null))
        );
        if (!isForCurrentSession) break;
        const isElicitation = Boolean((msg as { isElicitation?: boolean }).isElicitation)
          || isInteractiveElicitationToolName(msg.toolName);
        setPendingPermissionRequests((prev) => {
          if (prev.some((r: PendingPermissionRequest) => r.requestId === msg.requestId)) return prev;
          return [...prev, {
            requestId: msg.requestId,
            toolName: msg.toolName || 'UnknownTool',
            input: msg.input,
            context: msg.context,
            sessionId: sid,
            receivedAt: new Date(),
            isElicitation,
            toolCallId: typeof (msg as { toolCallId?: string }).toolCallId === 'string'
              ? (msg as { toolCallId?: string }).toolCallId
              : undefined,
          }];
        });
        setIsLoading(true);
        setCanAbortSession(true);
        const statusInfo = isElicitation
          ? {
            text: 'needs_input',
            tokens: 0,
            can_interrupt: true,
            statusKind: 'elicitation' as const,
          }
          : {
            text: 'Waiting for permission',
            tokens: 0,
            can_interrupt: true,
            statusKind: 'permission' as const,
          };
        setClaudeStatus(statusInfo);
        setPilotDeckStatus(statusInfo);
        break;
      }

      case 'permission_cancelled': {
        if (msg.requestId) {
          setPendingPermissionRequests((prev) => prev.filter((r: PendingPermissionRequest) => r.requestId !== msg.requestId));
        }
        break;
      }

      case 'status': {
        if (!isForActiveView) break;
        if (msg.text === 'token_budget' && msg.tokenBudget) {
          setTokenBudget(msg.tokenBudget as Record<string, unknown>);
        } else if (msg.text === 'clear_status') {
          setClaudeStatus(null);
          setPilotDeckStatus(null);
        } else if (msg.text) {
          const statusInfo = {
            text: msg.text,
            tokens: msg.tokens || 0,
            can_interrupt: msg.canInterrupt !== undefined ? msg.canInterrupt : true,
            compactProgress: msg.compactProgress || msg.compact_progress || null,
            statusKind: msg.statusKind,
            recoveryAttempt: msg.recoveryAttempt,
            recoveryMax: msg.recoveryMax,
            budgetRemaining: msg.budgetRemaining,
            interruptKind: msg.interruptKind,
            missingPaths: Array.isArray(msg.missingPaths) ? msg.missingPaths : undefined,
            verifiedPaths: Array.isArray(msg.verifiedPaths) ? msg.verifiedPaths : undefined,
            lastTurnId: typeof msg.lastTurnId === 'string' ? msg.lastTurnId : sid ?? undefined,
            recoveryOwner: msg.recoveryOwner,
          };
          setClaudeStatus(statusInfo);
          setPilotDeckStatus(statusInfo);
          setIsLoading(true);
          setCanAbortSession(msg.canInterrupt !== false);
        }
        break;
      }

      case 'compact_boundary': {
        if (isForActiveView) {
          setClaudeStatus(null);
          setPilotDeckStatus(null);
          setIsLoading(true);
          setCanAbortSession(true);
        }
        break;
      }

      // text, tool_use, tool_result, thinking, interactive_prompt, task_notification
      // → already routed to store above, no UI side effects needed
      default:
        break;
    }
  }, [
    provider,
    selectedSession,
    currentSessionId,
    setCurrentSessionId,
    setIsLoading,
    setCanAbortSession,
    setIsAborting,
    setClaudeStatus,
    setPilotDeckStatus,
    setTokenBudget,
    setPendingPermissionRequests,
    pendingViewSessionRef,
    onSessionInactive,
    onSessionProcessing,
    onSessionNotProcessing,
    onReplaceTemporarySession,
    onNavigateToSession,
    onWebSocketReconnect,
    sessionStore,
    onTurnComplete,
    onTurnRejected,
  ]);

  useEffect(() => {
    if (!subscribe) return;
    return subscribe(handleMessage as (msg: any) => void);
  }, [subscribe, handleMessage]);
}
