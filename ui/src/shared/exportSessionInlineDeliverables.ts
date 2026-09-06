/**
 * PD-SAAS-FORK: inline deliverable summary tables in session HTML export (WYSIWYG with chat UI).
 */
import type { ChatMessage } from '../components/chat/types/types';
import type { NormalizedMessage } from '../stores/useSessionStore';
import { normalizedToChatMessages } from '../components/chat/hooks/useChatMessages';
import type { DeliverableAcceptanceRow } from '../components/chat/deliverables/DeliverableSummaryTable';
import {
  buildDeliverableSummaryRows,
  type DeliverableSummaryRow,
} from './buildDeliverableSummaryRows';
import {
  collectDeliverablesFromMessages,
  collectTurnAllArtifacts,
  turnHasSuccessfulDeliverableTools,
  type DeliverableItem,
} from './collectDeliverables';
import { collectTurnFinalDeliverables } from './collectFinalDeliverables';
import { collectSessionFolderItems } from './collectSessionFolderItems';
import { mergeFolderItemsIntoDockRows, type DeliverableDockRow } from './buildDeliverableDockRows';
import {
  countAcceptanceRowsForMessage,
  isFinalAssistantReplyForMessage,
  shouldMountDeliverableSummary,
} from './deliverableSummaryMountPolicy';
import { resolveDeliverableSummaryExpectedManifest } from './resolveSessionDeliverableContract';
import { resolveCurrentSessionManifest } from './resolveSessionDeliverableManifest';
import { resolveContractScopeDir } from './resolveContractScopeDir';
import { resolveCurrentSessionTaskDirectory } from './resolveSessionTaskDirectory';
import {
  extractUserGoalFromSessionMessages,
  extractUserGoalFromTurnMessages,
} from './deliverableDisplayPolicy';
import { inferTurnArtifactDirectory } from './reconcileTurnDeliverables';
import {
  formatDeliverableFileTypeLabel,
  formatSummaryTableLinkLabel,
  resolveSummaryTableLinkDisplay,
} from './deliverableFileTypeLabel';
import {
  parseDeliverableLabelsFromAssistantText,
  resolveDeliverableDisplayName,
} from './deliverableSummaryLabels';
import { classifyDeliverablePath, getArtifactFileName } from './artifactPaths';
import {
  buildSanitizedAcceptanceRowsFromMessage,
  extractTurnAcceptanceMeta,
} from './turnAcceptanceMeta';
import type { UnifiedDeliverableView } from './buildUnifiedDeliverableView';
import { buildTurnDeliverableView } from './buildTurnDeliverableView';
import {
  isStickyDeliverableSummaryEnabled,
  isTerminalDeliverablePresentationEnabled,
  isTurnSnapshotKernelEnabled,
} from './conversationDeliverableFeatureFlags';
import { normalizeConversationSummaryProgress } from './normalizeConversationSummaryProgress';
import { assertDeliverableContextInvariants } from './deliverableContextInvariants';
import {
  presentConversationDeliverableRows,
  resolveTerminalPresentationMode,
} from './presentConversationDeliverableRows';
import type { SessionTaskPhase } from './sessionTaskLifecycle';
import type {
  DeliverableValidationStatus,
  ValidatedDeliverable,
} from './validateDeliverables';
import {
  expandExpectedManifestSlideCount,
  inferNovaSlidePagesFromPaths,
} from './slideManifestExpand';
import {
  isDocumentDeliverableProfile,
  isSlideDeliverableProfile,
} from './slideDeliverableProfile';
import type { ExportDeliverableAccess } from './exportDeliverableAccessUrls';
import { exportAccessMapKey, escapeHtml } from './exportDeliverableAccessUrls';

export type ExportInlineSummaryRow = {
  id: string;
  label: string;
  typeLabel: string;
  statusLabel: string;
  path: string;
  kind: ReturnType<typeof classifyDeliverablePath>;
  apiPath: string;
  resolvedPath?: string | null;
  status: DeliverableSummaryRow['status'];
  access?: ExportDeliverableAccess;
};

const PROCESS_MESSAGE_KINDS = new Set<NormalizedMessage['kind']>([
  'thinking',
  'tool_use',
  'tool_result',
  'agent_activity',
  'agent_activity_summary',
]);

export function isExportProcessMessage(message: NormalizedMessage): boolean {
  return PROCESS_MESSAGE_KINDS.has(message.kind);
}

