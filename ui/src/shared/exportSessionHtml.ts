// PD-SAAS-FORK: export full session transcript as readable offline HTML
import type { Project, ProjectSession } from '../types/app';
import { getSessionRequestParams } from '../types/app';
import type { NormalizedMessage } from '../stores/useSessionStore';
import {
  buildTailFetchMoreParams,
  buildTailFetchQueryParams,
  computeLoadedRangeAfterTailFetch,
  hasMoreFromLoadedRange,
  TAIL_PAGE_INITIAL_LIMIT,
  TAIL_PAGE_MORE_LIMIT,
} from '../stores/sessionMessagePagination';
import { fetchWithBackoff } from './fetchWithBackoff';
import { normalizedToChatMessages } from '../components/chat/hooks/useChatMessages';
import { getSessionProjectPath } from '../components/chat/utils/sessionLauncher';
import { projectDisplayName, sessionDisplayTitle } from '../lib/customNames';
import {
  buildUnifiedDeliverableView,
  type TaskFolderSnapshotBindingInput,
  type TaskFolderSnapshotFile,
  type UnifiedDeliverableView,
} from './buildUnifiedDeliverableView';
import type { DeliverableSummaryRow } from './buildDeliverableSummaryRows';
import { resolveContractScopeDir } from './resolveContractScopeDir';
import { resolveCurrentSessionTaskDirectory } from './resolveSessionTaskDirectory';
import {
  resolveCurrentSessionManifest,
  type SessionDeliverableManifestUi,
} from './resolveSessionDeliverableManifest';
import {
  createNotApplicableTaskFolderSnapshot,
  fetchTaskFolderSnapshotEnvelope,
  resolveTaskFolderSnapshotCompletenessForValidation,
  type TaskFolderSnapshotEnvelope,
} from './fetchTaskFolderSnapshot';
import {
  buildExportDeliverableAccess,
  buildExportDeliverableAccessMap,
  buildTaskFolderSnapshotUrl,
  exportAccessMapKey,
  type ExportDeliverableAccess,
} from './exportDeliverableAccessUrls';
import {
  buildExportInlineDeliverableRows,
  chatMessagesFromNormalized,
  EXPORT_UI_DELIVERABLE_TABLE_HEAD,
  exportUiStatusLabel,
  groupExportConversationTurns,
  renderExportInlineDeliverableTableHtml,
  renderExportTurnPointerHtml,
  renderExportUiDeliverableRowHtml,
  turnMessagesForAssistant,
} from './exportSessionInlineDeliverables';
import { assertDeliverableContextInvariants } from './deliverableContextInvariants';
import { isStickyDeliverableSummaryEnabled, isTerminalDeliverablePresentationEnabled } from './conversationDeliverableFeatureFlags';
import { normalizeConversationSummaryProgress } from './normalizeConversationSummaryProgress';
import { normalizeConversationSummaryProgress } from './normalizeConversationSummaryProgress';
import { presentConversationDeliverableRows } from './presentConversationDeliverableRows';
import { classifyDeliverablePath } from './artifactPaths';
import { formatDeliverableFileTypeLabel } from './deliverableFileTypeLabel';
import {
  buildExportSnapshotEnvelope,
  renderExportSnapshotBanner,
  type ExportSnapshotEnvelope,
  type ExportSnapshotMode,
  type ExportSnapshotTruncationReason,
} from './exportSnapshotEnvelope';
import { isExportSnapshotV2Enabled, isRequireValidationSettledForExportEnabled, isDeliverableSettledAcceptanceAuthorityEnabled, isDeliverableCertificateEnforceEnabled, isDeliverableCertificateUiEnabled } from './perfFeatureFlags';
import { resolvePipelineValidationSettled } from './resolvePipelineValidationSettled';
import {
  resolveAcceptanceCertificateStateFromTurnMeta,
  resolveLatestAcceptanceCertificate,
} from './turnAcceptanceMeta';
import { resolveSessionTaskPhase } from './sessionTaskLifecycle';
import { userGoalImpliesDeliverable } from './userFacingErrors';
import {
  coSourceSessionHistoryDeliverableEnvelope,
  resolveSessionHistoryDeliverableContext,
  type SessionHistoryDeliverableEnvelope,
} from './sessionHistoryDeliverableEnvelope';

/** PD-SAAS-FORK: export may paginate large transcripts; allow longer per-page fetch than session open. */
export const EXPORT_SESSION_MESSAGES_FETCH_TIMEOUT_MS = 90_000;

const EXPORT_MESSAGES_FETCH_BACKOFF = {
  maxAttempts: 12,
  defaultRetryAfterMs: 2000,
  maxJitterMs: 800,
} as const;

export type SessionExportLabels = {
  exportedAt: string;
  project: string;
  sessionId: string;
  messageCount: string;
  messageId: string;
  messageKind: string;
  messageIndex: string;
  turnId: string;
  toolId: string;
  runId: string;
  sequence: string;
  messageIndexTable: string;
  debugManifest: string;
  timestamp: string;
  user: string;
  assistant: string;
  toolCall: string;
  toolResult: string;
  thinking: string;
  error: string;
  system: string;
  attachments: string;
  images: string;
  activity: string;
  noMessages: string;
};

export type SessionExportFourLineDebug = {
  sessionId: string;
  projectName: string;
  projectApiName: string;
  exportOrigin?: string | null;
  workspaceUuid?: string | null;
  taskDirKey?: string | null;
  taskArtifactDir?: string | null;
  scopeDir?: string | null;
  folderPath?: string | null;
  contractHash?: string | null;
  taskFolderSnapshotUrl?: string | null;
};

export type SessionExportInput = {
  title: string;
  projectName: string;
  /** API project key for file/resolve & content URLs; defaults to projectName. */
  projectApiName?: string;
  sessionId: string;
  messages: NormalizedMessage[];
  exportedAt?: Date;
  labels: SessionExportLabels;
  /** PD-SAAS-FORK: scoped disk listing from task-folder-snapshot (paths only, no file bodies). */
  diskSnapshot?: TaskFolderSnapshotFile[];
  diskSnapshotVersion?: number;
  diskSnapshotComplete?: boolean;
  diskSnapshotBinding?: TaskFolderSnapshotBindingInput;
  /** PD-SAAS-FORK: one prebuilt contract view shared with inline rows/envelope/access-map. */
  prebuiltUnifiedView?: UnifiedDeliverableView | null;
  workspaceUuid?: string | null;
  exportOrigin?: string | null;
  accessMap?: Map<string, ExportDeliverableAccess>;
  /** PD-SAAS-FORK: 导出一致性快照 envelope */
  snapshotEnvelope?: ExportSnapshotEnvelope;
  /** PD-SAAS-FORK: flag 关闭时仅供终态语义判断，不序列化进导出。 */
  semanticSnapshotEnvelope?: ExportSnapshotEnvelope;
  /** PD-SAAS-FORK: user_archive 用户归档 / diagnostic 诊断 */
  exportMode?: ExportSnapshotMode;
  /** PD-SAAS-FORK: 仅允许收紧默认上限，供受限环境与负载验收使用。 */
  maxExportBytes?: number;
  /** PD-SAAS-FORK: 消息分页阶段已因预算提前停止。 */
  sourceTruncated?: boolean;
  sourceTruncationReason?: ExportSnapshotTruncationReason;
  /** PD-SAAS-FORK: top-level history response metadata, co-sourced without synthetic bubbles. */
  sessionHistoryEnvelope?: SessionHistoryDeliverableEnvelope;
};

const SKIP_EXPORT_KINDS = new Set<NormalizedMessage['kind']>([
  'stream_delta',
  'stream_end',
  'complete',
  'status',
  'session_created',
  'permission_cancelled',
  'session_manifest_updated',
  'compact_boundary',
]);

/** PD-SAAS-FORK: P0-0 offline HTML budgets; summaries remain well below either cap. */
export const USER_ARCHIVE_EXPORT_MAX_BYTES = 20 * 1024 * 1024;
export const DIAGNOSTIC_EXPORT_MAX_BYTES = 50 * 1024 * 1024;
const EXPORT_HTML_TEMPLATE_RESERVE_BYTES = 2 * 1024 * 1024;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatJson(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatTimestamp(value: string | undefined): string {
  if (!value) return '';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return escapeHtml(value);
  return escapeHtml(new Date(parsed).toLocaleString());
}

function isMarkdownTableRow(line: string): boolean {
  return /^\|.+\|$/.test(line.trim());
}

function isMarkdownTableSeparator(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function splitMarkdownTableCells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function renderMarkdownTable(headerLine: string, bodyLines: string[]): string {
  const headers = splitMarkdownTableCells(headerLine);
  const rows = bodyLines.map((line) => splitMarkdownTableCells(line));
  const headHtml = headers.map((cell) => `<th>${cell}</th>`).join('');
  const bodyHtml = rows.map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('');
  return `<table class="md-table"><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
}

function decodeUrlSchemeEntities(value: string): string {
  return value
    .replace(/&colon;|&#0*58;|&#x0*3a;/gi, ':')
    .replace(/&tab;|&#0*9;|&#x0*9;/gi, '\t')
    .replace(/&newline;|&#0*10;|&#x0*a;/gi, '\n');
}

function hasTraversalSegment(value: string): boolean {
  const pathOnly = value.split(/[?#]/, 1)[0] ?? '';
  return pathOnly.split('/').some((segment) => segment === '..');
}

function safeExportLinkHref(value: string): string | null {
  const trimmed = String(value ?? '').trim();
  if (!trimmed || /[\u0000-\u001f\u007f"'<>`]/.test(trimmed)) return null;
  const decodedEntities = decodeUrlSchemeEntities(trimmed);
  const compact = decodedEntities.replace(/\s+/g, '');
  let decodedPercent = compact;
  try {
    decodedPercent = decodeURIComponent(compact);
  } catch {
    return null;
  }
  const normalized = decodedPercent.toLowerCase();
  if (/^(?:https?|mailto):/.test(normalized)) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(normalized)) return null;
  if (
    normalized.startsWith('//')
    || trimmed.includes('\\')
    || hasTraversalSegment(trimmed)
    || hasTraversalSegment(decodedPercent)
  ) {
    return null;
  }
  return trimmed;
}

function safeExportImageSrc(value: string): string | null {
  const safe = safeExportLinkHref(value);
  if (!safe || /[\[\]{}]/.test(safe)) return null;
  const normalized = decodeUrlSchemeEntities(safe).replace(/\s+/g, '').toLowerCase();
  if (normalized.startsWith('https:')) return safe;
  if (/^[a-z][a-z0-9+.-]*:/i.test(normalized) || normalized.startsWith('//')) return null;
  return safe;
}

/** Lightweight markdown → HTML for export (GFM tables, blockquotes, safe escape). */
export function markdownToExportHtml(source: string): string {
  const placeholders: string[] = [];
  let text = source.replace(/\r\n/g, '\n');

  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const index = placeholders.length;
    placeholders.push(
      `<pre class="code-block"${lang ? ` data-lang="${escapeHtml(String(lang))}"` : ''}><code>${escapeHtml(String(code).replace(/\n$/, ''))}</code></pre>`,
    );
    return `\u0000HTML${index}\u0000`;
  });

  text = text.replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g, (_match, label, href) => {
    const index = placeholders.length;
    const safeHref = safeExportLinkHref(String(href));
    placeholders.push(safeHref
      ? `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(String(label))}</a>`
      : `<span class="unsafe-link">${escapeHtml(String(label))}</span>`);
    return `\u0000HTML${index}\u0000`;
  });

  text = escapeHtml(text);

  text = text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^&gt; (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
    .replace(/^(-{3,}|_{3,}|\*{3,})$/gm, '<hr />')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');

  const lines = text.split('\n');
  const out: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (/^\u0000HTML\d+\u0000$/.test(line)) {
      closeLists();
      out.push(line);
      continue;
    }

    if (isMarkdownTableRow(line)) {
      const next = lines[i + 1];
      if (next && isMarkdownTableSeparator(next)) {
        closeLists();
        const bodyLines: string[] = [];
        let j = i + 2;
        while (j < lines.length && isMarkdownTableRow(lines[j]!)) {
          bodyLines.push(lines[j]!);
          j += 1;
        }
        out.push(renderMarkdownTable(line, bodyLines));
        i = j - 1;
        continue;
      }
    }

    const ulMatch = line.match(/^[-*] (.+)$/);
    if (ulMatch) {
      if (!inUl) {
        closeLists();
        out.push('<ul>');
        inUl = true;
      }
      out.push(`<li>${ulMatch[1]}</li>`);
      continue;
    }
    const olMatch = line.match(/^\d+\. (.+)$/);
    if (olMatch) {
      if (!inOl) {
        closeLists();
        out.push('<ol>');
        inOl = true;
      }
      out.push(`<li>${olMatch[1]}</li>`);
      continue;
    }
    closeLists();
    if (line.trim() === '') {
      out.push('');
    } else if (/^<(h[1-3]|blockquote|hr|table)\b/.test(line.trim())) {
      out.push(line);
    } else {
      out.push(`<p>${line}</p>`);
    }
  }
  closeLists();

  let html = out.join('\n');
  html = html.replace(/\u0000HTML(\d+)\u0000/g, (_match, index) => placeholders[Number(index)] ?? '');
  return html;
}

