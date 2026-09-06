import { memo, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Check, ChevronRight, Copy } from 'lucide-react';
import { cn } from '../../lib/utils';
import { copyTextToClipboard } from '../../utils/clipboard';
import type { Project, SessionProvider } from '../../types/app';
import type {
 ChatMessage,
 PendingPermissionRequest,
 PilotDeckPermissionSuggestion,
 PermissionGrantResult,
} from '../chat/types/types';
import {
 findPendingRequestForToolMessage,
 isInteractiveElicitationToolName,
} from '../../shared/pendingElicitation';
import { extractElicitationFromToolMessage } from '../../shared/elicitationDisplay';
import { ElicitationAnswerSummary } from '../chat/tools/components/ContentRenderers/ElicitationAnswerSummary';
import MessageComponent from '../chat/view/subcomponents/MessageComponent';
import ImageLightbox, { type LightboxImage } from '../chat/view/subcomponents/ImageLightbox';
import { Markdown } from '../chat/view/subcomponents/Markdown';
import { replaceUserVisiblePilotDeckBrand } from '../../shared/novaUserVisibleBrand';
import { formatUsageLimitText } from '../chat/utils/chatFormatting';
import {
 buildExpandDetail,
 formatUserFacingNotice,
 isAgentRecoveryBoilerplate,
 isBareTransientNetworkErrorLeak,
 isBareTransientNetworkErrorBody,
 shouldHideBareUserVisibleError,
 sanitizeUserVisibleErrorText,
 isEngineToolHardStopLeak,
 isInfrastructureDisconnectMessage,
 isSessionBusyInternalError,
 shouldHideRecoveryBubble,
 isDegenerateUserVisibleAssistantFragment,
 isPermissionErrorCode,
 stripAgentRecoveryBoilerplateLines,
 type NoticeSeverity,
 type UserFacingNotice,
} from '../../shared/userFacingErrors';
import {
 shouldShowFormalRecoveryGuidance,
} from '../../shared/formalRecoveryInterrupt';
import {
 applyRecoverySurfaceToNoticeSummary,
 shouldRenderRecoveryNoticeForMessage,
 shouldShowRecoveryErrorInThread,
 type RecoverySurfaceView,
} from '../../shared/recoverySurfaceState';
import { stripLeakedToolCallMarkup } from '../../shared/stripLeakedToolMarkup';
import UserActionRequiredCard from './UserActionRequiredCard';
import { parseUserActionNoticeFromMessage } from '../../shared/parseUserActionNotice';
import { readAutoContinueEnabled } from './hooks/useAutoRecoveryContinue';
import { ProcessTrace } from './ProcessTrace';
import { InformalProcessStack } from './InformalProcessStack';
import { TurnReferencesPanel } from './TurnReferencesPanel';
import { resolveAudienceMode, type AudienceMode } from '../../shared/audienceMode';
import { readSessionCapability } from '../../shared/capabilitySessionBinding';
import { resolveClientProcessUxConfig } from '../../shared/processUxConfig';
import { AudienceCodeFold } from './AudienceCodeFold';
import { INFORMAL_PROCESS } from './processVisualTokens';
import { SURFACE_USER_BUBBLE } from './conversationSurfaceTokens';
import { ASSISTANT_MESSAGE_BODY_CLASS, ASSISTANT_PROSE_CLASS } from './chatTypography';
import { processSummaryToTrace, type ProcessAttachment, type TurnRunMeta } from './processGrouping';
 import DeliverableSummaryTable from '../chat/deliverables/DeliverableSummaryTable';
 import DeliverableTurnPointer from '../chat/deliverables/DeliverableTurnPointer';
 import DeliverableHistoricalFootnote from '../chat/deliverables/DeliverableHistoricalFootnote';
 // PD-SAAS-FORK: Beta-only turn footer / next chips (no-op when surface inactive)
 import { useWorkbenchBetaSurface } from '../../saas/workbench-beta/surface/WorkbenchBetaSurface';
 import TurnUsageFooter from '../../saas/workbench-beta/chat/TurnUsageFooter';
 import PostDeliverableNextChips from '../../saas/workbench-beta/chat/PostDeliverableNextChips';
 import { requestCapabilityTry } from '../../shared/capabilityTryBridge';
 import { getTurnUsageFooterMode } from '../../saas/workbench-beta/flags/workbenchBetaFlags';
 import { getArtifactFileName } from '../../shared/artifactPaths';
 import { supportsUnifiedFilePreview } from '../../shared/projectPreviewCapabilities';
import { isSessionPipelineBundleEnabled } from '../../shared/sessionDeliverablePipeline';
import {
sortDeliverables,
collectDeliverablesFromAssistantText,
collectDeliverablesFromMessages,
collectTurnAllArtifacts,
turnHasSuccessfulDeliverableTools,
type DeliverableItem,
} from '../../shared/collectDeliverables';
import { collectSessionFolderItems } from '../../shared/collectSessionFolderItems';
import { extractDeliverablePathsFromText } from '../../shared/artifactPaths';
import {
 collectTurnFinalDeliverables,
 collectTurnProcessArtifacts,
} from '../../shared/collectFinalDeliverables';
import { inferTurnArtifactDirectory } from '../../shared/reconcileTurnDeliverables';
import { extractUserGoalFromTurnMessages, extractUserGoalFromSessionMessages } from '../../shared/deliverableDisplayPolicy';
import { useValidatedDeliverableSet } from '../../shared/useValidatedDeliverables';
import {
 parseUserMessageReferences,
 resolveUserMessageAttachments,
} from '../../shared/referenceMaterials';
import { mergeDeliverablesByCanonicalPath } from '../../shared/mergeDeliverablesByCanonicalPath';
import { isDeliverableListRequest } from '../../shared/isDeliverableListRequest';
import { collectSessionVerifiedDeliverables } from '../../shared/collectSessionVerifiedDeliverables';
import { buildSanitizedAcceptanceRowsFromMessage, extractTurnAcceptanceMeta } from '../../shared/turnAcceptanceMeta';
import {
  resolveCurrentSessionManifest,
  resolveDeliverableSummaryExpectedManifest,
} from '../../shared/resolveSessionDeliverableManifest';
import { useSessionDeliverableManifest } from '../../shared/DeliverableValidationSessionContext';
import {
  expandExpectedManifestSlideCount,
  inferNovaSlidePagesFromPaths,
} from '../../shared/slideManifestExpand';
import { isDocumentDeliverableProfile, isSlideDeliverableProfile } from '../../shared/slideDeliverableProfile';
import { stripRedundantDeliverableProseForSummaryTable } from '../../shared/deliverableSummaryBodyStrip';
import { shouldMountDeliverableSummary as shouldMountDeliverableSummaryPolicy } from '../../shared/deliverableSummaryMountPolicy';
import type { DeliverableDockRow } from '../../shared/buildDeliverableDockRows';
import { buildTurnDeliverableView } from '../../shared/buildTurnDeliverableView';
import {
  isConversationDeliverableSyncEnabled,
  isStickyDeliverableSummaryEnabled,
  isTurnSnapshotKernelEnabled,
} from '../../shared/conversationDeliverableFeatureFlags';
import { normalizeConversationSummaryProgress } from '../../shared/normalizeConversationSummaryProgress';
import ReferenceMaterialCards from '../chat/view/subcomponents/ReferenceMaterialCards';
import GentleNotice from '../chat/shared/GentleNotice';

type DiffLine = { type: string; content: string; lineNum: number };

function collectPersistedDeliverableMetaItems(
message: ChatMessage,
projectRoot: string,
): DeliverableItem[] {
const paths = Array.isArray(message.verifiedDeliverablePaths)
? message.verifiedDeliverablePaths.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
: [];
if (paths.length === 0) return [];
const turnArtifactDir = typeof message.turnArtifactDir === 'string' ? message.turnArtifactDir : undefined;
return collectDeliverablesFromAssistantText(paths.map((path) => `\`${path}\``).join('\n'), projectRoot)
.filter((item) => item.kind !== 'url')
.map((item) => ({
...item,
turnArtifactDir: item.turnArtifactDir ?? turnArtifactDir,
}));
}