export type ExportConversationTurn = {
  userMessage?: NormalizedMessage;
  processMessages: NormalizedMessage[];
  finalAssistant?: NormalizedMessage;
  startIndex: number;
};

export function groupExportConversationTurns(messages: NormalizedMessage[]): ExportConversationTurn[] {
  const turns: ExportConversationTurn[] = [];
  let current: ExportConversationTurn = { processMessages: [], startIndex: 1 };

  const pushTurn = () => {
    if (current.userMessage || current.finalAssistant || current.processMessages.length > 0) {
      turns.push(current);
    }
  };

  messages.forEach((message, idx) => {
    const index = idx + 1;
    if (message.kind === 'text' && message.role === 'user') {
      pushTurn();
      current = { userMessage: message, processMessages: [], startIndex: index };
      return;
    }

    if (message.kind === 'text' && message.role === 'assistant') {
      if (current.finalAssistant) {
        current.processMessages.push(current.finalAssistant);
      }
      current.finalAssistant = message;
      return;
    }

    if (isExportProcessMessage(message)) {
      current.processMessages.push(message);
      return;
    }

    current.processMessages.push(message);
  });

  pushTurn();
  return turns;
}

/** WYSIWYG：与 DeliverableSummaryTable「文件链接」列一致；不注入用户未见的 API URL。 */
export function renderExportUiSummaryLinkCell(
  path: string,
  kind: ReturnType<typeof classifyDeliverablePath>,
  status: DeliverableSummaryRow['status'],
): string {
  if (status !== 'delivered' || !String(path ?? '').trim()) {
    return '<span class="export-link-none">—</span>';
  }
  const linkDisplay = resolveSummaryTableLinkDisplay(path, kind);
  const linkLabel = escapeHtml(formatSummaryTableLinkLabel(path, kind));
  if (linkDisplay.mode === 'external') {
    return `<a href="${escapeHtml(linkDisplay.href)}" target="_blank" rel="noopener noreferrer" class="export-file-link" title="${escapeHtml(linkDisplay.href)}">${linkLabel}</a>`;
  }
  if (linkDisplay.mode === 'project') {
    return `<span class="export-file-link" title="${escapeHtml(path)}">${linkLabel}</span>`;
  }
  return '<span class="export-link-none">—</span>';
}

export function renderExportUiDeliverableRowHtml(row: {
  label: string;
  typeLabel: string;
  status: DeliverableSummaryRow['status'];
  statusLabel: string;
  path: string;
  kind: ReturnType<typeof classifyDeliverablePath>;
}): string {
  const statusClass = row.status === 'delivered'
    ? 'status-delivered'
    : row.status === 'checking'
      ? 'status-checking'
      : 'status-pending';
  return `<tr>
      <td>${escapeHtml(row.label)}</td>
      <td>${escapeHtml(row.typeLabel)}</td>
      <td class="${statusClass}">${escapeHtml(row.statusLabel)}</td>
      <td>${renderExportUiSummaryLinkCell(row.path, row.kind, row.status)}</td>
    </tr>`;
}

export const EXPORT_UI_DELIVERABLE_TABLE_HEAD = `
        <tr>
          <th>成果名称</th>
          <th>文件类型</th>
          <th>状态</th>
          <th>文件链接</th>
        </tr>`;

export function exportUiStatusLabel(status: DeliverableSummaryRow['status']): string {
  switch (status) {
    case 'delivered':
      return '已完成';
    case 'checking':
      return '校验中…';
    case 'needContinue':
      return '需继续';
    case 'broken':
      return '需修复';
    case 'hidden':
      return '已隐藏';
    case 'missing':
    default:
      return '未完成';
  }
}

export function turnMessagesForAssistant(
  chatMessages: ChatMessage[],
  assistantMessage: ChatMessage,
): ChatMessage[] {
  const assistantIndex = chatMessages.findIndex((msg) => msg.id === assistantMessage.id);
  if (assistantIndex < 0) return [assistantMessage];

  let start = assistantIndex;
  for (let i = assistantIndex; i >= 0; i -= 1) {
    const msg = chatMessages[i];
    if (msg?.type === 'user') {
      start = i + 1;
      break;
    }
    if (i === 0) start = 0;
  }

  return chatMessages.slice(start, assistantIndex + 1);
}

