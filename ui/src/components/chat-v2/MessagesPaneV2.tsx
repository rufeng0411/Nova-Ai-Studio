import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n/config';
import { XCircle } from 'lucide-react';
import type {
 ChatMessage,
 ChatRunMode,
 ClaudeWorkStatus,
 PendingPermissionRequest,
 PilotDeckWorkStatus,
 PilotDeckPermissionSuggestion,
 PermissionGrantResult,
} from '../chat/types/types';
import { isBackgroundTaskSession, type Project, type ProjectSession, type SessionProvider } from '../../types/app';
import type { DeliverableItem } from '../../shared/collectDeliverables';
import type { DeliverableDockRow } from '../../shared/buildDeliverableDockRows';
import MessageRowV2 from './MessageRowV2';
import { TaskAcknowledgmentBubble } from './TaskAcknowledgmentBubble';
import { ProcessPhaseRail } from './ProcessPhaseRail';
import { resolveAudienceMode } from '../../shared/audienceMode';
import { readSessionCapability } from '../../shared/capabilitySessionBinding';
import { formatToolDisplayName, localizeRawProcessLabel } from '../../shared/processStepLabels';
import { ProcessLiveStatus, ProcessRunHeader, type ProcessTraceStep } from './ProcessTrace';
import { ProcessTimeline } from './ProcessTimeline';
import { INFORMAL_PROCESS } from './processVisualTokens';
import { inferProcessPhase } from '../../shared/processNarrative';
import {
  buildLiveTimelineSteps,
  coalesceLiveDockTimelineSteps,
  summarizeProcessActivity,
} from '../../shared/processTimelineBuilder';
import { formatProcessDuration } from './processTraceUtils';
import { useElapsedSeconds, formatElapsedLabel } from './hooks/useElapsedSeconds';
import { StaleTurnFallbackCard } from './StaleTurnFallbackCard';
import RecoveryGuidanceCard from './RecoveryGuidanceCard';
import {
 buildRenderableMessageItems,
 getLiveProcessGroups,
 shouldRenderLiveProcessGroup,
 type LiveProcessGroup,
 type RenderableMessageItem,
} from './processGrouping';
import { getIntrinsicMessageKey } from '../chat/utils/messageKeys.js';
import { SessionMessagesLoadingPlaceholder } from './SessionMessagesLoadingPlaceholder';
import { CONTENT_WIDTH, SURFACE_LIVE_STRIP } from './conversationSurfaceTokens';
import { cn } from '../../lib/utils';
import type { LatestDeliverableSummarySelection } from '../../shared/selectLatestDeliverableSummaryTurn';
import type { ProcessRailProgress } from '../../shared/sessionDeliverablePipeline';
import { clearLedger, buildLedgerSessionKey } from '../../shared/deliverableValidationLedger';
import { clearTurnSnapshots } from '../../shared/turnDeliverableSnapshot';
import type { SessionLoadFailureKind } from '../../shared/conversationOrphan';
import type { RecoverySurfaceView } from '../../shared/recoverySurfaceState';
import { messageVirtualizationThreshold } from '../../shared/perfFeatureFlags';
import { shouldHideUserFacingUserMessage } from '../../shared/userMessageDisplayDedup';

type DiffLine = { type: string; content: string; lineNum: number };

type MessagesPaneV2Props = {
 scrollContainerRef: RefObject<HTMLDivElement>;
 onWheel: () => void;
 onTouchMove: () => void;
 isLoadingSessionMessages: boolean;
 isRevalidatingSessionMessages?: boolean;
 /** PD-SAAS-FORK: defer SDM/validation scans until after session switch paint. */
 deliverablesPipelineReady?: boolean;
 latestDeliverableSummary?: LatestDeliverableSummarySelection;
 sessionLoadError?: string | null;
 sessionLoadFailureKind?: SessionLoadFailureKind | null;
 onRetrySessionLoad?: () => void;
 chatMessages: ChatMessage[];
 activityMessages?: ChatMessage[];
 visibleMessages: ChatMessage[];
 visibleMessageCount: number;
 isLoadingMoreMessages: boolean;
 hasMoreMessages: boolean;
 totalMessages: number;
 loadEarlierMessages: () => void;
 loadAllMessages: () => void;
 allMessagesLoaded: boolean;
 isLoadingAllMessages: boolean;
 provider: SessionProvider;
 selectedProject: Project | null;
 selectedSession: ProjectSession | null;
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
 processDetailLevel?: 'minimal' | 'standard' | 'detailed';
 setInput: Dispatch<SetStateAction<string>>;
 onApplySuggestionPrompt?: (prompt: string) => void;
 suggestedPrompts?: string[];
 isAssistantWorking?: boolean;
 /** PD-SAAS-FORK: engine repair loop active — summary table missing rows show「补齐中」. */
 sessionRepairActive?: boolean;
 /** PD-SAAS-FORK (UDC): unified deliverable view for latest assistant — sync table with Dock. */
 sessionUnifiedRows?: DeliverableDockRow[] | null;
 sessionUnifiedFolderItems?: DeliverableItem[];
 sessionScopeDir?: string | null;
 sessionContractHash?: string | null;
 /** PD-SAAS-FORK Razer RCA: latest turn uses TurnPointer when sticky bar is active. */
 stickySummaryEnabled?: boolean;
 onScrollToSessionSummary?: () => void;
 /** PD-SAAS-FORK: from sessionDeliverablePipeline — replaces local sdmProgress scan. */
 processRailProgress?: ProcessRailProgress | null;
 sessionWideItems?: DeliverableItem[];
 sessionVerifiedPaths?: string[];
 workingStatus?: ClaudeWorkStatus | PilotDeckWorkStatus | null;
 runMode?: ChatRunMode;
 pendingPermissionRequests?: PendingPermissionRequest[];
 handlePermissionDecision?: (
 requestIds: string | string[],
 decision: { allow?: boolean; message?: string; rememberEntry?: string | null; updatedInput?: unknown },
 ) => void;
 handleGrantToolPermission?: (suggestion: { entry: string; toolName: string }) => { success: boolean };
 onPlanExecutionApproved?: () => void;
 staleTurn?: {
   phase: 'warn' | 'fallback';
   stuckStepLabel: string | null;
   elapsedSec: number;
 };
 /** PD-SAAS-FORK: unified recovery UX surface from ChatInterfaceV2. */
 recoverySurface?: RecoverySurfaceView;
 sessionTaskPhase?: import('../../shared/sessionTaskLifecycle').SessionTaskPhase;
 showLiveToolProcessInDock?: boolean;
 onRecoveryFormalRetry?: () => void;
};

type KeyedRenderableMessageItem = RenderableMessageItem & {
 itemKey: string;
 renderIndex: number;
 estimatedHeight: number;
};

export type VirtualMessageWindow = {
 startIndex: number;
 endIndex: number;
 topPadding: number;
 bottomPadding: number;
 totalHeight: number;
};