type MessageRowV2Props = {
 message: ChatMessage;
 prevMessage: ChatMessage | null;
 nextMessage?: ChatMessage | null;
 beforeProcessAttachments?: ProcessAttachment[];
 afterProcessAttachments?: ProcessAttachment[];
 mergedProcessAttachments?: ProcessAttachment[];
 turnRunMeta?: TurnRunMeta | null;
 /** PD-SAAS-FORK: whole-turn messages, set only on the turn's final reply. */
 turnMessages?: ChatMessage[];
 /** PD-SAAS-FORK: full loaded session for continued multi-turn deliverable merge. */
 sessionMessages?: ChatMessage[];
 processDetailLevel?: 'minimal' | 'standard' | 'detailed';
 provider: SessionProvider;
 selectedProject: Project | null;
 createDiff: (oldStr: string, newStr: string) => DiffLine[];
 onFileOpen?: (filePath: string, diffInfo?: unknown) => void;
 onOpenTaskFolder?: (items: DeliverableItem[]) => void;
 onShowSettings?: () => void;
 onGrantSessionToolPermission?: (
 suggestion: PilotDeckPermissionSuggestion,
 ) => PermissionGrantResult | null | undefined;
 autoExpandTools?: boolean;
 showRawParameters?: boolean;
 showThinking?: boolean;
 isProcessExpanded?: (processKey: string, defaultExpanded?: boolean) => boolean;
 onProcessExpandedChange?: (processKey: string, expanded: boolean) => void;
  /** PD-SAAS-FORK: latest assistant bubble in session — for summary mount live context. */
  isLatestAssistantInSession?: boolean;
  /** PD-SAAS-FORK: engine-owned repair loop active on latest turn. */
  sessionRepairActive?: boolean;
  /** PD-SAAS-FORK (UDC): latest turn summary rows from buildUnifiedDeliverableView — sync with Dock. */
  sessionUnifiedRows?: DeliverableDockRow[] | null;
  sessionUnifiedFolderItems?: DeliverableItem[];
  sessionScopeDir?: string | null;
  sessionContractHash?: string | null;
  /** PD-SAAS-FORK Razer RCA: session sticky bar replaces latest-turn inline table. */
  stickySummaryEnabled?: boolean;
  onScrollToSessionSummary?: () => void;
  /** PD-SAAS-FORK: pipeline precomputed — skip session-wide collect on latest row. */
  sessionWideItems?: DeliverableItem[];
  sessionVerifiedPaths?: string[];
 /** PD-SAAS-FORK: suppress mid-task recovery error chrome while turn is live */
 isAssistantWorking?: boolean;
 /** PD-SAAS-FORK: session-level in-flight — recovery dedupe must not rely on isLast row only. */
 sessionInFlight?: boolean;
 /** PD-SAAS-FORK: unified recovery surface from ChatInterfaceV2. */
 recoverySurface?: RecoverySurfaceView;
 /** PD-SAAS-FORK: only last global recovery error may render GentleNotice. */
 isLastRecoveryErrorInTurn?: boolean;
 /** PD-SAAS-FORK: Hub major category for process audience mode. */
 audienceMode?: AudienceMode;
 pendingPermissionRequests?: PendingPermissionRequest[];
 handlePermissionDecision?: (
 requestIds: string | string[],
 decision: { allow?: boolean; message?: string; rememberEntry?: string | null; updatedInput?: unknown },
 ) => void;
};

// Fall back to the heavy legacy renderer for anything that isn't a vanilla
// user/assistant markdown message — tool invocations, diffs, permission
// prompts, task notifications, subagent containers, etc. live there and we
// don't want to re-implement them all.
const shouldDelegate = (message: ChatMessage): boolean => {
 if (message.isToolUse) return true;
 if (message.isInteractivePrompt) return true;
 if (message.isSubagentContainer) return true;
 if (message.isTaskNotification) return true;
 const t = message.type;
 if (t !== 'user' && t !== 'assistant' && t !== 'error') return true;
 return false;
};