function messageBodyHtml(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return '';
  return `<div class="markdown-body">${markdownToExportHtml(trimmed)}</div>`;
}

function renderAttachments(message: NormalizedMessage, labels: SessionExportLabels): string {
  const attachments = message.attachments;
  if (!Array.isArray(attachments) || attachments.length === 0) return '';
  const items = attachments
    .map((item) => {
      const name = escapeHtml(item.name || 'attachment');
      const path = item.path ? ` <span class="meta">(${escapeHtml(item.path)})</span>` : '';
      return `<li>${name}${path}</li>`;
    })
    .join('');
  return `<div class="attachments"><div class="meta">${escapeHtml(labels.attachments)}</div><ul>${items}</ul></div>`;
}

function renderImages(images: Array<{ data?: string; mimeType?: string; name?: string }> | string[] | undefined, labels: SessionExportLabels): string {
  if (!Array.isArray(images) || images.length === 0) return '';
  const blocks = images.map((image, index) => {
    if (typeof image === 'string') {
      const src = safeExportImageSrc(image);
      if (!src) return '';
      return `<figure class="image"><img src="${escapeHtml(src)}" alt="${escapeHtml(labels.images)} ${index + 1}" loading="lazy" /></figure>`;
    }
    if (image?.data) {
      const src = safeExportImageSrc(image.data);
      if (!src) return '';
      const alt = escapeHtml(image.name || `${labels.images} ${index + 1}`);
      return `<figure class="image"><img src="${escapeHtml(src)}" alt="${alt}" loading="lazy" /></figure>`;
    }
    return '';
  }).filter(Boolean);
  if (blocks.length === 0) return '';
  return `<div class="images">${blocks.join('')}</div>`;
}

function debugChip(label: string, value: string): string {
  return `<span class="debug-chip"><span class="debug-label">${escapeHtml(label)}</span><code>${escapeHtml(value)}</code></span>`;
}

function renderMessageDebugMeta(message: NormalizedMessage, index: number, labels: SessionExportLabels): string {
  const chips = [
    debugChip(labels.messageIndex, String(index)),
    debugChip(labels.messageId, message.id),
    debugChip(labels.messageKind, message.kind),
  ];
  if (message.turnId) chips.push(debugChip(labels.turnId, message.turnId));
  if (message.toolId) chips.push(debugChip(labels.toolId, message.toolId));
  if (message.runId) chips.push(debugChip(labels.runId, message.runId));
  if (message.sequence != null) chips.push(debugChip(labels.sequence, String(message.sequence)));
  return `<div class="message-debug">${chips.join('')}</div>`;
}

function buildExportIndexRecords(messages: NormalizedMessage[], sessionId: string) {
  return messages.map((message, idx) => ({
    index: idx + 1,
    id: message.id,
    sessionId: message.sessionId || sessionId,
    kind: message.kind,
    role: message.role ?? null,
    turnId: message.turnId ?? null,
    toolId: message.toolId ?? null,
    toolName: message.toolName ?? null,
    runId: message.runId ?? null,
    sequence: message.sequence ?? null,
    timestamp: message.timestamp,
  }));
}