const MESSAGE_WINDOW_OVERSCAN = 12;
const MESSAGE_GAP_PX = 16;

function clampNumber(value: number, min: number, max: number): number {
 return Math.min(max, Math.max(min, value));
}

function upperBound(values: number[], target: number): number {
 let low = 0;
 let high = values.length;
 while (low < high) {
 const mid = Math.floor((low + high) / 2);
 if (values[mid] <= target) {
 low = mid + 1;
 } else {
 high = mid;
 }
 }
 return low;
}

function getMessageTextLength(message: ChatMessage): number {
 const contentLength = typeof message.content === 'string' ? message.content.length : 0;
 const toolInputLength = typeof message.toolInput === 'string' ? message.toolInput.length : 0;
 const outputLength = typeof message.toolResult?.content === 'string' ? message.toolResult.content.length : 0;
 return contentLength + Math.min(toolInputLength + outputLength, 2400);
}

// eslint-disable-next-line react-refresh/only-export-components
export function estimateMessageItemHeight(item: RenderableMessageItem): number {
 const textLength = getMessageTextLength(item.message);
 const roughLines = Math.ceil(textLength / 92);
 const baseHeight = item.message.type === 'user' ? 64 : 92;
 const hasInformalStack =
 item.mergedProcessAttachments.length > 0 || Boolean(item.turnRunMeta);
 const legacyProcessCount =
 item.beforeProcessAttachments.length + item.afterProcessAttachments.length;
 const processSummaryHeight = hasInformalStack
 ? INFORMAL_PROCESS.collapsedHeightPx + (hasInformalStack ? 24 : 0)
 : legacyProcessCount * 32;
 const deliverableGridHeight = item.turnMessages.length > 0 ? 120 : 0;
 const attachmentHeight = Array.isArray(item.message.attachments) && item.message.attachments.length > 0 ? 56 : 0;
 const imageHeight = Array.isArray(item.message.images) && item.message.images.length > 0 ? 180 : 0;
 const toolHeight = item.message.isToolUse || item.message.toolName ? 140 : 0;

 return clampNumber(
 baseHeight + roughLines * 20 + processSummaryHeight + deliverableGridHeight + attachmentHeight + imageHeight + toolHeight + MESSAGE_GAP_PX,
 72,
 720,
 );
}

// eslint-disable-next-line react-refresh/only-export-components
export function getVirtualMessageWindow(
 itemHeights: number[],
 scrollTop: number,
 viewportHeight: number,
 overscan = MESSAGE_WINDOW_OVERSCAN,
): VirtualMessageWindow {
 if (itemHeights.length === 0) {
 return { startIndex: 0, endIndex: 0, topPadding: 0, bottomPadding: 0, totalHeight: 0 };
 }

 const prefixOffsets = [0];
 for (const height of itemHeights) {
 prefixOffsets.push(prefixOffsets[prefixOffsets.length - 1] + Math.max(1, height));
 }

 const totalHeight = prefixOffsets[prefixOffsets.length - 1];
 const safeScrollTop = clampNumber(Number.isFinite(scrollTop) ? scrollTop : 0, 0, totalHeight);
 const safeViewportHeight = Math.max(1, Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 900);
 const rawStart = Math.max(0, upperBound(prefixOffsets, safeScrollTop) - 1);
 const rawEnd = Math.min(itemHeights.length, upperBound(prefixOffsets, safeScrollTop + safeViewportHeight));
 const startIndex = Math.max(0, rawStart - overscan);
 const endIndex = Math.min(itemHeights.length, Math.max(startIndex + 1, rawEnd + overscan));

 return {
 startIndex,
 endIndex,
 topPadding: prefixOffsets[startIndex],
 bottomPadding: Math.max(0, totalHeight - prefixOffsets[endIndex]),
 totalHeight,
 };
}

function MeasuredMessageItem({
 itemKey,
 message,
 isLast,
 compactBottomSpacing = false,
 onHeightChange,
 children,
}: {
 itemKey: string;
 message: ChatMessage;
 isLast: boolean;
 compactBottomSpacing?: boolean;
 onHeightChange: (itemKey: string, height: number) => void;
 children: ReactNode;
}) {
 const itemRef = useRef<HTMLDivElement | null>(null);

 useLayoutEffect(() => {
 const node = itemRef.current;
 if (!node) return undefined;

 const reportHeight = () => {
 onHeightChange(itemKey, node.getBoundingClientRect().height);
 };

 reportHeight();
 if (typeof ResizeObserver === 'undefined') {
 return undefined;
 }

 const observer = new ResizeObserver(reportHeight);
 observer.observe(node);

 return () => observer.disconnect();
 }, [itemKey, onHeightChange]);

 return (
 <div
 ref={itemRef}
 className={`chat-message ${isLast ? '' : compactBottomSpacing ? 'pb-2' : 'pb-4'}`}
 data-message-timestamp={message.timestamp ? String(message.timestamp) : undefined}
 >
 {children}
 </div>
 );
}