function mapValidatedItems(
  items: DeliverableItem[],
  verifiedPaths: string[],
): ValidatedDeliverable[] {
  const verifiedSet = new Set(verifiedPaths.map((p) => p.replace(/\\/g, '/').toLowerCase()));
  return items.map((item) => {
    const path = (item.resolvedPath || item.apiPath || item.path || '').replace(/\\/g, '/');
    const pathLower = path.toLowerCase();
    const engineVerified = verifiedSet.has(pathLower)
      || [...verifiedSet].some((v) => v.endsWith(`/${pathLower}`) || pathLower.endsWith(`/${v}`));
    const inheritedStatus = (
      item as DeliverableItem & { validationStatus?: DeliverableValidationStatus }
    ).validationStatus;
    return {
      ...item,
      validationStatus: engineVerified ? 'verified' as const : inheritedStatus ?? 'pending',
    };
  });
}

function dockRowsFromSummaryRows(rows: DeliverableSummaryRow[]): DeliverableDockRow[] {
  return rows.map((row) => ({
    ...row,
    label: row.label || getArtifactFileName(row.path),
  }));
}

function buildExportInlineRows(input: {
  message: ChatMessage;
  turnMessages: ChatMessage[];
  sessionMessages: ChatMessage[];
  projectName: string;
  isLatestAssistantInSession: boolean;
  unifiedView: UnifiedDeliverableView | null;
  lifecyclePhase?: SessionTaskPhase | 'unknown';
  sessionRepairActive?: boolean;
}): DeliverableSummaryRow[] {
  const {
    message,
    turnMessages,
    sessionMessages,
    projectName,
    isLatestAssistantInSession,
    unifiedView,
    lifecyclePhase,
    sessionRepairActive = false,
  } = input;

  const turnMeta = extractTurnAcceptanceMeta(message);
  const terminalMode = resolveTerminalPresentationMode({
    lifecyclePhase,
    sessionRepairActive,
    completionState: turnMeta?.completionState
      ?? unifiedView?.qualityStatus?.completionState,
    acceptanceStatus: turnMeta?.acceptanceStatus,
  });

  if (isLatestAssistantInSession) {
    const liveRows = unifiedView?.rows.filter((row) => row.status !== 'hidden') ?? [];
    const presented = isTerminalDeliverablePresentationEnabled()
      ? presentConversationDeliverableRows(liveRows, terminalMode)
      : liveRows;
    assertDeliverableContextInvariants(presented, terminalMode, {
      contextLabel: `export-inline-latest:${message.id}`,
    });
    return presented;
  }

  if (isTurnSnapshotKernelEnabled()) {
    const turnView = buildTurnDeliverableView({
      sessionMessages,
      turnEndMessage: message,
      projectRoot: projectName,
    });
    if (turnView?.rows.length) {
      return turnView.rows;
    }
  }

  const formattedContent = String(message.content ?? '');
  const turnUserGoalText = extractUserGoalFromTurnMessages(turnMessages)
    || extractUserGoalFromSessionMessages(sessionMessages);
  const sessionManifest = resolveCurrentSessionManifest(sessionMessages);
  const turnDeliverables = collectTurnFinalDeliverables({
    assistantText: formattedContent,
    toolMessages: turnMessages,
    // PD-SAAS-FORK: export shares the frozen SDM row-count authority.
    sessionToolMessages: sessionMessages,
    projectRoot: projectName,
    userGoalText: turnUserGoalText,
  });

  let items = turnDeliverables;
  if (items.length === 0 && turnHasSuccessfulDeliverableTools(turnMessages)) {
    items = collectTurnAllArtifacts({
      assistantText: formattedContent,
      toolMessages: turnMessages,
      projectRoot: projectName,
      userGoalText: turnUserGoalText,
    }).filter((item) => item.kind !== 'url');
  }

  const acceptanceRows = buildSanitizedAcceptanceRowsFromMessage(message, {
    turnArtifactDir: typeof message.turnArtifactDir === 'string' ? message.turnArtifactDir : undefined,
    knownVerifiedPaths: items.map((item) => item.resolvedPath || item.apiPath || item.path),
  });

  const sessionWideItems = collectDeliverablesFromMessages(sessionMessages, projectName);
  const sessionVerifiedPaths: string[] = [];
  for (const msg of sessionMessages) {
    if (msg.type !== 'assistant') continue;
    const verified = msg.verifiedDeliverablePaths;
    if (Array.isArray(verified)) {
      for (const path of verified) {
        if (typeof path === 'string' && path.trim()) sessionVerifiedPaths.push(path.trim());
      }
    }
  }

  const expectedManifest = resolveDeliverableSummaryExpectedManifest({
    turnMeta: extractTurnAcceptanceMeta(message),
    sessionManifest,
    isLatestAssistantInSession,
    messages: sessionMessages,
    sessionDeliverables: sessionWideItems,
    sessionVerifiedPaths,
  });

  const sessionTaskDirectory = resolveCurrentSessionTaskDirectory(sessionMessages);
  const scopeDir = unifiedView?.scopeDir
    ?? resolveContractScopeDir({
      messages: sessionMessages,
      sessionTaskDirectory,
      sessionManifest,
      turnArtifactDir: typeof message.turnArtifactDir === 'string' ? message.turnArtifactDir : undefined,
    })
    ?? sessionTaskDirectory?.taskArtifactDir
    ?? null;

  const turnArtifactDir = typeof message.turnArtifactDir === 'string'
    ? message.turnArtifactDir
    : inferTurnArtifactDirectory(items) ?? scopeDir ?? undefined;

  const manifestForProfile = sessionManifest;
  const slideProfile = isSlideDeliverableProfile(manifestForProfile?.profileId)
    && !isDocumentDeliverableProfile(manifestForProfile?.profileId);
  const verifiedPaths = acceptanceRows
    .filter((row) => row.status === 'delivered')
    .map((row) => row.path)
    .filter(Boolean) as string[];

  let slideManifestPages: ReturnType<typeof inferNovaSlidePagesFromPaths> = [];
  if (slideProfile && turnArtifactDir) {
    const paths = items.map((item) => item.resolvedPath || item.apiPath || item.path);
    slideManifestPages = inferNovaSlidePagesFromPaths(turnArtifactDir, paths);
    if (slideManifestPages.length === 0 && expectedManifest) {
      slideManifestPages = expandExpectedManifestSlideCount(expectedManifest, turnArtifactDir);
    }
  }

  const validatedItems = mapValidatedItems(items, verifiedPaths);
  let rows = buildDeliverableSummaryRows({
    expectedManifest,
    slideManifestPages: slideManifestPages.length > 0 ? slideManifestPages : undefined,
    acceptanceRows: acceptanceRows as DeliverableAcceptanceRow[],
    validatedItems,
    verifiedPaths,
    turnArtifactDir,
    validationSettled: true,
    scopeDir,
  });

  const folderItems = collectSessionFolderItems({
    messages: sessionMessages,
    projectRoot: projectName,
    turnDeliverables: items,
    turnArtifactDir: scopeDir ?? turnArtifactDir ?? null,
  });

  if (folderItems.length > 0) {
    rows = mergeFolderItemsIntoDockRows(dockRowsFromSummaryRows(rows), folderItems, {
      allowExtraRows: !(expectedManifest?.length),
      expectedEntries: expectedManifest,
      scopeDir,
      validationSettled: true,
      verifiedPaths,
    });
  }

  if (rows.length === 0 && acceptanceRows.length === 0 && !expectedManifest?.length) {
    return [];
  }

  const legacyRows = rows.filter((row) => row.status !== 'hidden');
  if (
    isTerminalDeliverablePresentationEnabled()
    && terminalMode === 'terminal'
  ) {
    return presentConversationDeliverableRows(legacyRows, 'terminal');
  }
  return legacyRows;
}

