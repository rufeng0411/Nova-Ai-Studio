// PD-SAAS-FORK: deterministic process narrative from tool/activity messages
import type { ChatMessage } from '../components/chat/types/types';
import type { ProcessTraceStep } from '../components/chat-v2/ProcessTrace';
import { summarizeThinkingContent } from './processStepLabels';

export type ProcessPhaseId =
  | 'understand'
  | 'gather'
  | 'analyze'
  | 'produce'
  | 'deliver';

export type ProcessClueKind =
  | 'search'
  | 'fetch'
  | 'read'
  | 'milestone'
  | 'local_search'
  | 'recovery'
  | 'thinking';

export type ProcessClue = {
  id: string;
  kind: ProcessClueKind;
  label: string;
  detail?: string;
  filePath?: string;
  url?: string;
  toolName?: string;
  /** engine recovery_attempt reason, e.g. auto_continue vs tool_recovery */
  recoveryReason?: string;
  sources?: Array<{ title: string; url: string; snippet?: string }>;
};

export type ProcessNarrativeOptions = {
  maxClues?: number;
  includeThinkingInSteps?: boolean;
};

const GATHER_TOOLS = new Set([
  'web_search',
  'web_fetch',
  'fetch_page_images',
  'read_file',
  'read',
]);

const PRODUCE_TOOLS = new Set([
  'write_file',
  'edit_file',
  'write',
  'edit',
  'generate_image',
  'generate_video',
  'render_html_video',
]);

const ANALYZE_TOOLS = new Set(['grep', 'glob', 'bash', 'task', 'agent']);