export default function MessagesPaneV2({
 scrollContainerRef,
 onWheel,
 onTouchMove,
 isLoadingSessionMessages,
 isRevalidatingSessionMessages = false,
 deliverablesPipelineReady = true,
 latestDeliverableSummary: latestDeliverableSummaryProp,
 sessionLoadError,
 sessionLoadFailureKind = null,
 onRetrySessionLoad,
 chatMessages,
 activityMessages = [],
 visibleMessages,
 visibleMessageCount,
 isLoadingMoreMessages,
 hasMoreMessages,
 totalMessages,
 loadEarlierMessages,
 loadAllMessages,
 allMessagesLoaded,
 isLoadingAllMessages,
 provider,
 selectedProject,
 selectedSession,
 createDiff,
 onFileOpen,
 onOpenTaskFolder,
 onShowSettings,
 onGrantSessionToolPermission,
 autoExpandTools,
 showRawParameters,
 showThinking,
 processDetailLevel = 'standard',
 setInput,
 onApplySuggestionPrompt,
 suggestedPrompts,
 isAssistantWorking = false,
 sessionRepairActive = false,
 sessionUnifiedRows = null,
 sessionUnifiedFolderItems,
 sessionScopeDir = null,
 sessionContractHash = null,
 stickySummaryEnabled = false,
 onScrollToSessionSummary,
 processRailProgress: processRailProgressProp,
 sessionWideItems,
 sessionVerifiedPaths,
 workingStatus,
 runMode = 'agent',
 pendingPermissionRequests = [],
 handlePermissionDecision,
 handleGrantToolPermission,
 onPlanExecutionApproved,
 staleTurn,
 recoverySurface,
 sessionTaskPhase,
 showLiveToolProcessInDock = true,
 onRecoveryFormalRetry,
}: MessagesPaneV2Props) {
 const { t } = useTranslation('chat');
 const messageKeyMapRef = useRef<WeakMap<ChatMessage, string>>(new WeakMap());
 const generatedMessageKeyCounterRef = useRef(0);
 const measuredHeightsRef = useRef<Map<string, number>>(new Map());
 const heightVersionRafRef = useRef<number | null>(null);
 const [heightVersion, setHeightVersion] = useState(0);
 const [scrollViewport, setScrollViewport] = useState({ scrollTop: 0, height: 0 });
 const [expandedProcessRows, setExpandedProcessRows] = useState<Map<string, boolean>>(() => new Map());
 const userExpandedProcessKeys = useRef<Set<string>>(new Set());
 const prevIsAssistantWorkingRef = useRef(isAssistantWorking);

 const getMessageKey = useCallback((message: ChatMessage, index: number) => {
 const existingKey = messageKeyMapRef.current.get(message);
 if (existingKey) return existingKey;

 const intrinsicKey = getIntrinsicMessageKey(message);
 if (intrinsicKey) {
 messageKeyMapRef.current.set(message, intrinsicKey);
 return intrinsicKey;
 }

 generatedMessageKeyCounterRef.current += 1;
 const candidateKey = `message-generated-${index}-${generatedMessageKeyCounterRef.current}`;
 messageKeyMapRef.current.set(message, candidateKey);
 return candidateKey;
 }, []);

 const isProcessExpanded = useCallback((processKey: string, defaultExpanded = false) => (
 expandedProcessRows.get(processKey) ?? defaultExpanded
 ), [expandedProcessRows]);

 const handleProcessExpandedChange = useCallback((processKey: string, expanded: boolean) => {
 if (expanded) {
 userExpandedProcessKeys.current.add(processKey);
 } else {
 userExpandedProcessKeys.current.delete(processKey);
 }
 setExpandedProcessRows((currentRows) => {
 const currentExpanded = currentRows.get(processKey) ?? false;
 if (currentExpanded === expanded) {
 return currentRows;
 }

 const nextRows = new Map(currentRows);
 if (expanded) {
 nextRows.set(processKey, true);
 } else {
 nextRows.delete(processKey);
 }
 return nextRows;
 });
 }, []);

 const fallbackPrompts: string[] = useMemo(
 () => [
 t('emptyChat.prompts.plan', { defaultValue: 'Plan a refactor for this project' }),
 t('emptyChat.prompts.summary', { defaultValue: 'Summarize recent changes' }),
 t('emptyChat.prompts.review', { defaultValue: 'Review the most recent file I touched' }),
 ],
 [t],
 );
 const applyEmptyStatePrompt = onApplySuggestionPrompt ?? ((prompt: string) => setInput(prompt));

 const projectRoot = selectedProject?.fullPath || selectedProject?.path || '';
 const latestDeliverableSummary = latestDeliverableSummaryProp ?? { messageId: null, provisional: hasMoreMessages };

 const latestAssistantMessageId = useMemo(() => {
   for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
     const msg = chatMessages[i];
     if (msg.type === 'assistant') return msg.id;
   }
   return null;
 }, [chatMessages]);

 const sdmProgress = processRailProgressProp ?? null;

 useEffect(() => {
   if (!selectedSession?.id || !selectedProject?.name) return;
   const sessionKey = buildLedgerSessionKey(selectedSession.id, selectedProject.name);
   return () => {
     clearLedger(sessionKey);
     clearTurnSnapshots(sessionKey);
   };
 }, [selectedProject?.name, selectedSession?.id]);
 const dynamicPrompts = useMemo(
 () => (Array.isArray(suggestedPrompts) && suggestedPrompts.length > 0 ? suggestedPrompts : fallbackPrompts),
 [fallbackPrompts, suggestedPrompts],
 );

 const isEmpty = !isLoadingSessionMessages && chatMessages.length === 0;
 const isOrphanSessionLoad = sessionLoadFailureKind === 'orphan';
 const hasSessionLoadError = Boolean(
   !isLoadingSessionMessages
   && chatMessages.length === 0
   && (isOrphanSessionLoad || sessionLoadError),
 );
 const isNewConversationEmpty = isEmpty && !selectedSession;
 const isExistingConversationEmpty = isEmpty && Boolean(selectedSession) && !hasSessionLoadError;
 const isReadOnlyBackgroundSession = isBackgroundTaskSession(selectedSession);
 const liveActivities = useMemo(
 () => activityMessages.filter((message) => message.isAgentActivity),
 [activityMessages],
 );
 const renderableMessages = useMemo(
 () => visibleMessages.filter((message) => {
   if (message.isAgentActivity) return false;
   if (message.type === 'user' && shouldHideUserFacingUserMessage(message.content)) return false;
   return true;
 }),
 [visibleMessages],
 );
 const turnContextMessages = useMemo(
 () => chatMessages.filter((message) => !message.isAgentActivity),
 [chatMessages],
 );
 const audienceMode = useMemo(() => {
   const binding = selectedSession?.id ? readSessionCapability(selectedSession.id) : null;
   return resolveAudienceMode({
     majorCategory: binding?.majorCategory ?? null,
     capabilitySlug: binding?.slug ?? null,
   });
 }, [selectedSession?.id]);
 const processGroupingOptions = useMemo(
 () => ({ isAssistantWorking, showThinking, processDetailLevel, audienceMode }),
 [audienceMode, isAssistantWorking, processDetailLevel, showThinking],
 );
 const liveProcessGroups = useMemo(
 () => (isAssistantWorking
 ? getLiveProcessGroups(renderableMessages, processGroupingOptions)
 .filter((group) => shouldRenderLiveProcessGroup(group, runMode))
 : []),
 [isAssistantWorking, processGroupingOptions, renderableMessages, runMode],
 );
 const liveProcessGroupsByAnchor = useMemo(() => {
 const groupsByAnchor = new Map<number, LiveProcessGroup[]>();
 for (const group of liveProcessGroups) {
 const groups = groupsByAnchor.get(group.afterOriginalIndex) || [];
 groups.push(group);
 groupsByAnchor.set(group.afterOriginalIndex, groups);
 }
 return groupsByAnchor;
 }, [liveProcessGroups]);
 const renderableMessageItems = useMemo(
 () => buildRenderableMessageItems(renderableMessages, {
   ...processGroupingOptions,
   turnContextMessages,
 }),
 [processGroupingOptions, renderableMessages, turnContextMessages],
 );

 useEffect(() => {
 const wasWorking = prevIsAssistantWorkingRef.current;
 prevIsAssistantWorkingRef.current = isAssistantWorking;
 if (!wasWorking || isAssistantWorking) {
 return;
 }

 setExpandedProcessRows((currentRows) => {
 const nextRows = new Map(currentRows);
 for (const item of renderableMessageItems) {
 const messageId = item.message.id;
 if (!messageId) continue;
     if (userExpandedProcessKeys.current.has(messageId)) continue;
     if (item.mergedProcessAttachments.length > 0 || item.turnRunMeta) {
     nextRows.delete(messageId);
     }
 for (const attachment of item.mergedProcessAttachments) {
 if (userExpandedProcessKeys.current.has(attachment.id)) continue;
 nextRows.delete(attachment.id);
 }
 }
 return nextRows;
 });
 }, [isAssistantWorking, renderableMessageItems]);
 const keyedMessageItems = useMemo<KeyedRenderableMessageItem[]>(
 () => renderableMessageItems.map((item, index) => ({
 ...item,
 itemKey: getMessageKey(item.message, index),
 renderIndex: index,
 estimatedHeight: estimateMessageItemHeight(item),
 })),
 [getMessageKey, renderableMessageItems],
 );
 const lastGlobalRecoveryErrorRenderIndex = useMemo(() => {
   let last = -1;
   keyedMessageItems.forEach((item, index) => {
     if (item.message.type === 'error') last = index;
   });
   return last;
 }, [keyedMessageItems]);
 const measuredItemHeights = useMemo(() => {
 void heightVersion;
 return keyedMessageItems.map((item) => measuredHeightsRef.current.get(item.itemKey) ?? item.estimatedHeight);
 }, [heightVersion, keyedMessageItems]);
 const shouldVirtualizeMessages = keyedMessageItems.length > messageVirtualizationThreshold();
 const virtualWindow = useMemo(
 () => shouldVirtualizeMessages
 ? getVirtualMessageWindow(
 measuredItemHeights,
 scrollViewport.scrollTop,
 scrollViewport.height,
 MESSAGE_WINDOW_OVERSCAN,
 )
 : {
 startIndex: 0,
 endIndex: keyedMessageItems.length,
 topPadding: 0,
 bottomPadding: 0,
 totalHeight: measuredItemHeights.reduce((sum, height) => sum + height, 0),
 },
 [keyedMessageItems.length, measuredItemHeights, scrollViewport.height, scrollViewport.scrollTop, shouldVirtualizeMessages],
 );
 const windowedMessageItems = shouldVirtualizeMessages
 ? keyedMessageItems.slice(virtualWindow.startIndex, virtualWindow.endIndex)
 : keyedMessageItems;
 const liveProcessHeaderIndex = useMemo(() => {
 if (!isAssistantWorking) return -1;
 for (let index = keyedMessageItems.length - 1; index >= 0; index -= 1) {
 if (keyedMessageItems[index].message.type === 'user') {
 return Math.min(index + 1, keyedMessageItems.length);
 }
 }
 return keyedMessageItems.length > 0 ? 0 : -1;
 }, [isAssistantWorking, keyedMessageItems]);
 // The current turn's "started at" is anchored to the latest user message's
 // timestamp (set by the composer when the user submits). This is the only
 // signal that survives a page refresh and reliably resets between turns —
 // activity-based timing is unreliable because `activityMessages` accumulates
 // across turns in the session store.
 const liveProcessStartedAtMs = useMemo(() => {
 if (!isAssistantWorking || liveProcessHeaderIndex <= 0) return null;
 const anchorMessage = keyedMessageItems[liveProcessHeaderIndex - 1]?.message;
 if (anchorMessage?.type !== 'user' || anchorMessage.timestamp == null) return null;
 const parsed = Date.parse(String(anchorMessage.timestamp));
 return Number.isFinite(parsed) ? parsed : null;
 }, [isAssistantWorking, keyedMessageItems, liveProcessHeaderIndex]);
 const hasLiveAssistantContent = useMemo(() => {
 if (!isAssistantWorking || liveProcessHeaderIndex < 0) return false;
 return keyedMessageItems.slice(liveProcessHeaderIndex).some((item) => (
 item.message.type === 'assistant' &&
 !item.message.isThinking &&
 !item.message.isToolUse &&
 typeof item.message.content === 'string' &&
 item.message.content.trim().length > 0
 ));
 }, [isAssistantWorking, keyedMessageItems, liveProcessHeaderIndex]);
 const liveStatusStep = useMemo(
 () => getLiveStatusStep(liveActivities, workingStatus, hasLiveAssistantContent, isAssistantWorking, t, recoverySurface, sessionTaskPhase),
 [hasLiveAssistantContent, isAssistantWorking, liveActivities, recoverySurface, sessionTaskPhase, t, workingStatus],
 );
 const liveNarrativeMessages = useMemo(
 () => liveProcessGroups.flatMap((group) => group.messages),
 [liveProcessGroups],
 );
 const liveTurnProcessMessages = useMemo(() => {
 if (!isAssistantWorking) return [];
 let lastUserIndex = -1;
 for (let index = turnContextMessages.length - 1; index >= 0; index -= 1) {
 if (turnContextMessages[index]?.type === 'user') {
 lastUserIndex = index;
 break;
 }
 }
 const turnSlice = lastUserIndex >= 0
 ? turnContextMessages.slice(lastUserIndex + 1)
 : turnContextMessages;
 const fromTurn = turnSlice.filter((message) => (
 message.isToolUse
 || message.isThinking
 || message.type === 'tool'
 ));
 return fromTurn.length > 0 ? fromTurn : liveNarrativeMessages;
 }, [isAssistantWorking, liveNarrativeMessages, turnContextMessages]);
 const localeIsZh = i18n.language?.startsWith('zh') ?? true;
 const liveTimelineSteps = useMemo(
 () => {
 if (!isAssistantWorking) return [];
 const built = buildLiveTimelineSteps(liveTurnProcessMessages, liveActivities, t, {
 processDetailLevel,
 showThinking,
 maxVisibleSteps: 999,
 localeIsZh,
 audienceMode,
 sessionTaskPhase,
 sdmProgressDone: processRailProgressProp?.done,
 sdmProgressTotal: processRailProgressProp?.total,
 workingStatusKind: workingStatus?.statusKind ?? null,
 });
 return coalesceLiveDockTimelineSteps(built, liveStatusStep);
 },
 [audienceMode, isAssistantWorking, liveActivities, liveStatusStep, liveTurnProcessMessages, localeIsZh, processDetailLevel, processRailProgressProp?.done, processRailProgressProp?.total, sessionTaskPhase, showThinking, t, workingStatus?.statusKind],
 );
 const liveActivityCounts = useMemo(
 () => summarizeProcessActivity(liveNarrativeMessages),
 [liveNarrativeMessages],
 );
 const currentProcessPhase = useMemo(
 () => inferProcessPhase(liveNarrativeMessages, liveActivities, hasLiveAssistantContent),
 [hasLiveAssistantContent, liveActivities, liveNarrativeMessages],
 );
 // PD-SAAS-FORK: instant ack until the model's first visible reply lands
 const showTaskAcknowledgment = useMemo(() => {
 if (!isAssistantWorking || hasLiveAssistantContent) return false;
 const phase = liveStatusStep.phase;
 if (phase === 'recovery' || phase === 'permission' || phase === 'compact') return false;
 return true;
 }, [
 hasLiveAssistantContent,
 isAssistantWorking,
 liveStatusStep.phase,
 ]);
 const shouldRenderDockTimeline =
   isAssistantWorking && liveTimelineSteps.length > 0 && showLiveToolProcessInDock;
 const isDockTimelineExpanded = isProcessExpanded('dock-live-timeline', isAssistantWorking);
 const showLiveStatusRow = isAssistantWorking && (!shouldRenderDockTimeline || !isDockTimelineExpanded);

 const bumpHeightVersion = useCallback(() => {
 if (heightVersionRafRef.current !== null) return;
 heightVersionRafRef.current = requestAnimationFrame(() => {
 heightVersionRafRef.current = null;
 setHeightVersion((version) => version + 1);
 });
 }, []);

 const handleMeasuredItemHeight = useCallback((itemKey: string, height: number) => {
 const normalizedHeight = Math.max(1, Math.ceil(height));
 const currentHeight = measuredHeightsRef.current.get(itemKey);
 if (currentHeight !== undefined && Math.abs(currentHeight - normalizedHeight) < 2) {
 return;
 }

 measuredHeightsRef.current.set(itemKey, normalizedHeight);
 bumpHeightVersion();
 }, [bumpHeightVersion]);

 useEffect(() => () => {
 if (heightVersionRafRef.current !== null) {
 cancelAnimationFrame(heightVersionRafRef.current);
 }
 }, []);

 useEffect(() => {
 const validKeys = new Set(keyedMessageItems.map((item) => item.itemKey));
 let changed = false;

 for (const itemKey of measuredHeightsRef.current.keys()) {
 if (!validKeys.has(itemKey)) {
 measuredHeightsRef.current.delete(itemKey);
 changed = true;
 }
 }

 if (changed) {
 bumpHeightVersion();
 }
 }, [bumpHeightVersion, keyedMessageItems]);

 useLayoutEffect(() => {
 const container = scrollContainerRef.current;
 if (!container) return undefined;

 let frame = 0;
 const updateViewport = () => {
 frame = 0;
 setScrollViewport({
 scrollTop: container.scrollTop,
 height: container.clientHeight,
 });
 };
 const scheduleViewportUpdate = () => {
 if (frame) return;
 frame = requestAnimationFrame(updateViewport);
 };

 updateViewport();
 container.addEventListener('scroll', scheduleViewportUpdate, { passive: true });
 if (typeof ResizeObserver === 'undefined') {
 return () => {
 if (frame) cancelAnimationFrame(frame);
 container.removeEventListener('scroll', scheduleViewportUpdate);
 };
 }

 const resizeObserver = new ResizeObserver(scheduleViewportUpdate);
 resizeObserver.observe(container);

 return () => {
 if (frame) cancelAnimationFrame(frame);
 container.removeEventListener('scroll', scheduleViewportUpdate);
 resizeObserver.disconnect();
 };
 }, [scrollContainerRef]);

 const renderLiveProcessGroup = useCallback((_group: LiveProcessGroup, _index: number) => {
   // Live process steps always render in the sticky dock — never inline in the message stream.
   return null;
 }, []);

 const renderMessageItem = useCallback((item: KeyedRenderableMessageItem) => {
 const previousMessage = item.renderIndex > 0 ? keyedMessageItems[item.renderIndex - 1].message : null;
 const nextMessage = item.renderIndex < keyedMessageItems.length - 1
 ? keyedMessageItems[item.renderIndex + 1].message
 : null;
 const isLast = !isAssistantWorking && item.renderIndex === keyedMessageItems.length - 1;
 const isLastRecoveryErrorInTurn = item.message.type !== 'error'
   || lastGlobalRecoveryErrorRenderIndex === item.renderIndex;
 const anchoredLiveGroups = liveProcessGroupsByAnchor.get(item.originalIndex) || [];

 return (
 <Fragment key={item.itemKey}>
 {liveProcessHeaderIndex === 0 && item.renderIndex === 0 ? (
 <LiveRecoveryGuidance workingStatus={workingStatus} t={t} />
 ) : null}
 <MeasuredMessageItem
 itemKey={item.itemKey}
 message={item.message}
 isLast={isLast}
 compactBottomSpacing={anchoredLiveGroups.length > 0}
 onHeightChange={handleMeasuredItemHeight}
 >
 <MessageRowV2
 message={item.message}
 prevMessage={previousMessage}
 nextMessage={nextMessage}
 beforeProcessAttachments={item.beforeProcessAttachments}
 afterProcessAttachments={item.afterProcessAttachments}
 mergedProcessAttachments={item.mergedProcessAttachments}
 turnRunMeta={item.turnRunMeta}
 turnMessages={item.turnMessages}
 sessionMessages={turnContextMessages}
 processDetailLevel={processDetailLevel}
 provider={provider}
 selectedProject={selectedProject}
 createDiff={createDiff}
 onFileOpen={onFileOpen}
 onOpenTaskFolder={onOpenTaskFolder}
 onShowSettings={onShowSettings}
 onGrantSessionToolPermission={onGrantSessionToolPermission}
 autoExpandTools={autoExpandTools}
 showRawParameters={showRawParameters}
 showThinking={showThinking}
 isProcessExpanded={isProcessExpanded}
 onProcessExpandedChange={handleProcessExpandedChange}
 isAssistantWorking={isAssistantWorking && isLast}
 sessionInFlight={isAssistantWorking}
 recoverySurface={recoverySurface}
 isLastRecoveryErrorInTurn={isLastRecoveryErrorInTurn}
 isLatestAssistantInSession={
   item.message.type === 'assistant'
   && item.message.id === (latestDeliverableSummary.messageId ?? latestAssistantMessageId)
 }
 sessionRepairActive={sessionRepairActive}
 sessionUnifiedRows={sessionUnifiedRows}
 sessionUnifiedFolderItems={sessionUnifiedFolderItems}
 sessionScopeDir={sessionScopeDir}
 sessionContractHash={sessionContractHash}
 stickySummaryEnabled={stickySummaryEnabled}
 onScrollToSessionSummary={onScrollToSessionSummary}
 sessionWideItems={sessionWideItems}
 sessionVerifiedPaths={sessionVerifiedPaths}
 audienceMode={audienceMode}
 pendingPermissionRequests={pendingPermissionRequests}
 handlePermissionDecision={handlePermissionDecision}
 />
 {anchoredLiveGroups.length > 0 ? (
 <div className="mt-2 flex min-w-0 flex-col gap-2">
 {anchoredLiveGroups.map(renderLiveProcessGroup)}
 </div>
 ) : null}
 </MeasuredMessageItem>
 </Fragment>
 );
 }, [
 autoExpandTools,
 createDiff,
 handleMeasuredItemHeight,
 handleProcessExpandedChange,
 isProcessExpanded,
 isAssistantWorking,
 keyedMessageItems,
 lastGlobalRecoveryErrorRenderIndex,
 latestAssistantMessageId,
 liveActivities,
 liveProcessHeaderIndex,
 liveProcessStartedAtMs,
 liveProcessGroupsByAnchor,
 onFileOpen,
 onOpenTaskFolder,
 onGrantSessionToolPermission,
 onShowSettings,
 provider,
 recoverySurface,
 renderLiveProcessGroup,
 selectedProject,
 sessionRepairActive,
 sessionUnifiedRows,
 sessionUnifiedFolderItems,
 sessionScopeDir,
 sessionContractHash,
 showRawParameters,
 showThinking,
 t,
 turnContextMessages,
 ]);

 return (
 <div
 ref={scrollContainerRef}
 onWheel={onWheel}
 onTouchMove={onTouchMove}
 className="relative flex-1 overflow-y-auto overflow-x-hidden bg-background"
 >
 {hasSessionLoadError ? (
 <div className="mx-auto flex h-full max-w-[936px] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
 <XCircle className="h-5 w-5 text-warning" strokeWidth={1.75} />
 <div className="text-[15px] font-medium text-foreground">
 {isOrphanSessionLoad
 ? t('session.orphanTitle', { defaultValue: 'This conversation is no longer available' })
 : t('session.loadFailedTitle', { defaultValue: 'Could not load this conversation' })}
 </div>
 <div className="max-w-[520px] text-[13px] leading-5 text-muted-foreground">
 {isOrphanSessionLoad
 ? t('session.orphanBody', {
 defaultValue: 'No conversation record was found. It may never have started successfully or was already cleaned up.',
 })
 : sessionLoadError}
 </div>
 {!isOrphanSessionLoad && onRetrySessionLoad ? (
 <button
 type="button"
 onClick={onRetrySessionLoad}
 className="inline-flex h-8 items-center rounded-md border border-border px-3 text-[13px] font-medium text-foreground transition hover:bg-sidebar dark:hover:bg-primary"
 >
 {t('session.retryLoad', { defaultValue: 'Retry' })}
 </button>
 ) : null}
 </div>
 ) : isLoadingSessionMessages && chatMessages.length === 0 ? (
 <SessionMessagesLoadingPlaceholder />
 ) : isNewConversationEmpty ? (
 <div className="mx-auto flex h-full max-w-[936px] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
 <div className="text-[15px] font-medium text-foreground">
 {selectedProject
 ? t('emptyChat.title', { defaultValue: 'Start a new conversation' })
 : t('emptyChat.noProject', { defaultValue: 'Pick a project from the sidebar' })}
 </div>
 {selectedProject ? (
 <div className="flex flex-col gap-1.5">
 {dynamicPrompts.map((prompt) => (
 <button
 key={prompt}
 type="button"
 onClick={() => applyEmptyStatePrompt(prompt)}
 className="rounded-lg border border-border px-3 py-1.5 text-left text-[13px] text-foreground transition hover:bg-sidebar dark:hover:bg-primary"
 >
 {prompt}
 </button>
 ))}
 </div>
 ) : null}
 </div>
 ) : isExistingConversationEmpty ? (
 <div className="mx-auto flex h-full max-w-[936px] flex-col items-center justify-center gap-2 px-6 py-10 text-center">
 <div className="text-[15px] font-medium text-foreground">
 {isReadOnlyBackgroundSession
 ? t('emptyChat.readonlyBackgroundTitle', {
 defaultValue: 'No displayable messages in this task transcript',
 })
 : t('emptyChat.emptySessionTitle', {
 defaultValue: 'No displayable messages in this conversation',
 })}
 </div>
 <div className="max-w-[520px] text-[13px] leading-5 text-muted-foreground">
 {isReadOnlyBackgroundSession
 ? t('emptyChat.readonlyBackgroundDescription', {
 defaultValue:
 'This read-only background task transcript only contains records the chat view cannot display.',
 })
 : t('emptyChat.emptySessionDescription', {
 defaultValue:
 'This conversation exists, but it does not contain messages that can be rendered here.',
 })}
 </div>
 </div>
 ) : (
 <div
 className={cn(CONTENT_WIDTH, 'px-4 pt-7 pb-6 max-md:px-3.5 max-md:pt-5 max-md:pb-4')}
 data-virtualized-messages={shouldVirtualizeMessages ? 'true' : undefined}
 data-rendered-message-count={windowedMessageItems.length}
 data-total-message-count={keyedMessageItems.length}
 >
 {isRevalidatingSessionMessages ? (
 <div className="mb-2 text-center text-[11px] text-muted-foreground/80">
 {t('session.revalidating', { defaultValue: '正在同步最新内容…' })}
 </div>
 ) : null}
 {isLoadingMoreMessages && !isLoadingAllMessages && !allMessagesLoaded ? (
 <div className="pb-3 text-center text-[12px] text-muted-foreground">
 {t('session.loading.olderMessages')}
 </div>
 ) : null}

 {hasMoreMessages && !isLoadingMoreMessages && !allMessagesLoaded ? (
 <div className="mb-8 flex items-center justify-between border-b border-border pb-3 text-[12px] text-muted-foreground">
 <span>
 {t('session.messages.showingOf', {
 shown: chatMessages.length,
 total: totalMessages,
 })}
 </span>
 <button
 type="button"
 onClick={loadEarlierMessages}
 className="text-[12px] text-foreground underline-offset-2 hover:underline"
 >
 {t('session.messages.loadEarlier')}
 </button>
 </div>
 ) : null}

 {sessionLoadError && chatMessages.length > 0 && hasMoreMessages ? (
 <div className="mb-4 flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-[12px] text-muted-foreground">
 <span>{sessionLoadError}</span>
 {onRetrySessionLoad ? (
 <button
 type="button"
 onClick={onRetrySessionLoad}
 className="text-[12px] text-foreground underline-offset-2 hover:underline"
 >
 {t('session.retryLoadOlder', { defaultValue: '重试加载更早' })}
 </button>
 ) : null}
 </div>
 ) : null}

 {!hasMoreMessages && chatMessages.length > visibleMessageCount ? (
 <div className="mb-8 flex items-center justify-between border-b border-border pb-3 text-[12px] text-muted-foreground">
 <span>
 {t('session.messages.showingLast', {
 count: visibleMessageCount,
 total: chatMessages.length,
 })}
 </span>
 <button
 type="button"
 onClick={loadAllMessages}
 className="text-[12px] text-foreground underline-offset-2 hover:underline"
 >
 {t('session.messages.loadAll')}
 </button>
 </div>
 ) : null}

 {shouldVirtualizeMessages && virtualWindow.topPadding > 0 ? (
 <div aria-hidden="true" style={{ height: virtualWindow.topPadding }} />
 ) : null}

 {windowedMessageItems.map(renderMessageItem)}

 {recoverySurface?.phase === 'formal_stop' && recoverySurface.showActionableContinue && onRecoveryFormalRetry ? (
   <RecoveryGuidanceCard
     className="mt-4"
     budgetRemaining={0}
     onRetry={onRecoveryFormalRetry}
   />
 ) : null}

 {shouldVirtualizeMessages && virtualWindow.bottomPadding > 0 ? (
 <div aria-hidden="true" style={{ height: virtualWindow.bottomPadding }} />
 ) : null}

 {isAssistantWorking ? (
 <div
className={cn('relative mt-6 py-2', CONTENT_WIDTH)}
 data-testid="live-process-progress-dock"
 >
 <div className={cn(SURFACE_LIVE_STRIP, 'px-3 py-2.5')}>
 {showTaskAcknowledgment ? (
 <TaskAcknowledgmentBubble className="mb-2 border-b border-border/25 pb-2" />
 ) : null}
 <LiveRecoveryGuidance workingStatus={workingStatus} t={t} />
 {staleTurn?.phase ? (
   <StaleTurnFallbackCard
     className="mb-2"
     phase={staleTurn.phase}
     stuckStepLabel={staleTurn.stuckStepLabel}
     elapsedSec={staleTurn.elapsedSec}
   />
 ) : null}
 <ProcessPhaseRail currentPhase={currentProcessPhase} className="mb-2" />
 {sdmProgress && showLiveToolProcessInDock && !recoverySurface?.suppressSessionRepairUi ? (
   <p
     className="mb-2 text-xs text-muted-foreground"
     data-testid="sdm-progress-label"
   >
     {t('process.sdmProgress', {
       defaultValue: '成果进度 {{done}}/{{total}}',
       done: sdmProgress.done,
       total: sdmProgress.total,
     })}
     {sdmProgress.currentLabel ? ` · ${sdmProgress.currentLabel}` : ''}
   </p>
 ) : null}
 {showLiveStatusRow ? (
 <div data-testid="live-process-status">
 <ProcessLiveStatus
 step={liveStatusStep}
 variant="informal"
 compact
 className="mb-1"
 />
 </div>
 ) : null}
 <LiveProcessHeader
 activities={liveActivities}
 startedAtMs={liveProcessStartedAtMs}
 inProgress
 t={t}
 />
 {shouldRenderDockTimeline && isDockTimelineExpanded ? (
 <div
className="mt-1"
 data-testid="live-process-expanded-inline"
 >
 <ProcessTimeline
 mode="live"
 steps={liveTimelineSteps}
 maxVisibleSteps={8}
 isRunning
 suppressLiveHeader
 expanded
 showLiveCollapseTop
 showLiveCollapseBottom
 onExpandedChange={(expanded) => handleProcessExpandedChange('dock-live-timeline', expanded)}
 activityCounts={liveActivityCounts}
 processDetailLevel={processDetailLevel}
useLiveScrollViewport={false}
 />
 </div>
 ) : null}
 {shouldRenderDockTimeline && !isDockTimelineExpanded ? (
 <ProcessTimeline
 mode="live"
 steps={liveTimelineSteps}
 maxVisibleSteps={8}
 isRunning
 suppressLiveHeader
 expanded={false}
 onExpandedChange={(expanded) => handleProcessExpandedChange('dock-live-timeline', expanded)}
 activityCounts={liveActivityCounts}
 processDetailLevel={processDetailLevel}
 className="mt-1"
useLiveScrollViewport={false}
 />
 ) : null}
 </div>
 </div>
 ) : null}
 </div>
 )}
 </div>
 );
}