function MessageRowV2({
 message,
 prevMessage,
 nextMessage,
 beforeProcessAttachments = [],
 afterProcessAttachments = [],
 mergedProcessAttachments = [],
 turnRunMeta = null,
 turnMessages = [],
 sessionMessages = [],
 processDetailLevel = 'standard',
 provider,
 selectedProject,
 createDiff,
 onFileOpen,
 onOpenTaskFolder,
 onShowSettings,
 onGrantSessionToolPermission,
 autoExpandTools,
 showRawParameters,
 showThinking,
 isProcessExpanded,
 onProcessExpandedChange,
 isLatestAssistantInSession = false,
 sessionRepairActive = false,
 sessionUnifiedRows = null,
 sessionUnifiedFolderItems,
 sessionScopeDir = null,
 sessionContractHash = null,
 stickySummaryEnabled = false,
 onScrollToSessionSummary,
 sessionWideItems: sessionWideItemsProp,
 sessionVerifiedPaths: sessionVerifiedPathsProp,
 isAssistantWorking = false,
 sessionInFlight = false,
 recoverySurface,
 isLastRecoveryErrorInTurn = true,
 audienceMode: audienceModeProp,
 pendingPermissionRequests = [],
 handlePermissionDecision,
}: MessageRowV2Props) {
 const { t, i18n } = useTranslation('chat');
 const localeIsZh = i18n.language.startsWith('zh');
 // PD-SAAS-FORK: default active=false outside Beta provider
 const betaSurface = useWorkbenchBetaSurface();
 const betaSessionId =
 typeof (message as { sessionId?: string }).sessionId === 'string'
 && (message as { sessionId?: string }).sessionId
 ? String((message as { sessionId?: string }).sessionId)
 : typeof (selectedProject as { sessionId?: string } | null)?.sessionId === 'string'
 ? String((selectedProject as { sessionId?: string }).sessionId)
 : typeof (selectedProject as { id?: string } | null)?.id === 'string'
 ? String((selectedProject as { id?: string }).id)
 : 'session';
 const pendingElicitation = useMemo(
 () => findPendingRequestForToolMessage(pendingPermissionRequests, message),
 [message, pendingPermissionRequests],
 );
 const answeredElicitation = useMemo(() => {
 if (pendingElicitation || !message.isToolUse) return null;
 return extractElicitationFromToolMessage(message);
 }, [message, pendingElicitation]);
 const delegate = useMemo(() => {
 if (message.isToolUse && pendingElicitation && isInteractiveElicitationToolName(message.toolName)) {
 return false;
 }
 return shouldDelegate(message);
 }, [message, pendingElicitation]);

 const errorNoticeState = useMemo((): 'none' | 'suppressed' | UserFacingNotice => {
 if (message.type !== 'error') return 'none';
 const raw = replaceUserVisiblePilotDeckBrand(formatUsageLimitText(String(message.content ?? '')));
 const errorCode = typeof message.errorCode === 'string' ? message.errorCode : undefined;
 const recoverable = message.recoverable === true;
 const labels = {
 unifiedRetry: t('toolUseError.inlineRetry', { defaultValue: '可能需要些时间，请稍后' }),
 networkInterrupt: t('toolUseError.inlineNetwork', { defaultValue: '网络中断，您可以继续' }),
 networkRetry: t('toolUseError.inlineRetry', { defaultValue: '可能需要些时间，请稍后' }),
 unifiedPause: t('toolUseError.inlinePause', { defaultValue: '可能需要些时间，请稍后' }),
 unifiedExhausted: t('toolUseError.inlineExhausted', { defaultValue: '暂时未能自动完成，您可以继续' }),
 unifiedPermission: t('toolUseError.inlinePermission', { defaultValue: '需要确认一项权限' }),
 networkTransient: t('toolUseError.inlineNetwork', { defaultValue: '网络中断，您可以继续' }),
 recoverable: t('toolUseError.inlineRetry', { defaultValue: '可能需要些时间，请稍后' }),
 sessionRecoverable: t('toolUseError.inlineRetry', { defaultValue: '可能需要些时间，请稍后' }),
 sessionFatal: t('toolUseError.inlineExhausted', { defaultValue: '暂时未能自动完成，您可以继续' }),
 sessionPause: t('toolUseError.inlinePause', { defaultValue: '可能需要些时间，请稍后' }),
 handlingWithAttempt: t('toolUseError.inlineRetry', { defaultValue: '可能需要些时间，请稍后' }),
 technicalDetail: t('toolUseError.technicalDetail', { defaultValue: '技术详情' }),
 expandDetails: t('toolUseError.expandDetails', { defaultValue: '查看详情' }),
 hintNetwork: t('recovery.hints.network', { defaultValue: '' }),
 hintModel: t('recovery.hints.model', { defaultValue: '' }),
 hintPermission: t('recovery.hints.permission', { defaultValue: '需要授权后才能继续' }),
 hintContinue: t('recovery.hints.continue', {
 defaultValue: '您可点击继续，我会换种方式再试',
 }),
 hintStuck: t('recovery.hints.stuck', { defaultValue: '您可点击继续，我会换种方式再试' }),
 };
 const storedSeverity = typeof message.noticeSeverity === 'string'
 ? message.noticeSeverity as NoticeSeverity
 : undefined;
 const storedHints = Array.isArray(message.errorHints)
 ? message.errorHints.filter((hint): hint is string => typeof hint === 'string')
 : undefined;
 const autoContinue = readAutoContinueEnabled();
 const recoveryAttempt = typeof message.recoveryAttempt === 'number' ? message.recoveryAttempt : undefined;
 const recoveryMax = typeof message.recoveryMax === 'number' ? message.recoveryMax : undefined;
 const budgetRemaining = typeof (message as { budgetRemaining?: number }).budgetRemaining === 'number'
 ? (message as { budgetRemaining?: number }).budgetRemaining
 : undefined;
 const turnFinalFailure =
 errorCode === 'agent_tool_error_loop'
 || storedSeverity === 'pause'
 || recoverable === false
 || (typeof budgetRemaining === 'number' && budgetRemaining <= 0)
 || (recoveryAttempt !== undefined
 && recoveryMax !== undefined
 && recoveryAttempt >= recoveryMax);
 const exhausted = turnFinalFailure;
 const notice = formatUserFacingNotice(
 {
 code: errorCode,
 raw,
 recoverable,
 exhausted,
 attempt: recoveryAttempt,
 maxAttempts: recoveryMax,
 },
 labels,
 { autoContinueEnabled: autoContinue, suppressActionableHints: recoverySurface?.suppressDuplicateHints },
 );
 if (storedSeverity && !(autoContinue && storedSeverity === 'pause' && !turnFinalFailure)) {
 notice.severity = storedSeverity;
 } else if (autoContinue && storedSeverity === 'pause' && !turnFinalFailure) {
 notice.severity = 'handling';
 }
 if (storedHints && storedHints.length > 0) notice.hints = storedHints;
 // PD-SAAS-FORK: only mask pause as in-progress handling during live recovery — not turn-final errors.
 if (autoContinue && notice.severity === 'pause' && !turnFinalFailure) {
 notice.summary = labels.unifiedRetry;
 notice.severity = 'handling';
 notice.hints = [];
 notice.showTechnicalDetail = false;
 }
 const isPermission = isPermissionErrorCode(errorCode) || notice.severity === 'permission';
 const isTurnFinalPause = notice.severity === 'pause' && !notice.recoverable;
 const showFormalGuidance = shouldShowFormalRecoveryGuidance({
   autoContinueEnabled: autoContinue,
   isAssistantWorking: sessionInFlight || isAssistantWorking,
   errorCode,
   isTurnFinalPause,
   isPermission,
 });
 const showInThread = shouldShowRecoveryErrorInThread({
   surface: recoverySurface,
   autoContinueEnabled: autoContinue,
   isSessionInFlight: sessionInFlight,
   isLastGlobalRecoveryError: isLastRecoveryErrorInTurn,
   isPermission,
   showFormalGuidance,
   summary: notice.summary,
   unifiedHandlingSummary: labels.unifiedRetry,
 });
 if (!showInThread) {
   return 'suppressed';
 }
 if (showFormalGuidance) {
   notice.hints = [];
   notice.showTechnicalDetail = false;
 }
 if (recoverySurface) {
   const applied = applyRecoverySurfaceToNoticeSummary({
     surface: recoverySurface,
     defaultSummary: notice.summary,
     exhaustedSummary: labels.unifiedExhausted,
     handlingSummary: labels.unifiedRetry,
   });
   notice.summary = applied.summary;
   if (recoverySurface.suppressDuplicateHints) {
     notice.hints = applied.hints;
   }
 }
 if (
   recoverySurface
   && !shouldRenderRecoveryNoticeForMessage({
     messageType: message.type,
     isLastRecoveryErrorInTurn,
     surface: recoverySurface,
   })
 ) {
   return 'suppressed';
 }
 return notice;
 }, [
 message.content,
 message.errorCode,
 message.errorHints,
 message.noticeSeverity,
 message.recoverable,
 message.recoveryAttempt,
 message.recoveryMax,
 (message as { budgetRemaining?: number }).budgetRemaining,
 message.type,
 isAssistantWorking,
 sessionInFlight,
 isLastRecoveryErrorInTurn,
 recoverySurface,
 t,
 ]);
 const errorNotice = errorNoticeState === 'none' || errorNoticeState === 'suppressed'
   ? null
   : errorNoticeState;
 // PD-SAAS-FORK: strip leaked tool-call markup before any user-visible render
 const formattedContent = useMemo(() => {
 const raw = stripLeakedToolCallMarkup(String(message.content ?? ''), { localeIsZh });
 if (message.type === 'error' && isSessionBusyInternalError(message.errorCode, raw)) return '';
 const cleaned = message.type === 'assistant' ? stripAgentRecoveryBoilerplateLines(raw) : raw;
 const visible = message.type === 'user' ? parseUserMessageReferences(cleaned).content : cleaned;
 const formatted = replaceUserVisiblePilotDeckBrand(formatUsageLimitText(visible));
 if (message.type === 'assistant' && isBareTransientNetworkErrorBody(formatted)) return '';
 if (message.type === 'assistant' && isEngineToolHardStopLeak(formatted)) return '';
 // PD-SAAS-FORK (P0-1): a short assistant bubble that is essentially a raw infra-disconnect leak
 // (econnreset / code=1006 / aborted_streaming / fake proxy ip) must not surface — the engine
 // soft-resumes. Length-bounded so legitimate replies that merely mention "websocket" are unaffected.
 if (
  message.type === 'assistant'
  && formatted.trim().length <= 160
  && isInfrastructureDisconnectMessage(formatted)
 ) {
  return '';
 }
 if (message.type === 'assistant' && shouldHideRecoveryBubble(formatted)) return '';
 if (message.type === 'assistant' && isDegenerateUserVisibleAssistantFragment(formatted)) return '';
 return formatted;
 }, [message.content, message.type, localeIsZh]);
 const messageImages = useMemo(
 () =>
 Array.isArray(message.images)
 ? message.images.filter((image) => image && typeof image.data === 'string')
 : [],
 [message.images],
 );
 const messageAttachments = useMemo(
 () => resolveUserMessageAttachments(message),
 [message.attachments, message.content],
 );
 const projectRoot = selectedProject?.fullPath || selectedProject?.path || '';
 const sessionDeliverableManifest = useSessionDeliverableManifest();
 const processUx = useMemo(() => resolveClientProcessUxConfig(), []);
 const audienceMode = useMemo(
   () => audienceModeProp ?? resolveAudienceMode({}),
   [audienceModeProp],
 );
 const isFinalAssistantReply = !nextMessage || nextMessage.type === 'user' || nextMessage.type === 'error';
 // PD-SAAS-FORK: intermediate narration hosts only carry collapsed process pills.
 const isIntermediateProcessHost =
  !isFinalAssistantReply &&
  (beforeProcessAttachments.length > 0 || afterProcessAttachments.length > 0);
 const recoveryBoilerplateNotice = useMemo(() => {
 if (message.type !== 'assistant' || !formattedContent) return null;
 if (!isAgentRecoveryBoilerplate(formattedContent)) return null;
 const labels = {
 unifiedRetry: t('toolUseError.inlineRetry', { defaultValue: '可能需要些时间，请稍后' }),
 networkInterrupt: t('toolUseError.inlineNetwork', { defaultValue: '网络中断，您可以继续' }),
 networkRetry: t('toolUseError.inlineRetry', { defaultValue: '可能需要些时间，请稍后' }),
 unifiedPause: t('toolUseError.inlinePause', { defaultValue: '可能需要些时间，请稍后' }),
 unifiedExhausted: t('toolUseError.inlineExhausted', { defaultValue: '暂时未能自动完成，您可以继续' }),
 unifiedPermission: t('toolUseError.inlinePermission', { defaultValue: '需要确认一项权限' }),
 networkTransient: t('toolUseError.inlineNetwork', { defaultValue: '网络中断，您可以继续' }),
 recoverable: t('toolUseError.inlineRetry', { defaultValue: '可能需要些时间，请稍后' }),
 sessionRecoverable: t('toolUseError.inlineRetry', { defaultValue: '可能需要些时间，请稍后' }),
 sessionFatal: t('toolUseError.inlineExhausted', { defaultValue: '暂时未能自动完成，您可以继续' }),
 sessionPause: t('toolUseError.inlinePause', { defaultValue: '可能需要些时间，请稍后' }),
 handlingWithAttempt: t('toolUseError.inlineRetry', { defaultValue: '可能需要些时间，请稍后' }),
 technicalDetail: t('toolUseError.technicalDetail', { defaultValue: '技术详情' }),
 expandDetails: t('toolUseError.expandDetails', { defaultValue: '查看详情' }),
 hintNetwork: t('recovery.hints.network', { defaultValue: '' }),
 hintModel: t('recovery.hints.model', { defaultValue: '' }),
 hintPermission: t('recovery.hints.permission', { defaultValue: '需要授权后才能继续' }),
 hintContinue: t('recovery.hints.continue', { defaultValue: '您可点击继续，我会换种方式再试' }),
 hintStuck: t('recovery.hints.stuck', { defaultValue: '您可点击继续，我会换种方式再试' }),
 };
 const autoContinue = readAutoContinueEnabled();
 if (autoContinue) return null;
 return formatUserFacingNotice(
 { raw: formattedContent, exhausted: true },
 labels,
 );
 }, [formattedContent, message.type, t]);
 const userActionNotice = useMemo(
   () => parseUserActionNoticeFromMessage(message as Parameters<typeof parseUserActionNoticeFromMessage>[0]),
   [message],
 );
 // PD-SAAS-FORK: 三确同错 user_action_required — structured card (P1-2)
 const turnRecoveredWithDeliverables = useMemo(() => {
 if (message.type !== 'error' || turnMessages.length === 0) return false;
 const projectRoot = selectedProject?.fullPath || selectedProject?.path || '';
 let assistantText = '';
 for (let i = turnMessages.length - 1; i >= 0; i -= 1) {
 const turnMessage = turnMessages[i];
 if (turnMessage.type === 'assistant' && !turnMessage.isThinking && !turnMessage.isStreaming) {
 assistantText = String(turnMessage.content ?? '');
 break;
 }
 }
 const deliverableOptions = {
 assistantText,
 processAttachments: [...mergedProcessAttachments, ...beforeProcessAttachments, ...afterProcessAttachments],
 toolMessages: turnMessages,
 projectRoot,
 userGoalText: extractUserGoalFromTurnMessages(turnMessages),
 };
 return sortDeliverables(collectTurnFinalDeliverables(deliverableOptions)).length > 0;
 }, [
 afterProcessAttachments,
 beforeProcessAttachments,
 mergedProcessAttachments,
 message.type,
 projectRoot,
 selectedProject?.fullPath,
 selectedProject?.path,
 turnMessages,
 ]);

 const turnUserGoalText = useMemo(
   () => extractUserGoalFromSessionMessages(sessionMessages) || extractUserGoalFromTurnMessages(turnMessages),
   [sessionMessages, turnMessages],
 );

 const turnDeliverableOptions = useMemo(() => ({
 assistantText: formattedContent,
 processAttachments: [...mergedProcessAttachments, ...beforeProcessAttachments, ...afterProcessAttachments],
 toolMessages: turnMessages,
 projectRoot,
 userGoalText: turnUserGoalText,
 turnArtifactDirOverride: typeof message.turnArtifactDir === 'string' ? message.turnArtifactDir : undefined,
 turnDeliverableUnrecoverable: message.turnDeliverableUnrecoverable === true,
 sessionToolMessages: sessionMessages,
 verifiedPathsOverride: Array.isArray(message.verifiedDeliverablePaths)
   ? message.verifiedDeliverablePaths.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
   : undefined,
 }), [
 afterProcessAttachments,
 beforeProcessAttachments,
 formattedContent,
 mergedProcessAttachments,
 message.turnArtifactDir,
 message.turnDeliverableUnrecoverable,
 message.verifiedDeliverablePaths,
 projectRoot,
 sessionMessages,
 turnMessages,
 turnUserGoalText,
 ]);

 const turnArtifactDir = useMemo(
   () => (
     typeof message.turnArtifactDir === 'string'
       ? message.turnArtifactDir
       : inferTurnArtifactDirectory(collectTurnAllArtifacts(turnDeliverableOptions)) ?? undefined
   ),
   [message.turnArtifactDir, turnDeliverableOptions],
 );

const persistedMetaDeliverables = useMemo(
() => collectPersistedDeliverableMetaItems(message, projectRoot),
[message, projectRoot],
);

 const onFileOpenWithTurnHint = useMemo(
 () => {
 if (!onFileOpen) return undefined;
 return (filePath: string, second?: unknown) => {
   const fileName = getArtifactFileName(filePath) || filePath;
   const wantsPreview = supportsUnifiedFilePreview(fileName);
   if (!turnArtifactDir || !filePath || /^https?:\/\//i.test(filePath)) {
     if (second && typeof second === 'object') {
       onFileOpen(filePath, second);
       return;
     }
     onFileOpen(filePath, wantsPreview ? { initialPreview: true } : second);
     return;
   }
   if (second && typeof second === 'object') {
     const maybeDiff = second as Record<string, unknown>;
     if ('old_string' in maybeDiff || 'new_string' in maybeDiff) {
       onFileOpen(filePath, second);
       return;
     }
     onFileOpen(filePath, {
       ...maybeDiff,
       hintDir: typeof maybeDiff.hintDir === 'string' ? maybeDiff.hintDir : turnArtifactDir,
       ...(wantsPreview && maybeDiff.initialPreview !== false ? { initialPreview: true } : {}),
     });
     return;
   }
   onFileOpen(filePath, {
     hintDir: turnArtifactDir,
     ...(wantsPreview ? { initialPreview: true } : {}),
   });
 };
 },
 [onFileOpen, turnArtifactDir],
 );

 const markdownInteraction = useMemo(
 () => ({
 selectedProject,
 projectRoot,
 onFileOpen: onFileOpenWithTurnHint,
 turnArtifactDir,
 }),
 [onFileOpenWithTurnHint, projectRoot, selectedProject, turnArtifactDir],
 );

 const turnDeliverables = useMemo(() => {
 if (message.type !== 'assistant' || message.isStreaming || !isFinalAssistantReply) {
 return [];
 }
const curated = collectTurnFinalDeliverables(turnDeliverableOptions);
let merged = sortDeliverables(mergeDeliverablesByCanonicalPath(
curated,
persistedMetaDeliverables,
));
if (merged.length === 0 && turnMessages.length > 0 && turnHasSuccessfulDeliverableTools(turnMessages)) {
  const toolFallback = sortDeliverables(
    collectTurnAllArtifacts(turnDeliverableOptions).filter((item) => item.kind !== 'url'),
  );
  if (toolFallback.length > 0) {
    merged = toolFallback;
  }
}
if (isDeliverableListRequest(turnUserGoalText) && sessionMessages.length > 0) {
  const sessionItems = collectSessionVerifiedDeliverables(sessionMessages, projectRoot);
  if (sessionItems.length > 0) {
    return sessionItems;
  }
}
return merged;
 }, [
 isFinalAssistantReply,
 message.isStreaming,
 message.type,
persistedMetaDeliverables,
 projectRoot,
 sessionMessages,
 turnDeliverableOptions,
 turnUserGoalText,
 ]);

 const deliverableLabelSourceText = useMemo(() => {
   const chunks = [formattedContent];
   if (sessionMessages.length > 0) {
     for (const turnMessage of sessionMessages) {
       if (turnMessage.type !== 'assistant' || turnMessage.isThinking || turnMessage.isStreaming) continue;
       const text = String(turnMessage.content ?? '').trim();
       if (text) chunks.push(text);
     }
   }
   return chunks.join('\n');
 }, [formattedContent, sessionMessages]);

 const validatedTurnDeliverableSet = useValidatedDeliverableSet(
   selectedProject?.name,
   turnDeliverables,
   turnArtifactDir,
   message.id,
 );
 const validatedTurnDeliverables = validatedTurnDeliverableSet.displayItems;

 const acceptanceRows = useMemo(
   () => {
     if (message.type !== 'assistant') return [];
     const knownVerified = [
       ...validatedTurnDeliverables.map((item) => item.resolvedPath || item.apiPath || item.path),
       ...turnDeliverables.map((item) => item.resolvedPath || item.apiPath || item.path),
     ].filter(Boolean);
     return buildSanitizedAcceptanceRowsFromMessage(message, {
       turnArtifactDir,
       knownVerifiedPaths: knownVerified,
     });
   },
   [message, turnArtifactDir, turnDeliverables, validatedTurnDeliverables],
 );

 const deliverableSummaryManifest = useMemo(() => {
   const meta = extractTurnAcceptanceMeta(message);
   const messagesForContract = sessionMessages.length > 0 ? sessionMessages : (turnMessages ?? []);
   const sessionWideItems = isLatestAssistantInSession
     ? (sessionWideItemsProp ?? (isSessionPipelineBundleEnabled()
       ? []
       : collectDeliverablesFromMessages(messagesForContract, projectRoot)))
     : [];
   const sessionVerifiedPaths: string[] = [];
   if (isLatestAssistantInSession) {
     if (sessionVerifiedPathsProp?.length) {
       sessionVerifiedPaths.push(...sessionVerifiedPathsProp);
     } else {
       for (const msg of messagesForContract) {
         if (msg.type !== 'assistant') continue;
         const turnMeta = extractTurnAcceptanceMeta(msg);
         for (const path of turnMeta?.verifiedPaths ?? []) {
           if (typeof path === 'string' && path.trim()) sessionVerifiedPaths.push(path.trim());
         }
         if (Array.isArray(msg.verifiedDeliverablePaths)) {
           for (const path of msg.verifiedDeliverablePaths) {
             if (typeof path === 'string' && path.trim()) sessionVerifiedPaths.push(path.trim());
           }
         }
       }
     }
   }
   const expectedManifest = resolveDeliverableSummaryExpectedManifest({
     turnMeta: meta,
     sessionManifest: sessionDeliverableManifest
       ?? resolveCurrentSessionManifest(messagesForContract),
     isLatestAssistantInSession,
     messages: messagesForContract,
     sessionDeliverables: sessionWideItems,
     sessionVerifiedPaths,
   });
   const manifestForProfile = sessionDeliverableManifest
     ?? resolveCurrentSessionManifest(messagesForContract);
   const slideProfile = isSlideDeliverableProfile(manifestForProfile?.profileId)
     && !isDocumentDeliverableProfile(manifestForProfile?.profileId);
   const paths = [
     ...validatedTurnDeliverables.map((item) => item.resolvedPath || item.apiPath || item.path),
     ...turnDeliverables.map((item) => item.resolvedPath || item.apiPath || item.path),
     ...(meta?.verifiedPaths ?? []),
   ].filter(Boolean) as string[];
   const expectedCountEntry = expectedManifest?.find(
     (entry) => typeof entry.count === 'number' && entry.count > 0,
   );
   const expectedCount = typeof expectedCountEntry?.count === 'number'
     ? expectedCountEntry.count
     : undefined;
   let slideManifestPages: ReturnType<typeof inferNovaSlidePagesFromPaths> = [];
   if (slideProfile && turnArtifactDir) {
     slideManifestPages = inferNovaSlidePagesFromPaths(turnArtifactDir, paths, expectedCount);
     if (slideManifestPages.length === 0 && expectedManifest) {
       slideManifestPages = expandExpectedManifestSlideCount(expectedManifest, turnArtifactDir);
     }
   }
   return {
     expectedManifest,
     slideManifestPages: slideManifestPages.length > 0 ? slideManifestPages : undefined,
     resolvedPathMap: meta?.resolvedPathMap,
     verifiedPaths: meta?.verifiedPaths,
   };
 }, [isLatestAssistantInSession, message, projectRoot, sessionDeliverableManifest, sessionMessages, sessionVerifiedPathsProp, sessionWideItemsProp, turnArtifactDir, turnDeliverables, turnMessages, validatedTurnDeliverables]);

 const shouldMountDeliverableSummary = useMemo(() => {
   if (message.type !== 'assistant' || !isFinalAssistantReply) return false;
   return shouldMountDeliverableSummaryPolicy({
     message,
     isFinalAssistantReply,
     formattedContent,
     turnDeliverables,
     acceptanceRowCount: acceptanceRows.length,
     turnUserGoalText,
     turnMessages,
     turnArtifactDir,
     expectedManifest: deliverableSummaryManifest.expectedManifest,
     slideManifestPages: deliverableSummaryManifest.slideManifestPages,
     sessionManifest: sessionDeliverableManifest,
   }, {
     isLatestAssistantInSession,
     sessionRepairActive,
   });
 }, [
   acceptanceRows.length,
   deliverableSummaryManifest.expectedManifest,
   deliverableSummaryManifest.slideManifestPages,
   formattedContent,
   isFinalAssistantReply,
   isLatestAssistantInSession,
   message,
   sessionDeliverableManifest,
   sessionRepairActive,
   turnArtifactDir,
   turnDeliverables,
   turnMessages,
   turnUserGoalText,
 ]);

 const conversationSummaryRows = useMemo((): DeliverableDockRow[] | null => {
   if (message.type !== 'assistant' || !isFinalAssistantReply) return null;
   if (isLatestAssistantInSession) {
     return sessionUnifiedRows ?? null;
   }
   if (!isTurnSnapshotKernelEnabled()) return null;
   const messagesForContract = sessionMessages.length > 0 ? sessionMessages : (turnMessages ?? []);
   return buildTurnDeliverableView({
     sessionMessages: messagesForContract,
     turnEndMessage: message,
     projectRoot,
   })?.rows ?? null;
 }, [
   isFinalAssistantReply,
   isLatestAssistantInSession,
   message,
   projectRoot,
   sessionMessages,
   sessionUnifiedRows,
   turnMessages,
 ]);

 const hasConversationUnifiedRows = Boolean(conversationSummaryRows && conversationSummaryRows.length > 0);

 const conversationStickySummaryActive = stickySummaryEnabled && isStickyDeliverableSummaryEnabled();

 const conversationSummaryAuthoritative = useMemo(() => {
   if (!hasConversationUnifiedRows) return false;
   if (isLatestAssistantInSession && isConversationDeliverableSyncEnabled()) return true;
   if (!isLatestAssistantInSession && isTurnSnapshotKernelEnabled()) return true;
   return false;
 }, [hasConversationUnifiedRows, isLatestAssistantInSession]);

 const showConversationSummary = useMemo(() => {
   if (!shouldMountDeliverableSummary) return false;
   if (conversationStickySummaryActive) return false;
   if (isLatestAssistantInSession && isConversationDeliverableSyncEnabled()) {
     return true;
   }
   if (!isLatestAssistantInSession && isTurnSnapshotKernelEnabled()) {
     return hasConversationUnifiedRows;
   }
   return true;
 }, [
   conversationStickySummaryActive,
   hasConversationUnifiedRows,
   isLatestAssistantInSession,
   shouldMountDeliverableSummary,
 ]);

 const showHistoricalSummarySnapshot = useMemo(() => {
   if (!shouldMountDeliverableSummary) return false;
   if (isLatestAssistantInSession) return false;
   if (conversationStickySummaryActive) return false;
   if (!isTurnSnapshotKernelEnabled()) return false;
   return hasConversationUnifiedRows;
 }, [
   conversationStickySummaryActive,
   hasConversationUnifiedRows,
   isLatestAssistantInSession,
   shouldMountDeliverableSummary,
 ]);

 /** Sticky 开启时仍剥离正文内重复的四列汇总表 prose，避免与底栏双显。 */
 const shouldStripDeliverableProseForStickyBar = useMemo(() => {
   if (!isFinalAssistantReply || !shouldMountDeliverableSummary) return false;
   if (!conversationStickySummaryActive) return false;
   if (!isConversationDeliverableSyncEnabled()) return false;
   return isLatestAssistantInSession || hasConversationUnifiedRows;
 }, [
   conversationStickySummaryActive,
   hasConversationUnifiedRows,
   isFinalAssistantReply,
   isLatestAssistantInSession,
   shouldMountDeliverableSummary,
 ]);

 const historicalSummaryProgress = useMemo(
   () => normalizeConversationSummaryProgress(conversationSummaryRows ?? []),
   [conversationSummaryRows],
 );

 /** Sticky 底栏开启时，历史回合仅保留极淡脚注（不重复表格/引导框）。 */
 const showHistoricalStickyFootnote = useMemo(() => {
   if (!isFinalAssistantReply || !shouldMountDeliverableSummary) return false;
   if (isLatestAssistantInSession) return false;
   if (!conversationStickySummaryActive) return false;
   if (historicalSummaryProgress.total > 0) return true;
   return turnDeliverables.length > 0;
 }, [
   conversationStickySummaryActive,
   historicalSummaryProgress.total,
   isFinalAssistantReply,
   isLatestAssistantInSession,
   shouldMountDeliverableSummary,
   turnDeliverables.length,
 ]);

 const historicalFootnoteProgress = useMemo(() => {
   if (historicalSummaryProgress.total > 0) return historicalSummaryProgress;
   const count = turnDeliverables.length;
   return { done: count, total: count };
 }, [historicalSummaryProgress, turnDeliverables.length]);

 const summaryTableItems = useMemo(
   () => (validatedTurnDeliverables.length > 0 ? validatedTurnDeliverables : turnDeliverables),
   [turnDeliverables, validatedTurnDeliverables],
 );

 const summaryTableFolderItems = useMemo(() => {
   if (isLatestAssistantInSession && sessionUnifiedFolderItems?.length) {
     return sessionUnifiedFolderItems;
   }
   const messagesForContract = sessionMessages.length > 0 ? sessionMessages : (turnMessages ?? []);
   const sessionFolder = isLatestAssistantInSession
     ? collectSessionFolderItems({
       messages: messagesForContract,
       projectRoot,
       turnDeliverables,
       turnArtifactDir: sessionScopeDir ?? turnArtifactDir ?? null,
     })
     : [];
   const turnFolder = validatedTurnDeliverableSet.folderItems.length > 0
     ? validatedTurnDeliverableSet.folderItems
     : summaryTableItems;
   if (sessionFolder.length === 0) return turnFolder;
   const seen = new Set<string>();
   const merged: DeliverableItem[] = [];
   for (const item of [...sessionFolder, ...turnFolder]) {
     const key = (item.resolvedPath || item.apiPath || item.path).toLowerCase();
     if (seen.has(key)) continue;
     seen.add(key);
     merged.push(item);
   }
   return merged;
 }, [
   isLatestAssistantInSession,
   projectRoot,
   sessionMessages,
   sessionScopeDir,
   sessionUnifiedFolderItems,
   summaryTableItems,
   turnArtifactDir,
   turnDeliverables,
   turnMessages,
   validatedTurnDeliverableSet.folderItems,
 ]);

 const isDeliverableRepairActive = useMemo(() => {
   if (message.type !== 'assistant' || !isFinalAssistantReply) return false;
   if (!isLatestAssistantInSession) return false;
   return sessionRepairActive;
 }, [isFinalAssistantReply, isLatestAssistantInSession, message.type, sessionRepairActive]);

 const displayAssistantContent = useMemo(() => {
   if (!isFinalAssistantReply) return formattedContent;
   const stripForSummaryUi = showConversationSummary
     || showHistoricalSummarySnapshot
     || shouldStripDeliverableProseForStickyBar;
   if (stripForSummaryUi) {
     const stripItems = summaryTableItems.length > 0
       ? summaryTableItems
       : turnDeliverables;
     return stripRedundantDeliverableProseForSummaryTable(formattedContent, stripItems, {
       stripPathLabelsWithoutItems: true,
     });
   }
   return formattedContent;
 }, [
   formattedContent,
   isFinalAssistantReply,
   shouldStripDeliverableProseForStickyBar,
   showConversationSummary,
   showHistoricalSummarySnapshot,
   summaryTableItems,
   turnDeliverables,
 ]);

 const showUnrecoverableDeliverableHint = useMemo(() => {
   if (message.turnDeliverableUnrecoverable !== true) return false;
   if (validatedTurnDeliverables.length > 0) return false;
   return extractDeliverablePathsFromText(formattedContent).length > 0
     || turnDeliverables.length > 0;
 }, [
   formattedContent,
   message.turnDeliverableUnrecoverable,
   turnDeliverables.length,
   validatedTurnDeliverables.length,
 ]);

 const turnProcessArtifacts = useMemo(() => {
 if (message.type !== 'assistant' || message.isStreaming || !isFinalAssistantReply) {
 return [];
 }
 return sortDeliverables(collectTurnProcessArtifacts(turnDeliverableOptions));
 }, [
 isFinalAssistantReply,
 message.isStreaming,
 message.type,
 turnDeliverableOptions,
 ]);

 const informalProcessKey = message.id || message.runId || 'informal-process';
 const hasMergedProcess = mergedProcessAttachments.length > 0 || Boolean(turnRunMeta);
 const informalExpanded = isProcessExpanded?.(informalProcessKey, false) ?? false;

 if (message.isAgentActivitySummary) {
 return (
 <ProcessSummaryRow
 message={message}
 processKey={message.id || message.runId || message.activityId}
 isProcessExpanded={isProcessExpanded}
 onProcessExpandedChange={onProcessExpandedChange}
 t={t}
 />
 );
 }

 const renderProcessAttachment = (attachment: ProcessAttachment) => (
 <ProcessAttachmentRow
 key={attachment.id}
 attachment={attachment}
 renderDetail={(detailMessage, index) => (
 <MessageRowV2
 key={detailMessage.id || detailMessage.toolId || `${attachment.id || 'process-detail'}-${index}`}
 message={detailMessage}
 prevMessage={index > 0 ? attachment.processDetailMessages[index - 1] : null}
 provider={provider}
 selectedProject={selectedProject}
 createDiff={createDiff}
 onFileOpen={onFileOpenWithTurnHint}
 onShowSettings={onShowSettings}
 onGrantSessionToolPermission={onGrantSessionToolPermission}
 autoExpandTools={autoExpandTools}
 showRawParameters={showRawParameters}
 showThinking={showThinking}
 isProcessExpanded={isProcessExpanded}
 onProcessExpandedChange={onProcessExpandedChange}
 />
 )}
 isProcessExpanded={isProcessExpanded}
 onProcessExpandedChange={onProcessExpandedChange}
 t={t}
 />
 );

 const withProcessRows = (content: ReactNode) => {
 if (beforeProcessAttachments.length === 0 && afterProcessAttachments.length === 0) {
 return content;
 }

 return (
 <div className="flex min-w-0 flex-col gap-2">
 {beforeProcessAttachments.map(renderProcessAttachment)}
 {content}
 {afterProcessAttachments.map(renderProcessAttachment)}
 </div>
 );
 };

 if (pendingElicitation && message.isToolUse) {
 return withProcessRows(
 <p className="text-[13px] leading-relaxed text-muted-foreground">
 {t('working.elicitationHint', { defaultValue: '请在下方表单中回答这些问题，完成后点击提交。' })}
 </p>,
 );
 }

 if (
 answeredElicitation
 && Object.keys(answeredElicitation.answers).length > 0
 && message.isToolUse
 ) {
 return withProcessRows(
 <ElicitationAnswerSummary
 questions={answeredElicitation.questions}
 answers={answeredElicitation.answers}
 variant="process"
 />,
 );
 }

 if (delegate) {
 return withProcessRows(
 <div className="ui-v2-legacy-row">
 <MessageComponent
 message={message}
 prevMessage={prevMessage}
 createDiff={createDiff}
 onFileOpen={onFileOpenWithTurnHint}
 onShowSettings={onShowSettings}
 onGrantSessionToolPermission={onGrantSessionToolPermission}
 autoExpandTools={autoExpandTools}
 showRawParameters={showRawParameters}
 showThinking={showThinking}
 selectedProject={selectedProject ?? null}
 provider={provider}
 hideHeader
 />
 </div>,
 );
 }

 const isUser = message.type === 'user';
 const isError = message.type === 'error';
 const [userImageLightbox, setUserImageLightbox] = useState<number | null>(null);

 // User: right-aligned grey bubble.
 if (isUser) {
 if (shouldHideRecoveryBubble(formattedContent)) {
 return withProcessRows(null);
 }
 const lightboxImages: LightboxImage[] = messageImages.map((image) => ({
 data: image.data,
 name: image.name,
 mimeType: image.mimeType,
 }));
 return withProcessRows(
 <div className="flex w-full justify-end">
 <div className={cn(SURFACE_USER_BUBBLE, 'min-w-0 max-w-[75%] overflow-hidden px-4 py-2.5 text-[14px] leading-[1.6] text-foreground')}>
 {message.isStreaming && !formattedContent ? (
 <span className="inline-block h-4 w-2 animate-pulse bg-neutral-400 dark:bg-neutral-500" />
 ) : (
 <>
 {messageAttachments.length > 0 ? (
 <ReferenceMaterialCards
 attachments={messageAttachments}
 className={formattedContent ? 'mb-2' : undefined}
 cardClassName="bg-card/85 /45"
 />
 ) : null}
 {messageImages.length > 0 ? (
 <div className={formattedContent ? 'mb-2 grid grid-cols-1 gap-2' : 'grid grid-cols-1 gap-2'}>
 {messageImages.map((image, index) => (
 <button
 type="button"
 key={`${image.name || 'image'}-${index}`}
 onClick={() => setUserImageLightbox(index)}
 className="block w-72 max-w-full overflow-hidden rounded-xl border border-border bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
 aria-label={image.name ? `Preview ${image.name}` : 'Preview image'}
 >
 <img
 src={image.data}
 alt={image.name || 'Uploaded image'}
 className="block h-auto max-h-64 w-full cursor-zoom-in object-contain transition-opacity hover:opacity-90"
 loading="lazy"
 />
 </button>
 ))}
 </div>
 ) : null}
 {message.isElicitationReply ? (
 <div className="mb-1 text-[11px] font-medium text-muted-foreground">
 {t('elicitation.yourChoices', { defaultValue: '你的选择' })}
 </div>
 ) : null}
 {formattedContent ? (
 <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
 {formattedContent}
 </div>
 ) : null}
 </>
 )}
 </div>
 {userImageLightbox !== null && lightboxImages.length > 0 ? (
 <ImageLightbox
 images={lightboxImages}
 startIndex={userImageLightbox}
 onClose={() => setUserImageLightbox(null)}
 />
 ) : null}
 </div>,
 );
 }

 // Error: gentle notice (no red banner). Suppress stale mid-turn errors once deliverables exist.
 if (isError && shouldHideBareUserVisibleError(String(message.content ?? ''))) {
   return withProcessRows(null);
 }
 if (isError && errorNoticeState === 'suppressed') {
   return withProcessRows(null);
 }
 if (isError && !errorNotice && !turnRecoveredWithDeliverables) {
   const fallbackSummary = sanitizeUserVisibleErrorText(String(message.content ?? ''), {
     unifiedRetry: t('toolUseError.inlineRetry', { defaultValue: '可能需要些时间，请稍后' }),
     networkInterrupt: t('toolUseError.inlineNetwork', { defaultValue: '网络中断，您可以继续' }),
     networkRetry: t('toolUseError.inlineRetry', { defaultValue: '可能需要些时间，请稍后' }),
     unifiedPause: t('toolUseError.inlinePause', { defaultValue: '可能需要些时间，请稍后' }),
     unifiedExhausted: t('toolUseError.inlineExhausted', { defaultValue: '暂时未能自动完成，您可以继续' }),
     unifiedPermission: t('toolUseError.inlinePermission', { defaultValue: '需要确认一项权限' }),
     networkTransient: t('toolUseError.inlineNetwork', { defaultValue: '网络中断，您可以继续' }),
     recoverable: t('toolUseError.inlineRetry', { defaultValue: '可能需要些时间，请稍后' }),
     sessionRecoverable: t('toolUseError.inlineRetry', { defaultValue: '可能需要些时间，请稍后' }),
     sessionFatal: t('toolUseError.inlineExhausted', { defaultValue: '暂时未能自动完成，您可以继续' }),
     sessionPause: t('toolUseError.inlinePause', { defaultValue: '可能需要些时间，请稍后' }),
     handlingWithAttempt: t('toolUseError.inlineRetry', { defaultValue: '可能需要些时间，请稍后' }),
     technicalDetail: t('toolUseError.technicalDetail', { defaultValue: '技术详情' }),
     expandDetails: t('toolUseError.expandDetails', { defaultValue: '查看详情' }),
     hintNetwork: t('recovery.hints.network', { defaultValue: '' }),
     hintModel: t('recovery.hints.model', { defaultValue: '' }),
     hintPermission: t('recovery.hints.permission', { defaultValue: '需要授权后才能继续' }),
     hintContinue: t('recovery.hints.continue', { defaultValue: '您可点击继续，我会换种方式再试' }),
     hintStuck: t('recovery.hints.stuck', { defaultValue: '您可点击继续，我会换种方式再试' }),
   });
   if (fallbackSummary) {
     const autoContinue = readAutoContinueEnabled();
     const showFallback = shouldShowRecoveryErrorInThread({
       surface: recoverySurface,
       autoContinueEnabled: autoContinue,
       isSessionInFlight: sessionInFlight,
       isLastGlobalRecoveryError: isLastRecoveryErrorInTurn,
       isPermission: false,
       showFormalGuidance: false,
       summary: fallbackSummary,
       unifiedHandlingSummary: t('toolUseError.inlineRetry', { defaultValue: '可能需要些时间，请稍后' }),
     });
     if (!showFallback) {
       return withProcessRows(null);
     }
     return withProcessRows(
       <div className="space-y-2">
         <GentleNotice
           summary={fallbackSummary}
           showSpinner={message.recoverable === true}
           expandLabel={t('toolUseError.expandDetails', { defaultValue: '查看详情' })}
         />
       </div>,
     );
   }
 }
 if (isError && errorNotice && !turnRecoveredWithDeliverables) {
 const expandDetail = errorNotice.showTechnicalDetail ? errorNotice.technicalDetail : null;
 return withProcessRows(
 <div className="space-y-2">
 <GentleNotice
 summary={errorNotice.summary}
 hints={errorNotice.hints}
 expandDetail={expandDetail}
 expandLabel={t('toolUseError.expandDetails')}
 showSpinner={errorNotice.severity === 'handling'}
 />
 </div>,
 );
 }

 // Thinking: collapsible accordion (respect showThinking preference)
 if (message.isThinking) {
 if (!showThinking) {
 return withProcessRows(null);
 }
 return withProcessRows(
 <div className="min-w-0 text-[14px] leading-relaxed">
 <details className="group">
 <summary className="flex cursor-pointer select-none items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground">
 <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" strokeWidth={2} />
 <span>{t('thinking.title', { defaultValue: 'Thinking...' })}</span>
 </summary>
 <div className="mt-1.5 border-l-2 border-border pl-3 text-[13px] text-muted-foreground">
 <Markdown interaction={markdownInteraction} projectName={selectedProject?.name}>{formattedContent}</Markdown>
 </div>
 </details>
 </div>,
 );
 }

 const renderFormalAssistantBody = () => (
 <>
 {isFinalAssistantReply && hasMergedProcess && !message.isStreaming ? (
 <>
 <InformalProcessStack
 attachments={mergedProcessAttachments}
 processArtifacts={(conversationStickySummaryActive || showConversationSummary || showHistoricalSummarySnapshot || shouldStripDeliverableProseForStickyBar) ? [] : turnProcessArtifacts}
 runMeta={turnRunMeta}
 expanded={informalExpanded}
 onExpandedChange={(next) => onProcessExpandedChange?.(informalProcessKey, next)}
 hasDeliverables={turnDeliverables.length > 0}
 processDetailLevel={processDetailLevel}
 onFileOpen={onFileOpenWithTurnHint}
 renderDetail={(attachment) => (
 <ProcessAttachmentRow
 attachment={attachment}
 renderDetail={(detailMessage, index) => (
 <MessageRowV2
 key={detailMessage.id || detailMessage.toolId || `${attachment.id || 'process-detail'}-${index}`}
 message={detailMessage}
 prevMessage={index > 0 ? attachment.processDetailMessages[index - 1] : null}
 provider={provider}
 selectedProject={selectedProject}
 createDiff={createDiff}
 onFileOpen={onFileOpenWithTurnHint}
 onShowSettings={onShowSettings}
 onGrantSessionToolPermission={onGrantSessionToolPermission}
 autoExpandTools={autoExpandTools}
 showRawParameters={showRawParameters}
 showThinking={showThinking}
 isProcessExpanded={isProcessExpanded}
 onProcessExpandedChange={onProcessExpandedChange}
 processDetailLevel={processDetailLevel}
 />
 )}
 isProcessExpanded={isProcessExpanded}
 onProcessExpandedChange={onProcessExpandedChange}
 t={t}
 informalVariant
 />
 )}
 />
 <div className={INFORMAL_PROCESS.spacerAfter} aria-hidden />
 </>
 ) : null}
 {!isIntermediateProcessHost && displayAssistantContent ? (
 processUx.enabled ? (
 <AudienceCodeFold content={displayAssistantContent} audienceMode={audienceMode}>
 {(displayContent) => (
 <Markdown
 interaction={markdownInteraction}
 projectName={selectedProject?.name}
 className={ASSISTANT_PROSE_CLASS}
 >
 {displayContent}
 </Markdown>
 )}
 </AudienceCodeFold>
 ) : (
 <Markdown
 interaction={markdownInteraction}
 projectName={selectedProject?.name}
 className={ASSISTANT_PROSE_CLASS}
 >
 {displayAssistantContent}
 </Markdown>
 )
 ) : null}
 {isFinalAssistantReply && !message.isStreaming ? (
 <TurnReferencesPanel turnMessages={turnMessages} />
 ) : null}
 {showUnrecoverableDeliverableHint ? (
 <p className="mt-2 text-xs text-muted-foreground">
 {t('deliverables.historicalPathUnrecoverable', {
 defaultValue: '历史成果路径无法精确绑定，请从文件 Tab 选择',
 })}
 </p>
 ) : null}
{showHistoricalStickyFootnote ? (
 <DeliverableHistoricalFootnote
 done={historicalFootnoteProgress.done}
 total={historicalFootnoteProgress.total}
 />
 ) : null}
{showHistoricalSummarySnapshot ? (
 <div className="deliverable-summary-footer" data-testid="deliverable-historical-summary-footer">
 <DeliverableTurnPointer
 done={historicalSummaryProgress.done}
 total={historicalSummaryProgress.total}
 historical
 className="mt-4"
 />
 {hasConversationUnifiedRows ? (
 <DeliverableSummaryTable
 items={summaryTableItems}
 acceptanceRows={acceptanceRows}
 folderItems={summaryTableFolderItems}
 assistantText={deliverableLabelSourceText}
 selectedProject={selectedProject}
 projectRoot={projectRoot}
 turnArtifactDir={sessionScopeDir ?? turnArtifactDir}
 expectedManifest={deliverableSummaryManifest.expectedManifest}
 slideManifestPages={deliverableSummaryManifest.slideManifestPages}
 resolvedPathMap={deliverableSummaryManifest.resolvedPathMap}
 verifiedPaths={deliverableSummaryManifest.verifiedPaths}
 unifiedRowsOverride={conversationSummaryRows}
 unifiedRowsAuthoritative={conversationSummaryAuthoritative}
 contractHash={null}
 scopeDir={null}
 onFileOpen={onFileOpenWithTurnHint}
 onOpenTaskFolder={onOpenTaskFolder}
 validationSettled={conversationSummaryAuthoritative ? true : validatedTurnDeliverableSet.validationSettled}
 isDeliverableRepairActive={false}
 forceShow
 preferManifestLabels={Boolean(
   sessionDeliverableManifest?.slots?.length
   || deliverableSummaryManifest.expectedManifest?.length,
 )}
 className="mt-2 opacity-90"
 />
 ) : null}
 </div>
 ) : null}
{showConversationSummary ? (
 <div className="deliverable-summary-footer" data-testid="deliverable-summary-footer">
 <DeliverableSummaryTable
 items={summaryTableItems}
 acceptanceRows={acceptanceRows}
 folderItems={summaryTableFolderItems}
 assistantText={deliverableLabelSourceText}
 selectedProject={selectedProject}
 projectRoot={projectRoot}
 turnArtifactDir={sessionScopeDir ?? turnArtifactDir}
 expectedManifest={deliverableSummaryManifest.expectedManifest}
 slideManifestPages={deliverableSummaryManifest.slideManifestPages}
 resolvedPathMap={deliverableSummaryManifest.resolvedPathMap}
 verifiedPaths={deliverableSummaryManifest.verifiedPaths}
 unifiedRowsOverride={hasConversationUnifiedRows ? conversationSummaryRows : null}
 unifiedRowsAuthoritative={conversationSummaryAuthoritative}
 contractHash={isLatestAssistantInSession ? sessionContractHash : null}
 scopeDir={isLatestAssistantInSession ? sessionScopeDir : null}
 onFileOpen={onFileOpenWithTurnHint}
 onOpenTaskFolder={onOpenTaskFolder}
 validationSettled={conversationSummaryAuthoritative ? true : validatedTurnDeliverableSet.validationSettled}
 isDeliverableRepairActive={isDeliverableRepairActive}
 forceShow={Boolean(
   sessionDeliverableManifest?.slots?.length
   || deliverableSummaryManifest.expectedManifest?.length
   || acceptanceRows.length > 0,
 )}
 preferManifestLabels={Boolean(
   sessionDeliverableManifest?.slots?.length
   || deliverableSummaryManifest.expectedManifest?.length,
 )}
 className="mt-4"
 />
 </div>
 ) : null}
 {(displayAssistantContent.trim() || turnDeliverables.length > 0) && isFinalAssistantReply && displayAssistantContent.trim() ? (
 <div className={cn('mt-2 flex justify-end', conversationStickySummaryActive && 'opacity-60 hover:opacity-100 transition-opacity')}>
 <CopyMarkdownButton content={displayAssistantContent} />
 </div>
 ) : null}
 {/* PD-SAAS-FORK: workbench beta turn extras — active===false adds zero DOM on /app */}
 {betaSurface.active && isFinalAssistantReply && displayAssistantContent.trim() ? (
 <>
 <TurnUsageFooter
 content={displayAssistantContent}
 isLive={Boolean(message.isStreaming)}
 credits={!message.isStreaming && getTurnUsageFooterMode() !== 'off' ? 1 : null}
 tokens={null}
 sessionId={betaSessionId}
 />
 {isLatestAssistantInSession && !message.isStreaming ? (
 <PostDeliverableNextChips
 sessionId={betaSessionId || 'session'}
 basenames={turnDeliverables
 .map((d) => getArtifactFileName(d.resolvedPath || d.apiPath || d.path || '') || '')
 .filter(Boolean)}
 terminalComplete={Boolean(
 extractTurnAcceptanceMeta(message)?.acceptanceStatus === 'passed'
 || extractTurnAcceptanceMeta(message)?.completionState === 'complete',
 )}
 hasPendingSlots={Boolean(
 Array.isArray(sessionUnifiedRows)
 && sessionUnifiedRows.some((row) => {
 const status = String((row as { status?: string }).status || '').toLowerCase();
 return status === 'pending' || status === 'missing' || status === 'incomplete';
 }),
 )}
 onPrefill={(prompt) => {
 requestCapabilityTry(prompt);
 }}
 />
 ) : null}
 </>
 ) : null}
 </>
 );

 // Assistant: plain prose, no avatar and no bubble.
 if (isFinalAssistantReply && hasMergedProcess) {
 return (
 <div className={ASSISTANT_MESSAGE_BODY_CLASS}>
 {message.isStreaming && !formattedContent ? (
 <span className="inline-block h-4 w-2 animate-pulse bg-neutral-400 dark:bg-neutral-500" />
 ) : recoveryBoilerplateNotice ? (
 <GentleNotice
 summary={recoveryBoilerplateNotice.summary}
 expandDetail={
 recoveryBoilerplateNotice.showTechnicalDetail
 ? buildExpandDetail(recoveryBoilerplateNotice.hints, recoveryBoilerplateNotice.technicalDetail)
 : buildExpandDetail(recoveryBoilerplateNotice.hints, null)
 }
 expandLabel={t('toolUseError.expandDetails', { defaultValue: '查看详情' })}
 />
 ) : userActionNotice ? (
 <UserActionRequiredCard
 title={userActionNotice.title}
 reason={userActionNotice.reason}
 steps={userActionNotice.steps}
 settingsDeepLink={userActionNotice.settingsDeepLink}
 confirmedAttempts={userActionNotice.confirmedAttempts}
 onOpenSettings={onShowSettings}
 />
 ) : (
 renderFormalAssistantBody()
 )}
 </div>
 );
}

 return withProcessRows(
 <div className={ASSISTANT_MESSAGE_BODY_CLASS}>
 {message.isStreaming && !formattedContent ? (
 <span className="inline-block h-4 w-2 animate-pulse bg-neutral-400 dark:bg-neutral-500" />
 ) : recoveryBoilerplateNotice ? (
 <GentleNotice
 summary={recoveryBoilerplateNotice.summary}
 expandDetail={
 recoveryBoilerplateNotice.showTechnicalDetail
 ? buildExpandDetail(recoveryBoilerplateNotice.hints, recoveryBoilerplateNotice.technicalDetail)
 : buildExpandDetail(recoveryBoilerplateNotice.hints, null)
 }
 expandLabel={t('toolUseError.expandDetails', { defaultValue: '查看详情' })}
 />
 ) : userActionNotice ? (
 <UserActionRequiredCard
 title={userActionNotice.title}
 reason={userActionNotice.reason}
 steps={userActionNotice.steps}
 settingsDeepLink={userActionNotice.settingsDeepLink}
 confirmedAttempts={userActionNotice.confirmedAttempts}
 onOpenSettings={onShowSettings}
 />
 ) : (
 renderFormalAssistantBody()
 )}
 </div>,
 );
}