function parseToolInput(toolInput: unknown): Record<string, unknown> {
  if (toolInput && typeof toolInput === 'object' && !Array.isArray(toolInput)) {
    return toolInput as Record<string, unknown>;
  }
  if (typeof toolInput !== 'string' || !toolInput.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(toolInput);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function toolInputString(toolInput: unknown, key: string): string {
  const value = parseToolInput(toolInput)[key];
  return typeof value === 'string' ? value : '';
}

function toolTarget(message: ChatMessage): string {
  return (
    toolInputString(message.toolInput, 'file_path')
    || toolInputString(message.toolInput, 'path')
    || toolInputString(message.toolInput, 'url')
    || toolInputString(message.toolInput, 'pattern')
    || toolInputString(message.toolInput, 'query')
    || toolInputString(message.toolInput, 'command')
    || ''
  );
}

function displayBasename(target: string): string {
  if (!target) return '';
  const normalized = target.replace(/\\/g, '/');
  return normalized.split('/').filter(Boolean).pop() || target;
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function normalizeToolName(toolName: string | undefined): string {
  return String(toolName || '').toLowerCase();
}

function toolPhaseForMessage(message: ChatMessage): ProcessPhaseId | null {
  if (message.isThinking) return 'analyze';
  if (message.isAgentActivity && message.phase === 'recovery') return 'analyze';
  if (!message.isToolUse && !message.toolName) return null;

  const name = normalizeToolName(message.toolName);
  if (name === 'web_search' || name === 'web_fetch' || name === 'fetch_page_images') {
    return 'gather';
  }
  if (/^read/.test(name) || name === 'read_file') {
    return 'gather';
  }
  if (PRODUCE_TOOLS.has(name)) {
    return 'produce';
  }
  if (ANALYZE_TOOLS.has(name) || message.isSubagentContainer) {
    return 'analyze';
  }
  return 'analyze';
}

export function inferProcessPhase(
  messages: ChatMessage[],
  activityMessages: ChatMessage[] = [],
  hasAssistantStream = false,
): ProcessPhaseId {
  const combined = [...messages, ...activityMessages];
  let latest: ProcessPhaseId = 'understand';

  for (const message of combined) {
    const phase = toolPhaseForMessage(message);
    if (phase) {
      latest = phase;
    }
  }

  if (hasAssistantStream && latest === 'produce') {
    return 'deliver';
  }
  if (hasAssistantStream && latest === 'analyze') {
    return 'deliver';
  }

  return latest;
}

function writtenPathFromMessage(message: ChatMessage): string {
  const fromResult = message.toolResult && typeof message.toolResult === 'object'
    ? (message.toolResult as { writtenFilePath?: string }).writtenFilePath
    : undefined;
  if (typeof fromResult === 'string' && fromResult.trim()) {
    return fromResult.trim();
  }
  const fromMessage = typeof message.writtenFilePath === 'string' ? message.writtenFilePath : '';
  return fromMessage.trim();
}

function clueFromToolMessage(message: ChatMessage): ProcessClue | null {
  if (!message.isToolUse) return null;
  const name = normalizeToolName(message.toolName);
  const target = toolTarget(message);
  const id = message.toolId || message.id || `${name}-${target}`;

  if (name === 'web_search') {
    const query = toolInputString(message.toolInput, 'query') || target;
    if (!query) return null;
    const sources = parseSearchSourcesFromResult(message);
    return {
      id,
      kind: 'search',
      label: query,
      detail: query,
      sources,
    };
  }

  if (name === 'web_fetch' || name === 'fetch_page_images') {
    const url = toolInputString(message.toolInput, 'url') || target;
    if (!url) return null;
    return {
      id,
      kind: 'fetch',
      label: hostFromUrl(url),
      detail: url,
      url,
    };
  }

  if (/^read/.test(name) || name === 'read_file') {
    const file = displayBasename(target);
    if (!file) return null;
    return {
      id,
      kind: 'read',
      label: file,
      detail: target,
      filePath: target,
    };
  }

  const written = writtenPathFromMessage(message);
  if (written && PRODUCE_TOOLS.has(name) && message.toolResult && !message.toolResult.isError) {
    return {
      id,
      kind: 'milestone',
      label: displayBasename(written),
      detail: written,
      filePath: written,
    };
  }

  if (name === 'grep' || name === 'glob' || name === 'bash') {
    const pattern = toolInputString(message.toolInput, 'pattern')
      || toolInputString(message.toolInput, 'command')
      || target;
    return {
      id,
      kind: 'local_search',
      label: pattern || name,
      detail: pattern || undefined,
      toolName: name,
    };
  }

  return null;
}

function clueFromActivity(message: ChatMessage): ProcessClue | null {
  if (!message.isAgentActivity) return null;
  if (message.phase === 'recovery') {
    const recoveryReason = String(message.title || '').trim();
    return {
      id: message.activityId || message.id || 'recovery',
      kind: 'recovery',
      label: recoveryReason || message.detail || '',
      detail: message.detail,
      recoveryReason: recoveryReason || undefined,
    };
  }
  if (message.toolName || message.title) {
    return {
      id: message.activityId || message.id || 'subagent',
      kind: 'thinking',
      label: message.title || String(message.toolName || ''),
      detail: message.detail,
    };
  }
  return null;
}

export function buildProcessClues(
  messages: ChatMessage[],
  activityMessages: ChatMessage[] = [],
  options: ProcessNarrativeOptions = {},
): ProcessClue[] {
  const maxClues = options.maxClues ?? 5;
  const clues: ProcessClue[] = [];
  const seen = new Set<string>();

  const push = (clue: ProcessClue | null) => {
    if (!clue) return;
    const key = `${clue.kind}:${clue.label}:${clue.filePath || clue.url || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    clues.push(clue);
  };

  for (const message of messages) {
    if (message.isThinking && options.includeThinkingInSteps) {
      const snippet = summarizeThinkingContent(String(message.content || ''), 80);
      push({
        id: message.id || 'thinking',
        kind: 'thinking',
        label: snippet || 'thinking',
        detail: summarizeThinkingContent(String(message.content || ''), 160),
      });
      continue;
    }
    push(clueFromToolMessage(message));
  }

  for (const activity of activityMessages) {
    push(clueFromActivity(activity));
  }

  // Collapse multiple recovery clues in one turn — keep latest + count in label
  const recoveryClues = clues.filter((c) => c.kind === 'recovery');
  if (recoveryClues.length > 1) {
    const nonRecovery = clues.filter((c) => c.kind !== 'recovery');
    const latest = recoveryClues[recoveryClues.length - 1]!;
    const count = recoveryClues.length;
    nonRecovery.push({
      ...latest,
      label: latest.label || latest.recoveryReason || '',
      detail: count > 1 ? `×${count}` : latest.detail,
    });
    return nonRecovery.slice(-maxClues);
  }

  return clues.slice(-maxClues);
}

function stepKindForMessage(message: ChatMessage): string {
  if (message.isThinking) return 'thinking';
  if (message.isAgentActivity) {
    if (message.phase === 'recovery') return 'recovery';
    return 'activity';
  }
  const name = normalizeToolName(message.toolName);
  if (name === 'web_search') return 'search';
  if (name === 'web_fetch' || name === 'fetch_page_images') return 'fetch';
  if (/^read/.test(name) || name === 'read_file') return 'read';
  if (PRODUCE_TOOLS.has(name)) return 'milestone';
  if (name === 'grep' || name === 'glob') return 'local_search';
  if (name === 'bash') return 'command';
  if (ANALYZE_TOOLS.has(name) || message.isSubagentContainer) return 'subagent';
  return 'tool';
}

function stepTargetForMessage(message: ChatMessage): string {
  if (message.isThinking) {
    return summarizeThinkingContent(String(message.content || ''), 300);
  }
  const name = normalizeToolName(message.toolName);
  if (name === 'web_search') {
    return toolInputString(message.toolInput, 'query') || toolTarget(message);
  }
  if (PRODUCE_TOOLS.has(name)) {
    const written = writtenPathFromMessage(message);
    return written || toolTarget(message);
  }
  return toolTarget(message);
}

function truncateReadable(value: string, maxChars: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars - 1)}…`;
}

/** PD-SAAS-FORK: user-readable tool arg summary — no full paths or shell commands. */
export function buildToolStepDetailSummary(toolName: string, toolInput: unknown): string | undefined {
  const name = normalizeToolName(toolName);
  const input = parseToolInput(toolInput);

  if (name === 'web_search') {
    const query = typeof input.query === 'string' ? input.query.trim() : '';
    return query ? `搜索：${truncateReadable(query, 72)}` : undefined;
  }
  if (name === 'web_fetch' || name === 'fetch_page_images') {
    const url = typeof input.url === 'string' ? input.url.trim() : '';
    if (!url) return undefined;
    const host = hostFromUrl(url);
    return host ? `打开网页：${truncateReadable(host, 48)}` : undefined;
  }
  if (name === 'write_file' || name === 'write' || name === 'edit_file' || name === 'edit') {
    const path = typeof input.file_path === 'string'
      ? input.file_path
      : typeof input.path === 'string'
        ? input.path
        : '';
    const base = displayBasename(path);
    return base ? `写入：${truncateReadable(base, 48)}` : undefined;
  }
  if (name === 'read_file' || name === 'read') {
    const path = typeof input.file_path === 'string'
      ? input.file_path
      : typeof input.path === 'string'
        ? input.path
        : '';
    const base = displayBasename(path);
    return base ? `读取：${truncateReadable(base, 48)}` : undefined;
  }
  if (name === 'grep' || name === 'glob') {
    const pattern = typeof input.pattern === 'string' ? input.pattern.trim() : '';
    return pattern ? `检索：${truncateReadable(pattern, 48)}` : undefined;
  }
  return undefined;
}

export function buildKeySteps(
  messages: ChatMessage[],
  activityMessages: ChatMessage[] = [],
  options: ProcessNarrativeOptions = {},
): ProcessTraceStep[] {
  const steps: ProcessTraceStep[] = [];

  for (const message of messages) {
    if (message.isThinking) {
      if (!options.includeThinkingInSteps) continue;
      const target = stepTargetForMessage(message);
      steps.push({
        id: message.id,
        kind: 'thinking',
        target,
        detail: target || undefined,
        state: 'completed',
        phase: 'thinking',
      });
      continue;
    }
    if (!message.isToolUse) continue;

    const phase = toolPhaseForMessage(message);
    const hasError = Boolean(message.toolResult?.isError);
    const target = stepTargetForMessage(message);
    const friendlyDetail = buildToolStepDetailSummary(String(message.toolName || ''), message.toolInput);
    steps.push({
      id: message.toolId || message.id,
      kind: stepKindForMessage(message),
      target: target || undefined,
      detail: friendlyDetail || target || undefined,
      state: hasError ? 'failed' : message.toolResult ? 'completed' : 'running',
      phase: phase === 'gather' ? 'rag' : phase === 'produce' ? 'tool' : 'tool',
      toolName: message.toolName,
    });
  }

  for (const activity of activityMessages) {
    if (!activity.isAgentActivity) continue;
    steps.push({
      id: activity.activityId || activity.id,
      kind: activity.phase === 'recovery' ? 'recovery' : 'activity',
      title: activity.title || undefined,
      target: activity.title || activity.detail,
      detail: activity.detail,
      state: activity.state || 'completed',
      phase: activity.phase,
      toolName: activity.toolName,
    });
  }

  return steps;
}

export function getLiveStepDetail(
  messages: ChatMessage[],
  activityMessages: ChatMessage[] = [],
): string {
  const clues = buildProcessClues(messages, activityMessages, { maxClues: 1 });
  const latest = clues[clues.length - 1];
  if (!latest) return '';
  if (latest.kind === 'search') return latest.detail || latest.label;
  if (latest.kind === 'milestone') return latest.filePath || latest.label;
  if (latest.kind === 'fetch') return latest.url || latest.label;
  if (latest.kind === 'read') return latest.detail || latest.label;
  return latest.detail || latest.label;
}

/** Parse search hits from tool result preview or full text (P0: preview only; P1: fullText). */
export function parseSearchSourcesFromResult(
  message: ChatMessage,
): Array<{ title: string; url: string; snippet?: string }> {
  const content = typeof message.toolResult?.content === 'string'
    ? message.toolResult.content
    : '';
  const nestedFull = message.toolResult && typeof message.toolResult === 'object'
    ? (message.toolResult as { toolResultFullText?: string }).toolResultFullText
    : undefined;
  const fullText = typeof nestedFull === 'string' && nestedFull
    ? nestedFull
    : typeof message.toolResultFullText === 'string'
      ? message.toolResultFullText
      : content;
  return parseSearchSourcesFromText(fullText);
}

export function parseSearchSourcesFromText(
  text: string,
): Array<{ title: string; url: string; snippet?: string }> {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];

  try {
    const json = JSON.parse(trimmed) as unknown;
    return parseSearchSourcesFromJson(json);
  } catch {
    // fall through
  }

  const sources: Array<{ title: string; url: string; snippet?: string }> = [];
  const urlRegex = /https?:\/\/[^\s)\]"']+/gi;
  const matches = trimmed.match(urlRegex) || [];
  for (const url of matches.slice(0, 3)) {
    sources.push({
      title: hostFromUrl(url),
      url,
    });
  }
  return sources;
}

function parseSearchSourcesFromJson(
  json: unknown,
): Array<{ title: string; url: string; snippet?: string }> {
  const sources: Array<{ title: string; url: string; snippet?: string }> = [];
  const push = (title: string, url: string, snippet?: string) => {
    if (!url) return;
    sources.push({
      title: title || hostFromUrl(url),
      url,
      snippet,
    });
  };

  if (!json || typeof json !== 'object') return sources;

  const record = json as Record<string, unknown>;
  const lists = [
    record.results,
    record.data,
    (record.data as Record<string, unknown> | undefined)?.webPages,
    (record.data as Record<string, unknown> | undefined)?.results,
  ];

  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const url = String(row.url || row.link || row.href || '');
      const title = String(row.title || row.name || '');
      const snippet = String(row.snippet || row.description || row.content || '').slice(0, 160);
      push(title, url, snippet || undefined);
      if (sources.length >= 3) return sources;
    }
  }

  const webPages = (record.data as Record<string, unknown> | undefined)?.webPages as
    | Record<string, unknown>
    | undefined;
  if (webPages && Array.isArray(webPages.value)) {
    for (const item of webPages.value) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      push(String(row.name || ''), String(row.url || ''), String(row.snippet || '').slice(0, 160));
      if (sources.length >= 3) return sources;
    }
  }

  return sources.slice(0, 3);
}

export function collectTurnSearchSources(
  messages: ChatMessage[],
): Array<{ title: string; url: string; snippet?: string; query?: string }> {
  const results: Array<{ title: string; url: string; snippet?: string; query?: string }> = [];
  const seen = new Set<string>();

  for (const message of messages) {
    if (!message.isToolUse || normalizeToolName(message.toolName) !== 'web_search') continue;
    const query = toolInputString(message.toolInput, 'query');
    for (const source of parseSearchSourcesFromResult(message)) {
      const key = source.url.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ ...source, query });
    }
  }

  return results;
}
