import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTasksSettings } from '../../contexts/TasksSettingsContext';
import type { ChatInterfaceProps, ChatRunMode, Provider } from '../chat/types/types';
import {
 getSessionRequestParams,
 isBackgroundTaskSession,
} from '../../types/app';
import {
 isSessionSidebarCompleted,
 isSessionSidebarLocked,
 isSessionSidebarRevokedAutoComplete,
 setSessionSidebarCompleted,
 setSessionSidebarRevokedAutoComplete,
 useSessionSidebarStateVersion,
 SESSION_SIDEBAR_UNMARK_FOCUS_EVENT,
} from '../../lib/sessionSidebarState';
import { useChatProviderState } from '../chat/hooks/useChatProviderState';
import { useChatSessionState } from '../chat/hooks/useChatSessionState';
import { useChatRealtimeHandlers } from '../chat/hooks/useChatRealtimeHandlers';
import { useChatComposerState } from '../chat/hooks/useChatComposerState';
import { startSessionCommand } from '../chat/utils/sessionLauncher';
import { getPilotDeckSettings } from '../chat/utils/chatStorage';
import { useRuntimeFeatureFlags } from '../../shared/useRuntimeFeatureFlags';
import { useAutoRecoveryContinue, shouldRefireTurnCompleteAfterReconnect, resolveUiBudgetCap, readAutoContinueEnabled } from './hooks/useAutoRecoveryContinue';
import { resolveManualContinueOffer, type ManualContinueReason } from '../../shared/manualContinuePolicy';
import { fetchTaskResumeContext } from '../../shared/fetchTaskResumeContext';
import { markTaskResumeFired, prepareUserManualTaskResume, tryTaskResumeSchedule } from './hooks/taskResumeCoordinator';
import { useIncompleteDeliverableAutoContinue } from './hooks/useIncompleteDeliverableAutoContinue';
import { sessionHasPendingUserActionRequired } from '../../shared/parseUserActionNotice';
import { useColdResumeInitiator } from './hooks/useColdResumeInitiator';
import { ResumeHintToast } from './ResumeHintToast';
import { StageProgressRail } from './StageProgressRail';
import { useStaleTurnWatchdog } from './hooks/useStaleTurnWatchdog';
import { shouldSuppressStaleTurnFallback } from './hooks/staleTurnFallbackPolicy';
import {
  shouldBlockSessionAutoContinue,
} from '../../shared/sessionAutoContinueGate';
import {
  resolveSessionTerminalComplete,
  type SessionTerminalCompleteResult,
  isDeliverableManifestProgressIncomplete,
} from '../../shared/sessionTerminalComplete';
import { resolveRecoverySurfaceState } from '../../shared/recoverySurfaceState';
import { deriveSessionSidebarAttentionFromMessages } from '../../shared/sessionSidebarAttention';
import { resolveEffectiveTurnInteractionMode } from '../../shared/turnInteractionUiPolicy';
import type { AutoRecoveryStatus } from './hooks/useAutoRecoveryContinue';
import {
  isAssistantWorkingFromPhase,
  isComposerDisabledForPhase,
  isTaskLifecycleUiEnabled,
  resolveSessionTaskPhase,
  detectComboStageLabel,
  buildDeliverableLifecycleHint,
  shouldShowComposerStopButton,
} from '../../shared/sessionTaskLifecycle';
import {
  resolveDeliverableUserStatusCopy,
} from '../../shared/deliverableUserStatusCopy';
import { detectUserDeliverableAcknowledgment } from '../../../../src/saas/deliverables/userDeliverableAcknowledgment';
import {
  extractTurnAcceptanceMeta,
  resolveContinuationOwnerFromMessage,
  sanitizeTurnAcceptanceMetaRecord,
} from '../../shared/turnAcceptanceMeta';
import { recordDeliverableCertificateObservationEffect } from '../../shared/deliverableCertificateTelemetryStore';
import type { ChatMessage } from '../chat/types/types';
import {
 buildAutoRecoveryContinueMessage,
 buildStaleTurnFallbackContinueMessage,
 isContinuationOnlyUserText,
 userGoalImpliesDeliverable,
} from '../../shared/userFacingErrors';
import { useSessionStore } from '../../stores/useSessionStore';
import { useWebSocket } from '../../contexts/WebSocketContext';
import MessagesPaneV2 from './MessagesPaneV2';
import ComposerV2 from './ComposerV2';
import { api } from '../../utils/api';
import {
 clearPendingCapabilityPrompt,
 readPendingCapabilityPrompt,
 CAPABILITY_PROMPT_EVENT,
 injectCapabilityPrompt,
} from '../../shared/capabilityPromptInjection';
import { isCapabilityPromptPayload, type CapabilityBindingContext } from '../../shared/capabilityBinding';
import { registerCapabilityTryHost, requestCapabilityLaunch, requestCapabilityTry } from '../../shared/capabilityTryBridge';
import { subscribePreflightComposerSubmit } from '../../shared/preflightStudioBridge';
import { subscribeDesignCanvasPrefill } from '../../shared/designCanvasBridge';
import { subscribeHtmlStudioPrefill } from '../../shared/htmlStudioBridge';
import { subscribeHfStudioPrefill } from '../../shared/hfStudioBridge';
import { installHfStudioDeliverableSync } from '../../shared/hfStudioDeliverableSync';
import { collectConversationMainDeliverablePaths } from '../../shared/collectConversationDeliverables';
import { filterPathsForCapabilityTry } from '../../shared/capabilityTryReferences';
import { personalizeCapabilityTryPrompt } from '../../shared/capabilityTryPrompt';
import { isTemporarySessionId } from '../chat/utils/sessionLauncher';
import {
  processingSessionsHas,
  resolveAbortTargetSessionId,
} from '../../shared/resolveAbortTargetSessionId';
import {
 extractOutstandingElicitations,
 isInteractiveElicitationToolName,
 mergePendingPermissionRequests,
} from '../../shared/pendingElicitation';
import PermissionRequestsBanner from '../chat/view/subcomponents/PermissionRequestsBanner';
import TemplatesHubDialog from '../templates-hub/TemplatesHubDialog';
import { primeCapabilitiesCache } from '../../shared/capabilitiesBundled.js';
import { primeProcessTemplatesCache } from '../../shared/templatesHubCache';
import { pickRandomWelcomePrompts } from '../../shared/welcomePromptPool';
// PD-SAAS-FORK: Beta welcome card grid — no-op when surface inactive
import { useWorkbenchBetaSurface } from '../../saas/workbench-beta/surface/WorkbenchBetaSurface';
import BetaWelcome from '../../saas/workbench-beta/layout/BetaWelcome';
import { DeliverableValidationSessionProvider } from '../../shared/DeliverableValidationSessionContext';
import { selectLatestDeliverableSummaryTurn } from '../../shared/selectLatestDeliverableSummaryTurn';
import {
  shouldRunSessionDeliverablesPipeline,
  useSessionDeliverablesPipelineGate,
} from '../../shared/sessionDeliverablesPipelineGate';
import {
  buildSessionDeliverablePipeline,
  isSessionPipelineBundleEnabled,
  type SessionDeliverablePipelineBundle,
} from '../../shared/sessionDeliverablePipeline';
import { isDeferDeliverablesWhileStreamingEnabled } from '../../shared/perfFeatureFlags';
import {
  createSessionSwitchDockPlaceholder,
  resolveDeferredDeliverableMessageBundle,
  resolveSessionFrozenPipelineBundle,
  shouldClearFrozenPipelineOnSessionChange,
} from '../../shared/sessionSwitchDeliverablesSync';
import { resolvePipelineValidationSettled } from '../../shared/resolvePipelineValidationSettled';
import { deriveDeliverablesDockState } from '../../shared/deriveDeliverablesDockState';
import { shouldShowDeliverableComposerChrome } from '../../shared/deliverableDockPolicy';
import { resolveCurrentSessionTaskDirectory } from '../../shared/resolveSessionTaskDirectory';
import {
  buildTaskFolderSnapshotContractIdentity,
  resolveTaskFolderSnapshotCompletenessForValidation,
} from '../../shared/fetchTaskFolderSnapshot';
import {
  resolveCurrentSessionManifest,
  resolveFrozenSessionManifest,
  type SessionDeliverableManifestUi,
} from '../../shared/resolveSessionDeliverableManifest';
import { resolveContractScopeDir } from '../../shared/resolveContractScopeDir';
import { useTaskFolderDiskSnapshot } from '../../shared/useTaskFolderDiskSnapshot';
import {
  buildDockRowOpenOptions,
  canOpenDeliverableDockRow,
  resolveDockRowOpenPath,
} from '../../shared/openDeliverableDockRow';
import { useRightWorkspaceRail } from '../../shared/RightWorkspaceRailContext';
import type { DeliverableItem } from '../../shared/collectDeliverables';
import DeliverableSessionSheet from '../chat/deliverables/DeliverableSessionSheet';
import SessionDeliverableSummaryBar from '../chat/deliverables/SessionDeliverableSummaryBar';
import { useMobileShell } from '../../hooks/useMobileShell';
import {
  isDeliverableStatusLockEnabled,
  isStickyDeliverableBarPersistEnabled,
  isStickyDeliverableSummaryEnabled,
} from '../../shared/conversationDeliverableFeatureFlags';
import {
  pickStickySummaryRows,
  resolvePersistedDeliverablesDockState,
  shouldAcceptFrozenPipelineUpdate,
  shouldRefreshTaskFolderSnapshot,
  shouldShowStickyDeliverableBar,
} from '../../shared/stickyDeliverableBarPersist';
import { applyDeliverableRowPresentationLock } from '../../shared/deliverableRowPresentationLock';
import { normalizeConversationSummaryProgress } from '../../shared/normalizeConversationSummaryProgress';
import { presentConversationDeliverableRows } from '../../shared/presentConversationDeliverableRows';
import { normalizeSessionId } from '../../shared/sessionId';
import {
 SUBMIT_FIRST_FRAME_TIMEOUT_MS,
 createSubmitFirstFrameTracker,
 type SubmitFirstFrameSnapshot,
 type SubmitFirstFrameTracker,
} from '../../shared/chatSubmitTimeouts';
import { GENTLE_TOAST_EVENT, type GentleToastDetail } from '../../shared/gentleToast';
type PendingViewSession = {
 sessionId: string | null;
 startedAt: number;
};

