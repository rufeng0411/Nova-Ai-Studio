import type { ChatMessage } from '../components/chat/types/types';
import type { ProcessAttachment } from '../components/chat-v2/processGrouping';
import { reconcileTurnDeliverables } from './reconcileTurnDeliverables';
import {
  classifyDeliverablePath,
  extractDeliverablePath,
  extractDeliverablePathsFromText,
  extractExternalUrlsFromText,
  normalizeArtifactPath,
  resolveDeliverableApiPath,
  type DeliverableKind,
} from './artifactPaths';
import { isDesignCanvasEnabled } from './designCanvasGate';
import { canvasBoardDirFromPath, isCanvasManifestPath } from './designCanvasManifest';
import { isNonUserDeliverablePath } from './nonDeliverablePaths';
import type { DeliverableLinkContract } from '../../shared/deliverableLinkContract.mjs';

export type DeliverableSource = 'tool' | 'text' | 'link';

export interface DeliverableItem {
  id: string;
  path: string;
  apiPath: string;
  resolvedPath?: string;
  linkContract?: DeliverableLinkContract;
  kind: DeliverableKind;
  source: DeliverableSource;
  toolName?: string;
  /** PD-SAAS-FORK: inferred artifacts/… directory for this turn (disambiguates bare filenames). */
  turnArtifactDir?: string;
}

// PD-SAAS-FORK: only writing/generating tools produce deliverables. Files
// touched by read_file / web_fetch / fetch_page_images are research inputs and
// must never show up in the deliverables panel.
const DELIVERABLE_TOOL_NAMES = new Set([
  'Write',
  'write_file',
  'Edit',
  'edit_file',
  'MultiEdit',
  'multi_edit',
  'create_file',
  'ApplyPatch',
  'apply_patch',
  'generate_image',
  'generate_video',
  'render_html_video',
  'compose_images_to_document',
  'ocr_to_editable_pptx',
  'export_document',
]);

/** PD-SAAS-FORK: detect successful deliverable-tool writes in a turn for summary mount fallback. */
export function turnHasSuccessfulDeliverableTools(messages: ChatMessage[]): boolean {
  return messages.some((message) => {
    if (!message.isToolUse) return false;
    const toolName = String(message.toolName || '');
    if (!DELIVERABLE_TOOL_NAMES.has(toolName)) return false;
    const toolResult = message.toolResult;
    if (toolResult && typeof toolResult === 'object' && toolResult.isError) return false;
    return true;
  });
}

function deliverableKey(path: string, kind: DeliverableKind): string {
  return `${kind}:${normalizeArtifactPath(path).toLowerCase()}`;
}

function createFileDeliverable(
  path: string,
  source: DeliverableSource,
  projectRoot?: string,
  toolName?: string,
): DeliverableItem | null {
  const normalized = normalizeArtifactPath(path);
  if (!normalized || isNonUserDeliverablePath(normalized)) return null;
  let kind = classifyDeliverablePath(normalized);
  if (isDesignCanvasEnabled() && isCanvasManifestPath(normalized)) {
    kind = 'design_canvas';
  }
  const apiPath = toProjectApiPathSafe(normalized, projectRoot);
  const turnArtifactDir =
    isDesignCanvasEnabled() && isCanvasManifestPath(normalized)
      ? canvasBoardDirFromPath(normalized)
      : undefined;
  return {
    id: deliverableKey(normalized, kind),
    path: normalized,
    apiPath,
    kind,
    source,
    toolName,
    turnArtifactDir: turnArtifactDir || undefined,
  };
}

function createUrlDeliverable(url: string): DeliverableItem {
  return {
    id: deliverableKey(url, 'url'),
    path: url,
    apiPath: url,
    kind: 'url',
    source: 'link',
  };
}

function toProjectApiPathSafe(path: string, projectRoot?: string): string {
  return resolveDeliverableApiPath({ writtenFilePath: path }, undefined, projectRoot) || normalizeArtifactPath(path);
}

function collectFromToolMessage(message: ChatMessage, projectRoot?: string): DeliverableItem[] {
  if (!message.isToolUse) return [];

  // PD-SAAS-FORK: 失败/未完成工具写入不计入成果（规则 3）
  const toolResult = message.toolResult;
  if (toolResult && typeof toolResult === 'object' && toolResult.isError) {
    return [];
  }

  const toolName = String(message.toolName || '');
  // PD-SAAS-FORK: skip non-writing tools entirely — their results often carry
  // file paths (read_file, web_fetch) that are not deliverables.
  if (!DELIVERABLE_TOOL_NAMES.has(toolName)) return [];

  const result = message.toolResult;
  const input = message.toolInput;

  const items: DeliverableItem[] = [];
  const pathFromResult = extractDeliverablePath(result, input);
  if (pathFromResult) {
    const item = createFileDeliverable(pathFromResult, 'tool', projectRoot, toolName);
    if (item) items.push(item);
  }

  let parsedInput: Record<string, unknown> | null = null;
  if (typeof input === 'string' && input.trim()) {
    try {
      const parsed = JSON.parse(input) as unknown;
      if (parsed && typeof parsed === 'object') parsedInput = parsed as Record<string, unknown>;
    } catch {
      parsedInput = null;
    }
  } else if (input && typeof input === 'object') {
    parsedInput = input as Record<string, unknown>;
  }

  if (DELIVERABLE_TOOL_NAMES.has(toolName) && items.length === 0 && parsedInput) {
    const record = parsedInput;
    const fallbackPath =
      record.file_path
      ?? record.filePath
      ?? record.html_path
      ?? record.htmlPath
      ?? record.output_path
      ?? record.outputPath;
    if (typeof fallbackPath === 'string') {
      const item = createFileDeliverable(fallbackPath, 'tool', projectRoot, toolName);
      if (item) items.push(item);
    }
  }

  return items;
}