function getLatestActivity(activities: ChatMessage[]): ChatMessage | null {
 const byId = new Map<string, ChatMessage>();
 for (const activity of activities) {
 const key = activity.activityId || activity.id || `${activity.runId}-${activity.timestamp}`;
 byId.set(key, activity);
 }
 const latest = Array.from(byId.values());
 return [...latest].reverse().find((activity) => activity.state === 'running') || null;
}

function activityToLiveStep(
 activity: ChatMessage,
 t: TFunction<'chat'>,
): ProcessTraceStep {
 let title = activity.title || activity.content || '';
 const rawTitle = localizeRawProcessLabel(title, t);
 if (activity.phase === 'recovery') {
 title = rawTitle || t('process.recovery.adjusting', { defaultValue: '调整中' });
 } else if (rawTitle) {
 title = rawTitle;
 } else if (!title && activity.toolName) {
 title = formatToolDisplayName(activity.toolName, t);
 }
 return {
 id: activity.activityId || activity.id,
 title,
 detail: activity.phase === 'recovery' ? undefined : (activity.detail || ''),
 state: activity.state || 'running',
 severity: activity.severity,
 phase: activity.phase,
 toolName: activity.toolName,
 kind: activity.phase === 'recovery' ? 'recovery' : 'activity',
 };
}