function renderMessageIndexTable(
  messages: NormalizedMessage[],
  sessionId: string,
  labels: SessionExportLabels,
): string {
  if (messages.length === 0) return '';
  const rows = messages.map((message, idx) => {
    const index = idx + 1;
    const anchorId = `msg-${message.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    return `<tr>
      <td><a href="#${escapeHtml(anchorId)}">${index}</a></td>
      <td><code>${escapeHtml(message.id)}</code></td>
      <td><code>${escapeHtml(message.kind)}</code></td>
      <td>${escapeHtml(message.role ?? '—')}</td>
      <td>${formatTimestamp(message.timestamp)}</td>
    </tr>`;
  }).join('');
  return `
<details class="debug-index" open>
  <summary>${escapeHtml(labels.messageIndexTable)}</summary>
  <div class="debug-index-meta"><span>${escapeHtml(labels.sessionId)}：</span><code>${escapeHtml(sessionId)}</code></div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>${escapeHtml(labels.messageId)}</th>
        <th>${escapeHtml(labels.messageKind)}</th>
        <th>role</th>
        <th>${escapeHtml(labels.timestamp)}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</details>`;
}

function renderMessageBlock(
  message: NormalizedMessage,
  index: number,
  roleLabel: string,
  roleClass: string,
  bodyHtml: string,
  labels: SessionExportLabels,
  options?: { showDebug?: boolean; extraBody?: string },
): string {
  if (!bodyHtml.trim() && !options?.extraBody) return '';
  const anchorId = `msg-${message.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const debugMeta = options?.showDebug === false
    ? ''
    : renderMessageDebugMeta(message, index, labels);
  return `
<article class="message ${roleClass}" id="${escapeHtml(anchorId)}" data-message-id="${escapeHtml(message.id)}" data-session-id="${escapeHtml(message.sessionId)}" data-kind="${escapeHtml(message.kind)}" data-index="${index}">
  <header class="message-header">
    <span class="role">${escapeHtml(roleLabel)}</span>
    <span class="message-id-ref"><code>#${index}</code> · <code>${escapeHtml(message.id)}</code></span>
    <time datetime="${escapeHtml(message.timestamp ?? '')}">${formatTimestamp(message.timestamp)}</time>
  </header>
  ${debugMeta}
  <div class="message-body">${bodyHtml}${options?.extraBody ?? ''}</div>
</article>`;
}

function renderNormalizedMessage(
  message: NormalizedMessage,
  index: number,
  labels: SessionExportLabels,
  options?: { showDebug?: boolean },
): string {
  const showDebug = options?.showDebug !== false;
  const blockOptions = showDebug ? undefined : { showDebug: false };
  const kind = message.kind;

  if (kind === 'text') {
    const role = message.role === 'user' ? labels.user : labels.assistant;
    const roleClass = message.role === 'user' ? 'role-user' : 'role-assistant';
    const content = message.content ?? message.text ?? '';
    const body = [
      messageBodyHtml(String(content)),
      renderAttachments(message, labels),
      renderImages(message.images, labels),
    ].filter(Boolean).join('');
    return renderMessageBlock(message, index, role, roleClass, body, labels, blockOptions);
  }

  if (kind === 'thinking') {
    const text = message.content ?? message.text ?? '';
    if (!String(text).trim()) return '';
    return renderMessageBlock(
      message,
      index,
      labels.thinking,
      'role-thinking',
      messageBodyHtml(String(text)),
      labels,
      blockOptions,
    );
  }

  if (kind === 'tool_use') {
    const toolName = escapeHtml(message.toolName || 'tool');
    const input = formatJson(message.toolInput ?? message.input);
    return renderMessageBlock(
      message,
      index,
      `${labels.toolCall}: ${toolName}`,
      'role-tool',
      `<pre class="code-block"><code>${escapeHtml(input)}</code></pre>`,
      labels,
      blockOptions,
    );
  }

  if (kind === 'tool_result') {
    const toolName = escapeHtml(message.toolName || 'tool');
    const resultText = message.toolResult?.content ?? message.content ?? message.text ?? '';
    const errorClass = message.isError || message.toolResult?.isError ? ' is-error' : '';
    const body = [
      `<pre class="code-block${errorClass}"><code>${escapeHtml(String(resultText))}</code></pre>`,
      renderImages(message.toolResultImages, labels),
    ].filter(Boolean).join('');
    return renderMessageBlock(
      message,
      index,
      `${labels.toolResult}: ${toolName}`,
      'role-tool-result',
      body,
      labels,
      blockOptions,
    );
  }

  if (kind === 'error') {
    const text = message.content ?? message.text ?? 'Error';
    return renderMessageBlock(message, index, labels.error, 'role-error', messageBodyHtml(String(text)), labels, blockOptions);
  }

  if (kind === 'agent_activity' || kind === 'agent_activity_summary') {
    const title = message.title || message.summary || message.detail || message.phase || kind;
    const detail = message.detail && message.detail !== title ? message.detail : '';
    const body = [
      messageBodyHtml(String(title)),
      detail ? messageBodyHtml(String(detail)) : '',
    ].filter(Boolean).join('');
    return renderMessageBlock(message, index, labels.activity, 'role-activity', body, labels, blockOptions);
  }

  if (kind === 'task_notification') {
    const taskStatus = (
      message as NormalizedMessage & { taskStatus?: unknown }
    ).taskStatus;
    const parts = [
      taskStatus ? `Status: ${String(taskStatus)}` : '',
      message.taskResult ? String(message.taskResult) : '',
      message.outputFile ? `Output: ${message.outputFile}` : '',
    ].filter(Boolean).join('\n\n');
    return renderMessageBlock(message, index, labels.system, 'role-system', messageBodyHtml(parts || kind), labels, blockOptions);
  }

  if (kind === 'permission_request' || kind === 'interactive_prompt') {
    const text = message.content ?? message.text ?? formatJson(message.input);
    return renderMessageBlock(message, index, labels.system, 'role-system', messageBodyHtml(String(text)), labels, blockOptions);
  }

  if (kind === 'interrupted' || kind === 'turn_acceptance_snapshot') {
    const text = message.content ?? message.text ?? message.summary ?? kind;
    return renderMessageBlock(message, index, labels.system, 'role-system', messageBodyHtml(String(text)), labels, blockOptions);
  }

  const fallback = message.content ?? message.text ?? message.summary ?? message.detail;
  if (!fallback) return '';
  return renderMessageBlock(message, index, labels.system, 'role-system', messageBodyHtml(String(fallback)), labels, blockOptions);
}

function renderProcessFold(
  messages: NormalizedMessage[],
  labels: SessionExportLabels,
): string {
  if (messages.length === 0) return '';
  const inner = messages
    .map((message, idx) => renderNormalizedMessage(message, idx + 1, labels, { showDebug: false }))
    .filter(Boolean)
    .join('\n');
  if (!inner.trim()) return '';
  return `
<details class="export-process-fold">
  <summary>思考与工具过程（${messages.length} 步，默认折叠）</summary>
  <div class="export-process-body">${inner}</div>
</details>`;
}

function findLatestAssistantChatMessage(chatMessages: ReturnType<typeof chatMessagesFromNormalized>) {
  for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
    const msg = chatMessages[i];
    if (msg?.type === 'assistant' && !msg.isThinking) return msg;
  }
  return null;
}

function collectExportAccessPathCandidates(input: {
  messages: NormalizedMessage[];
  unifiedView: UnifiedDeliverableView | null;
  diskSnapshot?: TaskFolderSnapshotFile[];
  scopeDir?: string | null;
}): Array<{ path: string; hintDir?: string | null }> {
  const scopeDir = input.scopeDir ?? null;
  const seen = new Set<string>();
  const paths: Array<{ path: string; hintDir?: string | null }> = [];

  const push = (path: string | null | undefined, hintDir?: string | null) => {
    const normalized = String(path ?? '').trim();
    if (!normalized) return;
    const hint = hintDir ?? scopeDir;
    const key = exportAccessMapKey(normalized, hint);
    if (seen.has(key)) return;
    seen.add(key);
    paths.push({ path: normalized, hintDir: hint });
  };

  for (const row of input.unifiedView?.rows ?? []) {
    push(row.path, scopeDir);
    push(row.resolvedPath, scopeDir);
    push(row.apiPath, scopeDir);
  }

  for (const file of input.diskSnapshot ?? []) {
    push(file.path, scopeDir);
  }

  for (const item of input.unifiedView?.folderItems ?? []) {
    push(item.resolvedPath || item.apiPath || item.path, scopeDir);
  }

  for (const message of input.messages) {
    if (!Array.isArray(message.verifiedDeliverablePaths)) continue;
    for (const path of message.verifiedDeliverablePaths) {
      push(path, scopeDir);
    }
  }

  for (const path of collectLatestVerifiedPaths(input.messages)) {
    push(path, scopeDir);
  }

  return paths;
}

function ensureExportAccessMap(
  input: SessionExportInput,
  unifiedView: UnifiedDeliverableView | null,
  scopeDir: string | null,
): Map<string, ExportDeliverableAccess> {
  if (input.accessMap) return input.accessMap;

  const projectApiName = input.projectApiName ?? input.projectName;
  const map = new Map<string, ExportDeliverableAccess>();
  for (const entry of collectExportAccessPathCandidates({
    messages: input.messages,
    unifiedView,
    diskSnapshot: input.diskSnapshot,
    scopeDir,
  })) {
    const access = buildExportDeliverableAccess({
      projectName: projectApiName,
      path: entry.path,
      hintDir: entry.hintDir,
      exportOrigin: input.exportOrigin,
    });
    map.set(exportAccessMapKey(entry.path, entry.hintDir), access);
  }
  return map;
}

function serializeExportAccess(access: ExportDeliverableAccess | undefined) {
  if (!access) return null;
  return {
    apiPath: access.apiPath,
    resolvedPath: access.resolvedPath ?? null,
    contentUrl: access.absoluteContentUrl || access.contentUrl,
    previewUrl: access.absolutePreviewUrl || access.previewUrl,
    resolveUrl: access.absoluteResolveUrl || access.resolveUrl,
    downloadUrl: access.absoluteDownloadUrl || access.downloadUrl,
    inlineMediaUrl: access.absoluteInlineMediaUrl || access.inlineMediaUrl,
  };
}

function renderConversationMessages(
  filtered: NormalizedMessage[],
  labels: SessionExportLabels,
  projectApiName: string,
  unifiedView: UnifiedDeliverableView | null,
  accessMap: Map<string, ExportDeliverableAccess>,
  scopeDir: string | null,
  options?: {
    snapshotEnvelope?: ExportSnapshotEnvelope;
  },
): { html: string; turnSnapshots: Array<{ messageId: string; rows: ReturnType<typeof buildExportInlineDeliverableRows> }> } {
  const chatMessages = chatMessagesFromNormalized(filtered);
  const latestAssistant = findLatestAssistantChatMessage(chatMessages);
  const turns = groupExportConversationTurns(filtered);
  const turnSnapshots: Array<{ messageId: string; rows: ReturnType<typeof buildExportInlineDeliverableRows> }> = [];

  const html = turns.map((turn) => {
    const parts: string[] = [];
    if (turn.userMessage) {
      const idx = filtered.indexOf(turn.userMessage) + 1;
      parts.push(renderNormalizedMessage(turn.userMessage, idx, labels));
    }
    if (turn.processMessages.length > 0) {
      parts.push(renderProcessFold(turn.processMessages, labels));
    }
    if (turn.finalAssistant) {
      const idx = filtered.indexOf(turn.finalAssistant) + 1;
      const chatMsg = chatMessages.find((m) => m.id === turn.finalAssistant!.id);
      if (chatMsg) {
        const isLatest = latestAssistant?.id === chatMsg.id;
        const turnMsgs = turnMessagesForAssistant(chatMessages, chatMsg);
        const sessionSlice = chatMessages.slice(0, chatMessages.indexOf(chatMsg) + 1);
        const inlineRows = buildExportInlineDeliverableRows({
          message: chatMsg,
          turnMessages: turnMsgs,
          sessionMessages: sessionSlice,
          projectName: projectApiName,
          isLatestAssistantInSession: isLatest,
          unifiedView: isLatest ? unifiedView : null,
          accessMap,
          scopeDir,
          lifecyclePhase: options?.snapshotEnvelope?.lifecyclePhase,
          sessionRepairActive: options?.snapshotEnvelope?.lifecyclePhase === 'deliverable_repair_pending',
        });
        if (inlineRows.length > 0 && chatMsg.id) {
          turnSnapshots.push({ messageId: chatMsg.id, rows: inlineRows });
        }
        const content = turn.finalAssistant.content ?? turn.finalAssistant.text ?? '';
        const body = [
          messageBodyHtml(String(content)),
          renderAttachments(turn.finalAssistant, labels),
          renderImages(turn.finalAssistant.images, labels),
        ].filter(Boolean).join('');
        let extraBody = '';
        if (isLatest && isStickyDeliverableSummaryEnabled() && unifiedView) {
          const progress = normalizeConversationSummaryProgress(unifiedView.rows);
          extraBody = renderExportTurnPointerHtml({
            done: progress.done,
            total: progress.total,
          });
        } else if (inlineRows.length > 0) {
          extraBody = renderExportInlineDeliverableTableHtml(inlineRows, {
            historical: !isLatest && isStickyDeliverableSummaryEnabled(),
          });
        }
        parts.push(renderMessageBlock(
          turn.finalAssistant,
          idx,
          labels.assistant,
          'role-assistant',
          body,
          labels,
          { extraBody: extraBody || undefined },
        ));
      } else {
        parts.push(renderNormalizedMessage(turn.finalAssistant, idx, labels));
      }
    }
    return parts.filter(Boolean).join('\n');
  }).filter(Boolean).join('\n');

  return { html, turnSnapshots };
}

export function filterMessagesForExport(messages: NormalizedMessage[]): NormalizedMessage[] {
  return messages.filter((message) => {
    if (SKIP_EXPORT_KINDS.has(message.kind)) return false;
    if (message.id.startsWith('__streaming_')) return false;
    return true;
  });
}

const EMBEDDED_DATA_URL_PATTERN = /data:[a-z0-9.+/-]+(?:;(?!base64\b)[a-z0-9.+_-]+(?:=[^;,\s]*)?)*;base64\s*,[a-z0-9+/_=-]*(?:(?:\r?\n|[ \t]+)[a-z0-9+/_=-]+)*/gi;
const SECRET_REDACTION_PLACEHOLDER = '[redacted]';
const BASE64_REDACTION_PLACEHOLDER = '[base64-redacted]';

function stripEmbeddedDataPayloads(value: string): string {
  return String(value ?? '')
    .replace(EMBEDDED_DATA_URL_PATTERN, '[embedded-data-redacted]')
    .replace(/[A-Za-z0-9+/]{1024,}={0,2}/g, BASE64_REDACTION_PLACEHOLDER);
}

function isLikelyStandaloneBase64(value: string): boolean {
  const compact = String(value ?? '').replace(/\s+/g, '');
  if (
    compact.length < 4
    || compact.length % 4 === 1
    || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(compact)
  ) {
    return false;
  }
  try {
    const standard = compact
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .replace(/=+$/, '');
    const decoded = atob(standard.padEnd(Math.ceil(standard.length / 4) * 4, '='));
    const printable = Array.from(decoded).every((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126);
    });
    return compact.endsWith('=') || printable || compact.length >= 64;
  } catch {
    return false;
  }
}

function stripToolEmbeddedPayloads(value: string): string {
  const stripped = stripEmbeddedDataPayloads(value);
  if (isLikelyStandaloneBase64(stripped.trim())) return BASE64_REDACTION_PLACEHOLDER;
  const withoutLabeledPayloads = stripped.replace(
    /((?:base64|attachment(?:body|data)?|payload|content|body|bytes|image)\s*["']?\s*[:=]\s*["']?)([A-Za-z0-9+/_-]{2,}={0,2}(?:(?:\r?\n|[ \t]+)[A-Za-z0-9+/_-]{2,}={0,2})*)/gi,
    (match, prefix: string, candidate: string) => {
      const chunkPattern = /[A-Za-z0-9+/_-]{2,}={0,2}/g;
      let chunkMatch = chunkPattern.exec(candidate);
      while (chunkMatch) {
        const consumedEnd = chunkMatch.index + chunkMatch[0].length;
        if (isLikelyStandaloneBase64(candidate.slice(0, consumedEnd))) {
          return `${prefix}${BASE64_REDACTION_PLACEHOLDER}${candidate.slice(consumedEnd)}`;
        }
        chunkMatch = chunkPattern.exec(candidate);
      }
      return match;
    },
  );
  return withoutLabeledPayloads.replace(
    /(?<![A-Za-z0-9+/_-])([A-Za-z0-9+/_-]{4,}={0,2})(?![A-Za-z0-9+/_=-])/g,
    (candidate) => (
      isLikelyStandaloneBase64(candidate)
        ? BASE64_REDACTION_PLACEHOLDER
        : candidate
    ),
  );
}

function sanitizeUnknownExportPayload(
  value: unknown,
  seen: WeakMap<object, unknown>,
  mode: ExportSnapshotMode,
  depth = 0,
): unknown {
  if (typeof value === 'string') {
    return stripToolEmbeddedPayloads(sanitizeSessionExportHtml(value, mode));
  }
  if (!value || typeof value !== 'object') return value;
  if (depth > 64) return '[export-value-truncated]';
  const cached = seen.get(value);
  if (cached !== undefined) return cached;
  if (Array.isArray(value)) {
    const output: unknown[] = [];
    seen.set(value, output);
    for (const item of value) {
      output.push(sanitizeUnknownExportPayload(item, seen, mode, depth + 1));
    }
    return output;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  const output: Record<string, unknown> = {};
  seen.set(value, output);
  for (const [key, nested] of Object.entries(value)) {
    output[key] = sanitizeUnknownExportPayload(nested, seen, mode, depth + 1);
  }
  return output;
}

function sanitizeMessageExportPayload(
  message: NormalizedMessage,
  mode: ExportSnapshotMode,
): NormalizedMessage {
  const seen = new WeakMap<object, unknown>();
  const isToolPayload = message.kind === 'tool_result' || message.kind === 'tool_use';
  const sanitizeText = (value: string) => (
    sanitizeSessionExportHtml(value, mode)
  );
  const sanitizeToolText = (value: string) => (
    stripToolEmbeddedPayloads(sanitizeSessionExportHtml(value, mode))
  );
  const sanitizePrimaryText = isToolPayload ? sanitizeToolText : sanitizeText;
  return {
    ...message,
    ...(typeof message.content === 'string'
      ? { content: sanitizePrimaryText(message.content) }
      : {}),
    ...(typeof message.text === 'string'
      ? { text: sanitizePrimaryText(message.text) }
      : {}),
    ...(typeof message.summary === 'string'
      ? { summary: sanitizeText(message.summary) }
      : {}),
    ...(typeof message.detail === 'string'
      ? { detail: sanitizeText(message.detail) }
      : {}),
    ...(typeof message.title === 'string'
      ? { title: sanitizeText(message.title) }
      : {}),
    ...(typeof message.taskResult === 'string'
      ? { taskResult: sanitizeText(message.taskResult) }
      : {}),
    ...(typeof message.outputFile === 'string'
      ? { outputFile: sanitizeText(message.outputFile) }
      : {}),
    ...(message.toolInput !== undefined
      ? { toolInput: sanitizeUnknownExportPayload(message.toolInput, seen, mode) }
      : {}),
    ...(message.input !== undefined
      ? { input: sanitizeUnknownExportPayload(message.input, seen, mode) }
      : {}),
    ...(message.toolResult
      ? {
        toolResult: {
          ...message.toolResult,
          content: sanitizeToolText(message.toolResult.content),
          toolUseResult: sanitizeUnknownExportPayload(
            message.toolResult.toolUseResult,
            seen,
            mode,
          ),
        },
      }
      : {}),
    ...(Array.isArray(message.images)
      ? { images: message.images.map((image) => sanitizePrimaryText(image)) }
      : {}),
    ...(Array.isArray(message.toolResultImages)
      ? {
        toolResultImages: message.toolResultImages.map((image) => ({
          ...image,
          data: sanitizeToolText(image.data),
          ...(image.name ? { name: sanitizeText(image.name) } : {}),
        })),
      }
      : {}),
    ...(Array.isArray(message.attachments)
      ? {
        attachments: message.attachments.map((attachment) => ({
          ...attachment,
          name: sanitizeText(attachment.name),
          ...(attachment.path
            ? { path: sanitizeText(attachment.path) }
            : {}),
        })),
      }
      : {}),
  };
}

function addBoundedUtf8Bytes(
  value: string,
  state: { bytes: number; limit: number; exceeded: boolean },
): void {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0x26) state.bytes += 5;
    else if (code === 0x3c || code === 0x3e) state.bytes += 4;
    else if (code === 0x22) state.bytes += 6;
    else if (code === 0x27) state.bytes += 5;
    else if (code <= 0x7f) state.bytes += 1;
    else if (code <= 0x7ff) state.bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        state.bytes += 4;
        index += 1;
      } else {
        state.bytes += 3;
      }
    } else {
      state.bytes += 3;
    }
    if (state.bytes >= state.limit) {
      state.exceeded = true;
      return;
    }
  }
}