function CopyMarkdownButton({ content }: { content: string }) {
 const { t } = useTranslation('chat');
 const [copied, setCopied] = useState(false);
 const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 const copyLabel = copied ? t('codeBlock.copied') : t('codeBlock.copy');

 const handleClick = async () => {
 const ok = await copyTextToClipboard(content);
 if (!ok) return;
 setCopied(true);
 if (timerRef.current) clearTimeout(timerRef.current);
 timerRef.current = setTimeout(() => setCopied(false), 2000);
 };

 return (
 <button
 type="button"
 onClick={handleClick}
 className="rounded p-1 text-muted-foreground transition-colors hover:text-muted-foreground dark:hover:text-muted-foreground"
 aria-label={copyLabel}
 title={copyLabel}
 >
 {copied ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : <Copy className="h-3.5 w-3.5" strokeWidth={2} />}
 </button>
 );
}

export default memo(MessageRowV2);

function ProcessSummaryRow({
 message,
 processKey,
 detailMessages = [],
 renderDetailMessage,
 isProcessExpanded,
 onProcessExpandedChange,
 t,
 informalVariant = false,
}: {
 message: ChatMessage;
 processKey?: string;
 detailMessages?: ChatMessage[];
 renderDetailMessage?: (message: ChatMessage, index: number) => ReactNode;
 isProcessExpanded?: (processKey: string, defaultExpanded?: boolean) => boolean;
 onProcessExpandedChange?: (processKey: string, expanded: boolean) => void;
 t: TFunction<'chat'>;
 informalVariant?: boolean;
}) {
 const trace = useMemo(() => processSummaryToTrace(message, t), [message, t]);
 const detailSteps = detailMessages.length > 0 && renderDetailMessage ? [] : trace.steps;
 const resolvedProcessKey = processKey || message.id || message.runId || message.activityId;
 const expanded = resolvedProcessKey
 ? isProcessExpanded?.(resolvedProcessKey, false)
 : undefined;

 return (
 <ProcessTrace
 label={trace.label}
 collapsedDetail={trace.collapsedDetail}
 statusLabel={trace.statusLabel}
 status={trace.status}
 metrics={trace.metrics}
 steps={detailSteps}
 expanded={expanded}
 onExpandedChange={resolvedProcessKey
 ? (nextExpanded) => onProcessExpandedChange?.(resolvedProcessKey, nextExpanded)
 : undefined}
 variant={informalVariant ? 'informal' : 'default'}
 >
 {detailMessages.length > 0 && renderDetailMessage
 ? detailMessages.map((detailMessage, index) =>
 renderDetailMessage(detailMessage, index),
 )
 : null}
 </ProcessTrace>
 );
}