export function shouldRenderExportInlineDeliverableSummary(input: {
  message: ChatMessage;
  turnMessages: ChatMessage[];
  sessionMessages: ChatMessage[];
  isLatestAssistantInSession: boolean;
}): boolean {
  const { message, turnMessages, sessionMessages, isLatestAssistantInSession } = input;
  const nextMessage = sessionMessages[sessionMessages.findIndex((m) => m.id === message.id) + 1];
  const isFinalAssistantReply = isFinalAssistantReplyForMessage(message, nextMessage);
  const formattedContent = String(message.content ?? '');
  const turnUserGoalText = extractUserGoalFromTurnMessages(turnMessages)
    || extractUserGoalFromSessionMessages(sessionMessages);

  const turnDeliverables = collectTurnFinalDeliverables({
    assistantText: formattedContent,
    toolMessages: turnMessages,
    // PD-SAAS-FORK: mount policy must observe the same frozen SDM.
    sessionToolMessages: sessionMessages,
    projectRoot: '',
    userGoalText: turnUserGoalText,
  });

  const sessionManifest = resolveCurrentSessionManifest(sessionMessages);
  const expectedManifest = resolveDeliverableSummaryExpectedManifest({
    turnMeta: extractTurnAcceptanceMeta(message),
    sessionManifest,
    isLatestAssistantInSession,
    messages: sessionMessages,
  });

  return shouldMountDeliverableSummary({
    message,
    isFinalAssistantReply,
    formattedContent,
    turnDeliverables,
    acceptanceRowCount: countAcceptanceRowsForMessage(message),
    turnUserGoalText,
    turnMessages,
    turnArtifactDir: typeof message.turnArtifactDir === 'string' ? message.turnArtifactDir : undefined,
    expectedManifest,
    sessionManifest,
  }, {
    isLatestAssistantInSession,
    sessionRepairActive: false,
  });
}