function addFixedExportBytes(
  amount: number,
  state: { bytes: number; limit: number; exceeded: boolean },
): void {
  state.bytes += amount;
  if (state.bytes >= state.limit) state.exceeded = true;
}

function measureExportPayloadValue(
  value: unknown,
  state: { bytes: number; limit: number; exceeded: boolean },
  ancestors: Set<object>,
  depth = 0,
): void {
  if (state.exceeded) return;
  if (typeof value === 'string') {
    addBoundedUtf8Bytes(value, state);
    return;
  }
  if (value == null) {
    addFixedExportBytes(4, state);
    return;
  }
  if (typeof value !== 'object') {
    addBoundedUtf8Bytes(String(value), state);
    return;
  }
  if (depth > 64 || ancestors.has(value)) {
    state.exceeded = true;
    return;
  }
  ancestors.add(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      addFixedExportBytes(2, state);
      if (state.exceeded) break;
      measureExportPayloadValue(item, state, ancestors, depth + 1);
      if (state.exceeded) break;
    }
  } else {
    for (const key of Object.keys(value)) {
      addFixedExportBytes(4, state);
      if (state.exceeded) break;
      addBoundedUtf8Bytes(key, state);
      if (state.exceeded) break;
      measureExportPayloadValue(
        (value as Record<string, unknown>)[key],
        state,
        ancestors,
        depth + 1,
      );
      if (state.exceeded) break;
    }
  }
  ancestors.delete(value);
}

function measureExportInputBytes(
  input: Pick<SessionExportInput, 'title' | 'projectName' | 'sessionId'>,
  messages: NormalizedMessage[],
  limit: number,
): { bytes: number; exceeded: boolean } {
  const state = { bytes: 0, limit, exceeded: false };
  const ancestors = new Set<object>();
  for (const value of [input.title, input.projectName, input.sessionId, messages]) {
    measureExportPayloadValue(value, state, ancestors);
    if (state.exceeded) break;
  }
  return { bytes: state.bytes, exceeded: state.exceeded };
}

function resolveExportMaxBytes(mode: ExportSnapshotMode, requested?: number): number {
  const hardLimit = mode === 'diagnostic'
    ? DIAGNOSTIC_EXPORT_MAX_BYTES
    : USER_ARCHIVE_EXPORT_MAX_BYTES;
  if (!Number.isFinite(requested) || Number(requested) <= 0) return hardLimit;
  return Math.min(hardLimit, Math.floor(Number(requested)));
}

function resolveExportInputBudget(maxBytes: number): number {
  const reserve = Math.min(
    EXPORT_HTML_TEMPLATE_RESERVE_BYTES,
    Math.max(256, Math.floor(maxBytes * 0.1)),
  );
  return Math.max(1, maxBytes - reserve);
}

function collectLatestVerifiedPaths(messages: NormalizedMessage[]): string[] {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    const nested = message.turnAcceptanceMeta as { verifiedPaths?: string[] } | undefined;
    const verified = Array.isArray(message.verifiedDeliverablePaths)
      ? message.verifiedDeliverablePaths.filter((p): p is string => typeof p === 'string')
      : Array.isArray(nested?.verifiedPaths)
        ? nested!.verifiedPaths.filter((p): p is string => typeof p === 'string')
        : [];
    if (verified.length > 0) return verified;
  }
  return [];
}

function resolveExportTaskKind(
  messages: NormalizedMessage[],
  sessionManifest: ReturnType<typeof resolveCurrentSessionManifest>,
): 'chat' | 'deliverable' {
  const activeSlots = sessionManifest?.slots?.filter((slot) => slot.status !== 'removed') ?? [];
  if (activeSlots.length > 0) return 'deliverable';
  for (const message of messages) {
    if (message.kind !== 'text' || message.role !== 'user') continue;
    const goal = String(message.content ?? message.text ?? '').trim();
    if (goal && userGoalImpliesDeliverable(goal)) return 'deliverable';
    break;
  }
  return 'chat';
}

/** PD-SAAS-FORK: block sidebar export only while deliverable task is actively in-flight. */
export function shouldBlockSessionExportForValidation(input: {
  requireValidationSettled: boolean;
  taskKind: 'chat' | 'deliverable';
  executionStatus?: ProjectSession['executionStatus'];
  pipelineSettled: boolean;
}): boolean {
  if (!input.requireValidationSettled) return false;
  if (input.taskKind !== 'deliverable') return false;
  const executionInFlight = input.executionStatus === 'running'
    || input.executionStatus === 'queued';
  if (!executionInFlight) return false;
  return !input.pipelineSettled;
}

function isExportUseContractEnabled(): boolean {
  const flag = import.meta.env.VITE_EXPORT_USE_CONTRACT ?? import.meta.env.PILOTDECK_EXPORT_USE_CONTRACT;
  if (flag === '0' || flag === 'false') return false;
  return true;
}

function isExportActiveDeliverableRow(status: DeliverableSummaryRow['status']): boolean {
  return status !== 'hidden';
}

export function coSourceExportSessionHistory(
  messages: NormalizedMessage[],
  envelope: SessionHistoryDeliverableEnvelope,
) {
  return coSourceSessionHistoryDeliverableEnvelope(
    normalizedToChatMessages(messages),
    envelope,
  );
}

function tryBuildExportUnifiedView(
  messages: NormalizedMessage[],
  projectName: string,
  diskSnapshot?: {
    files?: TaskFolderSnapshotFile[];
    snapshotVersion?: number;
    snapshotComplete?: boolean;
    binding?: TaskFolderSnapshotBindingInput;
  },
  sessionHistoryEnvelope?: SessionHistoryDeliverableEnvelope,
): UnifiedDeliverableView | null {
  if (!isExportUseContractEnabled()) return null;
  try {
    const historyContext = resolveSessionHistoryDeliverableContext(
      normalizedToChatMessages(messages),
      sessionHistoryEnvelope ?? {},
    );
    const chatMessages = historyContext.messages;
    const detachedEnvelope = historyContext.detachedEnvelope;
    const snapshotComplete = diskSnapshot?.snapshotComplete === true;
    const acceptanceMeta = detachedEnvelope?.latestTurnAcceptanceMeta ?? undefined;
    const certificateUi = isDeliverableCertificateUiEnabled();
    const certificateResolution = resolveAcceptanceCertificateStateFromTurnMeta(acceptanceMeta);
    const hasValidCertificate = certificateResolution.state === 'valid_v1'
      || certificateResolution.state === 'valid_v2';
    const pipelineSettled = resolvePipelineValidationSettled({
      latestTurnAcceptanceMeta: acceptanceMeta,
      diskSnapshotComplete: snapshotComplete,
      settledAcceptanceAuthority: isDeliverableSettledAcceptanceAuthorityEnabled(),
      certificateUiEnabled: certificateUi,
      certificateComplete: certificateResolution.state === 'valid_v2'
        ? certificateResolution.certificate.complete === true
        : hasValidCertificate,
      certificateEnforce: isDeliverableCertificateEnforceEnabled(),
    });
    return buildUnifiedDeliverableView({
      messages: chatMessages,
      projectRoot: projectName,
      sessionManifest: detachedEnvelope?.sessionDeliverableManifest ?? undefined,
      sessionTaskDirectory: detachedEnvelope?.sessionTaskDirectory,
      latestTurnAcceptanceMeta: acceptanceMeta,
      validationSettled: pipelineSettled,
      diskSnapshot: diskSnapshot?.files,
      diskSnapshotVersion: diskSnapshot?.snapshotVersion,
      diskSnapshotComplete: snapshotComplete,
      diskSnapshotBinding: diskSnapshot?.binding,
    });
  } catch {
    return null;
  }
}

function resolveExportFourLineDebug(
  input: SessionExportInput,
  view: UnifiedDeliverableView | null,
): SessionExportFourLineDebug {
  const historyContext = resolveSessionHistoryDeliverableContext(
    normalizedToChatMessages(input.messages),
    input.sessionHistoryEnvelope ?? {},
  );
  const chatMessages = historyContext.messages;
  const detachedEnvelope = historyContext.detachedEnvelope;
  const sessionTaskDirectory = resolveCurrentSessionTaskDirectory(chatMessages)
    ?? detachedEnvelope?.sessionTaskDirectory;
  const sessionManifest = resolveCurrentSessionManifest(chatMessages)
    ?? detachedEnvelope?.sessionDeliverableManifest
    ?? undefined;
  const contractScopeDir = resolveContractScopeDir({
    messages: chatMessages,
    sessionTaskDirectory,
    sessionManifest,
  });
  const taskArtifactDir = sessionTaskDirectory?.taskArtifactDir?.replace(/\\/g, '/').replace(/\/+$/, '') ?? null;
  const scopeDir = view?.scopeDir
    ?? contractScopeDir
    ?? taskArtifactDir
    ?? null;

  const projectApiName = input.projectApiName ?? input.projectName;

  return {
    sessionId: input.sessionId,
    projectName: input.projectName,
    projectApiName,
    exportOrigin: input.exportOrigin ?? null,
    workspaceUuid: input.workspaceUuid ?? null,
    taskDirKey: sessionTaskDirectory?.taskDirKey ?? null,
    taskArtifactDir,
    scopeDir,
    folderPath: view?.folderPath ?? scopeDir,
    contractHash: view?.contractHash ?? null,
    taskFolderSnapshotUrl: scopeDir
      ? buildTaskFolderSnapshotUrl(projectApiName, scopeDir)
      : null,
  };
}

function renderCodeCell(value: string | null | undefined, fallback = '—'): string {
  if (!value || !String(value).trim()) return escapeHtml(fallback);
  return `<code>${escapeHtml(String(value))}</code>`;
}

function renderExportDebugIdsSection(debug: SessionExportFourLineDebug): string {
  const rows: Array<[string, string | null | undefined]> = [
    ['会话 ID', debug.sessionId],
    ['项目（展示名）', debug.projectName],
    ['项目 API 名', debug.projectApiName],
    ['导出 Origin', debug.exportOrigin],
    ['工作区 UUID', debug.workspaceUuid],
    ['任务文件夹 ID (taskDirKey)', debug.taskDirKey],
    ['STDA 目录 (taskArtifactDir)', debug.taskArtifactDir],
    ['四线 scopeDir', debug.scopeDir],
    ['文件夹路径 (folderPath)', debug.folderPath],
    ['contractHash', debug.contractHash],
    ['task-folder-snapshot API', debug.taskFolderSnapshotUrl],
  ];

  const body = rows.map(([label, value]) => (
    `<tr><th>${escapeHtml(label)}</th><td>${renderCodeCell(value)}</td></tr>`
  )).join('');

  return `
<section class="export-debug-ids" data-testid="export-debug-ids">
  <h2>排查标识（四线统一）</h2>
  <p class="section-note">技术排查字段；完整访问 URL 见底部 JSON manifest 的 access 对象（非用户界面可见内容）。</p>
  <table class="debug-kv-table">
    <tbody>${body}</tbody>
  </table>
</section>`;
}

function renderDeliverableFourLineSection(
  view: UnifiedDeliverableView | null,
  messages: NormalizedMessage[],
  snapshotEnvelope?: ExportSnapshotEnvelope,
): string {
  if (view) {
    const rawRows = view.rows.filter((row) => isExportActiveDeliverableRow(row.status));
    if (rawRows.length === 0) return '';

    const presentationMode = snapshotEnvelope?.isTerminalSnapshot ? 'terminal' : 'turn_snapshot';
    const rows = isTerminalDeliverablePresentationEnabled()
      ? presentConversationDeliverableRows(rawRows, presentationMode)
      : rawRows;
    assertDeliverableContextInvariants(rows, presentationMode, {
      contextLabel: 'export-four-line-section',
    });
    const progress = normalizeConversationSummaryProgress(rows);

    const body = rows.map((row) => {
      const path = row.resolvedPath || row.path || '';
      const kind = classifyDeliverablePath(path);
      const label = row.label || path.split('/').pop() || row.id;
      return renderExportUiDeliverableRowHtml({
        label,
        typeLabel: formatDeliverableFileTypeLabel(path, kind),
        status: row.status,
        statusLabel: exportUiStatusLabel(row.status),
        path,
        kind,
      });
    }).join('');

    const heading = snapshotEnvelope
      ? snapshotEnvelope.isTerminalSnapshot
        ? '成果清单（终态成果清单 · 与 UI 同源）'
        : '成果清单（进行中快照 · 非终态 · 与 UI 同源）'
      : '成果清单（终态成果清单 · 与 UI 同源）';

    return `
<section class="deliverable-summary-export" data-testid="deliverable-summary-table" data-contract-hash="${escapeHtml(view.contractHash)}" data-progress-done="${progress.done}" data-progress-total="${progress.total}">
  <h2>${heading}</h2>
  <p class="section-note">列与对话内成果清单一致；有超链则导出超链，无超链则纯文本（不注入 API URL）。</p>
  <div class="table-scroll">
    <table class="ui-deliverable-table">
      <thead>
        ${EXPORT_UI_DELIVERABLE_TABLE_HEAD}
      </thead>
      <tbody>${body}</tbody>
    </table>
  </div>
</section>`;
  }

  return renderLegacyDeliverableSummaryExportSection(messages);
}