function getLiveStatusStep(
 activities: ChatMessage[],
 workingStatus: ClaudeWorkStatus | PilotDeckWorkStatus | null | undefined,
 hasAssistantContent: boolean,
 isAssistantWorking: boolean,
 t: TFunction<'chat'>,
 recoverySurface?: RecoverySurfaceView,
 sessionTaskPhase?: import('../../shared/sessionTaskLifecycle').SessionTaskPhase,
): ProcessTraceStep {
 if (recoverySurface?.phase === 'auto_continuing') {
   return {
     id: 'live-auto-continuing',
     title: t('working.autoContinuing', { defaultValue: '正在从上次步骤继续…' }),
     phase: 'recovery',
     state: 'running',
   };
 }
 if (
   !isAssistantWorking
   && (
     sessionTaskPhase === 'deliverable_repair_pending'
     || recoverySurface?.liveDockTitleKey === 'working.deliverableAligning'
   )
 ) {
   return {
     id: 'live-deliverable-aligning',
     title: t('working.deliverableAligning', { defaultValue: '正在核对成果清单…' }),
     phase: 'recovery',
     state: 'running',
   };
 }
 if (recoverySurface?.phase === 'silent' && isAssistantWorking) {
   const rawStatus = String(workingStatus?.text || '').toLowerCase();
   if (
     workingStatus?.statusKind === 'infra_interrupt'
     || (workingStatus as { interruptKind?: string } | null)?.interruptKind === 'infra'
   ) {
     return {
       id: 'live-infra-interrupt',
       title: t('working.networkInterruptAutoContinue', { defaultValue: '网络连接中断，正在自动继续' }),
       phase: 'recovery',
       state: 'running',
     };
   }
   if (
     workingStatus?.statusKind === 'recovery_handling'
     || rawStatus.includes('recovery_handling')
     || workingStatus?.statusKind === 'recovery_pause'
     || rawStatus.includes('recovery_pause')
   ) {
     return {
       id: 'live-recovery-silent',
       title: t('working.recoveryHandlingGeneric', { defaultValue: '可能需要些时间，请稍后' }),
       phase: 'recovery',
       state: 'running',
     };
   }
 }
 if (recoverySurface?.phase === 'formal_stop' && recoverySurface.showActionableContinue) {
   return {
     id: 'live-recovery-exhausted',
     title: t('working.recoveryExhausted', { defaultValue: '暂时未能自动完成' }),
     phase: 'recovery',
     state: 'running',
   };
 }
 const latestActivity = getLatestActivity(activities);
 if (latestActivity) {
 return activityToLiveStep(latestActivity, t);
 }

 if (workingStatus?.compactProgress) {
 const progress = workingStatus.compactProgress;
 return {
 id: 'live-compact',
 title: t('working.compacting', { defaultValue: 'Compacting context...' }),
 detail: progress.label || progress.stage || '',
 phase: 'compact',
 state: progress.state || 'running',
 };
 }

 const rawStatus = String(workingStatus?.text || '').toLowerCase();
 const recoveryAttempt =
   typeof (workingStatus as { recoveryAttempt?: number } | null)?.recoveryAttempt === 'number'
     ? (workingStatus as { recoveryAttempt: number }).recoveryAttempt
     : undefined;
 const recoveryMax =
   typeof (workingStatus as { recoveryMax?: number } | null)?.recoveryMax === 'number'
     ? (workingStatus as { recoveryMax: number }).recoveryMax
     : 8;
 const budgetRemaining =
  typeof (workingStatus as unknown as { budgetRemaining?: number } | null)?.budgetRemaining === 'number'
    ? (workingStatus as unknown as { budgetRemaining: number }).budgetRemaining
     : undefined;

 if (
   workingStatus?.statusKind === 'infra_interrupt'
   || (workingStatus as { interruptKind?: string } | null)?.interruptKind === 'infra'
 ) {
   return {
     id: 'live-infra-interrupt',
     // PD-SAAS-FORK (P0-1): while the turn is still recovering (auto-continue armed) use passive copy;
// never imply the user must act. Only a fully-stopped turn keeps "您可以继续".
title: isAssistantWorking
        ? t('working.networkInterruptAutoContinue', { defaultValue: '网络连接中断，正在自动继续' })
        : t('working.networkInterrupt', { defaultValue: '网络中断，您可以继续' }),
     phase: 'recovery',
     state: 'running',
   };
 }

 if (
   workingStatus?.statusKind === 'recovery_handling'
   || rawStatus.includes('recovery_handling')
 ) {
   return {
     id: 'live-recovery-handling',
     title: t('working.recoveryHandlingGeneric', { defaultValue: '可能需要些时间，请稍后' }),
     phase: 'recovery',
     state: 'running',
   };
 }

 // PD-SAAS-FORK: only surface recovery copy when the engine pauses for user attention.
 if (
 workingStatus?.statusKind === 'recovery_pause'
 || rawStatus.includes('recovery_pause')
 ) {
   if (!isAssistantWorking && budgetRemaining === 0) {
     return {
       id: 'live-recovery-exhausted',
       title: t('working.recoveryExhausted', {
         defaultValue: '您可以继续',
       }),
       phase: 'recovery',
       state: 'running',
     };
   }
 return {
 id: 'live-recovery',
 title: t('working.recoveryPause', {
   defaultValue: '可能需要些时间，请稍后',
 }),
 phase: 'recovery',
 state: 'running',
 };
 }
 if (
 workingStatus?.statusKind === 'elicitation'
 || rawStatus.includes('needs_input')
 ) {
 return {
 id: 'live-elicitation',
 title: t('working.needsYourInput', { defaultValue: '请回答几个问题' }),
 phase: 'elicitation',
 state: 'running',
 };
 }
 if (rawStatus.includes('permission')) {
 return {
 id: 'live-permission',
 title: t('working.waitingForPermission', { defaultValue: 'Waiting for permission' }),
 phase: 'permission',
 state: 'running',
 severity: 'warning',
 };
 }
 if (rawStatus.includes('compact')) {
 return {
 id: 'live-compact',
 title: t('working.compacting', { defaultValue: 'Compacting context...' }),
 phase: 'compact',
 state: 'running',
 };
 }

 return hasAssistantContent
 ? {
 id: 'live-generation',
 title: t('working.generating', { defaultValue: 'Generating response' }),
 phase: 'generation',
 state: 'running',
 }
 : {
 id: 'live-thinking',
 title: t('working.thinking', { defaultValue: 'Thinking' }),
 phase: 'thinking',
 state: 'running',
 };
}