function mergeDeliverables(existing: DeliverableItem[], incoming: DeliverableItem[]): DeliverableItem[] {
  const map = new Map<string, DeliverableItem>();
  for (const item of existing) {
    map.set(item.id, item);
  }
  for (const item of incoming) {
    const current = map.get(item.id);
    if (!current || (current.source !== 'tool' && item.source === 'tool')) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

export function collectDeliverablesFromMessages(
  messages: ChatMessage[],
  projectRoot?: string,
): DeliverableItem[] {
  return messages.reduce<DeliverableItem[]>(
    (acc, message) => mergeDeliverables(acc, collectFromToolMessage(message, projectRoot)),
    [],
  );
}

/** PD-SAAS-FORK (STDA): session-wide collect filtered to task scope — prevents cross-task pollution. */
export function collectDeliverablesFromMessagesInScope(
  messages: ChatMessage[],
  projectRoot: string | undefined,
  scopeDir: string | null | undefined,
): DeliverableItem[] {
  const items = collectDeliverablesFromMessages(messages, projectRoot);
  if (!scopeDir) return items;
  const scope = scopeDir.replace(/\\/g, '/').replace(/\/+$/, '');
  return items.filter((item) => {
    const path = (item.resolvedPath || item.apiPath || item.path || '').replace(/\\/g, '/');
    return path === scope || path.startsWith(`${scope}/`);
  });
}

export function collectDeliverablesFromProcessAttachments(
  attachments: ProcessAttachment[],
  projectRoot?: string,
): DeliverableItem[] {
  const toolMessages = attachments.flatMap((attachment) => attachment.processDetailMessages);
  return collectDeliverablesFromMessages(toolMessages, projectRoot);
}

export function collectDeliverablesFromAssistantText(
  text: string,
  projectRoot?: string,
): DeliverableItem[] {
  const fileItems = extractDeliverablePathsFromText(text)
    .map((path) => createFileDeliverable(path, 'text', projectRoot))
    .filter((item): item is DeliverableItem => item != null);
  const urlItems = extractExternalUrlsFromText(text).map(createUrlDeliverable);
  return mergeDeliverables(fileItems, urlItems);
}

export type CollectTurnDeliverablesOptions = {
  assistantText?: string;
  processAttachments?: ProcessAttachment[];
  toolMessages?: ChatMessage[];
  projectRoot?: string;
  /** PD-SAAS-FORK: 本回合用户诉求，供成果展示策展（隐藏无关脚本等） */
  userGoalText?: string;
  /** PD-SAAS-FORK: persisted JSONL turn_deliverable_meta overrides infer. */
  turnArtifactDirOverride?: string | null;
  /** PD-SAAS-FORK: historical turn cannot bind deliverables precisely. */
  turnDeliverableUnrecoverable?: boolean;
  /** PD-SAAS-FORK: full session messages for continued multi-turn campaign deliverable merge. */
  sessionToolMessages?: ChatMessage[];
  /** PD-SAAS-FORK: ledger / turn_deliverable_meta verified paths — authoritative anchor source. */
  verifiedPathsOverride?: string[];
  /** PD-SAAS-FORK: capability slug for content-matrix / last30days expand rules. */
  capabilitySlug?: string;
};

export function collectTurnAllArtifacts(options: CollectTurnDeliverablesOptions): DeliverableItem[] {
  const {
    assistantText = '',
    processAttachments = [],
    toolMessages = [],
    projectRoot,
  } = options;

  let items: DeliverableItem[] = [];
  items = mergeDeliverables(items, collectDeliverablesFromProcessAttachments(processAttachments, projectRoot));
  items = mergeDeliverables(items, collectDeliverablesFromMessages(toolMessages, projectRoot));
  items = mergeDeliverables(items, collectDeliverablesFromAssistantText(assistantText, projectRoot));
  return reconcileTurnDeliverables(items);
}

// PD-SAAS-FORK: T2 panel uses collectTurnFinalDeliverables from collectFinalDeliverables.ts

export function sortDeliverables(items: DeliverableItem[]): DeliverableItem[] {
  const kindOrder: DeliverableKind[] = [
    'html',
    'image',
    'video',
    'pdf',
    'document',
    'presentation',
    'spreadsheet',
    'code',
    'archive',
    'file',
    'url',
  ];

  const extensionRank = (item: DeliverableItem): number => {
    const path = (item.resolvedPath || item.apiPath || item.path).toLowerCase();
    if (path.endsWith('.docx')) return 0;
    if (path.endsWith('.html') || item.kind === 'html') return 1;
    if (path.endsWith('.md')) return 2;
    if (item.kind === 'image' || /\.(png|jpe?g|webp|gif|svg)$/.test(path)) return 3;
    if (item.kind === 'video' || path.endsWith('.mp4')) return 4;
    if (path.endsWith('.pdf')) return 5;
    return 10;
  };

  return [...items].sort((a, b) => {
    const sourceRank = (source: DeliverableSource) => (source === 'tool' ? 0 : source === 'text' ? 1 : 2);
    const sourceDiff = sourceRank(a.source) - sourceRank(b.source);
    if (sourceDiff !== 0) return sourceDiff;
    const extDiff = extensionRank(a) - extensionRank(b);
    if (extDiff !== 0) return extDiff;
    const kindDiff = kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind);
    if (kindDiff !== 0) return kindDiff;
    return a.path.localeCompare(b.path);
  });
}