// V2 chat wrapper. Reuses all business-logic hooks from legacy
// `ChatInterface` so streaming, file-mentions, slash commands, permissions,
// ccr_output, task notifications, subagent containers, etc. all keep working
// unchanged. The difference is purely in the rendered UI:
// · MessagesPaneV2 — markdown row layout, GPT-like reading width
// · ComposerV2 — card textarea + paperclip/at + arrow-up send
// · NO provider picker empty state, NO pill bar, NO gradient bubbles
function ChatInterfaceV2({
 selectedProject,
 selectedSession,
 ws,
 sendMessage,
 // latestMessage is intentionally not consumed here — useChatRealtimeHandlers
 // now subscribes to the WebSocket directly so React state batching can't
 // drop intermediate stream_delta events.
 onFileOpen,
 onOpenTaskFolder,
 onInputFocusChange,
 onSessionActive,
 onSessionInactive,
 onSessionProcessing,
 onSessionNotProcessing,
 onExecutionStatusChange,
 onSessionAttentionChange,
 onSessionActivityBump,
 processingSessions,
 onReplaceTemporarySession,
 onNavigateToSession,
 onShowSettings,
 autoExpandTools,
 showRawParameters,
 showThinking,
 processDetailLevel = 'standard',
 autoScrollToBottom,
 sendByCtrlEnter,
 externalMessageUpdate,
 forceWelcome,
 onExitWelcome,
 onOpenDiscoverTab,
 onStartNewSession,
}: ChatInterfaceProps) {
 const { t, i18n } = useTranslation('chat');
 const { t: tHub } = useTranslation('templatesHub');
 // PD-SAAS-FORK: default active=false outside Beta provider (/app unchanged)
 const betaSurface = useWorkbenchBetaSurface();
 const sessionSidebarStateVersion = useSessionSidebarStateVersion();
 const { tasksEnabled: _tasksEnabled, isTaskMasterInstalled: _isTaskMasterInstalled } =
 useTasksSettings();
 const isReadOnlyBackgroundSession = isBackgroundTaskSession(selectedSession);
 const isLockedSession = Boolean(
  selectedSession?.id && isSessionSidebarLocked(selectedSession.id),
 );
 const isReadOnlyComposer = isReadOnlyBackgroundSession || isLockedSession;
 const sessionRequestParams = React.useMemo(
 () => getSessionRequestParams(selectedSession),
 [selectedSession],
 );

 const sessionStore = useSessionStore();
 const runtimeFeatureFlags = useRuntimeFeatureFlags();
 const { isConnected } = useWebSocket();
 const streamBufferRef = useRef('');
 const streamTimerRef = useRef<number | null>(null);
 const accumulatedStreamRef = useRef('');
 const pendingViewSessionRef = useRef<PendingViewSession | null>(null);
 const [isAbortPending, setIsAbortPending] = useState(false);
 const [runMode, setRunMode] = useState<ChatRunMode>('agent');
 const fallbackSuggestionPrompts = useMemo(() => pickRandomWelcomePrompts(6), []);
 const [suggestionPrompts, setSuggestionPrompts] = useState<string[]>(fallbackSuggestionPrompts);
 const [templatesHubOpen, setTemplatesHubOpen] = useState(false);
 const [turnCompleteSignal, setTurnCompleteSignal] = useState(0);
 const [recoveryRunId, setRecoveryRunId] = useState(0);
 const reconnectDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 const reconnectInFlightRef = useRef<Promise<void> | null>(null);
 // PD-SAAS-FORK: track whether a turn was in-flight when WS dropped, so a reconnect
 // status poll that reports "not processing" can refire turn-complete and auto-resume
 // the turn the engine ended with aborted_streaming during the disconnect window.
 const isLoadingRef = useRef(false);
 const reconnectResumeArmedRef = useRef(false);
 /** PD-SAAS-FORK: defer reconnect turn-complete until transcript fetch finishes. */
 const pendingReconnectTurnCompleteRef = useRef(false);
 const [lastTurnCompleteMeta, setLastTurnCompleteMeta] = useState<{
  exitCode?: number;
  aborted?: boolean;
  userAborted?: boolean;
  success?: boolean;
  errorCode?: string;
  errorRecoverable?: boolean;
 } | null>(null);
 const [gentleToast, setGentleToast] = useState<GentleToastDetail | null>(null);
 const certificateObservationKeysRef = useRef(new Set<string>());
 const certificateObservationSessionRef = useRef<string | null>(null);
 /** PD-SAAS-FORK (P0-B1): freeze dock rows while assistant is streaming. */
 const frozenPipelineBundleRef = useRef<SessionDeliverablePipelineBundle | null>(null);
 const frozenPipelineSessionIdRef = useRef<string | null>(null);
 const railSessionIdRef = useRef<string | null>(null);
 const stickySummaryBarRef = useRef<HTMLDivElement | null>(null);

 const handleTurnComplete = useCallback((outcome: {
  exitCode?: number;
  aborted?: boolean;
  userAborted?: boolean;
  success?: boolean;
  errorCode?: string;
  errorRecoverable?: boolean;
 }) => {
  setLastTurnCompleteMeta({
   ...outcome,
   userAborted: outcome.userAborted ?? (outcome.aborted ? isAbortPending : false),
  });
  setTurnCompleteSignal((value) => value + 1);
 }, [isAbortPending]);

 useEffect(() => {
 primeCapabilitiesCache(i18n.language);
 primeProcessTemplatesCache(i18n.language);
 }, [i18n.language]);

 useEffect(() => {
  const onGentleToast = (event: Event) => {
   const detail = (event as CustomEvent<GentleToastDetail>).detail;
   if (!detail?.text) return;
   setGentleToast(detail);
   window.setTimeout(() => setGentleToast(null), 3200);
  };
  window.addEventListener(GENTLE_TOAST_EVENT, onGentleToast);
  return () => window.removeEventListener(GENTLE_TOAST_EVENT, onGentleToast);
 }, []);

 const resetStreamingState = useCallback(() => {
 if (streamTimerRef.current) {
 clearTimeout(streamTimerRef.current);
 streamTimerRef.current = null;
 }
 streamBufferRef.current = '';
 accumulatedStreamRef.current = '';
 }, []);

 const {
 model,
 permissionMode,
 setPermissionMode: setPermissionModeRaw,
 pendingPermissionRequests,
 setPendingPermissionRequests,
 } = useChatProviderState({ selectedSession });

 const cycleRunMode = useCallback(() => {
 setRunMode((currentMode) => (currentMode === 'plan' ? 'agent' : 'plan'));
 }, []);

 const selectPermissionMode = useCallback((mode: typeof permissionMode) => {
 setPermissionModeRaw(mode);
 localStorage.setItem('permissionMode-default', mode);
 if (selectedSession?.id) {
 localStorage.setItem(`permissionMode-${selectedSession.id}`, mode);
 }
 }, [setPermissionModeRaw, selectedSession?.id]);

 const effectivePermissionMode =
 runMode === 'plan' ? 'plan' : permissionMode;

 const {
 chatMessages,
 activityMessages,
 addMessage,
 clearMessages,
 rewindMessages,
 isLoading,
 effectiveIsLoading,
 setIsLoading,
 currentSessionId,
 setCurrentSessionId,
 isLoadingSessionMessages,
 isRevalidatingSessionMessages,
 sessionLoadError,
 sessionLoadFailureKind,
 isLoadingMoreMessages,
 hasMoreMessages,
 totalMessages,
 canAbortSession,
 setCanAbortSession,
 isAborting: _isAborting,
 setIsAborting,
 setIsUserScrolledUp,
 tokenBudget,
 setTokenBudget,
 visibleMessageCount,
 visibleMessages,
 loadEarlierMessages,
 loadAllMessages,
 allMessagesLoaded,
 isLoadingAllMessages,
 claudeStatus,
 pilotDeckStatus,
 setClaudeStatus,
 setPilotDeckStatus,
 createDiff,
 scrollContainerRef,
 scrollToBottom,
 handleScroll,
 } = useChatSessionState({
 selectedProject,
 selectedSession,
 ws,
 sendMessage,
 autoScrollToBottom,
 externalMessageUpdate,
 processingSessions,
 resetStreamingState,
 pendingViewSessionRef,
 sessionStore,
 });

 useEffect(() => {
  setRecoveryRunId(0);
 }, [currentSessionId]);

 useEffect(() => {
  isLoadingRef.current = isLoading;
 }, [isLoading]);

 const activeSessionId = selectedSession?.id || currentSessionId;
 const restoredElicitations = useMemo(() => {
  if (!activeSessionId) return [];
  return extractOutstandingElicitations(sessionStore.getMessages(activeSessionId), activeSessionId);
 }, [activeSessionId, sessionStore, chatMessages.length, isLoadingSessionMessages]);

 const effectivePendingPermissionRequests = useMemo(
  () => mergePendingPermissionRequests(pendingPermissionRequests, restoredElicitations),
  [pendingPermissionRequests, restoredElicitations],
 );

 const elicitationPermissionRequests = useMemo(
  () => effectivePendingPermissionRequests.filter(
    (request) => request.isElicitation || isInteractiveElicitationToolName(request.toolName),
  ),
  [effectivePendingPermissionRequests],
 );

 useEffect(() => {
  if (restoredElicitations.length === 0) return;
  const outstanding = restoredElicitations[0];
  if (!outstanding?.isElicitation) return;
  setClaudeStatus((prev) => (
    prev?.statusKind === 'elicitation' || prev?.text === 'needs_input'
      ? prev
      : {
        text: 'needs_input',
        tokens: 0,
        can_interrupt: true,
        statusKind: 'elicitation',
      }
  ));
  setPilotDeckStatus((prev) => (
    prev?.statusKind === 'elicitation' || prev?.text === 'needs_input'
      ? prev
      : {
        text: 'needs_input',
        tokens: 0,
        can_interrupt: true,
        statusKind: 'elicitation',
      }
  ));
  setIsLoading(true);
  setCanAbortSession(true);
 }, [
  restoredElicitations,
  setCanAbortSession,
  setClaudeStatus,
  setIsLoading,
  setPilotDeckStatus,
 ]);

 const lastAssistantText = useMemo(() => {
  for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
   const message = chatMessages[i] as { type?: string; role?: string; content?: string };
   if (message?.type === 'assistant' || message?.role === 'assistant') {
    return typeof message.content === 'string' ? message.content : '';
   }
  }
  return '';
 }, [chatMessages]);

 const userActionBlocked = useMemo(
  () => sessionHasPendingUserActionRequired(chatMessages),
  [chatMessages],
 );

 const lastAssistantRepairOwned = useMemo(() => {
  if (effectiveIsLoading) return true;
  for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
   const message = chatMessages[i] as ChatMessage & {
    acceptanceStatus?: string;
    turnAcceptanceMeta?: { acceptanceStatus?: string };
   };
   if (message?.type === 'assistant' || (message as { role?: string }).role === 'assistant') {
    if (message.isStreaming) return true;
    const meta = extractTurnAcceptanceMeta(message);
    if (meta?.circuitBreakerTripped) return false;
    const acceptanceStatus = message.acceptanceStatus
     ?? message.turnAcceptanceMeta?.acceptanceStatus
     ?? meta?.acceptanceStatus;
    if (acceptanceStatus === 'passed') return false;
    const owner = resolveContinuationOwnerFromMessage(message);
    if (acceptanceStatus === 'needs_repair') {
     return owner === 'deliverable_repair' || owner === 'auto_continue_engine';
    }
    return owner === 'deliverable_repair' || owner === 'auto_continue_engine';
   }
  }
  return false;
 }, [chatMessages, effectiveIsLoading]);

 // PD-SAAS-FORK: read the engine's acceptance verdict for the latest assistant
 // turn. When it is needs_repair, the engine owns the repair loop, so the UI
 // deliverable fallback must stand aside (see useIncompleteDeliverableAutoContinue).
 const lastAssistantTurnMeta = useMemo(() => {
  for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
   const message = chatMessages[i] as ChatMessage;
   if (message?.type === 'assistant' || (message as { role?: string }).role === 'assistant') {
    return extractTurnAcceptanceMeta(message);
   }
  }
  return null;
 }, [chatMessages]);

 const lastAssistantContinuationOwner = useMemo(() => {
  for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
   const message = chatMessages[i] as ChatMessage;
   if (message?.type === 'assistant' || (message as { role?: string }).role === 'assistant') {
    return resolveContinuationOwnerFromMessage(message);
   }
  }
  return undefined;
 }, [chatMessages]);

 const lastAssistantAcceptanceStatus = useMemo(() => {
  for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
   const message = chatMessages[i] as {
    type?: string;
    role?: string;
    acceptanceStatus?: string;
    turnAcceptanceMeta?: { acceptanceStatus?: string };
   };
   if (message?.type === 'assistant' || message?.role === 'assistant') {
    return message.acceptanceStatus ?? message.turnAcceptanceMeta?.acceptanceStatus;
   }
  }
  return undefined;
 }, [chatMessages]);

 const lastAssistantCircuitBreakerTripped = useMemo(() => {
  for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
   const message = chatMessages[i] as ChatMessage;
   if (message?.type === 'assistant' || message?.role === 'assistant') {
    const meta = extractTurnAcceptanceMeta(message);
    return meta?.circuitBreakerTripped === true;
   }
  }
  return false;
 }, [chatMessages]);

 const userAcknowledgedComplete = useMemo(() => {
  if (currentSessionId && isSessionSidebarRevokedAutoComplete(currentSessionId)) {
    return false;
  }
  if (currentSessionId && isSessionSidebarCompleted(currentSessionId)) {
    return true;
  }
  for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
   const message = chatMessages[i] as { type?: string; role?: string; content?: string };
   if (message?.type === 'user' || message?.role === 'user') {
    const text = typeof message.content === 'string' ? message.content : '';
    return /(?:已完成|没问题|可以了|不用改了|就这样|满意了)\s*[.!。！]?$/i.test(text.trim())
      && !/(?:再(?:做|改|加|来)|另外|改成|增加|页数|帮我|请做|重新做)/i.test(text);
   }
  }
  return false;
 }, [chatMessages, currentSessionId, sessionSidebarStateVersion]);

 const sessionSidebarRevokedAutoComplete = useMemo(
   () => Boolean(currentSessionId && isSessionSidebarRevokedAutoComplete(currentSessionId)),
   [currentSessionId, sessionSidebarStateVersion],
 );

 const sessionSidebarCompleted = useMemo(
   () => Boolean(currentSessionId && isSessionSidebarCompleted(currentSessionId)),
   [currentSessionId, sessionSidebarStateVersion],
 );

 const acceptanceMetaEnvelope = useMemo(() => {
   if (!currentSessionId) return null;
   const slotMeta = sessionStore.getSlot(currentSessionId)?.latestTurnAcceptanceMeta;
   if (slotMeta && typeof slotMeta === 'object') {
     return slotMeta as Record<string, unknown>;
   }
   return null;
 }, [currentSessionId, sessionStore, chatMessages.length, isLoadingSessionMessages]);

 const sessionTerminalComplete = useMemo((): SessionTerminalCompleteResult => {
   const manifest = currentSessionId
     ? (sessionStore.getSlot(currentSessionId)?.sessionDeliverableManifestEnvelope as
       | SessionDeliverableManifestUi
       | undefined)
     : undefined;
   return resolveSessionTerminalComplete({
     sessionSidebarCompleted,
     userRevokedSidebarComplete: sessionSidebarRevokedAutoComplete,
     userAcknowledgedComplete,
     latestTurnAcceptanceMeta: acceptanceMetaEnvelope,
     lastAssistantAcceptanceStatus,
     lastAssistantCircuitBreakerTripped,
     deliverableProgressIncomplete: isDeliverableManifestProgressIncomplete(manifest),
   });
 }, [
   acceptanceMetaEnvelope,
   currentSessionId,
   lastAssistantAcceptanceStatus,
   lastAssistantCircuitBreakerTripped,
   sessionSidebarCompleted,
   sessionSidebarRevokedAutoComplete,
   sessionStore,
   userAcknowledgedComplete,
   chatMessages.length,
 ]);

 const sessionTerminalCompleteRef = useRef(sessionTerminalComplete.terminal);
 sessionTerminalCompleteRef.current = sessionTerminalComplete.terminal;

 const autoContinueBlocked = useMemo(
   () => shouldBlockSessionAutoContinue({
     session: selectedSession ?? null,
     userAcknowledgedComplete: userAcknowledgedComplete || sessionTerminalComplete.terminal,
     userRevokedSidebarComplete: sessionSidebarRevokedAutoComplete,
     syntheticAutoContinue: true,
   }),
   [selectedSession, sessionSidebarRevokedAutoComplete, sessionTerminalComplete.terminal, userAcknowledgedComplete],
 );
 const recoveryAutoContinueBlocked = useMemo(
   () => shouldBlockSessionAutoContinue({
     session: selectedSession ?? null,
     userAcknowledgedComplete: userAcknowledgedComplete || sessionTerminalComplete.terminal,
     userRevokedSidebarComplete: sessionSidebarRevokedAutoComplete,
     syntheticAutoContinue: false,
   }),
   [selectedSession, sessionSidebarRevokedAutoComplete, sessionTerminalComplete.terminal, userAcknowledgedComplete],
 );

 const userGoalText = useMemo(() => {
  for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
   const message = chatMessages[i] as {
    type?: string;
    role?: string;
    content?: string;
    metadata?: { synthetic?: boolean };
   };
   if (message?.metadata?.synthetic) continue;
   if (message?.type === 'user' || message?.role === 'user') {
    const text = typeof message.content === 'string' ? message.content : '';
    if (isContinuationOnlyUserText(text)) continue;
    return text;
   }
  }
  for (let i = visibleMessages.length - 1; i >= 0; i -= 1) {
   const message = visibleMessages[i] as { role?: string; content?: string; metadata?: { synthetic?: boolean } };
   if (message?.metadata?.synthetic) continue;
   if (message?.role === 'user' && typeof message.content === 'string') {
    if (isContinuationOnlyUserText(message.content)) continue;
    return message.content;
   }
  }
  return '';
 }, [chatMessages, visibleMessages]);

 const comboStageLabel = useMemo(
   () => detectComboStageLabel(userGoalText),
   [userGoalText],
 );

 const {
 input,
 setInput,
 applyExternalComposerInput,
 applyIntentComposerInput,
 textareaRef,
 isTextareaExpanded: _isTextareaExpanded,
 thinkingMode: _thinkingMode,
 setThinkingMode: _setThinkingMode,
 slashCommandsCount: _slashCommandsCount,
 filteredCommands,
 frequentCommands,
 commandQuery,
 showCommandMenu,
 selectedCommandIndex,
 resetCommandMenuState: _resetCommandMenuState,
 dismissCommandMenu,
 handleCommandSelect,
 handleToggleCommandMenu,
 showFileDropdown,
 filteredFiles,
 selectedFileIndex,
 fileReferencePaths,
 selectFile,
 removeFileReference,
 addFileReferences,
 setPromptWithReferences,
 attachedImages,
 setAttachedImages,
 uploadingImages,
 imageErrors,
 getRootProps,
 getInputProps,
 isDragActive,
 openImagePicker,
 handleSubmit,
 handleInputChange,
 insertAtCursor,
 handleKeyDown,
 handlePaste,
 handleTextareaClick,
 handleTextareaInput,
 handlePermissionDecision,
 handleGrantToolPermission,
 handleGrantSessionToolPermission,
 handleInputFocusChange,
 } = useChatComposerState({
 selectedProject,
 selectedSession,
 currentSessionId,
 model,
 permissionMode: effectivePermissionMode,
 basePermissionMode: permissionMode,
 cycleRunMode,
 isLoading,
 canAbortSession,
 tokenBudget,
 sendMessage,
 sendByCtrlEnter,
 onSessionActive,
 onSessionProcessing,
 onSessionActivityBump,
 onInputFocusChange,
 onFileOpen,
 onShowSettings,
 pendingViewSessionRef,
 scrollToBottom,
 addMessage,
 clearMessages,
 rewindMessages,
 setIsLoading,
 setCanAbortSession,
 setIsAborting,
 setClaudeStatus,
 setPilotDeckStatus,
 setIsUserScrolledUp,
 pendingPermissionRequests: effectivePendingPermissionRequests,
 setPendingPermissionRequests,
 });

 useEffect(() => {
 if (!isConnected && isLoading) {
 setIsLoading(false);
 setCanAbortSession(false);
 setClaudeStatus(null);
 setPilotDeckStatus(null);
 }
 }, [
 isConnected,
 isLoading,
 setCanAbortSession,
 setClaudeStatus,
 setIsLoading,
 setPilotDeckStatus,
 ]);

 const submitResponseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 const submitFirstFrameTrackerRef = useRef<SubmitFirstFrameTracker | null>(null);
 const latestSubmitSnapshotRef = useRef<SubmitFirstFrameSnapshot>({
  messages: 0,
  activities: 0,
  hasStatus: false,
 });
 latestSubmitSnapshotRef.current = {
  messages: chatMessages.length,
  activities: activityMessages.length,
  hasStatus: Boolean(claudeStatus || pilotDeckStatus),
 };

 useEffect(() => {
 if (submitResponseTimeoutRef.current) {
 clearTimeout(submitResponseTimeoutRef.current);
 submitResponseTimeoutRef.current = null;
 }
 if (!isLoading) {
  submitFirstFrameTrackerRef.current = null;
 return undefined;
 }

 submitFirstFrameTrackerRef.current = createSubmitFirstFrameTracker(
  latestSubmitSnapshotRef.current,
  { weakInFlightDeliverableGoal: userGoalImpliesDeliverable(userGoalText) },
 );

 submitResponseTimeoutRef.current = setTimeout(() => {
 submitResponseTimeoutRef.current = null;
 const tracker = submitFirstFrameTrackerRef.current;
 if (!tracker?.shouldTimeout()) return;
 tracker.stop();
 submitFirstFrameTrackerRef.current = null;
 setIsLoading(false);
 setCanAbortSession(false);
 setClaudeStatus(null);
 setPilotDeckStatus(null);
 addMessage({
 type: 'error',
 content: '响应时间较长，正在重新连接并自动续跑。',
 timestamp: Date.now(),
 }, currentSessionId);
 }, SUBMIT_FIRST_FRAME_TIMEOUT_MS);

 return () => {
 if (submitResponseTimeoutRef.current) {
 clearTimeout(submitResponseTimeoutRef.current);
 submitResponseTimeoutRef.current = null;
 }
 };
 }, [
 addMessage,
 currentSessionId,
 isLoading,
 setCanAbortSession,
 setClaudeStatus,
 setIsLoading,
 setPilotDeckStatus,
 userGoalText,
 ]);

 useEffect(() => {
 if (!isLoading || !submitResponseTimeoutRef.current) {
 return;
 }
 const tracker = submitFirstFrameTrackerRef.current;
 if (tracker?.observe(latestSubmitSnapshotRef.current)) {
 clearTimeout(submitResponseTimeoutRef.current);
 submitResponseTimeoutRef.current = null;
 }
 }, [
 activityMessages.length,
 chatMessages.length,
 claudeStatus,
 isLoading,
 pilotDeckStatus,
 ]);

 const handlePlanExecutionApproved = useCallback(() => {
 setRunMode('agent');
 }, []);

 const handleAutoRecoveryContinue = useCallback((
   continueMessage: string,
   options?: { userInitiated?: boolean; recovery?: boolean },
 ): boolean => {
 if (!selectedProject?.name) return false;
 if (sessionTerminalCompleteRef.current) return false;
 if (currentSessionId && isSessionSidebarCompleted(currentSessionId)) return false;
 const blocked = options?.recovery ? recoveryAutoContinueBlocked : autoContinueBlocked;
 if (blocked && !options?.userInitiated) return false;
 if (
   !options?.userInitiated
   && (lastTurnCompleteMeta?.errorRecoverable === false
     || lastTurnCompleteMeta?.errorCode === 'agent_model_error')
 ) {
   return false;
 }
 setClaudeStatus(null);
 setPilotDeckStatus(null);
 const toolsSettings = getPilotDeckSettings();
 const text = continueMessage.trim() || buildAutoRecoveryContinueMessage('zh');
 startSessionCommand({
 sendMessage,
 selectedProject,
 command: text,
 sessionId: currentSessionId,
 temporarySessionId: selectedSession?.id,
 toolsSettings,
 permissionMode: effectivePermissionMode,
 model,
 });
 return true;
 }, [
 currentSessionId,
 effectivePermissionMode,
 model,
 selectedProject,
 selectedSession?.id,
 sendMessage,
 setClaudeStatus,
 setPilotDeckStatus,
 autoContinueBlocked,
 recoveryAutoContinueBlocked,
 lastTurnCompleteMeta?.errorCode,
 lastTurnCompleteMeta?.errorRecoverable,
 ]);

 const workingStatus = claudeStatus || pilotDeckStatus;
 const handleRecoveryFormalRetry = useCallback(() => {
   handleAutoRecoveryContinue(buildAutoRecoveryContinueMessage(
     typeof document !== 'undefined' && document.documentElement.lang.startsWith('en') ? 'en' : 'zh',
   ));
 }, [handleAutoRecoveryContinue]);
 const turnBoundaryKey = `${currentSessionId || 'none'}:${recoveryRunId}:${turnCompleteSignal}:${lastAssistantAcceptanceStatus ?? 'na'}`;
 const {
 resumeHintVisible,
 resumeHintMessage,
 dismissResumeHint,
 recoveryContinuePending,
 } = useAutoRecoveryContinue({
 sessionId: currentSessionId,
 turnBoundaryKey,
 status: workingStatus,
 isLoading,
 isLoadingSessionMessages,
 isConnected,
 turnCompleteSignal,
 turnCompleteMeta: lastTurnCompleteMeta ?? undefined,
 lastAssistantText,
 userGoal: userGoalText,
 projectName: selectedProject?.name,
 projectPath: selectedProject?.fullPath || selectedProject?.path,
 userActionBlocked,
 userAcknowledgedComplete,
 sessionTerminalComplete: sessionTerminalComplete.terminal,
 autoContinueBlocked: recoveryAutoContinueBlocked,
 onContinue: (message) => handleAutoRecoveryContinue(message, { recovery: true }),
 });

 const [pendingAutoContinue, setPendingAutoContinue] = useState(false);
 const [manualResumeOffer, setManualResumeOffer] = useState<{
   message: string | null;
   reason: ManualContinueReason;
 } | null>(null);
 const [isManualContinuePending, setIsManualContinuePending] = useState(false);
 const clearManualContinueOffer = useCallback(() => {
   setManualResumeOffer((prev) => (prev ? null : prev));
 }, []);
 const handleManualContinueOffer = useCallback((message: string, reason: ManualContinueReason) => {
   setManualResumeOffer((prev) => {
     if (prev?.message === message && prev?.reason === reason) return prev;
     return { message, reason };
   });
 }, []);
 const [engineRepairCooldownUntilMs, setEngineRepairCooldownUntilMs] = useState<number | undefined>();
 const prevEngineRepairOwnedRef = useRef(lastAssistantRepairOwned);

 useEffect(() => {
   if (
     prevEngineRepairOwnedRef.current
     && !lastAssistantRepairOwned
     && lastAssistantAcceptanceStatus === 'needs_repair'
   ) {
     setEngineRepairCooldownUntilMs(Date.now() + 30_000);
   }
   prevEngineRepairOwnedRef.current = lastAssistantRepairOwned;
 }, [lastAssistantAcceptanceStatus, lastAssistantRepairOwned]);

 useEffect(() => {
   setEngineRepairCooldownUntilMs(undefined);
 }, [turnBoundaryKey]);

 useIncompleteDeliverableAutoContinue({
  sessionId: currentSessionId,
  turnBoundaryKey,
  turnCompleteSignal,
  turnCompleteMeta: lastTurnCompleteMeta ?? undefined,
  lastAssistantText,
  userGoalText,
  isLoading,
  isLoadingSessionMessages,
  isConnected,
  engineRepairOwned: lastAssistantRepairOwned,
  engineRepairCooldownUntilMs,
  userActionBlocked,
  circuitBreakerTripped: lastAssistantCircuitBreakerTripped,
 userAcknowledgedComplete,
 sessionTerminalComplete: sessionTerminalComplete.terminal,
 autoContinueBlocked: recoveryAutoContinueBlocked,
 acceptanceStatus: lastAssistantAcceptanceStatus,
  onContinue: handleAutoRecoveryContinue,
  onManualContinueOffer: handleManualContinueOffer,
  onManualContinueClear: clearManualContinueOffer,
  onPendingAutoContinue: setPendingAutoContinue,
 });

 const projectRoot = selectedProject?.fullPath || selectedProject?.path || '';
 const deliverablesPipelineReady = useSessionDeliverablesPipelineGate(selectedSession?.id);
 const deliverableMessageBundle = useMemo(
   () => ({ sessionId: currentSessionId ?? null, messages: chatMessages }),
   [currentSessionId, chatMessages],
 );
 const deferredDeliverableMessageBundle = useDeferredValue(deliverableMessageBundle);
 const { aligned: deferredDeliverablesAligned, messages: deferredDeliverableMessages } =
   resolveDeferredDeliverableMessageBundle({
     currentSessionId: currentSessionId ?? null,
     chatMessages,
     deferredBundle: deferredDeliverableMessageBundle,
   });
 const deliverablesAssistantWorking = effectiveIsLoading || lastAssistantRepairOwned;
 const runDeliverablesPipeline = shouldRunSessionDeliverablesPipeline({
   pipelineReady: deliverablesPipelineReady,
   isLoadingSessionMessages,
   messageCount: chatMessages.length,
   deferWhileAssistantWorking: true,
   isAssistantWorking: deliverablesAssistantWorking,
 });
 const messagesForDeliverables = runDeliverablesPipeline ? deferredDeliverableMessages : [];
 const currentSessionEnvelope = currentSessionId
   ? sessionStore.getSlot(currentSessionId)
   : undefined;
 const sessionTaskDirectoryEnvelope = currentSessionEnvelope?.sessionTaskDirectory;
 const latestTurnAcceptanceMetaEnvelope = currentSessionEnvelope?.latestTurnAcceptanceMeta;
 const sessionDeliverableManifestEnvelope =
   currentSessionEnvelope?.sessionDeliverableManifestEnvelope as
     | SessionDeliverableManifestUi
     | undefined;
 const usePipelineBundle = isSessionPipelineBundleEnabled() && runDeliverablesPipeline;
 const deliverablesScopeDirForDisk = useMemo(() => {
   const frozenManifest = runDeliverablesPipeline
     ? (resolveFrozenSessionManifest(messagesForDeliverables)
       ?? resolveCurrentSessionManifest(messagesForDeliverables)
       ?? sessionDeliverableManifestEnvelope)
     : sessionDeliverableManifestEnvelope;
   return resolveContractScopeDir({
     messages: runDeliverablesPipeline ? messagesForDeliverables : [],
     sessionTaskDirectory: sessionTaskDirectoryEnvelope,
     sessionManifest: frozenManifest,
     pathHints: frozenManifest?.slots?.map((slot) => slot.pathHint).filter(Boolean) as string[] | undefined,
   });
 }, [
   messagesForDeliverables,
   runDeliverablesPipeline,
   sessionDeliverableManifestEnvelope,
   sessionTaskDirectoryEnvelope,
 ]);
 const sessionManifestForDisk = useMemo(
   () => resolveCurrentSessionManifest(messagesForDeliverables)
     ?? sessionDeliverableManifestEnvelope,
   [messagesForDeliverables, sessionDeliverableManifestEnvelope],
 );
 const deliverablesScopeDir = deliverablesScopeDirForDisk;
 // PD-SAAS-FORK: retain snapshot-v2 completeness so truncated scans stay inconclusive.
 const diskSnapshotEnvelope = useTaskFolderDiskSnapshot({
   projectName: selectedProject?.name,
   scopeDir: deliverablesScopeDir,
   slots: sessionManifestForDisk?.slots,
   goalVersion: sessionManifestForDisk?.goalVersion,
   enabled: shouldRefreshTaskFolderSnapshot({
     pipelineReady: deliverablesPipelineReady,
     hasScopeDir: Boolean(
       deliverablesScopeDir?.includes('artifacts/')
       || sessionManifestForDisk?.slots?.length,
     ),
     isAssistantWorking: deliverablesAssistantWorking,
   }),
   sessionId: currentSessionId ?? null,
 });
 const diskSnapshot = diskSnapshotEnvelope.files;
 const diskSnapshotContractIdentity = buildTaskFolderSnapshotContractIdentity({
   slots: sessionManifestForDisk?.slots,
 });
 const diskSnapshotCompleteness = resolveTaskFolderSnapshotCompletenessForValidation(
   diskSnapshotEnvelope.status,
 );
 const pipelineValidationSettled = useMemo(
   () => resolvePipelineValidationSettled({
     sessionRepairActive: lastAssistantRepairOwned,
     isAssistantWorking: deliverablesAssistantWorking,
     latestTurnAcceptanceMeta: sanitizeTurnAcceptanceMetaRecord(latestTurnAcceptanceMetaEnvelope),
     diskSnapshotComplete: diskSnapshotCompleteness,
   }),
   [
     lastAssistantRepairOwned,
     deliverablesAssistantWorking,
     latestTurnAcceptanceMetaEnvelope,
     diskSnapshotCompleteness,
   ],
 );
 const computedSessionDeliverablePipelineBundle = useMemo(() => {
   if (!usePipelineBundle) return null;
   return buildSessionDeliverablePipeline({
     sessionId: currentSessionId ?? undefined,
     messages: messagesForDeliverables,
     projectRoot,
     hasMoreMessages,
     sessionTaskDirectory: sessionTaskDirectoryEnvelope,
     diskSnapshot,
     diskSnapshotVersion: diskSnapshotEnvelope.snapshotVersion,
     diskSnapshotContractIdentity,
     diskSnapshotBinding: diskSnapshotEnvelope.binding,
     diskSnapshotComplete: diskSnapshotCompleteness,
     validationSettled: pipelineValidationSettled,
     deliverableCertificateUiEnabled: runtimeFeatureFlags?.deliverableCertificateUi,
     deliverableQualityUiEnabled: runtimeFeatureFlags?.deliverableQualityUi,
     latestTurnAcceptanceMeta: latestTurnAcceptanceMetaEnvelope,
     sessionDeliverableManifest: sessionDeliverableManifestEnvelope,
     sessionRepairActive: lastAssistantRepairOwned,
     isAssistantWorking: deliverablesAssistantWorking,
     turnBoundaryKey,
   });
 }, [
   usePipelineBundle,
   currentSessionId,
   messagesForDeliverables,
   projectRoot,
   hasMoreMessages,
   sessionTaskDirectoryEnvelope,
   diskSnapshot,
   diskSnapshotEnvelope.snapshotVersion,
   diskSnapshotContractIdentity,
   diskSnapshotEnvelope.binding,
   diskSnapshotCompleteness,
   pipelineValidationSettled,
   latestTurnAcceptanceMetaEnvelope,
   sessionDeliverableManifestEnvelope,
   runtimeFeatureFlags?.deliverableCertificateUi,
   runtimeFeatureFlags?.deliverableQualityUi,
   lastAssistantRepairOwned,
   deliverablesAssistantWorking,
   turnBoundaryKey,
 ]);
 useEffect(() => {
   if (!computedSessionDeliverablePipelineBundle) return;
   if (!shouldAcceptFrozenPipelineUpdate({
     prev: frozenPipelineBundleRef.current,
     next: computedSessionDeliverablePipelineBundle,
     inFlight: deliverablesAssistantWorking,
   })) {
     return;
   }
   frozenPipelineBundleRef.current = computedSessionDeliverablePipelineBundle;
   frozenPipelineSessionIdRef.current = currentSessionId ?? null;
 }, [computedSessionDeliverablePipelineBundle, currentSessionId, deliverablesAssistantWorking, turnBoundaryKey]);
 if (
   shouldClearFrozenPipelineOnSessionChange({
     currentSessionId: currentSessionId ?? null,
     frozenSessionId: frozenPipelineSessionIdRef.current,
   })
 ) {
   frozenPipelineBundleRef.current = null;
   frozenPipelineSessionIdRef.current = currentSessionId ?? null;
 }
 const sessionDeliverablePipelineBundle = useMemo(
   () => resolveSessionFrozenPipelineBundle({
     currentSessionId: currentSessionId ?? null,
     frozenSessionId: frozenPipelineSessionIdRef.current,
     frozenBundle: frozenPipelineBundleRef.current,
     deferWhileStreaming: isDeferDeliverablesWhileStreamingEnabled(),
     runDeliverablesPipeline,
     computedBundle: computedSessionDeliverablePipelineBundle,
   }),
   [computedSessionDeliverablePipelineBundle, currentSessionId, runDeliverablesPipeline],
 );
 useEffect(() => {
   if (certificateObservationSessionRef.current !== currentSessionId) {
     certificateObservationSessionRef.current = currentSessionId;
     certificateObservationKeysRef.current.clear();
   }
   recordDeliverableCertificateObservationEffect({
     sessionId: currentSessionId,
     observation: sessionDeliverablePipelineBundle?.unifiedView.certificateObservation,
     seenKeys: certificateObservationKeysRef.current,
   });
 }, [
   currentSessionId,
   sessionDeliverablePipelineBundle?.unifiedView.certificateObservation,
 ]);
 // PD-SAAS-FORK: defer window must not scan full transcript — only store envelopes.
 const deferredDeliverablesDockState = useMemo(() => {
   if (sessionDeliverablePipelineBundle || runDeliverablesPipeline) return null;
   const manifest = sessionDeliverableManifestEnvelope;
   const deferredState = deriveDeliverablesDockState({
     messages: [],
     projectRoot,
     hasMoreMessages,
     sessionRepairActive: lastAssistantRepairOwned,
     isAssistantWorking: deliverablesAssistantWorking,
     sessionManifest: manifest,
     sessionTaskDirectory: sessionTaskDirectoryEnvelope,
     diskSnapshot,
     diskSnapshotVersion: diskSnapshotEnvelope.snapshotVersion,
     diskSnapshotComplete: diskSnapshotCompleteness,
   });
   const scopeDir = resolveContractScopeDir({
     messages: [],
     sessionTaskDirectory: sessionTaskDirectoryEnvelope,
     sessionManifest: manifest,
     pathHints: manifest?.slots?.map((slot) => slot.pathHint).filter(Boolean) as string[] | undefined,
   });
   const hasSessionManifest = Boolean(manifest?.slots?.length);
   return {
     ...deferredState,
     showComposerChrome: shouldShowDeliverableComposerChrome({
       rowCount: deferredState.rows.length,
       hasSessionManifest,
       hasFolderPath: Boolean(scopeDir),
       isDeliverableTask: hasSessionManifest || Boolean(scopeDir?.includes('artifacts/')),
     }),
   };
 }, [
   sessionDeliverablePipelineBundle,
   runDeliverablesPipeline,
   projectRoot,
   hasMoreMessages,
   lastAssistantRepairOwned,
   deliverablesAssistantWorking,
   sessionDeliverableManifestEnvelope,
   sessionTaskDirectoryEnvelope,
   diskSnapshot,
   diskSnapshotEnvelope.snapshotVersion,
   diskSnapshotCompleteness,
 ]);
 const deliverablesDockStateRaw = useMemo(() => {
   if (sessionDeliverablePipelineBundle) {
     return sessionDeliverablePipelineBundle.dockState;
   }
   if (deferredDeliverablesDockState) {
     return deferredDeliverablesDockState;
   }
   return deriveDeliverablesDockState({
     messages: messagesForDeliverables,
     projectRoot,
     hasMoreMessages,
     sessionRepairActive: lastAssistantRepairOwned,
     isAssistantWorking: deliverablesAssistantWorking,
     sessionManifest: sessionManifestForDisk,
     sessionTaskDirectory: sessionTaskDirectoryEnvelope,
     diskSnapshot,
     diskSnapshotVersion: diskSnapshotEnvelope.snapshotVersion,
     diskSnapshotComplete: diskSnapshotCompleteness,
   });
 }, [
   sessionDeliverablePipelineBundle,
   deferredDeliverablesDockState,
   messagesForDeliverables,
   projectRoot,
   hasMoreMessages,
   lastAssistantRepairOwned,
   deliverablesAssistantWorking,
   sessionManifestForDisk,
   sessionTaskDirectoryEnvelope,
   diskSnapshot,
   diskSnapshotEnvelope.snapshotVersion,
   diskSnapshotCompleteness,
 ]);
 const deliverablesDockState = useMemo(() => {
   if (!isStickyDeliverableBarPersistEnabled()) return deliverablesDockStateRaw;
   const frozenDock = frozenPipelineBundleRef.current?.dockState;
   return resolvePersistedDeliverablesDockState({
     live: { ...deliverablesDockStateRaw, sessionId: currentSessionId ?? null },
     frozen: frozenDock
       ? { ...frozenDock, sessionId: frozenPipelineSessionIdRef.current }
       : null,
     envelopeManifest: sessionDeliverableManifestEnvelope,
     envelopeTaskDir: deliverablesScopeDir ?? sessionTaskDirectoryEnvelope?.taskArtifactDir ?? null,
     sessionId: currentSessionId ?? null,
     pipelineRunning: runDeliverablesPipeline,
     inFlight: deliverablesAssistantWorking,
   });
 }, [
   currentSessionId,
   deliverablesAssistantWorking,
   deliverablesDockStateRaw,
   deliverablesScopeDir,
   runDeliverablesPipeline,
   sessionDeliverableManifestEnvelope,
   sessionTaskDirectoryEnvelope,
 ]);
 const latestDeliverableSummary = useMemo(() => {
   if (sessionDeliverablePipelineBundle) {
     return sessionDeliverablePipelineBundle.latest;
   }
   if (!runDeliverablesPipeline) {
     return { messageId: null, provisional: hasMoreMessages };
   }
   return selectLatestDeliverableSummaryTurn({
     messages: messagesForDeliverables,
     projectRoot,
     hasMoreMessages,
   });
 }, [
   sessionDeliverablePipelineBundle,
   runDeliverablesPipeline,
   messagesForDeliverables,
   hasMoreMessages,
   projectRoot,
 ]);
 const sessionExecutionStatus = typeof selectedSession?.executionStatus === 'string'
   ? selectedSession.executionStatus as 'queued' | 'running' | 'completed' | 'failed' | 'paused'
   : undefined;
 const sessionTaskPhase = useMemo(
   () => resolveSessionTaskPhase({
     isLoading,
     executionStatus: sessionExecutionStatus,
     sessionRepairActive: lastAssistantRepairOwned
       || (lastAssistantAcceptanceStatus === 'needs_repair' && !lastAssistantCircuitBreakerTripped),
     lastAcceptanceStatus: lastAssistantAcceptanceStatus,
     pendingAutoContinue,
     userActionBlocked,
     isConnected,
     userAcknowledgedComplete,
     sessionTerminalComplete: sessionTerminalComplete.terminal,
     comboStageLabel,
     deliverableIncomplete: Boolean(
       deliverablesDockState.showComposerChrome
       && deliverablesDockState.progress.total > 0
       && deliverablesDockState.progress.done < deliverablesDockState.progress.total
       && !isLoading
       && !lastAssistantRepairOwned
       && !userAcknowledgedComplete
       && !sessionTerminalComplete.terminal
       && !pendingAutoContinue
     ),
   }),
   [
     isLoading,
     isConnected,
     lastAssistantAcceptanceStatus,
     lastAssistantRepairOwned,
     pendingAutoContinue,
     userActionBlocked,
     comboStageLabel,
     deliverablesDockState.showComposerChrome,
     deliverablesDockState.progress.done,
     deliverablesDockState.progress.total,
     userAcknowledgedComplete,
     sessionTerminalComplete.terminal,
     sessionExecutionStatus,
   ],
 );

 const isAssistantWorkingFromLifecycle = !sessionTerminalComplete.terminal && !userAcknowledgedComplete && (
   isTaskLifecycleUiEnabled()
     ? isAssistantWorkingFromPhase(sessionTaskPhase)
     : isLoading
 );

 const latestTurnInteractionMode = useMemo(
   () => resolveEffectiveTurnInteractionMode({
     messages: chatMessages,
     isLoading,
   }),
   [chatMessages, isLoading],
 );

 const uiGraceRemaining = useMemo(
   () => resolveUiBudgetCap(workingStatus as AutoRecoveryStatus),
   [workingStatus],
 );

 const autoContinueEnabled = readAutoContinueEnabled();
 const deliverableIncompleteForManual = Boolean(
   deliverablesDockState.showComposerChrome
   && deliverablesDockState.progress.total > 0
   && deliverablesDockState.progress.done < deliverablesDockState.progress.total
   && !isLoading
   && !lastAssistantRepairOwned
   && lastAssistantAcceptanceStatus !== 'passed'
   && !userAcknowledgedComplete
   && !sessionTerminalComplete.terminal
 );

 const deliverableStatusCopy = useMemo(
   () => resolveDeliverableUserStatusCopy({
     sessionTaskPhase,
     acceptanceStatus: lastAssistantAcceptanceStatus,
     completionState: lastAssistantTurnMeta?.completionState,
     qualityCompletion: deliverablesDockState.qualityStatus?.qualityCompletion,
     requiredDone: deliverablesDockState.progress.done,
     requiredTotal: deliverablesDockState.progress.total,
     continuationOwner: lastAssistantContinuationOwner,
     autoContinueEnabled,
     sessionRepairActive: lastAssistantRepairOwned,
     pendingAutoContinue,
     executionStatus: sessionExecutionStatus,
     queuePosition: typeof selectedSession?.queuePosition === 'number'
       ? selectedSession.queuePosition
       : undefined,
     validationSettled: pipelineValidationSettled,
     isAssistantWorking: isAssistantWorkingFromLifecycle,
   }),
   [
     sessionTaskPhase,
     lastAssistantAcceptanceStatus,
     lastAssistantTurnMeta?.completionState,
     deliverablesDockState.qualityStatus?.qualityCompletion,
     deliverablesDockState.progress.done,
     deliverablesDockState.progress.total,
     lastAssistantContinuationOwner,
     autoContinueEnabled,
     lastAssistantRepairOwned,
     pendingAutoContinue,
     sessionExecutionStatus,
     selectedSession?.queuePosition,
     pipelineValidationSettled,
     isAssistantWorkingFromLifecycle,
   ],
 );

 const recoverySurface = useMemo(
   () => resolveRecoverySurfaceState({
     autoContinueEnabled,
     recoveryContinuePending,
     pendingAutoContinue,
     userActionBlocked,
     autoContinueBlocked,
     circuitBreakerTripped: lastAssistantCircuitBreakerTripped,
     userAcknowledgedComplete,
     sessionTerminalComplete: sessionTerminalComplete.terminal,
     isLoading,
     sessionTaskPhase,
     isAssistantWorkingFromLifecycle,
     workingStatus: workingStatus as AutoRecoveryStatus,
     latestTurnInteractionMode,
     uiGraceRemaining,
     engineRepairOwned: lastAssistantRepairOwned,
     manualContinuePending: Boolean(manualResumeOffer),
   }),
   [
     autoContinueBlocked,
     isLoading,
     lastAssistantCircuitBreakerTripped,
     lastAssistantRepairOwned,
     latestTurnInteractionMode,
     pendingAutoContinue,
     recoveryContinuePending,
     sessionTaskPhase,
     uiGraceRemaining,
     userAcknowledgedComplete,
     sessionTerminalComplete.terminal,
     userActionBlocked,
     workingStatus,
     isAssistantWorkingFromLifecycle,
     autoContinueEnabled,
     manualResumeOffer,
   ],
 );

 const isAssistantWorking = recoverySurface.isAssistantWorkingAuthoritative;

 const engineMissingPaths = useMemo(() => {
   const meta = sanitizeTurnAcceptanceMetaRecord(latestTurnAcceptanceMetaEnvelope);
   return Array.isArray(meta?.missingPaths)
     ? meta.missingPaths.filter((path): path is string => typeof path === 'string' && path.trim().length > 0)
     : [];
 }, [latestTurnAcceptanceMetaEnvelope]);

 const presentationLockResult = useMemo(() => {
   if (!isDeliverableStatusLockEnabled() || !currentSessionId || !deliverablesDockState.contractHash) {
     return { rows: deliverablesDockState.rows, lockStore: null as import('../../shared/deliverableRowPresentationLock').DeliverablePresentationLockStore | null };
   }
   const lockStore = sessionStore.getDeliverablePresentationLock(currentSessionId);
   return applyDeliverableRowPresentationLock(deliverablesDockState.rows, {
     sessionId: currentSessionId,
     contractHash: deliverablesDockState.contractHash,
     lockStore,
     validationSettled: pipelineValidationSettled,
     engineMissingPaths,
   });
 }, [
   currentSessionId,
   deliverablesDockState.contractHash,
   deliverablesDockState.rows,
   engineMissingPaths,
   pipelineValidationSettled,
   sessionStore,
 ]);

 useEffect(() => {
   if (!currentSessionId || !presentationLockResult.lockStore) return;
   sessionStore.patchDeliverablePresentationLock(currentSessionId, presentationLockResult.lockStore);
 }, [currentSessionId, presentationLockResult.lockStore, sessionStore]);

 const deliverablesDockStateWithLock = useMemo(() => {
   const lockedProgress = normalizeConversationSummaryProgress(presentationLockResult.rows);
   return {
     ...deliverablesDockState,
     rows: presentationLockResult.rows,
     progress: {
       ...deliverablesDockState.progress,
       done: lockedProgress.done,
       total: lockedProgress.total,
     },
   };
 }, [deliverablesDockState, presentationLockResult.rows]);

 const deliverablesDockStateLive = useMemo(
   () => ({
     ...deliverablesDockStateWithLock,
     sessionId: currentSessionId ?? null,
     isInProgress: !sessionSidebarCompleted && (isAssistantWorking || lastAssistantRepairOwned),
     statusSubtitleKey: deliverableStatusCopy.liveDockTitleKey,
     statusSubtitleValues: deliverableStatusCopy.liveDockTitleValues,
   }),
   [
     currentSessionId,
     deliverableStatusCopy.liveDockTitleKey,
     deliverableStatusCopy.liveDockTitleValues,
     deliverablesDockStateWithLock,
     isAssistantWorking,
     lastAssistantRepairOwned,
     sessionSidebarCompleted,
   ],
 );

 const isMobileShell = useMobileShell();
 const rightRail = useRightWorkspaceRail();

 const setRailDockState = rightRail?.setDockState;
 useEffect(() => {
   if (!setRailDockState) return;
   const nextSessionId = currentSessionId ?? null;
   const sessionChanged = railSessionIdRef.current !== nextSessionId;
   railSessionIdRef.current = nextSessionId;
   if (sessionChanged && runDeliverablesPipeline && !deferredDeliverablesAligned) {
     setRailDockState(createSessionSwitchDockPlaceholder(nextSessionId));
     return;
   }
   setRailDockState(deliverablesDockStateLive);
 }, [
   currentSessionId,
   deferredDeliverablesAligned,
   deliverablesDockStateLive,
   runDeliverablesPipeline,
   setRailDockState,
 ]);

 const scrollToStickySummaryBar = useCallback(() => {
   stickySummaryBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
 }, []);

 const handleOpenDeliverablesDock = useCallback(() => {
   if (isMobileShell && rightRail) {
     rightRail.openMobileDeliverablesSheet();
     return;
   }
   scrollToStickySummaryBar();
 }, [isMobileShell, rightRail, scrollToStickySummaryBar]);

 const showStickySummaryBar = shouldShowStickyDeliverableBar({
   persistEnabled: isStickyDeliverableBarPersistEnabled(),
   stickySummaryEnabled: isStickyDeliverableSummaryEnabled(),
   showComposerChrome: deliverablesDockStateLive.showComposerChrome,
   turnArtifactDir: deliverablesDockStateLive.turnArtifactDir,
   folderPath: deliverablesDockStateLive.folderPath,
   rowCount: deliverablesDockStateLive.rows.length,
   progressTotal: deliverablesDockStateLive.progress.total,
   hasSessionManifest: Boolean(sessionDeliverableManifestEnvelope?.slots?.length)
     || Boolean(deliverablesDockStateLive.hasSessionManifest),
   hasStdaDir: Boolean(deliverablesScopeDir?.includes('artifacts/')),
   isDeliverableTask: Boolean(sessionDeliverableManifestEnvelope?.slots?.length)
     || Boolean(deliverablesScopeDir?.includes('artifacts/'))
     || Boolean(deliverablesDockStateLive.hasSessionManifest),
   lifecycleInFlight: deliverablesAssistantWorking,
 });

 const stickySummaryRowsSource = deliverablesDockStateWithLock.rows;
 const stickyPresentationMode = sessionSidebarCompleted || sessionTerminalComplete.terminal
   ? 'terminal' as const
   : 'turn_snapshot' as const;
 const stickySummaryRowsPresented = useMemo(
   () => presentConversationDeliverableRows(stickySummaryRowsSource, stickyPresentationMode),
   [stickyPresentationMode, stickySummaryRowsSource],
 );
 const deferredStickySummaryRows = useDeferredValue(stickySummaryRowsPresented);
 const stickySummaryRows = pickStickySummaryRows({
   live: stickySummaryRowsPresented,
   deferred: deferredStickySummaryRows,
   assistantWorking: deliverablesAssistantWorking && isDeferDeliverablesWhileStreamingEnabled(),
 });

 const handleSelectDeliverableDockRow = useCallback((row: import('../../shared/buildDeliverableDockRows').DeliverableDockRow) => {
   rightRail?.setSelectedRowId(row.id);
   const path = resolveDockRowOpenPath(row, deliverablesDockStateLive.turnArtifactDir);
   if (canOpenDeliverableDockRow(row) && path && onFileOpen) {
     onFileOpen(path, buildDockRowOpenOptions(row, deliverablesDockStateLive.turnArtifactDir));
   }
 }, [deliverablesDockStateLive.turnArtifactDir, onFileOpen, rightRail]);

 const handleOpenTaskFolderInRail = useCallback((items: DeliverableItem[]) => {
   if (isMobileShell) {
     rightRail?.openMobileFolderSheet();
   }
   if (rightRail?.openTaskFolder) {
     rightRail.openTaskFolder(items);
     return;
   }
   onOpenTaskFolder?.(items);
 }, [isMobileShell, onOpenTaskFolder, rightRail]);

 const ackBypassComposerBlock = sessionTaskPhase === 'deliverable_incomplete'
   && detectUserDeliverableAcknowledgment(input);

 const manualModeComposerOpen = !autoContinueEnabled
   && !isLoading
   && (sessionTaskPhase === 'deliverable_incomplete' || sessionTaskPhase === 'deliverable_repair_pending');

 const isComposerTaskBlocked = isTaskLifecycleUiEnabled()
   ? (isComposerDisabledForPhase(sessionTaskPhase) && !ackBypassComposerBlock && !manualModeComposerOpen)
   : isLoading;

 const showComposerStopButton = useMemo(
   () => shouldShowComposerStopButton({
     userAcknowledgedComplete: userAcknowledgedComplete || sessionTerminalComplete.terminal,
     canAbortSession,
     isLoading,
     sessionTaskPhase,
     executionStatus: sessionExecutionStatus,
     sessionInProcessingSet: processingSessionsHas(processingSessions, currentSessionId),
   }),
   [
     userAcknowledgedComplete,
     sessionTerminalComplete.terminal,
     canAbortSession,
     isLoading,
     sessionTaskPhase,
     sessionExecutionStatus,
     currentSessionId,
     processingSessions,
   ],
 );

 const handleColdResumeManualOffer = useCallback(
   (message: string) => handleManualContinueOffer(message, 'cold_resume'),
   [handleManualContinueOffer],
 );

 // PD-SAAS-FORK (P0-2): cold-start (load-time) resume initiator. Server owns idempotency/budget/recency.
 useColdResumeInitiator({
  sessionId: currentSessionId,
  turnBoundaryKey,
  executionStatus: sessionExecutionStatus,
  isConnected,
  isLoading,
  isLoadingSessionMessages,
  hasMessages: chatMessages.length > 0,
  userActionBlocked,
  autoContinueBlocked: recoveryAutoContinueBlocked,
  sessionTerminalComplete: sessionTerminalComplete.terminal,
  circuitBreakerTripped: lastAssistantCircuitBreakerTripped,
  projectName: selectedProject?.name,
  projectPath: selectedProject?.fullPath || selectedProject?.path,
  onContinue: (message) => handleAutoRecoveryContinue(message, { recovery: true }),
  onManualContinueOffer: handleColdResumeManualOffer,
 });

 // PD-SAAS-FORK (P0-D4): auto sidebar「完成」when engine passes or user ACKs — same as manual complete (pause-turn).
 useEffect(() => {
   if (!currentSessionId) return;
   if (sessionSidebarRevokedAutoComplete) return;
   if (!sessionTerminalComplete.shouldAutoMarkSidebarComplete) return;
   if (sessionSidebarCompleted) return;
   setSessionSidebarCompleted(currentSessionId, true);
   sendMessage({ type: 'pause-turn', sessionId: currentSessionId, reason: 'engine_pass_auto_complete' });
   onSessionNotProcessing?.(currentSessionId);
 }, [
   currentSessionId,
   sessionSidebarCompleted,
   sessionSidebarRevokedAutoComplete,
   sessionTerminalComplete.shouldAutoMarkSidebarComplete,
   onSessionNotProcessing,
   sendMessage,
 ]);

 // PD-SAAS-FORK (P0-D4): drop ghost processing when opening a terminal session.
 useEffect(() => {
   if (!currentSessionId || !sessionTerminalComplete.terminal) return;
   onSessionNotProcessing?.(currentSessionId);
   setPendingAutoContinue(false);
 }, [currentSessionId, onSessionNotProcessing, sessionTerminalComplete.terminal]);

 // PD-SAAS-FORK: repair circuit must not catalog-pause — heal legacy repair_circuit_tripped rows.
 useEffect(() => {
   if (!currentSessionId) return;
   if (sessionExecutionStatus !== 'paused') return;
   if (selectedSession?.pausedReason !== 'repair_circuit_tripped') return;
   sendMessage({ type: 'unpause-session', sessionId: currentSessionId, reason: 'user_resume' });
   onExecutionStatusChange?.({
     sessionId: currentSessionId,
     executionStatus: 'idle',
     pausedReason: null,
   });
 }, [
   currentSessionId,
   onExecutionStatusChange,
   selectedSession?.pausedReason,
   sendMessage,
   sessionExecutionStatus,
 ]);

 useEffect(() => {
 let cancelled = false;
 const loadWelcomePrompts = async () => {
 try {
 const projectPath = selectedProject?.fullPath || selectedProject?.path || undefined;
 const response = await api.capabilitiesWelcome({ projectPath, locale: i18n.language });
 if (!response.ok) {
 throw new Error('capabilities_welcome_failed');
 }
 const payload = await response.json();
 const prompts = Array.isArray(payload?.prompts)
 ? payload.prompts.filter((item: unknown) => typeof item === 'string' && item.trim().length > 0)
 : [];
 if (!cancelled) {
 setSuggestionPrompts(prompts.length > 0 ? prompts : fallbackSuggestionPrompts);
 }
 } catch {
 if (!cancelled) {
 setSuggestionPrompts(fallbackSuggestionPrompts);
 }
 }
 };
 void loadWelcomePrompts();
 return () => {
 cancelled = true;
 };
 }, [fallbackSuggestionPrompts, i18n.language, selectedProject?.fullPath, selectedProject?.path]);

 useEffect(() => {
 const applyPendingPrompt = (prompt: string) => {
 const trimmed = prompt.trim();
 if (!trimmed) return;
 applyIntentComposerInput(trimmed);
 clearPendingCapabilityPrompt();
 requestAnimationFrame(() => {
 const el = textareaRef.current;
 if (!el) return;
 el.focus();
 const end = el.value.length;
 el.setSelectionRange(end, end);
 });
 };

 const pending = readPendingCapabilityPrompt();
 if (pending) applyPendingPrompt(pending);

 const onInject = (event: Event) => {
 const detail = (event as CustomEvent<unknown>).detail;
 if (typeof detail === 'string') {
 applyPendingPrompt(detail);
 return;
 }
 // PD-SAAS-FORK: Hub「试一下」支持 CapabilityPromptPayload 事件载荷
 if (isCapabilityPromptPayload(detail)) {
 injectCapabilityPrompt(detail.prompt, detail.capability, { deferComposerApply: true });
 applyPendingPrompt(detail.prompt);
 return;
 }
 };

 window.addEventListener(CAPABILITY_PROMPT_EVENT, onInject);
 return () => window.removeEventListener(CAPABILITY_PROMPT_EVENT, onInject);
 }, [applyIntentComposerInput, textareaRef]);

 const applySuggestionPrompt = useCallback(
 (prompt: string) => {
 const trimmed = prompt.trim();
 if (!trimmed) return;
 applyIntentComposerInput(trimmed);
 requestAnimationFrame(() => {
 const el = textareaRef.current;
 if (!el) return;
 el.focus();
 const end = el.value.length;
 el.setSelectionRange(end, end);
 });
 },
 [applyIntentComposerInput, textareaRef],
 );

 const refreshSuggestionPrompts = useCallback(() => {
 setSuggestionPrompts(pickRandomWelcomePrompts(6));
 }, []);

 const applyPromptToComposer = useCallback(
 (prompt: string) => {
 const trimmed = prompt.trim();
 if (!trimmed) return;
 applyIntentComposerInput(trimmed);
 clearPendingCapabilityPrompt();
 requestAnimationFrame(() => {
 const el = textareaRef.current;
 if (!el) return;
 el.focus();
 const end = el.value.length;
 el.setSelectionRange(end, end);
 });
 },
 [applyIntentComposerInput, textareaRef],
 );

 const hasActiveConversation = useCallback(() => {
 if (forceWelcome) return false;
 const sessionId = selectedSession?.id || currentSessionId;
 if (!sessionId || isTemporarySessionId(sessionId)) return false;
 return chatMessages.some(
 (message) =>
 message.type === 'user'
 || message.type === 'assistant'
 || message.role === 'user'
 || message.role === 'assistant',
 );
 }, [chatMessages, currentSessionId, forceWelcome, selectedSession?.id]);

 const applyWithDeliverableReferences = useCallback(
 (prompt: string, capability?: CapabilityBindingContext) => {
 const rawPaths = collectConversationMainDeliverablePaths(chatMessages, projectRoot);
 const paths = filterPathsForCapabilityTry(rawPaths, capability?.slug);
 const personalized = personalizeCapabilityTryPrompt(prompt, paths, capability?.slug);
 setPromptWithReferences(personalized, paths);
 clearPendingCapabilityPrompt();
 },
 [chatMessages, projectRoot, setPromptWithReferences],
 );

 const focusComposer = useCallback(() => {
 requestAnimationFrame(() => {
 const el = textareaRef.current;
 if (!el) return;
 el.focus();
 const end = el.value.length;
 el.setSelectionRange(end, end);
 });
 }, [textareaRef]);

 useEffect(() => {
   const onUnmarkFocus = (event: Event) => {
     const detail = (event as CustomEvent<{ sessionId?: string }>).detail;
     const targetId = typeof detail?.sessionId === 'string' ? detail.sessionId : '';
     if (!targetId || !currentSessionId) return;
     if (normalizeSessionId(targetId) !== normalizeSessionId(currentSessionId)) return;
     setPendingAutoContinue(false);
     clearManualContinueOffer();
     setGentleToast({
       text: t('composer.unmarkCompleteHint', {
         defaultValue: '已取消任务完成。有什么新的想法？',
       }),
     });
     window.setTimeout(() => setGentleToast(null), 5000);
     focusComposer();
   };
   window.addEventListener(SESSION_SIDEBAR_UNMARK_FOCUS_EVENT, onUnmarkFocus);
   return () => window.removeEventListener(SESSION_SIDEBAR_UNMARK_FOCUS_EVENT, onUnmarkFocus);
 }, [clearManualContinueOffer, currentSessionId, focusComposer, t]);

 useEffect(() => {
 registerCapabilityTryHost({
 hasActiveConversation,
 applyPrompt: applyPromptToComposer,
 applyWithDeliverableReferences,
 focusComposer,
 });
 return () => registerCapabilityTryHost(null);
 }, [applyPromptToComposer, applyWithDeliverableReferences, focusComposer, hasActiveConversation]);

 useEffect(() => {
 return subscribeDesignCanvasPrefill((detail) => {
 const prompt = detail.prompt?.trim();
 if (!prompt) return;
 const paths = detail.nodePaths ?? [];
 if (paths.length > 0) {
 setPromptWithReferences(prompt, paths);
 } else {
 applyExternalComposerInput(prompt);
 }
 focusComposer();
 });
 }, [applyExternalComposerInput, focusComposer, setPromptWithReferences]);

 useEffect(() => {
 return subscribeHtmlStudioPrefill((detail) => {
 const instruction = detail.instruction?.trim();
 if (!instruction) return;
 applyExternalComposerInput(instruction);
 focusComposer();
 });
 }, [applyExternalComposerInput, focusComposer]);

 useEffect(() => {
 return subscribeHfStudioPrefill((prompt) => {
 if (!prompt.trim()) return;
 applyExternalComposerInput(prompt);
 focusComposer();
 });
 }, [applyExternalComposerInput, focusComposer]);

 useEffect(() => {
 return installHfStudioDeliverableSync(() => ({
 projectName: selectedProject?.name,
 sessionId: selectedSession?.id,
 }));
 }, [selectedProject?.name, selectedSession?.id]);

 const handleTryTemplatePrompt = useCallback(
 (prompt: string, capability?: CapabilityBindingContext) => {
 if (!selectedProject) return;
 const handlers = {
 onNeedNewSession: () => onStartNewSession?.(selectedProject),
 onSwitchToChat: () => onExitWelcome?.(),
 };
 if (capability?.slug) {
 requestCapabilityLaunch({
 slug: capability.slug,
 displayName: capability.displayName,
 launchMode: capability.launchMode,
 prompt,
 capability,
 handlers,
 });
 } else {
 requestCapabilityTry(prompt, capability, handlers);
 }
 setTemplatesHubOpen(false);
 },
 [onExitWelcome, onStartNewSession, selectedProject],
 );

 const handleWebSocketReconnect = useCallback(async () => {
 if (!selectedProject || !selectedSession) return;

 // Reset streaming refs so stale accumulated text from the previous
 // connection doesn't merge with freshly-fetched server messages.
 if (streamTimerRef.current) {
 clearTimeout(streamTimerRef.current);
 streamTimerRef.current = null;
 }
 accumulatedStreamRef.current = '';
 streamBufferRef.current = '';

 await sessionStore.refreshFromServer(selectedSession.id, {
 provider: 'pilotdeck',
 projectName: selectedProject.name,
 projectPath: selectedProject.fullPath || selectedProject.path || '',
 ...sessionRequestParams,
 });

 // Ask the backend whether the session is still processing so the
 // loading indicator and Stop button reflect reality after reconnect.
 // PD-SAAS-FORK: arm the resume probe — if a turn was running when WS dropped and the
 // poll comes back "not processing", that turn ended in the disconnect window (engine
 // aborted_streaming) and we refire turn-complete so it auto-resumes instead of waiting.
 reconnectResumeArmedRef.current = isLoadingRef.current;
 sendMessage({
 type: 'check-session-status',
 sessionId: selectedSession.id,
 provider: 'pilotdeck',
 });
 }, [
 selectedProject,
 selectedSession,
 sessionRequestParams,
 sessionStore,
 streamTimerRef,
 accumulatedStreamRef,
 streamBufferRef,
 sendMessage,
 ]);

 // PD-SAAS-FORK: debounce reconnect refresh to avoid HTTP storms
 const handleWebSocketReconnectDebounced = useCallback(() => {
 if (reconnectDebounceRef.current) {
 clearTimeout(reconnectDebounceRef.current);
 }
 reconnectDebounceRef.current = setTimeout(() => {
 reconnectDebounceRef.current = null;
 const run = async () => {
 await handleWebSocketReconnect();
 };
 if (reconnectInFlightRef.current) {
 reconnectInFlightRef.current = reconnectInFlightRef.current.then(run);
 } else {
 reconnectInFlightRef.current = run().finally(() => {
 reconnectInFlightRef.current = null;
 });
 }
 }, 300);
 }, [handleWebSocketReconnect]);

 // PD-SAAS-FORK: reconnect resume probe wrappers (see shouldRefireTurnCompleteAfterReconnect).
 const handleSessionProcessingWithProbe = useCallback((statusSessionId?: string | null) => {
  // Still running after reconnect — nothing was interrupted, disarm the probe.
  reconnectResumeArmedRef.current = false;
  onSessionProcessing?.(statusSessionId);
 }, [onSessionProcessing]);

 const handleSessionNotProcessingWithProbe = useCallback((statusSessionId?: string | null) => {
  onSessionNotProcessing?.(statusSessionId);
  const armedWhileLoading = reconnectResumeArmedRef.current;
  reconnectResumeArmedRef.current = false;
  if (
    shouldRefireTurnCompleteAfterReconnect({ armedWhileLoading, sessionStillProcessing: false })
    && !sessionTerminalCompleteRef.current
  ) {
   pendingReconnectTurnCompleteRef.current = true;
  }
 }, [onSessionNotProcessing]);

 const handleTurnRejected = useCallback((payload?: { reason?: string }) => {
  const reason = payload?.reason;
  if (reason === 'parallel_limit' || reason === 'platform_busy') {
   setGentleToast({ text: t('composer.parallelLimitHint') });
   window.setTimeout(() => setGentleToast(null), 3200);
  }
 }, [t]);

 const handleTurnAccepted = useCallback((payload: { executionStatus?: string }) => {
  if (payload.executionStatus === 'queued' && !isTaskLifecycleUiEnabled()) {
   setGentleToast({ text: t('composer.taskQueuedHint') });
   window.setTimeout(() => setGentleToast(null), 3200);
  }
 }, [t]);

 useEffect(() => {
   clearManualContinueOffer();
 }, [clearManualContinueOffer, currentSessionId]);

 useEffect(() => {
   if (!pendingReconnectTurnCompleteRef.current || isLoadingSessionMessages) return;
   pendingReconnectTurnCompleteRef.current = false;
   if (readAutoContinueEnabled()) {
     handleTurnComplete({ aborted: true });
     return;
   }
   const locale = typeof document !== 'undefined' && document.documentElement.lang.startsWith('en')
     ? 'en' as const
     : 'zh' as const;
   handleManualContinueOffer(buildAutoRecoveryContinueMessage(locale), 'reconnect');
 }, [handleManualContinueOffer, handleTurnComplete, isLoadingSessionMessages]);

 useChatRealtimeHandlers({
 provider: 'pilotdeck',
 selectedProject,
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
 onSessionProcessing: handleSessionProcessingWithProbe,
 onSessionNotProcessing: handleSessionNotProcessingWithProbe,
 onExecutionStatusChange,
 onReplaceTemporarySession,
 onNavigateToSession,
 onWebSocketReconnect: handleWebSocketReconnectDebounced,
 sessionStore,
 onTurnComplete: handleTurnComplete,
 onTurnRejected: handleTurnRejected,
 onTurnAccepted: handleTurnAccepted,
 });

 useEffect(() => {
 if (!showComposerStopButton) {
 setIsAbortPending(false);
 }
 }, [showComposerStopButton]);

 useEffect(() => {
 if (!isAbortPending || !showComposerStopButton) return;
 const timer = window.setTimeout(() => setIsAbortPending(false), 2500);
 return () => window.clearTimeout(timer);
 }, [isAbortPending, showComposerStopButton]);

 useEffect(() => {
 setIsAbortPending(false);
 }, [currentSessionId, selectedSession?.id]);

 const handleAbortWithPending = useCallback(() => {
 if (isAbortPending || !showComposerStopButton) return;

 const pendingSessionId =
   typeof window !== 'undefined' ? sessionStorage.getItem('pendingSessionId') : null;
 const targetSessionId = resolveAbortTargetSessionId({
   currentSessionId,
   pendingViewSessionId: pendingViewSessionRef.current?.sessionId || null,
   pendingSessionIdFromStorage: pendingSessionId,
   selectedSessionId: selectedSession?.id || null,
   processingSessionIds: processingSessions ? Array.from(processingSessions) : undefined,
 });
 if (!targetSessionId) return;

 sendMessage({ type: 'pause-turn', sessionId: targetSessionId, reason: 'user_pause' });
 onExecutionStatusChange?.({
   sessionId: targetSessionId,
   executionStatus: 'paused',
   pausedReason: 'user_pause',
 });
 onSessionNotProcessing?.(targetSessionId);
 setIsLoading(false);
 setCanAbortSession(false);
 setIsAborting(false);
 setClaudeStatus(null);
 setPilotDeckStatus(null);
 setPendingAutoContinue(false);
 clearManualContinueOffer();
 setGentleToast({ text: t('composer.taskPausedHint') });
 window.setTimeout(() => setGentleToast(null), 4000);
 setIsAbortPending(true);
 }, [
 currentSessionId,
 isAbortPending,
 onExecutionStatusChange,
 onSessionNotProcessing,
 pendingViewSessionRef,
 processingSessions,
 selectedSession?.id,
 sendMessage,
 setCanAbortSession,
 setClaudeStatus,
 setIsAborting,
 setIsLoading,
 setPilotDeckStatus,
 showComposerStopButton,
 t,
 ]);

 const [loadingStartedAtMs, setLoadingStartedAtMs] = useState<number | null>(null);
 const [bridgeStaleHandled, setBridgeStaleHandled] = useState(false);
 useEffect(() => {
   if (isLoading) {
     setLoadingStartedAtMs((prev) => prev ?? Date.now());
   } else {
     setLoadingStartedAtMs(null);
   }
 }, [isLoading]);

 useEffect(() => {
   const interruptKind = (workingStatus as { interruptKind?: string } | null)?.interruptKind;
   const statusKind = (workingStatus as { statusKind?: string } | null)?.statusKind;
   const statusText = String((workingStatus as { text?: string } | null)?.text || '').toLowerCase();
   if (
     interruptKind === 'stale_idle'
     || statusKind === 'recovery_pause'
     || statusText === 'recovery_pause'
     || statusKind === 'recovery_handling'
   ) {
     setBridgeStaleHandled(true);
   }
 }, [workingStatus]);

 useEffect(() => {
   setBridgeStaleHandled(false);
 }, [turnBoundaryKey]);

 const handleStaleTurnFallback = useCallback(async (stuckStepLabel: string | null) => {
   if (!selectedProject?.name) return;
   if (sessionTerminalCompleteRef.current) return;
   if (currentSessionId && isSessionSidebarCompleted(currentSessionId)) return;
   const locale = typeof document !== 'undefined' && document.documentElement.lang.startsWith('en')
     ? 'en' as const
     : 'zh' as const;
   const message = buildStaleTurnFallbackContinueMessage(locale, stuckStepLabel ?? undefined);
   if (!autoContinueEnabled) {
     handleAbortWithPending();
     handleManualContinueOffer(message, 'stale_turn');
     return;
   }
   if (recoveryAutoContinueBlocked) return;
   if (!tryTaskResumeSchedule(turnBoundaryKey, 'stale_turn')) return;
   handleAbortWithPending();
   markTaskResumeFired(turnBoundaryKey, 'stale_turn');
   handleAutoRecoveryContinue(message, { recovery: true });
 }, [
   recoveryAutoContinueBlocked,
   autoContinueEnabled,
   handleAbortWithPending,
   handleAutoRecoveryContinue,
   handleManualContinueOffer,
   selectedProject?.name,
   turnBoundaryKey,
   currentSessionId,
 ]);

 const staleTurnSuppressFallback = shouldSuppressStaleTurnFallback({
   bridgeStaleHandled,
   userAcknowledgedComplete: userAcknowledgedComplete || sessionTerminalComplete.terminal,
   autoContinueBlocked,
   pendingAutoContinue,
   recoveryContinuePending,
   hardTurnStop: lastTurnCompleteMeta?.errorRecoverable === false
     || lastTurnCompleteMeta?.errorCode === 'agent_model_error',
   workingStatus: workingStatus as AutoRecoveryStatus,
   isLoading,
 });

 const userCompleteStopKeyRef = useRef<string | null>(null);
 useEffect(() => {
   userCompleteStopKeyRef.current = null;
 }, [currentSessionId]);

 useEffect(() => {
   if (!sessionTerminalComplete.terminal || !currentSessionId) return;
   const stopKey = `${currentSessionId}:${sessionTerminalComplete.reason ?? 'terminal'}`;
   if (userCompleteStopKeyRef.current === stopKey) return;
   const needsStop = isLoading
     || pendingAutoContinue
     || recoveryContinuePending
     || lastAssistantRepairOwned
     || canAbortSession;
   if (!needsStop) return;
   userCompleteStopKeyRef.current = stopKey;

   sendMessage({ type: 'pause-turn', sessionId: currentSessionId, reason: 'user_complete_click' });
   onSessionNotProcessing?.(currentSessionId);
   setIsLoading(false);
   setCanAbortSession(false);
   setIsAborting(false);
   setClaudeStatus(null);
   setPilotDeckStatus(null);
   setPendingAutoContinue(false);
 }, [
   canAbortSession,
   currentSessionId,
   isLoading,
   lastAssistantRepairOwned,
   onSessionNotProcessing,
   pendingAutoContinue,
   recoveryContinuePending,
   sendMessage,
   setCanAbortSession,
   setClaudeStatus,
   setIsAborting,
   setIsLoading,
   setPilotDeckStatus,
   sessionTerminalComplete.reason,
   sessionTerminalComplete.terminal,
 ]);

 const staleTurn = useStaleTurnWatchdog({
   isWorking: isAssistantWorking,
   startedAtMs: loadingStartedAtMs,
   activities: activityMessages,
   chatMessages,
   isConnected,
   suppressFallback: staleTurnSuppressFallback,
   disableAutoFallback: false,
   onFallback: handleStaleTurnFallback,
 });

 const manualContinueResolved = useMemo(
   () => resolveManualContinueOffer({
     autoContinueEnabled,
     sessionId: currentSessionId,
     isConnected,
     userActionBlocked,
     userAcknowledgedComplete,
     sessionTerminalComplete: sessionTerminalComplete.terminal,
     autoContinueBlocked,
     circuitBreakerTripped: lastAssistantCircuitBreakerTripped,
     isLoading,
     isLoadingSessionMessages,
     sessionTaskPhase,
     workingStatus: workingStatus as AutoRecoveryStatus,
     deliverableIncomplete: deliverableIncompleteForManual,
     staleTurnPhase: staleTurn.phase,
     pendingResumeMessage: manualResumeOffer?.message ?? null,
     pendingReason: manualResumeOffer?.reason ?? null,
     suppressManualContinueHint: deliverableStatusCopy.suppressManualContinueHint,
   }),
   [
     autoContinueBlocked,
     autoContinueEnabled,
     currentSessionId,
     deliverableIncompleteForManual,
     deliverableStatusCopy.suppressManualContinueHint,
     isConnected,
     isLoading,
     isLoadingSessionMessages,
     manualResumeOffer,
     sessionTaskPhase,
     sessionTerminalComplete.terminal,
     staleTurn.phase,
     userAcknowledgedComplete,
     userActionBlocked,
     workingStatus,
     lastAssistantCircuitBreakerTripped,
   ],
 );

 const sessionSidebarAttention = useMemo(
   () => {
     if (!currentSessionId) {
       return { needsUserInput: false, interrupted: false };
     }
     return deriveSessionSidebarAttentionFromMessages(chatMessages, {
       userActionBlocked,
       pendingElicitationCount: effectivePendingPermissionRequests.length,
       isLoading,
       isAssistantWorking,
       recoveryPhase: recoverySurface.phase,
       manualContinueReason: manualContinueResolved.reason,
       circuitBreakerTripped: lastAssistantCircuitBreakerTripped,
       formalErrorCode: lastTurnCompleteMeta?.errorCode ?? null,
       pausedReason: selectedSession?.pausedReason ?? null,
       executionStatus: sessionExecutionStatus,
       userAcknowledgedComplete,
       sessionTerminalComplete: sessionTerminalComplete.terminal,
     });
   },
   [
     chatMessages,
     currentSessionId,
     effectivePendingPermissionRequests.length,
     isAssistantWorking,
     isLoading,
     lastAssistantCircuitBreakerTripped,
     lastTurnCompleteMeta?.errorCode,
     manualContinueResolved.reason,
     recoverySurface.phase,
     selectedSession?.pausedReason,
     sessionExecutionStatus,
     sessionTerminalComplete.terminal,
     userAcknowledgedComplete,
     userActionBlocked,
   ],
 );

 useEffect(() => {
   if (!currentSessionId) return;
   onSessionAttentionChange?.(currentSessionId, sessionSidebarAttention);
 }, [currentSessionId, onSessionAttentionChange, sessionSidebarAttention]);

 const handleManualContinueClick = useCallback(async () => {
   if (!selectedProject?.name || !currentSessionId) return;
   if (isManualContinuePending) return;
   if (!isConnected) {
     setGentleToast({
       text: t('composer.manualContinueNotConnected', { defaultValue: '连接尚未就绪，请稍后再试' }),
     });
     window.setTimeout(() => setGentleToast(null), 3200);
     return;
   }
   setIsManualContinuePending(true);
   try {
     const resumeKind = manualContinueResolved.reason ?? 'recovery_pause';
     const mappedKind = resumeKind === 'incomplete_deliverable'
       ? 'ui_incomplete_deliverable'
       : resumeKind === 'cold_resume'
         ? 'cold_resume'
         : resumeKind === 'stale_turn'
           ? 'stale_turn'
           : resumeKind === 'reconnect'
             ? 'infra_interrupt'
             : resumeKind === 'infra_interrupt'
               ? 'infra_interrupt'
               : resumeKind === 'deliverable_repair'
                 ? 'deliverable_repair'
                 : 'recovery_pause';
     if (!prepareUserManualTaskResume(turnBoundaryKey, mappedKind)) {
       setGentleToast({
         text: t('composer.manualContinueFailed', { defaultValue: '暂时未能继续，请稍后再试' }),
       });
       window.setTimeout(() => setGentleToast(null), 3200);
       return;
     }
     let message = manualContinueResolved.resumeMessage?.trim() ?? '';
     if (!message) {
       const locale = typeof document !== 'undefined' && document.documentElement.lang.startsWith('en')
         ? 'en' as const
         : 'zh' as const;
       if (staleTurn.phase === 'fallback' || staleTurn.phase === 'warn') {
         message = buildStaleTurnFallbackContinueMessage(locale, staleTurn.stuckStepLabel ?? undefined);
       } else {
         message = await fetchTaskResumeContext(
           currentSessionId,
           selectedProject.name,
           selectedProject.fullPath || selectedProject.path,
         ) ?? buildAutoRecoveryContinueMessage(locale);
       }
     }
     const sent = handleAutoRecoveryContinue(message, { userInitiated: true });
     if (!sent) {
       setGentleToast({
         text: t('composer.manualContinueFailed', { defaultValue: '暂时未能继续，请稍后再试' }),
       });
       window.setTimeout(() => setGentleToast(null), 3200);
       return;
     }
     markTaskResumeFired(turnBoundaryKey, mappedKind);
     clearManualContinueOffer();
     setRecoveryRunId((value) => value + 1);
   } finally {
     setIsManualContinuePending(false);
   }
 }, [
   clearManualContinueOffer,
   currentSessionId,
   handleAutoRecoveryContinue,
   isConnected,
   isManualContinuePending,
   manualContinueResolved.reason,
   manualContinueResolved.resumeMessage,
   selectedProject,
   staleTurn.phase,
   staleTurn.stuckStepLabel,
   t,
   turnBoundaryKey,
 ]);

 useEffect(() => {
   if (!isLoading || !canAbortSession) return;
 const handleGlobalEscape = (event: KeyboardEvent) => {
 if (event.key !== 'Escape' || event.repeat || event.defaultPrevented) return;
 event.preventDefault();
 handleAbortWithPending();
 };
 document.addEventListener('keydown', handleGlobalEscape, { capture: true });
 return () => {
 document.removeEventListener('keydown', handleGlobalEscape, { capture: true });
 };
 }, [canAbortSession, handleAbortWithPending, isLoading]);

 useEffect(() => {
 return () => {
 resetStreamingState();
 };
 }, [resetStreamingState]);

 // ChatGPT-style empty state. Triggered explicitly via `forceWelcome` and
 // implicitly when nothing has been started yet (no session, no
 // messages, not in the middle of loading). The composer floats in the
 // middle with a welcome headline above it; once the user sends, we drop
 // into the normal layout (composer at bottom, messages on top) on the
 // next render.
 const isWelcomeMode =
 !!forceWelcome ||
 (!selectedSession && !currentSessionId && !isLoadingSessionMessages && chatMessages.length === 0);

 // Fire onExitWelcome the moment the user submits from welcome mode. Wraps
 // handleSubmit so we don't have to thread state through useChatComposerState.
 const wrappedSubmit = useCallback(
 (...args: unknown[]) => {
 if (sessionSidebarCompleted && currentSessionId) {
   setGentleToast({
     text: t('composer.taskMarkedCompleteSendBlocked', {
       defaultValue: '任务已标记完成。如需继续，请先在侧栏右键「取消任务完成」。',
     }),
   });
   window.setTimeout(() => setGentleToast(null), 4500);
   return;
 }
 if (isWelcomeMode && onExitWelcome) onExitWelcome();
 if (currentSessionId && sessionSidebarRevokedAutoComplete) {
   setSessionSidebarRevokedAutoComplete(currentSessionId, false);
 }
 setRecoveryRunId((value) => value + 1);
 return (handleSubmit as (...a: unknown[]) => unknown)(...args);
 },
 [currentSessionId, handleSubmit, isWelcomeMode, onExitWelcome, sessionSidebarCompleted, sessionSidebarRevokedAutoComplete, t],
 );

 useEffect(() => {
   return subscribePreflightComposerSubmit(() => {
     window.setTimeout(() => {
       wrappedSubmit({ preventDefault: () => undefined } as React.FormEvent);
     }, 0);
   });
 }, [wrappedSubmit]);

 const connectionBanner = !isConnected && !isReadOnlyBackgroundSession ? (
 <div
 role="status"
 className="mx-auto mb-2 w-full max-w-[936px] rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-center text-xs text-warning /40"
 >
 {t('composer.connectionLost', {
 defaultValue: '实时连接未建立，提问无法送达。请刷新页面；局域网访问请用本机 IP 打开并确认服务已启动。',
 })}
 </div>
 ) : null;

 // The composer is identical in welcome / normal mode — just rendered in a
 // different parent container. Pulled out so we don't drift between the two.
 const composer = isReadOnlyComposer ? (
 <div className="mx-auto w-full max-w-[936px] px-6 pb-3.5 pt-2.5">
 <div className="rounded-xl border border-border bg-sidebar px-4 py-3 text-[13px] text-muted-foreground">
 {isLockedSession
 ? t('session.readonlyLocked', {
 defaultValue: '此对话已锁定，无法继续发送消息。请在侧栏右键菜单中解除锁定。',
 })
 : t('session.readonlyBackground', {
 defaultValue: 'This background task transcript is read-only.',
 })}
 </div>
 </div>
 ) : (
 <ComposerV2
 input={input}
 placeholder={
   (() => {
     if (sessionSidebarCompleted) {
       return t('composer.taskMarkedCompletePlaceholder', {
         defaultValue: '任务已结束。如需继续或有新需求，请先在侧栏右键「取消任务完成」。',
       }) as string;
     }
     if (sessionSidebarRevokedAutoComplete) {
       return t('composer.unmarkCompletePlaceholder', {
         defaultValue: '有什么新的想法？输入后发送即可继续…',
       }) as string;
     }
     const copy = deliverableStatusCopy;
     if (copy.composerPlaceholderKey === 'composer.deliverableIncompleteProgressPlaceholder' && copy.showUserAckHint) {
       const hint = buildDeliverableLifecycleHint({
         done: deliverablesDockStateLive.progress.done,
         total: deliverablesDockStateLive.progress.total,
         pendingWritten: deliverablesDockStateLive.progress.done > 0,
       });
       return hint
         ? (t(copy.composerPlaceholderKey, {
           defaultValue: `${hint}…如需确认完成可回复「可以了」`,
           hint,
           ...copy.composerPlaceholderValues,
         }) as string)
         : (t('composer.deliverableIncompletePlaceholder', {
           defaultValue: '成果尚未齐备，正在继续处理…如需确认完成可回复「可以了」',
         }) as string);
     }
     if (copy.composerPlaceholderKey !== 'composer.placeholder') {
       return t(copy.composerPlaceholderKey, {
         defaultValue: copy.composerPlaceholderKey === 'composer.deliverableAligningPlaceholder'
           ? `正在核对成果清单（${copy.composerPlaceholderValues.done}/${copy.composerPlaceholderValues.total}），请稍候…`
           : copy.composerPlaceholderKey === 'composer.deliverableQueuedPlaceholder'
             ? `排队中（第 ${copy.composerPlaceholderValues.position} 位），请稍候…`
             : copy.composerPlaceholderKey === 'composer.taskInFlightPlaceholder'
               ? '制作中，请稍候…'
             : copy.composerPlaceholderKey === 'composer.deliverableIncompleteManualPlaceholder'
               ? `还有 ${copy.composerPlaceholderValues.remaining} 项成果，点「继续」或发消息说明即可`
               : '制作中，请稍候…',
         ...copy.composerPlaceholderValues,
       }) as string;
     }
     if (isComposerTaskBlocked) {
       return t('composer.taskInFlightPlaceholder', {
         defaultValue: '任务进行中，请稍候…',
       }) as string;
     }
     return t('composer.placeholder', {
       defaultValue: 'Tell Nova Ai-Studio what you want to get done…',
     }) as string;
   })()
 }
 textareaRef={textareaRef}
 fileReferencePaths={fileReferencePaths}
 onRemoveFileReference={removeFileReference}
 onInputChange={handleInputChange}
 onTextareaClick={handleTextareaClick}
 onTextareaKeyDown={handleKeyDown}
 onTextareaPaste={handlePaste}
 onTextareaInput={handleTextareaInput}
 onInputFocusChange={handleInputFocusChange}
 onSubmit={wrappedSubmit as typeof handleSubmit}
 onAbortSession={handleAbortWithPending}
 openImagePicker={openImagePicker}
 attachedImages={attachedImages}
 onRemoveImage={(index) =>
 setAttachedImages((previous) =>
 previous.filter((_, currentIndex) => currentIndex !== index),
 )
 }
 uploadingImages={uploadingImages}
 imageErrors={imageErrors}
 showFileDropdown={showFileDropdown}
 filteredFiles={filteredFiles}
 selectedFileIndex={selectedFileIndex}
 onSelectFile={selectFile}
 filteredCommands={filteredCommands}
 selectedCommandIndex={selectedCommandIndex}
 onCommandSelect={handleCommandSelect}
 onCloseCommandMenu={dismissCommandMenu}
 isCommandMenuOpen={showCommandMenu}
 frequentCommands={commandQuery ? [] : frequentCommands}
 onToggleCommandMenu={handleToggleCommandMenu}
 onInsertMention={() => insertAtCursor('@')}
 onInsertSlash={() => insertAtCursor('/')}
 onOpenTemplatesHub={() => setTemplatesHubOpen(true)}
 getRootProps={getRootProps as (...args: unknown[]) => Record<string, unknown>}
 getInputProps={getInputProps as (...args: unknown[]) => Record<string, unknown>}
 isDragActive={isDragActive}
 isLoading={isComposerTaskBlocked || sessionSidebarCompleted}
 canAbortSession={canAbortSession}
 showStopButton={showComposerStopButton}
 showContinueButton={manualContinueResolved.showButton}
 onManualContinue={handleManualContinueClick}
 isManualContinuePending={isManualContinuePending}
 manualContinueHint={
   manualContinueResolved.showButton && manualContinueResolved.hintKey
     ? t(manualContinueResolved.hintKey)
     : undefined
 }
 isConnected={isConnected}
 isAbortPending={isAbortPending}
 tokenBudget={tokenBudget}
 pendingPermissionRequests={effectivePendingPermissionRequests}
 handlePermissionDecision={handlePermissionDecision}
 handleGrantToolPermission={handleGrantToolPermission}
 runMode={runMode}
 onRunModeChange={setRunMode}
 planModeAvailable={true}
 onPlanExecutionApproved={handlePlanExecutionApproved}
 sendByCtrlEnter={sendByCtrlEnter}
 chromeless={isWelcomeMode}
 />
 );

 const templatesHubDialog = (
 <TemplatesHubDialog
 open={templatesHubOpen}
 selectedProject={selectedProject}
 onTryPrompt={handleTryTemplatePrompt}
 onClose={() => setTemplatesHubOpen(false)}
 />
 );

 if (isWelcomeMode) {
 const projectName = selectedProject?.displayName || selectedProject?.name || '';
 // PD-SAAS-FORK: Beta Demo card-grid welcome; /app keeps pill chips below
 if (betaSurface.active) {
 return (
 <DeliverableValidationSessionProvider
   sessionId={selectedSession?.id}
   projectName={selectedProject?.name}
   projectRoot={selectedProject?.fullPath || selectedProject?.path || ''}
   latest={latestDeliverableSummary}
   chatMessages={messagesForDeliverables}
   pipelineBundle={sessionDeliverablePipelineBundle}
 >
 <div className="flex h-full flex-col bg-background px-6 max-md:px-3.5">
 {templatesHubDialog}
 <BetaWelcome
   projectName={projectName}
   prompts={suggestionPrompts}
   onPickPrompt={applySuggestionPrompt}
   onRefreshPrompts={refreshSuggestionPrompts}
   onOpenHub={() => setTemplatesHubOpen(true)}
   onOpenDiscover={onOpenDiscoverTab}
   connectionBanner={connectionBanner}
   composer={composer}
 />
 </div>
 {isMobileShell ? (
 <DeliverableSessionSheet
   open={Boolean(rightRail?.sheetOpen)}
   mode={rightRail?.sheetMode ?? 'folder'}
   onClose={() => rightRail?.setSheetOpen(false)}
   selectedSessionId={activeSessionId ?? null}
   rows={deliverablesDockStateLive.rows}
   folderPath={deliverablesDockStateLive.folderPath}
   folderItems={deliverablesDockStateLive.folderItems}
   selectedProject={selectedProject}
   projectRoot={projectRoot}
   turnArtifactDir={deliverablesDockStateLive.turnArtifactDir}
   scopeDir={deliverablesDockStateLive.turnArtifactDir ?? deliverablesDockStateLive.folderPath ?? null}
   contractHash={deliverablesDockStateLive.contractHash ?? null}
   validationSettled={pipelineValidationSettled || sessionSidebarCompleted}
   qualityStatus={deliverablesDockStateLive.qualityStatus ?? null}
   selectedRowId={rightRail?.selectedRowId}
   isRepairActive={deliverablesDockStateLive.isRepairActive}
   currentStageId={deliverablesDockStateLive.progress.currentStageId}
   stageProgress={deliverablesDockStateLive.progress}
   onSelectRow={handleSelectDeliverableDockRow}
   onFileOpen={onFileOpen}
   onOpenTaskFolder={handleOpenTaskFolderInRail}
 />
 ) : null}
 </DeliverableValidationSessionProvider>
 );
 }
 return (
 <DeliverableValidationSessionProvider
   sessionId={selectedSession?.id}
   projectName={selectedProject?.name}
   projectRoot={selectedProject?.fullPath || selectedProject?.path || ''}
   latest={latestDeliverableSummary}
   chatMessages={messagesForDeliverables}
   pipelineBundle={sessionDeliverablePipelineBundle}
 >
 <div className="flex h-full flex-col bg-background">
 {templatesHubDialog}
 <div className="flex flex-1 flex-col items-center justify-center px-6 max-md:px-3.5">
 <div className="w-full max-w-[936px]">
 <h1 className="mb-8 text-center text-[26px] font-medium tracking-tight text-foreground max-md:mb-6 max-md:text-[22px]">
 {selectedProject
 ? t('welcome.greetingWithProject', {
 project: projectName,
 defaultValue: `What's on the plan today?`,
 })
 : t('welcome.noProject', {
 defaultValue: 'Pick a project from the sidebar to get started',
 })}
 </h1>
 <div className="mb-3 flex flex-wrap justify-center gap-2">
 {suggestionPrompts.map((item) => (
 <button
 key={item}
 type="button"
 className="rounded-full border border-border bg-sidebar px-3 py-1.5 text-xs text-foreground transition-all hover:-translate-y-px hover:border-border hover:bg-muted"
 onClick={() => applySuggestionPrompt(item)}
 >
 {item}
 </button>
 ))}
 </div>
 {onOpenDiscoverTab ? (
 <div className="mb-4 flex flex-col items-center gap-2 text-center">
 <button
 type="button"
 onClick={() => setTemplatesHubOpen(true)}
 className="rounded-full border border-indigo-200/80 bg-indigo-50/80 px-4 py-2 text-xs font-medium text-indigo-900 transition hover:border-indigo-300 hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-100 dark:hover:bg-indigo-950/60"
 >
 {tHub('welcomeCta')} → {tHub('openHub')}
 </button>
 <button
 type="button"
 onClick={onOpenDiscoverTab}
 className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
 >
 探索全部能力 →
 </button>
 </div>
 ) : null}
 {connectionBanner}
 {composer}
 </div>
 </div>
 </div>
 {isMobileShell ? (
 <DeliverableSessionSheet
   open={Boolean(rightRail?.sheetOpen)}
   mode={rightRail?.sheetMode ?? 'folder'}
   onClose={() => rightRail?.setSheetOpen(false)}
   selectedSessionId={activeSessionId ?? null}
   rows={deliverablesDockStateLive.rows}
   folderPath={deliverablesDockStateLive.folderPath}
   folderItems={deliverablesDockStateLive.folderItems}
   selectedProject={selectedProject}
   projectRoot={projectRoot}
   turnArtifactDir={deliverablesDockStateLive.turnArtifactDir}
   scopeDir={deliverablesDockStateLive.turnArtifactDir ?? deliverablesDockStateLive.folderPath ?? null}
   contractHash={deliverablesDockStateLive.contractHash ?? null}
   validationSettled={pipelineValidationSettled || sessionSidebarCompleted}
   qualityStatus={deliverablesDockStateLive.qualityStatus ?? null}
   selectedRowId={rightRail?.selectedRowId}
   isRepairActive={deliverablesDockStateLive.isRepairActive}
   currentStageId={deliverablesDockStateLive.progress.currentStageId}
   stageProgress={deliverablesDockStateLive.progress}
   onSelectRow={handleSelectDeliverableDockRow}
   onFileOpen={onFileOpen}
   onOpenTaskFolder={handleOpenTaskFolderInRail}
 />
 ) : null}
 </DeliverableValidationSessionProvider>
 );
 }

 return (
 <DeliverableValidationSessionProvider
   sessionId={selectedSession?.id}
   projectName={selectedProject?.name}
   projectRoot={selectedProject?.fullPath || selectedProject?.path || ''}
   latest={latestDeliverableSummary}
   chatMessages={messagesForDeliverables}
   pipelineBundle={sessionDeliverablePipelineBundle}
 >
 <div className="flex h-full min-h-0 flex-col bg-background">
 {templatesHubDialog}
 <div className="flex min-h-0 flex-1 flex-col">
 <MessagesPaneV2
 scrollContainerRef={scrollContainerRef}
 onWheel={handleScroll}
 onTouchMove={handleScroll}
 isLoadingSessionMessages={isLoadingSessionMessages}
 isRevalidatingSessionMessages={isRevalidatingSessionMessages}
 deliverablesPipelineReady={deliverablesPipelineReady}
 latestDeliverableSummary={latestDeliverableSummary}
 sessionLoadError={sessionLoadError}
 sessionLoadFailureKind={sessionLoadFailureKind}
 onRetrySessionLoad={handleWebSocketReconnect}
 chatMessages={chatMessages}
 activityMessages={activityMessages}
 visibleMessages={visibleMessages}
 visibleMessageCount={visibleMessageCount}
 isLoadingMoreMessages={isLoadingMoreMessages}
 hasMoreMessages={hasMoreMessages}
 totalMessages={totalMessages}
 loadEarlierMessages={loadEarlierMessages}
 loadAllMessages={loadAllMessages}
 allMessagesLoaded={allMessagesLoaded}
 isLoadingAllMessages={isLoadingAllMessages}
 provider={'pilotdeck' as Provider}
 selectedProject={selectedProject}
 selectedSession={selectedSession}
 createDiff={createDiff}
 onFileOpen={onFileOpen}
 onOpenTaskFolder={handleOpenTaskFolderInRail}
 onShowSettings={onShowSettings}
 onGrantSessionToolPermission={handleGrantSessionToolPermission}
 autoExpandTools={autoExpandTools}
 showRawParameters={showRawParameters}
 showThinking={showThinking}
 processDetailLevel={processDetailLevel}
 setInput={setInput}
 onApplySuggestionPrompt={applySuggestionPrompt}
 suggestedPrompts={suggestionPrompts}
 isAssistantWorking={isAssistantWorking}
 recoverySurface={recoverySurface}
 sessionTaskPhase={sessionTaskPhase}
 sessionRepairActive={lastAssistantRepairOwned && !recoverySurface.suppressSessionRepairUi}
 sessionUnifiedRows={deliverablesDockStateWithLock.rows}
 sessionUnifiedFolderItems={deliverablesDockStateWithLock.folderItems}
 sessionScopeDir={deliverablesDockStateWithLock.turnArtifactDir ?? deliverablesDockStateWithLock.folderPath ?? null}
 sessionContractHash={deliverablesDockStateWithLock.contractHash ?? null}
 stickySummaryEnabled={showStickySummaryBar}
 onScrollToSessionSummary={scrollToStickySummaryBar}
 processRailProgress={
   sessionDeliverablePipelineBundle
     ? (sessionDeliverablePipelineBundle.processRailProgress ?? null)
     : undefined
 }
 sessionWideItems={sessionDeliverablePipelineBundle?.sessionItems}
 sessionVerifiedPaths={sessionDeliverablePipelineBundle?.verifiedPaths}
 workingStatus={claudeStatus || pilotDeckStatus}
 runMode={runMode}
 pendingPermissionRequests={effectivePendingPermissionRequests}
 handlePermissionDecision={handlePermissionDecision}
 handleGrantToolPermission={handleGrantToolPermission}
 onPlanExecutionApproved={handlePlanExecutionApproved}
 staleTurn={staleTurn.phase ? staleTurn : undefined}
 showLiveToolProcessInDock={recoverySurface?.showLiveToolProcessInDock ?? true}
 onRecoveryFormalRetry={handleRecoveryFormalRetry}
 />
 </div>
 {elicitationPermissionRequests.length > 0 ? (
 <div className="shrink-0 border-t border-border bg-card px-4 py-3 max-md:px-3.5" data-testid="elicitation-dock">
 <div className="mx-auto max-w-[936px]">
 <PermissionRequestsBanner
 pendingPermissionRequests={elicitationPermissionRequests}
 handlePermissionDecision={handlePermissionDecision}
 handleGrantToolPermission={handleGrantToolPermission}
 onPlanExecutionApproved={handlePlanExecutionApproved}
 />
 </div>
 </div>
 ) : null}
 <div className="shrink-0 border-t border-border/25 px-4 pb-2.5 pt-2 max-md:px-3.5 max-md:pb-2">
 {connectionBanner}
 {sessionSidebarCompleted ? (
   <div
     role="status"
     className="mx-auto mb-2 w-full max-w-[936px] rounded-lg border border-border/50 bg-muted/25 px-3 py-2 text-center text-[12px] text-muted-foreground"
   >
     {t('composer.taskMarkedCompleteBanner', {
       defaultValue: '任务已结束，下方可查看当前成果。如需继续或有新需求，请先在侧栏右键「取消任务完成」。',
     })}
   </div>
 ) : null}
 {showStickySummaryBar ? (
   <div ref={stickySummaryBarRef} className="mb-2">
     <SessionDeliverableSummaryBar
       rows={stickySummaryRows}
       folderItems={deliverablesDockStateLive.folderItems}
       contractHash={deliverablesDockStateLive.contractHash ?? null}
       validationSettled={pipelineValidationSettled || sessionSidebarCompleted}
       isRepairActive={sessionSidebarCompleted ? false : deliverablesDockStateLive.isRepairActive}
       taskMarkedComplete={sessionSidebarCompleted}
       selectedProject={selectedProject}
       projectRoot={projectRoot}
       turnArtifactDir={deliverablesDockStateLive.turnArtifactDir ?? null}
       scopeDir={deliverablesDockStateLive.turnArtifactDir ?? deliverablesDockStateLive.folderPath ?? null}
       qualityStatus={deliverablesDockStateLive.qualityStatus ?? null}
       onFileOpen={onFileOpen}
       onOpenTaskFolder={handleOpenTaskFolderInRail}
       isMobile={isMobileShell}
       onOpenMobileSheet={handleOpenDeliverablesDock}
     />
   </div>
 ) : null}
 {composer}
 </div>
 {gentleToast ? (
 <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-neutral-800/90 px-4 py-2 text-xs text-primary-foreground shadow-lg">
 {gentleToast.text}
 </div>
 ) : null}
 <ResumeHintToast
 visible={resumeHintVisible}
 message={resumeHintMessage}
 onDismiss={dismissResumeHint}
 />
 <StageProgressRail stages={undefined} />
 </div>
 {isMobileShell ? (
 <DeliverableSessionSheet
   open={Boolean(rightRail?.sheetOpen)}
   mode={rightRail?.sheetMode ?? 'folder'}
   onClose={() => rightRail?.setSheetOpen(false)}
   selectedSessionId={activeSessionId ?? null}
   rows={deliverablesDockStateLive.rows}
   folderPath={deliverablesDockStateLive.folderPath}
   folderItems={deliverablesDockStateLive.folderItems}
   selectedProject={selectedProject}
   projectRoot={projectRoot}
   turnArtifactDir={deliverablesDockStateLive.turnArtifactDir}
   scopeDir={deliverablesDockStateLive.turnArtifactDir ?? deliverablesDockStateLive.folderPath ?? null}
   contractHash={deliverablesDockStateLive.contractHash ?? null}
   validationSettled={pipelineValidationSettled || sessionSidebarCompleted}
   qualityStatus={deliverablesDockStateLive.qualityStatus ?? null}
   selectedRowId={rightRail?.selectedRowId}
   isRepairActive={deliverablesDockStateLive.isRepairActive}
   currentStageId={deliverablesDockStateLive.progress.currentStageId}
   stageProgress={deliverablesDockStateLive.progress}
   onSelectRow={handleSelectDeliverableDockRow}
   onFileOpen={onFileOpen}
   onOpenTaskFolder={handleOpenTaskFolderInRail}
 />
 ) : null}
 </DeliverableValidationSessionProvider>
 );
}

export default React.memo(ChatInterfaceV2);