function getLiveProcessStartedAtMs(activities: ChatMessage[], fallbackStartedAtMs: number): number {
 if (activities.length === 0) return fallbackStartedAtMs;

 // `activityMessages` accumulates across turns in the session store, so the
 // raw list can include activities from previous runs. Scope the start time
 // to the current run by anchoring on the most recently received activity's
 // `runId` and picking the earliest start within that run.
 const latestActivity = activities[activities.length - 1];
 const latestRunId = latestActivity?.runId;
 const currentRunActivities = latestRunId
 ? activities.filter((activity) => activity.runId === latestRunId)
 : activities;

 let earliestMs = Number.POSITIVE_INFINITY;
 for (const activity of currentRunActivities) {
 const value = activity.startedAt || activity.timestamp;
 const parsed = value ? Date.parse(String(value)) : NaN;
 if (Number.isFinite(parsed) && parsed < earliestMs) {
 earliestMs = parsed;
 }
 }
 return Number.isFinite(earliestMs) ? earliestMs : fallbackStartedAtMs;
}

function LiveProcessHeader({
 activities,
 startedAtMs,
 inProgress = false,
 t,
}: {
 activities: ChatMessage[];
 startedAtMs: number | null;
 inProgress?: boolean;
 t: (key: string, options?: Record<string, unknown>) => string;
}) {
 const fallbackStartedAtRef = useRef(Date.now());
 const effectiveStartedAtMs = startedAtMs
   ?? getLiveProcessStartedAtMs(activities, fallbackStartedAtRef.current);
 const elapsedSec = Math.floor(useElapsedSeconds(effectiveStartedAtMs, inProgress) / 1000);
 const duration = formatProcessDuration(elapsedSec * 1000);
 const longWait = inProgress && elapsedSec >= 20;
 const label = inProgress
   ? longWait
     ? formatElapsedLabel(elapsedSec, t)
     : t('process.summary.inProgress', {
       duration,
       defaultValue: `进行中 ${duration}`,
     })
   : t('process.summary.processed', {
     duration,
     defaultValue: `Processed ${duration}`,
   });

 return <ProcessRunHeader label={label} />;
}

function LiveRecoveryGuidance(_props: {
 workingStatus?: ClaudeWorkStatus | PilotDeckWorkStatus | null;
 t: (key: string, options?: Record<string, unknown>) => string;
 isAssistantWorking?: boolean;
}) {
 // PD-SAAS-FORK: mid-task dead-man cards removed — auto-continue handles recovery silently.
 return null;
}

function CompletedProcessHeader({
 durationMs,
 t,
}: {
 durationMs: number;
 t: (key: string, options?: Record<string, unknown>) => string;
}) {
 const duration = formatProcessDuration(durationMs);
 const label = t('process.summary.processed', {
 duration,
 defaultValue: `已处理 ${duration}`,
 });

 return <ProcessRunHeader label={label} />;
}