type FolderExportRow = {
  path: string;
  basename: string;
  source: 'disk' | 'transcript';
  inContract?: boolean;
  slotId?: string;
  isProcessFile?: boolean;
};

function collectFolderExportRows(
  diskSnapshot: TaskFolderSnapshotFile[] | undefined,
  view: UnifiedDeliverableView | null,
): FolderExportRow[] {
  const byPath = new Map<string, FolderExportRow>();

  for (const file of diskSnapshot ?? []) {
    const path = file.path.replace(/\\/g, '/');
    byPath.set(path.toLowerCase(), {
      path,
      basename: file.basename || path.split('/').pop() || path,
      source: 'disk',
      inContract: file.inContract,
      slotId: file.slotId,
      isProcessFile: file.isProcessFile,
    });
  }

  for (const item of view?.folderItems ?? []) {
    const path = (item.resolvedPath || item.apiPath || item.path || '').replace(/\\/g, '/');
    if (!path) continue;
    const key = path.toLowerCase();
    if (byPath.has(key)) continue;
    byPath.set(key, {
      path,
      basename: path.split('/').pop() || path,
      source: 'transcript',
    });
  }

  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path, 'zh-CN'));
}

function renderFolderContentSection(
  diskSnapshot: TaskFolderSnapshotFile[] | undefined,
  view: UnifiedDeliverableView | null,
  scopeDir: string | null,
): string {
  const rows = collectFolderExportRows(diskSnapshot, view);
  if (rows.length === 0 && !scopeDir) return '';

  const body = rows.length > 0
    ? rows.map((row, index) => `<tr>
      <td>${index + 1}</td>
      <td><code>${escapeHtml(row.path)}</code></td>
      <td>${escapeHtml(row.basename)}</td>
      <td>${row.source === 'disk' ? '磁盘' : '对话'}</td>
      <td>${row.inContract === true ? '是' : row.inContract === false ? '否' : '—'}</td>
      <td>${row.slotId ? `<code>${escapeHtml(row.slotId)}</code>` : '—'}</td>
      <td>${row.isProcessFile ? '是' : '—'}</td>
    </tr>`).join('')
    : `<tr><td colspan="7" class="empty-cell">scopeDir 下暂无索引文件（${scopeDir ? escapeHtml(scopeDir) : '未解析 scopeDir'}）</td></tr>`;

  return `
<section class="folder-content-export" data-testid="folder-content-table">
  <h2>文件夹内容清单</h2>
  <p class="section-note">路径索引；访问 URL 见 JSON manifest（非用户界面可见）。</p>
  <div class="table-scroll">
    <table>
      <thead>
        <tr>
          <th>#</th><th>路径</th><th>文件名</th><th>来源</th>
          <th>在契约内</th><th>槽位 ID</th><th>过程文件</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  </div>
</section>`;
}

function renderFourLineDebugBlock(
  input: SessionExportInput,
  view: UnifiedDeliverableView | null,
  debug: SessionExportFourLineDebug,
): string {
  const scopeDir = debug.scopeDir ?? null;
  const deliverableSection = renderDeliverableFourLineSection(
    view,
    input.messages,
    input.snapshotEnvelope ?? input.semanticSnapshotEnvelope,
  );
  const folderSection = renderFolderContentSection(input.diskSnapshot, view, scopeDir);
  if (!deliverableSection && !folderSection && !debug.taskDirKey && !debug.scopeDir) {
    return '';
  }

  return `
<section class="export-four-line-debug" data-testid="export-four-line-debug">
  ${renderExportDebugIdsSection(debug)}
  ${deliverableSection}
  ${folderSection}
</section>`;
}

function buildFourLineManifestPayload(
  debug: SessionExportFourLineDebug,
  view: UnifiedDeliverableView | null,
  diskSnapshot: TaskFolderSnapshotFile[] | undefined,
  accessMap: Map<string, ExportDeliverableAccess>,
) {
  const scopeDir = debug.scopeDir ?? null;
  const deliverables = (view?.rows ?? [])
    .filter((row) => isExportActiveDeliverableRow(row.status))
    .map((row) => {
      const lookupPath = row.resolvedPath ?? row.apiPath ?? row.path ?? '';
      const access = accessMap.get(exportAccessMapKey(lookupPath, scopeDir))
        ?? accessMap.get(exportAccessMapKey(row.path, scopeDir));
      return {
        id: row.id,
        label: row.label,
        path: row.path,
        resolvedPath: row.resolvedPath ?? row.apiPath ?? null,
        status: row.status,
        linkable: row.linkable,
        previewable: row.previewable,
        stageId: row.stageId ?? null,
        access: serializeExportAccess(access),
      };
    });

  const folderFiles = collectFolderExportRows(diskSnapshot, view).map((row) => {
    const access = accessMap.get(exportAccessMapKey(row.path, scopeDir));
    return {
      ...row,
      access: serializeExportAccess(access),
    };
  });

  const taskFolderSnapshotAbsoluteUrl = debug.taskFolderSnapshotUrl && debug.exportOrigin
    ? `${debug.exportOrigin.replace(/\/+$/, '')}${debug.taskFolderSnapshotUrl}`
    : debug.taskFolderSnapshotUrl ?? null;

  return {
    fourLineDebug: {
      ...debug,
      taskFolderSnapshotAbsoluteUrl,
    },
    deliverables,
    folderFiles,
  };
}

function renderLegacyDeliverableSummaryExportSection(
  messages: NormalizedMessage[],
): string {
  const verified = collectLatestVerifiedPaths(messages);
  if (verified.length === 0) return '';
  const body = verified.map((filePath) => {
    const kind = classifyDeliverablePath(filePath);
    const name = filePath.split('/').pop() ?? filePath;
    return renderExportUiDeliverableRowHtml({
      label: name,
      typeLabel: formatDeliverableFileTypeLabel(filePath, kind),
      status: 'delivered',
      statusLabel: exportUiStatusLabel('delivered'),
      path: filePath,
      kind,
    });
  }).join('');
  return `
<section class="deliverable-summary-export" data-testid="deliverable-summary-table">
  <h2>成果清单</h2>
  <div class="table-scroll">
    <table class="ui-deliverable-table">
      <thead>
        ${EXPORT_UI_DELIVERABLE_TABLE_HEAD}
      </thead>
      <tbody>${body}</tbody>
    </table>
  </div>
</section>`;
}

function preserveRelativeArtifactPath(value: string): string {
  const normalized = value.replace(/\\/g, '/');
  const markerIndex = normalized.toLowerCase().indexOf('/artifacts/');
  if (markerIndex >= 0) return normalized.slice(markerIndex + 1);
  return '[local-path-redacted]';
}

const SENSITIVE_EXPORT_KEY_PATTERN = [
  'password',
  'passwd',
  'pwd',
  'aws_secret_access_key',
  'secret_key',
  'private_key',
  'client[_-]?secret',
  'database[_-]?url',
  'redis[_-]?url',
  'cookie',
  'set[_-]?cookie',
  'connect\\.sid',
  'session(?:[_-]?(?:cookie|token))?',
  'jwt',
  'access[_-]?token',
  'refresh[_-]?token',
  'api[_-]?key',
  'authorization',
  'token',
  'secret',
  '(?:[a-z0-9]+[_-])+(?:api[_-]?key|secret|token|password|passwd|pwd)',
].join('|');
const HIGH_CONFIDENCE_NAKED_TOKEN_PATTERN = /(?<![A-Za-z0-9_-])(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|sk_live_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|hf_[A-Za-z0-9]{30,}|glpat-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{30,}|AKIA[A-Z0-9]{16})(?![A-Za-z0-9_-])/g;

function replaceSensitiveKeyValues(
  value: string,
  keyPattern: string,
  flags: string,
): string {
  const keyPrefix = `((?:&quot;|&#39;|["'])?${keyPattern}(?:&quot;|&#39;|["'])?\\s*[:=]\\s*)`;
  const quotedValue = new RegExp(
    `${keyPrefix}(?:&quot;[\\s\\S]*?&quot;|&#39;[\\s\\S]*?&#39;|"[^"\\r\\n]*"|'[^'\\r\\n]*')`,
    flags,
  );
  const unquotedValue = new RegExp(
    `${keyPrefix}(?!&quot;|&#39;|["'])[^<>&,;\\r\\n]+`,
    flags,
  );
  return value
    .replace(quotedValue, (match, prefix: string) => {
      const suffix = String(match).slice(String(prefix).length);
      if (suffix.startsWith('&quot;')) {
        return `${prefix}&quot;${SECRET_REDACTION_PLACEHOLDER}&quot;`;
      }
      if (suffix.startsWith('&#39;')) {
        return `${prefix}&#39;${SECRET_REDACTION_PLACEHOLDER}&#39;`;
      }
      const quote = suffix[0] === '"' || suffix[0] === "'" ? suffix[0] : '';
      return quote
        ? `${prefix}${quote}${SECRET_REDACTION_PLACEHOLDER}${quote}`
        : `${prefix}${SECRET_REDACTION_PLACEHOLDER}`;
    })
    .replace(unquotedValue, (_match, prefix) => `${prefix}${SECRET_REDACTION_PLACEHOLDER}`);
}

function scrubSensitiveKeyValues(value: string): string {
  const commonScrubbed = replaceSensitiveKeyValues(
    value,
    `\\b(?:${SENSITIVE_EXPORT_KEY_PATTERN})\\b`,
    'gi',
  );
  return replaceSensitiveKeyValues(
    commonScrubbed,
    '(?<!data-)\\b(?:session_id|session-id|sessionid)\\b',
    'g',
  );
}