export function buildExportInlineDeliverableRows(input: {
  message: ChatMessage;
  turnMessages: ChatMessage[];
  sessionMessages: ChatMessage[];
  projectName: string;
  isLatestAssistantInSession: boolean;
  unifiedView: UnifiedDeliverableView | null;
  accessMap?: Map<string, ExportDeliverableAccess>;
  scopeDir?: string | null;
  lifecyclePhase?: SessionTaskPhase | 'unknown';
  sessionRepairActive?: boolean;
}): ExportInlineSummaryRow[] {
  if (!shouldRenderExportInlineDeliverableSummary(input)) return [];

  const rows = buildExportInlineRows(input);
  const assistantText = String(input.message.content ?? '');
  const labelMap = parseDeliverableLabelsFromAssistantText(assistantText);
  const hintDir = input.scopeDir
    ?? (typeof input.message.turnArtifactDir === 'string' ? input.message.turnArtifactDir : null);

  return rows.map((row) => {
    const path = row.resolvedPath || row.path;
    const kind = classifyDeliverablePath(path);
    const label = row.label
      || resolveDeliverableDisplayName(path, kind, labelMap, { preferManifestLabel: true });
    const access = input.accessMap?.get(exportAccessMapKey(path, hintDir))
      ?? input.accessMap?.get(exportAccessMapKey(row.path, hintDir))
      ?? input.accessMap?.get(exportAccessMapKey(path, null));
    return {
      id: row.id,
      label,
      typeLabel: formatDeliverableFileTypeLabel(path, kind),
      statusLabel: exportUiStatusLabel(row.status),
      path,
      kind,
      apiPath: access?.apiPath ?? path,
      resolvedPath: access?.resolvedPath ?? row.resolvedPath ?? row.apiPath ?? null,
      status: row.status,
      access,
    };
  });
}

export function renderExportTurnPointerHtml(input: {
  done: number;
  total: number;
  historical?: boolean;
}): string {
  const progress = input.total > 0
    ? `${Math.min(input.done, input.total)}/${input.total}`
    : '对齐中';
  const historicalNote = input.historical
    ? '<span class="inline-deliverable-historical-tag">非当前清单</span> '
    : '';
  const link = input.historical
    ? ''
    : ' · <span class="inline-deliverable-pointer-link">查看会话成果清单 ↑</span>';
  return `
<div class="inline-deliverable-turn-pointer" data-testid="export-turn-pointer" data-historical="${input.historical ? 'true' : 'false'}">
  ${historicalNote}<span>${progress} 项成果</span>${link}
</div>`;
}

export function renderExportInlineDeliverableTableHtml(
  rows: ExportInlineSummaryRow[],
  options?: { historical?: boolean },
): string {
  if (rows.length === 0) return '';

  const body = rows.map((row) => renderExportUiDeliverableRowHtml(row)).join('');
  const historicalAttr = options?.historical ? ' data-non-authoritative="true"' : '';

  return `
<div class="inline-deliverable-summary" data-testid="inline-deliverable-summary-table"${historicalAttr}>
  ${options?.historical ? '<div class="inline-deliverable-historical-tag">非当前清单（历史快照）</div>' : ''}
  <div class="inline-deliverable-title">成果清单</div>
  <div class="table-scroll">
    <table class="ui-deliverable-table">
      <thead>
        ${EXPORT_UI_DELIVERABLE_TABLE_HEAD}
      </thead>
      <tbody>${body}</tbody>
    </table>
  </div>
</div>`;
}

export function chatMessagesFromNormalized(messages: NormalizedMessage[]): ChatMessage[] {
  return normalizedToChatMessages(messages);
}