function ProcessAttachmentRow({
 attachment,
 renderDetail,
 isProcessExpanded,
 onProcessExpandedChange,
 t,
 informalVariant = false,
}: {
 attachment: ProcessAttachment;
 renderDetail: (message: ChatMessage, index: number) => ReactNode;
 isProcessExpanded?: (processKey: string, defaultExpanded?: boolean) => boolean;
 onProcessExpandedChange?: (processKey: string, expanded: boolean) => void;
 t: TFunction<'chat'>;
 informalVariant?: boolean;
}) {
 const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
 const lightboxImages: LightboxImage[] = useMemo(
 () =>
 attachment.inlineImages.map((image) => ({
 data: image.data,
 name: image.name,
 mimeType: image.mimeType,
 })),
 [attachment.inlineImages],
 );

 return (
 <div className={`flex min-w-0 flex-col items-start gap-2 ${informalVariant ? 'text-[12px] text-muted-foreground/75' : ''}`}>
 <ProcessSummaryRow
 message={attachment.processSummary}
 processKey={attachment.id}
 detailMessages={attachment.processDetailMessages}
 renderDetailMessage={renderDetail}
 isProcessExpanded={isProcessExpanded}
 onProcessExpandedChange={onProcessExpandedChange}
 t={t}
 informalVariant={informalVariant}
 />
 {lightboxImages.length > 0 ? (
 <div className="flex max-w-full flex-wrap gap-2">
 {lightboxImages.map((image, idx) => (
 <button
 type="button"
 key={`${attachment.inlineImages[idx].toolId || 'tool-image'}-${idx}`}
 onClick={() => setLightboxIndex(idx)}
 className="block overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
 aria-label={image.name ? `Preview ${image.name}` : 'Preview image'}
 >
 <img
 src={image.data}
 alt={image.name || 'Tool result image'}
 className="block h-auto max-h-72 max-w-xs cursor-zoom-in object-contain"
 loading="lazy"
 />
 </button>
 ))}
 </div>
 ) : null}
 {lightboxIndex !== null && lightboxImages.length > 0 ? (
 <ImageLightbox
 images={lightboxImages}
 startIndex={lightboxIndex}
 onClose={() => setLightboxIndex(null)}
 />
 ) : null}
 </div>
 );
}