function scrubPlainExportSecrets(value: string): string {
  const withoutPrivateKeys = String(value ?? '').replace(
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gi,
    SECRET_REDACTION_PLACEHOLDER,
  );
  const withoutCookieHeaders = withoutPrivateKeys.replace(
    /\b((?:Set-Cookie|Cookie)\s*:\s*)[^<\r\n]*/gi,
    (_match, prefix: string) => `${prefix}${SECRET_REDACTION_PLACEHOLDER}`,
  );
  const withoutAuthTokens = withoutCookieHeaders
    .replace(/\bBearer\s+[^\s<>&"']+/gi, `Bearer ${SECRET_REDACTION_PLACEHOLDER}`)
    .replace(/\bBasic\s+[^\s<>&"']+/gi, `Basic ${SECRET_REDACTION_PLACEHOLDER}`)
    .replace(HIGH_CONFIDENCE_NAKED_TOKEN_PATTERN, SECRET_REDACTION_PLACEHOLDER)
    .replace(
      /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}(?![A-Za-z0-9_-])/g,
      SECRET_REDACTION_PLACEHOLDER,
    )
    .replace(
      /\b([a-z][a-z0-9+.-]*:\/\/)[^/\s:@<>"']*:[^@\s/<>"']+@/gi,
      `$1${SECRET_REDACTION_PLACEHOLDER}@`,
    );
  return scrubSensitiveKeyValues(withoutAuthTokens);
}

function decodePercentEncodedToken(value: string): string {
  let decoded = value;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded.replace(/\+/g, '%20'));
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

function scrubPercentEncodedSecrets(value: string): string {
  return value.replace(
    /[^\s<>"'&]*%[0-9a-f]{2}[^\s<>"'&]*/gi,
    (token) => {
      const decoded = decodePercentEncodedToken(token);
      return scrubPlainExportSecrets(decoded) === decoded
        ? token
        : SECRET_REDACTION_PLACEHOLDER;
    },
  );
}

function scrubExportSecrets(html: string): string {
  return stripEmbeddedDataPayloads(
    scrubPercentEncodedSecrets(scrubPlainExportSecrets(String(html ?? ''))),
  );
}

function scrubUserArchiveIdentifiers(html: string): string {
  const artifactPaths: string[] = [];
  const protectedHtml = html.replace(
    /\bartifacts(?:\/|\\|%2F)[^\s<>"'&]+/gi,
    (value) => {
      const index = artifactPaths.push(value) - 1;
      return `__NOVA_EXPORT_ARTIFACT_${index}__`;
    },
  );
  const scrubbed = protectedHtml
    .replace(/(?<![-\w])tenant[-:][a-z0-9][a-z0-9_-]*\b/gi, '[tenant-redacted]')
    .replace(/(?<![-\w])user[-:][a-z0-9][a-z0-9_-]*\b/gi, '[user-redacted]')
    .replace(
      /(\b(?:tenantId|userId|tenant_id|user_id)\b(?:&quot;|&#39;|["'])?\s*[:=]\s*(?:&quot;|&#39;|["'])?)[^\s<>&"']+/gi,
      '$1[redacted]',
    );
  return scrubbed.replace(
    /__NOVA_EXPORT_ARTIFACT_(\d+)__/g,
    (_match, index) => artifactPaths[Number(index)] ?? '',
  );
}

function redactUserArchiveLocalPaths(html: string): string {
  const withoutEncodedLocalReferences = html.replace(
    /[^\s<>"'&]*%[0-9a-f]{2}[^\s<>"'&]*/gi,
    (token) => {
      const decoded = decodePercentEncodedToken(token);
      const isLocalUrl = /(?:https?|wss?):\/\/(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?/i.test(decoded);
      const hasWindowsPath = /(?:^|[\s(:=[{"'])(?:[A-Za-z]:[\\/]|\\\\)/.test(decoded);
      const hasUncPath = /(?:^|[\s(:=[{"'])\/\/[^./\s]+[\\/]/.test(decoded);
      const hasUnixPath = /(?:^|[\s(:=[{"'])\/(?!\/|artifacts(?:\/|$))[^\s]/i.test(decoded);
      if (!isLocalUrl && !hasWindowsPath && !hasUncPath && !hasUnixPath) return token;
      if (!isLocalUrl && /[\\/]artifacts[\\/]/i.test(decoded)) {
        return preserveRelativeArtifactPath(decoded);
      }
      return isLocalUrl ? '[local-url-redacted]' : '[local-path-redacted]';
    },
  );
  return withoutEncodedLocalReferences
    .replace(
      /(?:https?|wss?):\/\/(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?[^\s<>"']*/gi,
      '[local-url-redacted]',
    )
    .replace(
      /(?<![A-Za-z0-9])[A-Za-z]:[\\/][^<>"'&\r\n]+/g,
      (value) => preserveRelativeArtifactPath(value),
    )
    .replace(
      /(?<!\\)\\\\[^\\/<>"'&\r\n]+[\\/][^<>"'&\r\n]+/g,
      (value) => preserveRelativeArtifactPath(value),
    )
    .replace(
      /(?<!:)\/\/[^./\s<>"'&]+\/[^<>"'&\r\n]+/g,
      (value) => preserveRelativeArtifactPath(value),
    )
    .replace(
      /(^|[\s(:=[{>"']|&quot;|&#39;)(\/(?!\/|artifacts(?:\/|$))[^<>"'&\r\n]+)/gim,
      (_match, prefix, value) => `${prefix}${preserveRelativeArtifactPath(value)}`,
    );
}

/** PD-SAAS-FORK: final HTML gate; diagnostic keeps relative debug fields but never secrets. */
export function sanitizeSessionExportHtml(
  html: string,
  mode: ExportSnapshotMode,
): string {
  const secretsScrubbed = scrubExportSecrets(String(html ?? ''));
  if (mode === 'diagnostic') return secretsScrubbed;

  const withoutLocalRoots = redactUserArchiveLocalPaths(secretsScrubbed);
  return scrubUserArchiveIdentifiers(withoutLocalRoots);
}

type FinalizeSessionExportHtmlInput = {
  html: string;
  mode: ExportSnapshotMode;
  maxBytes?: number;
  title: string;
  projectName: string;
  sessionId: string;
  messageCount: number;
  snapshotEnvelope?: ExportSnapshotEnvelope;
  truncationReason?: ExportSnapshotTruncationReason;
};

function boundedSummaryValue(value: string): string {
  return String(value ?? '').slice(0, 240);
}

function buildTruncatedExportSummary(
  input: FinalizeSessionExportHtmlInput,
  originalBytes: number,
  maxBytes: number,
): string {
  const manifestJson = escapeHtml(JSON.stringify({
    exportMode: input.mode,
    truncated: true,
    truncationReason: input.truncationReason ?? 'export_size_limit',
    originalBytes,
    maxBytes,
    title: boundedSummaryValue(input.title),
    projectName: boundedSummaryValue(input.projectName),
    sessionId: boundedSummaryValue(input.sessionId),
    messageCount: input.messageCount,
    snapshotEnvelope: input.snapshotEnvelope ?? null,
  }, null, 2));

  return `<!DOCTYPE html>
<html lang="zh-CN" data-export-mode="${escapeHtml(input.mode)}" data-truncated="true">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(boundedSummaryValue(input.title))} · Nova Ai-Studio</title>
</head>
<body data-truncated="true">
  <main>
    <h1>${escapeHtml(boundedSummaryValue(input.title))}</h1>
    <p>导出内容超过大小上限，已生成脱敏摘要；truncated=true，原始大块内容与内嵌 base64 未写入。</p>
    <pre id="nova-session-export-index">${manifestJson}</pre>
  </main>
</body>
</html>`;
}

/** PD-SAAS-FORK: sanitize first, then replace oversized exports with an explicit safe summary. */
export function finalizeSessionExportHtml(input: FinalizeSessionExportHtmlInput): string {
  const sanitized = sanitizeSessionExportHtml(input.html, input.mode);
  const maxBytes = resolveExportMaxBytes(input.mode, input.maxBytes);
  const originalBytes = new TextEncoder().encode(input.html).byteLength;
  const sanitizedBytes = new TextEncoder().encode(sanitized).byteLength;
  if (originalBytes <= maxBytes && sanitizedBytes <= maxBytes) return sanitized;

  return sanitizeSessionExportHtml(
    buildTruncatedExportSummary(input, originalBytes, maxBytes),
    input.mode,
  );
}

export function buildSessionExportHtml(input: SessionExportInput): string {
  const exportedAt = input.exportedAt ?? new Date();
  const exportMode = input.exportMode ?? input.snapshotEnvelope?.mode ?? 'user_archive';
  const maxBytes = resolveExportMaxBytes(exportMode, input.maxExportBytes);
  const filteredSource = filterMessagesForExport(input.messages);
  const inputMeasurement = measureExportInputBytes(
    input,
    filteredSource,
    resolveExportInputBudget(maxBytes),
  );
  if (inputMeasurement.exceeded) {
    return sanitizeSessionExportHtml(
      buildTruncatedExportSummary({
        html: '',
        mode: exportMode,
        maxBytes,
        title: input.title,
        projectName: input.projectName,
        sessionId: input.sessionId,
        messageCount: filteredSource.length,
        snapshotEnvelope: input.snapshotEnvelope,
        truncationReason: 'input_budget',
      }, inputMeasurement.bytes, maxBytes),
      exportMode,
    );
  }
  const filtered = filteredSource.map((message) => (
    sanitizeMessageExportPayload(message, exportMode)
  ));
  const boundedInput: SessionExportInput = {
    ...input,
    messages: filtered,
  };
  const isDiagnosticExport = exportMode === 'diagnostic';
  const projectApiName = input.projectApiName ?? input.projectName;
  const unifiedView = input.prebuiltUnifiedView
    ?? tryBuildExportUnifiedView(filtered, projectApiName, {
      files: input.diskSnapshot,
      snapshotVersion: input.diskSnapshotVersion,
      snapshotComplete: input.diskSnapshotComplete,
      binding: input.diskSnapshotBinding,
    }, input.sessionHistoryEnvelope);
  const fourLineDebug = resolveExportFourLineDebug(boundedInput, unifiedView);
  const scopeDir = fourLineDebug.scopeDir ?? null;
  const accessMap = ensureExportAccessMap(boundedInput, unifiedView, scopeDir);
  const deliverableSummaryBlock = renderDeliverableFourLineSection(
    unifiedView,
    filtered,
    input.snapshotEnvelope ?? input.semanticSnapshotEnvelope,
  );
  const fourLineBlock = isDiagnosticExport
    ? renderFourLineDebugBlock(boundedInput, unifiedView, fourLineDebug)
    : (deliverableSummaryBlock
      ? `<section class="export-four-line-debug" data-testid="export-four-line-debug">${deliverableSummaryBlock}</section>`
      : '');
  const conversation = renderConversationMessages(
    filtered,
    input.labels,
    projectApiName,
    unifiedView,
    accessMap,
    scopeDir,
    { snapshotEnvelope: input.snapshotEnvelope ?? input.semanticSnapshotEnvelope },
  );
  const messageBlocksHtml = conversation.html;
  const indexRecords = buildExportIndexRecords(filtered, input.sessionId);
  const indexTable = isDiagnosticExport
    ? renderMessageIndexTable(filtered, input.sessionId, input.labels)
    : '';
  const fourLinePayload = isDiagnosticExport
    ? buildFourLineManifestPayload(fourLineDebug, unifiedView, input.diskSnapshot, accessMap)
    : { fourLineDebug: { sessionId: input.sessionId, scopeDir, contractHash: fourLineDebug.contractHash ?? null } };
  const manifestJson = escapeHtml(JSON.stringify({
    sessionId: input.sessionId,
    title: input.title,
    projectName: input.projectName,
    exportedAt: exportedAt.toISOString(),
    messageCount: filtered.length,
    exportMode,
    truncated: input.sourceTruncated || undefined,
    truncationReason: input.sourceTruncated
      ? input.sourceTruncationReason ?? 'message_budget'
      : undefined,
    snapshotEnvelope: input.snapshotEnvelope ?? null,
    messages: isDiagnosticExport ? indexRecords : undefined,
    turnDeliverableSnapshots: isDiagnosticExport ? conversation.turnSnapshots : undefined,
    ...fourLinePayload,
  }, null, 2));
  const bodyContent = messageBlocksHtml.trim()
    ? messageBlocksHtml
    : `<p class="empty">${escapeHtml(input.labels.noMessages)}</p>`;

  const title = escapeHtml(input.title);
  const project = escapeHtml(input.projectName);
  const sessionId = escapeHtml(input.sessionId);
  const exportedLabel = escapeHtml(input.labels.exportedAt);
  const exportedValue = escapeHtml(exportedAt.toLocaleString());
  const projectLabel = escapeHtml(input.labels.project);
  const sessionIdLabel = escapeHtml(input.labels.sessionId);
  const countLabel = escapeHtml(input.labels.messageCount);
  const countValue = escapeHtml(String(filtered.length));
  const debugManifestLabel = escapeHtml(input.labels.debugManifest);
  const rawSessionId = input.sessionId;
  const snapshotBanner = input.snapshotEnvelope
    ? `<p class="export-snapshot-banner" data-testid="export-snapshot-banner">${escapeHtml(renderExportSnapshotBanner(input.snapshotEnvelope))}</p>`
    : '';
  const sourceTruncationNotice = input.sourceTruncated
    ? `<p class="export-truncation-notice" data-testid="export-truncation-notice" data-truncated="true">较早消息已达到导出预算，未继续读取；truncated=true。</p>`
    : '';

  const rawHtml = `<!DOCTYPE html>
<!-- Nova Ai-Studio session export | sessionId=${escapeHtml(rawSessionId)} | mode=${escapeHtml(exportMode)} -->
<html lang="zh-CN" data-session-id="${sessionId}" data-export-mode="${escapeHtml(exportMode)}"${input.sourceTruncated ? ' data-truncated="true"' : ''}>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="nova-session-id" content="${sessionId}" />
  <meta name="nova-exported-at" content="${escapeHtml(exportedAt.toISOString())}" />
  <title>${title} · Nova Ai-Studio</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f4f5;
      --card: #ffffff;
      --text: #18181b;
      --muted: #71717a;
      --border: #e4e4e7;
      --user: #eff6ff;
      --assistant: #fafafa;
      --tool: #fff7ed;
      --tool-result: #f0fdf4;
      --thinking: #faf5ff;
      --error: #fef2f2;
      --system: #f8fafc;
      --accent: #6366f1;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 15px/1.65 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    .page {
      max-width: 920px;
      margin: 0 auto;
      padding: 32px 20px 64px;
    }
    .hero {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px 28px;
      margin-bottom: 24px;
      box-shadow: 0 1px 2px rgba(0,0,0,.04);
    }
    .hero h1 {
      margin: 0 0 8px;
      font-size: 28px;
      line-height: 1.25;
      letter-spacing: -0.02em;
    }
    .hero .brand {
      color: var(--accent);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px 16px;
      margin-top: 18px;
      font-size: 13px;
      color: var(--muted);
    }
    .meta-grid strong, .meta-grid code { color: var(--text); font-weight: 600; }
    .meta-grid code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
      word-break: break-all;
    }
    .debug-index {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 14px 16px 16px;
      margin-bottom: 20px;
    }
    .debug-index summary {
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
    }
    .debug-index-meta {
      margin: 10px 0 12px;
      font-size: 12px;
      color: var(--muted);
    }
    .debug-index table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .debug-index th, .debug-index td {
      border-bottom: 1px solid var(--border);
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    .debug-index code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      word-break: break-all;
    }
    .debug-manifest {
      margin-top: 24px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 14px 16px;
    }
    .debug-manifest summary {
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
    }
    .debug-manifest pre {
      margin: 12px 0 0;
      padding: 12px;
      overflow-x: auto;
      border-radius: 10px;
      background: #18181b;
      color: #f4f4f5;
      font-size: 11px;
      line-height: 1.5;
      white-space: pre;
    }
    .messages { display: grid; gap: 14px; }
    .message {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow: hidden;
    }
    .message-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px 12px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--border);
      background: rgba(255,255,255,.72);
      font-size: 12px;
    }
    .message-id-ref code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      color: var(--muted);
      word-break: break-all;
    }
    .message-debug {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 10px;
      padding: 8px 16px;
      border-bottom: 1px solid var(--border);
      background: #fafafa;
      font-size: 11px;
    }
    .debug-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .debug-label {
      color: var(--muted);
    }
    .debug-chip code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      background: #eef2ff;
      color: #3730a3;
      padding: 1px 6px;
      border-radius: 4px;
      word-break: break-all;
    }
    .role { font-weight: 700; letter-spacing: 0.02em; }
    time { color: var(--muted); white-space: nowrap; }
    .message-body { padding: 16px 18px 18px; }
    .role-user { background: var(--user); }
    .role-assistant { background: var(--assistant); }
    .role-tool, .role-tool-result { background: var(--tool); }
    .role-tool-result { background: var(--tool-result); }
    .role-thinking { background: var(--thinking); }
    .role-error { background: var(--error); }
    .role-activity, .role-system { background: var(--system); }
    .markdown-body p { margin: 0 0 0.85em; }
    .markdown-body p:last-child { margin-bottom: 0; }
    .markdown-body h1, .markdown-body h2, .markdown-body h3 {
      margin: 1.1em 0 0.55em;
      line-height: 1.3;
    }
    .markdown-body h1 { font-size: 1.35rem; }
    .markdown-body h2 { font-size: 1.15rem; }
    .markdown-body h3 { font-size: 1rem; }
    .markdown-body ul, .markdown-body ol { margin: 0 0 0.85em 1.2em; padding: 0; }
    .markdown-body a { color: var(--accent); }
    .markdown-body blockquote {
      margin: 0 0 0.85em;
      padding: 0.35em 0 0.35em 0.9em;
      border-left: 3px solid var(--border);
      color: var(--muted);
    }
    .markdown-body hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 1em 0;
    }
    .markdown-body table.md-table {
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 0.85em;
      font-size: 13px;
    }
    .markdown-body table.md-table th,
    .markdown-body table.md-table td {
      border: 1px solid var(--border);
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    .markdown-body table.md-table th {
      background: #fafafa;
      font-weight: 600;
    }
    .export-process-fold {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 10px 14px 12px;
    }
    .export-process-fold summary {
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      color: var(--muted);
    }
    .export-process-body {
      display: grid;
      gap: 10px;
      margin-top: 10px;
    }
    .export-process-body .message {
      border-radius: 10px;
      font-size: 13px;
    }
    .export-process-body .message-debug,
    .export-process-body .message-id-ref {
      display: none;
    }
    .inline-deliverable-summary {
      margin-top: 14px;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: #fafafa;
    }
    .inline-deliverable-title {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .ui-deliverable-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .ui-deliverable-table th,
    .ui-deliverable-table td {
      border-bottom: 1px solid var(--border);
      padding: 7px 8px;
      text-align: left;
      vertical-align: top;
    }
    .ui-deliverable-table th {
      font-size: 11px;
      color: var(--muted);
      font-weight: 600;
    }
    .status-delivered { color: #15803d; font-weight: 600; }
    .status-checking { color: #a16207; font-weight: 600; }
    .status-pending { color: #c2410c; font-weight: 600; }
    .export-file-link {
      color: var(--accent);
      text-decoration: underline;
      text-underline-offset: 2px;
      word-break: break-all;
    }
    .export-link-none {
      color: var(--muted);
      opacity: 0.5;
    }
    .inline-code, .code-block code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.92em;
    }
    .inline-code {
      background: #f4f4f5;
      padding: 0.1em 0.35em;
      border-radius: 4px;
    }
    .code-block {
      margin: 0;
      padding: 12px 14px;
      overflow-x: auto;
      border-radius: 10px;
      background: #18181b;
      color: #f4f4f5;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .code-block.is-error { background: #450a0a; color: #fecaca; }
    .attachments, .images { margin-top: 12px; }
    .attachments ul { margin: 6px 0 0 1.1em; padding: 0; }
    .meta { color: var(--muted); font-size: 12px; }
    .image img {
      display: block;
      max-width: 100%;
      height: auto;
      border-radius: 10px;
      border: 1px solid var(--border);
      margin-top: 8px;
    }
    .empty { color: var(--muted); text-align: center; padding: 24px; }
    .export-four-line-debug {
      display: grid;
      gap: 20px;
      margin-top: 28px;
    }
    .export-four-line-debug > section {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 18px 20px 20px;
    }
    .export-four-line-debug h2 {
      margin: 0 0 8px;
      font-size: 18px;
      line-height: 1.3;
    }
    .section-note {
      margin: 0 0 14px;
      font-size: 12px;
      color: var(--muted);
      line-height: 1.5;
    }
    .debug-kv-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .debug-kv-table th {
      width: 220px;
      text-align: left;
      vertical-align: top;
      padding: 8px 12px 8px 0;
      color: var(--muted);
      font-weight: 600;
    }
    .debug-kv-table td {
      padding: 8px 0;
      word-break: break-all;
    }
    .debug-kv-table code,
    .export-four-line-debug table code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      word-break: break-all;
    }
    .table-scroll {
      overflow-x: auto;
    }
    .export-four-line-debug table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .export-four-line-debug th,
    .export-four-line-debug td {
      border-bottom: 1px solid var(--border);
      padding: 7px 8px;
      text-align: left;
      vertical-align: top;
    }
    .export-four-line-debug th {
      color: var(--muted);
      font-weight: 600;
      white-space: nowrap;
    }
    .empty-cell {
      color: var(--muted);
      text-align: center;
      padding: 16px 8px !important;
    }
    @media print {
      body { background: #fff; }
      .page { max-width: none; padding: 0; }
      .hero, .message { box-shadow: none; break-inside: avoid; }
    }
  </style>
</head>
<body data-session-id="${sessionId}">
  <main class="page">
    <header class="hero">
      <div class="brand">Nova Ai-Studio</div>
      <h1>${title}</h1>
      <div class="meta-grid">
        <div><span>${projectLabel}：</span><strong>${project}</strong></div>
        <div><span>${sessionIdLabel}：</span><code>${sessionId}</code></div>
        <div><span>${countLabel}：</span><strong>${countValue}</strong></div>
        <div><span>${exportedLabel}：</span><strong>${exportedValue}</strong></div>
      </div>
    </header>
    ${snapshotBanner}
    ${sourceTruncationNotice}
    ${indexTable}
    <section class="messages">
      ${bodyContent}
    </section>
    ${fourLineBlock}
    <details class="debug-manifest"${isDiagnosticExport ? ' open' : ''}>
      <summary>${debugManifestLabel}</summary>
      <pre id="nova-session-export-index">${manifestJson}</pre>
    </details>
  </main>
</body>
</html>`;

  return finalizeSessionExportHtml({
    html: rawHtml,
    mode: exportMode,
    title: input.title,
    projectName: input.projectName,
    sessionId: input.sessionId,
    messageCount: filtered.length,
    snapshotEnvelope: input.snapshotEnvelope,
    maxBytes,
  });
}

export function buildSessionExportFilename(title: string, sessionId?: string): string {
  const slug = title
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50) || 'conversation';
  const idPart = (sessionId ?? '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .trim()
    .slice(0, 40);
  const date = new Date().toISOString().slice(0, 10);
  return idPart ? `${idPart}__${slug}-${date}.html` : `${slug}-${date}.html`;
}

export function downloadHtmlFile(filename: string, html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function fetchMessagesPage(
  sessionId: string,
  params: URLSearchParams,
): Promise<{
  messages: NormalizedMessage[];
  total: number;
  nextCursor?: string | null;
  offset?: number | null;
  latestTurnAcceptanceMeta?: Record<string, unknown>;
  sessionDeliverableManifest?: SessionDeliverableManifestUi;
  sessionTaskDirectory?: SessionHistoryDeliverableEnvelope['sessionTaskDirectory'];
}> {
  const qs = params.toString();
  const url = `/api/sessions/${encodeURIComponent(sessionId)}/messages${qs ? `?${qs}` : ''}`;
  // PD-SAAS-FORK: align export with session-open messages fetch — Bridge 503/429 is retryable.
  const { response } = await fetchWithBackoff(url, {
    signal: AbortSignal.timeout(EXPORT_SESSION_MESSAGES_FETCH_TIMEOUT_MS),
  }, EXPORT_MESSAGES_FETCH_BACKOFF);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  return {
    messages: data.messages ?? [],
    total: data.total ?? (data.messages?.length ?? 0),
    nextCursor: data.nextCursor ?? null,
    offset: typeof data.offset === 'number' ? data.offset : null,
    ...(data.latestTurnAcceptanceMeta && typeof data.latestTurnAcceptanceMeta === 'object'
      ? { latestTurnAcceptanceMeta: data.latestTurnAcceptanceMeta as Record<string, unknown> }
      : {}),
    ...(data.sessionDeliverableManifest && typeof data.sessionDeliverableManifest === 'object'
      ? { sessionDeliverableManifest: data.sessionDeliverableManifest as SessionDeliverableManifestUi }
      : {}),
    ...(data.sessionTaskDirectory && typeof data.sessionTaskDirectory === 'object'
      ? { sessionTaskDirectory: data.sessionTaskDirectory as SessionHistoryDeliverableEnvelope['sessionTaskDirectory'] }
      : {}),
  };
}

export type FetchSessionMessagesForExportInput = {
  sessionId: string;
  projectName: string;
  projectPath?: string;
  sessionKind?: string;
  parentSessionId?: string;
  relativeTranscriptPath?: string;
  mode?: ExportSnapshotMode;
  maxExportBytes?: number;
};

export type SessionExportMessageFetchResult = {
  messages: NormalizedMessage[];
  truncated: boolean;
  truncationReason?: 'message_budget';
  estimatedBytes: number;
  transcriptCursor: string | null;
  sourceOffset: number | null;
  latestTurnAcceptanceMeta?: Record<string, unknown>;
  sessionDeliverableManifest?: SessionDeliverableManifestUi;
  sessionTaskDirectory?: SessionHistoryDeliverableEnvelope['sessionTaskDirectory'];
};

function selectNewestPageMessagesWithinBudget(input: {
  messages: NormalizedMessage[];
  remainingBytes: number;
}): {
  messages: NormalizedMessage[];
  bytes: number;
  truncated: boolean;
} {
  const selectedNewestFirst: NormalizedMessage[] = [];
  let bytes = 0;
  let truncated = false;
  const exportable = filterMessagesForExport(input.messages);
  for (let index = exportable.length - 1; index >= 0; index -= 1) {
    const message = exportable[index]!;
    const state = {
      bytes: 0,
      limit: Math.max(1, input.remainingBytes - bytes),
      exceeded: input.remainingBytes - bytes <= 0,
    };
    addFixedExportBytes(2, state);
    if (!state.exceeded) {
      measureExportPayloadValue(
        message,
        state,
        new Set<object>(),
      );
    }
    if (state.exceeded) {
      truncated = true;
      break;
    }
    bytes += state.bytes;
    selectedNewestFirst.push(message);
  }
  return {
    messages: selectedNewestFirst.reverse(),
    bytes,
    truncated,
  };
}

export async function fetchAllSessionMessagesForExport(
  input: FetchSessionMessagesForExportInput,
): Promise<SessionExportMessageFetchResult> {
  const appendScope = (params: URLSearchParams) => {
    params.append('provider', 'pilotdeck');
    params.append('purpose', 'export');
    if (input.projectName) params.append('projectName', input.projectName);
    if (input.projectPath) params.append('projectPath', input.projectPath);
    if (input.sessionKind) params.append('sessionKind', input.sessionKind);
    if (input.parentSessionId) params.append('parentSessionId', input.parentSessionId);
    if (input.relativeTranscriptPath) {
      params.append('relativeTranscriptPath', input.relativeTranscriptPath);
    }
  };

  const mode = input.mode ?? 'user_archive';
  const maxBytes = resolveExportMaxBytes(mode, input.maxExportBytes);
  const messageBudget = resolveExportInputBudget(maxBytes);
  const pageChunksNewestFirst: NormalizedMessage[][] = [];
  let estimatedBytes = 0;
  let truncated = false;
  let loadedRange: { start: number; end: number } | null = null;
  let hasMore = true;
  let transcriptCursor: string | null = null;
  let sourceOffset: number | null = null;
  let latestTurnAcceptanceMeta: Record<string, unknown> | undefined;
  let sessionDeliverableManifest: SessionDeliverableManifestUi | undefined;
  let sessionTaskDirectory: SessionHistoryDeliverableEnvelope['sessionTaskDirectory'];

  while (hasMore) {
    const paginationParams = loadedRange
      ? buildTailFetchMoreParams(loadedRange, TAIL_PAGE_MORE_LIMIT)
      : buildTailFetchQueryParams(
        { limit: TAIL_PAGE_INITIAL_LIMIT, direction: 'backward' },
        true,
        TAIL_PAGE_INITIAL_LIMIT,
      );
    appendScope(paginationParams);
    const page = await fetchMessagesPage(input.sessionId, paginationParams);
    transcriptCursor = page.nextCursor ?? null;
    if (typeof page.offset === 'number') {
      sourceOffset = sourceOffset === null ? page.offset : Math.min(sourceOffset, page.offset);
    }
    latestTurnAcceptanceMeta ??= page.latestTurnAcceptanceMeta;
    sessionDeliverableManifest ??= page.sessionDeliverableManifest;
    sessionTaskDirectory ??= page.sessionTaskDirectory;
    const selected = selectNewestPageMessagesWithinBudget({
      messages: page.messages,
      remainingBytes: messageBudget - estimatedBytes,
    });
    if (selected.messages.length > 0) pageChunksNewestFirst.push(selected.messages);
    estimatedBytes += selected.bytes;
    loadedRange = computeLoadedRangeAfterTailFetch(page.total, page.nextCursor);
    hasMore = hasMoreFromLoadedRange(loadedRange);
    if (selected.truncated) {
      truncated = true;
      break;
    }
  }

  const messages = pageChunksNewestFirst.length <= 1
    ? pageChunksNewestFirst[0] ?? []
    : pageChunksNewestFirst.slice().reverse().flat();
  return {
    messages,
    truncated,
    ...(truncated ? { truncationReason: 'message_budget' as const } : {}),
    estimatedBytes,
    transcriptCursor,
    sourceOffset,
    ...(latestTurnAcceptanceMeta ? { latestTurnAcceptanceMeta } : {}),
    ...(sessionDeliverableManifest ? { sessionDeliverableManifest } : {}),
    ...(sessionTaskDirectory ? { sessionTaskDirectory } : {}),
  };
}

export async function resolveSessionExportDiskSnapshotEnvelope(input: {
  projectName: string;
  messages: NormalizedMessage[];
  sessionHistoryEnvelope?: SessionHistoryDeliverableEnvelope;
}): Promise<TaskFolderSnapshotEnvelope> {
  const historyContext = resolveSessionHistoryDeliverableContext(
    normalizedToChatMessages(input.messages),
    input.sessionHistoryEnvelope ?? {},
  );
  const chatMessages = historyContext.messages;
  const detachedEnvelope = historyContext.detachedEnvelope;
  const sessionTaskDirectory = resolveCurrentSessionTaskDirectory(chatMessages)
    ?? detachedEnvelope?.sessionTaskDirectory;
  const sessionManifest = resolveCurrentSessionManifest(chatMessages)
    ?? detachedEnvelope?.sessionDeliverableManifest
    ?? undefined;
  const contractScopeDir = resolveContractScopeDir({
    messages: chatMessages,
    sessionTaskDirectory,
    sessionManifest,
  });
  const scopeDir = contractScopeDir
    ?? sessionTaskDirectory?.taskArtifactDir?.replace(/\\/g, '/').replace(/\/+$/, '')
    ?? null;
  if (!scopeDir) {
    return createNotApplicableTaskFolderSnapshot('', 'export_scope_missing');
  }

  return fetchTaskFolderSnapshotEnvelope({
    projectName: input.projectName,
    scopeDir,
    slots: sessionManifest?.slots,
    goalVersion: sessionManifest?.goalVersion,
    force: true,
  });
}

export async function resolveSessionExportDiskSnapshot(input: {
  projectName: string;
  messages: NormalizedMessage[];
}): Promise<TaskFolderSnapshotFile[]> {
  const envelope = await resolveSessionExportDiskSnapshotEnvelope(input);
  return envelope.files;
}

export async function exportSessionToHtmlFile(input: {
  project: Project;
  session: ProjectSession;
  labels: SessionExportLabels;
  mode?: ExportSnapshotMode;
}): Promise<{ filename: string; messageCount: number }> {
  const exportMode = input.mode ?? 'user_archive';
  const sessionParams = getSessionRequestParams(input.session);
  const messageFetch = await fetchAllSessionMessagesForExport({
    sessionId: input.session.id,
    projectName: input.project.name,
    projectPath: getSessionProjectPath(input.project),
    mode: exportMode,
    ...sessionParams,
  });
  const messages = messageFetch.messages;
  const filtered = filterMessagesForExport(messages);
  const sessionHistoryEnvelope: SessionHistoryDeliverableEnvelope = {
    latestTurnAcceptanceMeta: messageFetch.latestTurnAcceptanceMeta,
    sessionDeliverableManifest: messageFetch.sessionDeliverableManifest,
    sessionTaskDirectory: messageFetch.sessionTaskDirectory,
  };
  const diskSnapshotEnvelope = await resolveSessionExportDiskSnapshotEnvelope({
    projectName: input.project.name,
    messages: filtered,
    sessionHistoryEnvelope,
  });
  const diskSnapshot = diskSnapshotEnvelope.files;
  const diskSnapshotComplete = resolveTaskFolderSnapshotCompletenessForValidation(
    diskSnapshotEnvelope.status,
  ) ?? diskSnapshotEnvelope.snapshotComplete;
  const acceptanceMetaForExport = messageFetch.latestTurnAcceptanceMeta ?? undefined;
  const certificateResolutionForExport = resolveAcceptanceCertificateStateFromTurnMeta(
    acceptanceMetaForExport,
  );
  const hasValidCertificateForExport = certificateResolutionForExport.state === 'valid_v1'
    || certificateResolutionForExport.state === 'valid_v2';
  const exportPipelineSettled = resolvePipelineValidationSettled({
    latestTurnAcceptanceMeta: acceptanceMetaForExport,
    diskSnapshotComplete,
    settledAcceptanceAuthority: isDeliverableSettledAcceptanceAuthorityEnabled(),
    certificateUiEnabled: isDeliverableCertificateUiEnabled(),
    certificateComplete: certificateResolutionForExport.state === 'valid_v2'
      ? certificateResolutionForExport.certificate.complete === true
      : hasValidCertificateForExport,
    certificateEnforce: isDeliverableCertificateEnforceEnabled(),
  });
  const sessionManifestForExport = messageFetch.sessionDeliverableManifest
    ?? resolveCurrentSessionManifest(filtered)
    ?? undefined;
  const exportTaskKind = resolveExportTaskKind(filtered, sessionManifestForExport);
  if (shouldBlockSessionExportForValidation({
    requireValidationSettled: isRequireValidationSettledForExportEnabled(),
    taskKind: exportTaskKind,
    executionStatus: input.session.executionStatus,
    pipelineSettled: exportPipelineSettled,
  })) {
    throw new Error('export_validation_pending');
  }
  const title = sessionDisplayTitle(input.session);
  const projectApiName = input.project.name;
  const unifiedView = tryBuildExportUnifiedView(filtered, projectApiName, {
    files: diskSnapshot,
    snapshotVersion: diskSnapshotEnvelope.snapshotVersion,
    snapshotComplete: diskSnapshotComplete,
    binding: diskSnapshotEnvelope.binding,
  }, sessionHistoryEnvelope);
  const exportOrigin = typeof window !== 'undefined' ? window.location.origin : null;
  const historyContext = resolveSessionHistoryDeliverableContext(
    normalizedToChatMessages(filtered),
    sessionHistoryEnvelope,
  );
  const chatMessages = historyContext.messages;
  const detachedEnvelope = historyContext.detachedEnvelope;
  const sessionManifest = resolveCurrentSessionManifest(chatMessages)
    ?? detachedEnvelope?.sessionDeliverableManifest
    ?? undefined;
  const detachedCertificateResolution = resolveAcceptanceCertificateStateFromTurnMeta(
    detachedEnvelope?.latestTurnAcceptanceMeta,
  );
  const acceptanceCertificate = resolveLatestAcceptanceCertificate(chatMessages)
    ?? (
      detachedCertificateResolution.state === 'valid_v1'
      || detachedCertificateResolution.state === 'valid_v2'
        ? detachedCertificateResolution.certificate
        : null
    );
  const taskKind = exportTaskKind;
  const scopeDir = resolveExportFourLineDebug({
    title,
    projectName: projectDisplayName(input.project),
    projectApiName,
    sessionId: input.session.id,
    messages: filtered,
    labels: input.labels,
    diskSnapshot,
    workspaceUuid: input.project.workspaceUuid ?? null,
    exportOrigin,
  }, unifiedView).scopeDir ?? null;
  const semanticSnapshotEnvelope = buildExportSnapshotEnvelope({
    mode: exportMode,
    lifecyclePhase: resolveSessionTaskPhase({
      isLoading: input.session.executionStatus === 'running',
      executionStatus: input.session.executionStatus === 'idle'
        ? undefined
        : input.session.executionStatus,
      lastAcceptanceStatus: acceptanceCertificate?.acceptanceStatus,
    }),
    executionStatus: input.session.executionStatus,
    sessionManifest,
    scopeDir,
    contractHash: unifiedView?.contractHash ?? acceptanceCertificate?.contractHash ?? null,
    evidenceHash: acceptanceCertificate?.evidenceHash ?? null,
    completionState: acceptanceCertificate?.completionState,
    acceptanceCertificate,
    taskKind,
    truncated: messageFetch.truncated,
    truncationReason: messageFetch.truncationReason,
    transcriptCursor: messageFetch.transcriptCursor,
    sourceOffset: messageFetch.sourceOffset,
    folderSnapshotComplete: diskSnapshotComplete,
  });
  const snapshotEnvelope = isExportSnapshotV2Enabled()
    ? semanticSnapshotEnvelope
    : undefined;
  const accessMap = await buildExportDeliverableAccessMap({
    projectName: projectApiName,
    paths: collectExportAccessPathCandidates({
      messages: filtered,
      unifiedView,
      diskSnapshot,
      scopeDir,
    }),
    exportOrigin,
    resolveOnServer: true,
  });
  const html = buildSessionExportHtml({
    title,
    projectName: projectDisplayName(input.project),
    projectApiName,
    sessionId: input.session.id,
    messages,
    labels: input.labels,
    diskSnapshot,
    diskSnapshotVersion: diskSnapshotEnvelope.snapshotVersion,
    diskSnapshotComplete,
    diskSnapshotBinding: diskSnapshotEnvelope.binding,
    prebuiltUnifiedView: unifiedView,
    workspaceUuid: input.project.workspaceUuid ?? null,
    exportOrigin,
    accessMap,
    snapshotEnvelope,
    semanticSnapshotEnvelope,
    exportMode,
    sourceTruncated: messageFetch.truncated,
    sourceTruncationReason: messageFetch.truncationReason,
    sessionHistoryEnvelope,
  });
  const filename = buildSessionExportFilename(title, input.session.id);
  downloadHtmlFile(filename, html);
  return { filename, messageCount: filterMessagesForExport(messages).length };
}
