// PD-SAAS-FORK: localize process trace steps at render time (not persisted)
import type { TFunction } from 'i18next';
import type { ProcessTraceStep } from '../components/chat-v2/ProcessTrace';
import { getCanonicalToolName } from '../components/chat/tools/configs/toolConfigs';
import { humanizeToolLabel, type AudienceMode } from './audienceMode';

export type ProcessStepKind =
  | 'thinking'
  | 'edit'
  | 'read'
  | 'search'
  | 'fetch'
  | 'command'
  | 'subagent'
  | 'compact'
  | 'tool'
  | 'recovery'
  | 'milestone'
  | 'activity'
  | 'local_search';

const TOOL_I18N_KEYS: Record<string, string> = {
  read: 'process.tool.read',
  read_file: 'process.tool.readFile',
  write: 'process.tool.write',
  write_file: 'process.tool.writeFile',
  edit: 'process.tool.edit',
  edit_file: 'process.tool.editFile',
  applypatch: 'process.tool.applyPatch',
  apply_patch: 'process.tool.applyPatch',
  web_search: 'process.tool.webSearch',
  web_fetch: 'process.tool.webFetch',
  fetch_page_images: 'process.tool.fetchPageImages',
  grep: 'process.tool.grep',
  glob: 'process.tool.glob',
  bash: 'process.tool.bash',
  task: 'process.tool.task',
  agent: 'process.tool.task',
  tasks: 'process.tool.tasks',
  taskcreate: 'process.tool.taskCreate',
  taskupdate: 'process.tool.taskUpdate',
  tasklist: 'process.tool.taskList',
  taskget: 'process.tool.taskGet',
  todowrite: 'process.tool.todoWrite',
  todo_write: 'process.tool.todoWrite',
  todoread: 'process.tool.todoRead',
  todo_read: 'process.tool.todoRead',
  read_skill: 'process.tool.readSkill',
  readskill: 'process.tool.readSkill',
  croncreate: 'process.tool.cronCreate',
  cron_create: 'process.tool.cronCreate',
  crondelete: 'process.tool.cronDelete',
  cron_delete: 'process.tool.cronDelete',
  cronlist: 'process.tool.cronList',
  cron_list: 'process.tool.cronList',
  askuserquestion: 'process.tool.askUserQuestion',
  ask_user_question: 'process.tool.askUserQuestion',
  exitplanmode: 'process.tool.exitPlanMode',
  exit_plan_mode: 'process.tool.exitPlanMode',
  exportdocument: 'process.tool.exportDocument',
  export_document: 'process.tool.exportDocument',
  compose_images_to_document: 'process.tool.composeImages',
  ocr_to_editable_pptx: 'process.tool.ocrPptx',
  multi_edit: 'process.tool.multiEdit',
  generate_image: 'process.tool.generateImage',
  generate_video: 'process.tool.generateVideo',
  render_html_video: 'process.tool.renderHtmlVideo',
  canvas_create: 'process.tool.canvasCreate',
  canvas_update: 'process.tool.canvasUpdate',
};

const RAW_PROCESS_LABEL_I18N_KEYS: Record<string, string> = {
  session_prepare: 'process.stage.sessionPrepare',
  plugin_refresh: 'process.stage.pluginRefresh',
  mcp_ready: 'process.stage.mcpReady',
  memory_retrieve: 'process.stage.memoryRetrieve',
  router_judge: 'process.stage.routerJudge',
  compact: 'process.stage.compact',
  recovery_pause: 'process.status.recoveryPause',
  recovery_handling: 'process.status.recoveryHandling',
  infra_interrupt: 'process.status.infraInterrupt',
  deliverable_repair: 'process.status.deliverableRepair',
  acceptance_started: 'process.status.acceptanceStarted',
  acceptance_completed: 'process.status.acceptanceCompleted',
  acceptance_failed: 'process.status.acceptanceFailed',
  elicitation: 'process.status.elicitation',
  permission: 'process.status.permission',
  next_turn: 'process.recovery.nextTurn',
  model_error: 'process.recovery.modelError',
  max_turns: 'process.recovery.maxTurns',
  aborted_streaming: 'process.recovery.abortedStreaming',
  aborted_tools: 'process.recovery.abortedTools',
  auto_compact: 'process.recovery.autoCompact',
  tool_recovery: 'process.recovery.toolRecovery',
  auto_continue: 'process.recovery.autoContinue',
  soft_fetch_recovery: 'process.recovery.softFetchRecovery',
  deliverable_validate_failed: 'process.recovery.adjusting',
  large_file_partial_continue: 'process.recovery.autoContinue',
  invalid_tool_input_recovery: 'process.recovery.autoContinue',
  retry_alternate: 'process.recovery.retryAlternate',
  stage_hint: 'process.recovery.stageHint',
};

function normalizeProcessKey(value: string | undefined): string {
  return String(value || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

function isKnownRawProcessLabel(value: string | undefined): boolean {
  const key = normalizeProcessKey(value);
  return Boolean(RAW_PROCESS_LABEL_I18N_KEYS[key] || TOOL_I18N_KEYS[key]);
}

function translateI18nKey(
  i18nKey: string,
  fallback: string,
  t: TFunction<'chat'>,
): string {
  return t(i18nKey, { defaultValue: fallback });
}

export function localizeRawProcessLabel(
  rawLabel: string | undefined,
  t: TFunction<'chat'>,
): string | undefined {
  const raw = String(rawLabel || '').trim();
  if (!raw) return undefined;
  const key = normalizeProcessKey(raw);
  const processKey = RAW_PROCESS_LABEL_I18N_KEYS[key];
  if (processKey) {
    return translateI18nKey(processKey, raw, t);
  }
  const toolKey = TOOL_I18N_KEYS[key];
  if (toolKey) {
    return translateI18nKey(toolKey, raw, t);
  }
  return undefined;
}

export function formatToolDisplayName(
  toolName: string | undefined,
  t: TFunction<'chat'>,
  audienceMode?: AudienceMode,
): string {
  if (audienceMode) {
    const human = humanizeToolLabel(toolName || '', audienceMode, t);
    if (human) return human;
  }
  const rawKey = normalizeProcessKey(toolName);
  const rawI18nKey = TOOL_I18N_KEYS[rawKey];
  if (rawI18nKey) {
    return translateI18nKey(rawI18nKey, String(toolName || ''), t);
  }
  const canonical = getCanonicalToolName(String(toolName || ''));
  const key = normalizeProcessKey(canonical);
  const i18nKey = TOOL_I18N_KEYS[key];
  if (i18nKey) {
    return translateI18nKey(i18nKey, canonical, t);
  }
  if (audienceMode === 'non_technical' || /^mcp__/i.test(canonical) || canonical.includes('__')) {
    return t('process.tool.externalService', {
      defaultValue: '正在调用外部服务',
    });
  }
  const displayTool = canonical || t('process.tool.tool', { defaultValue: '工具' });
  return t('process.tool.generic', {
    tool: displayTool,
    defaultValue: `使用 ${displayTool}`,
  });
}

function displayBasename(target: string): string {
  if (!target) return '';
  const normalized = target.replace(/\\/g, '/');
  return normalized.split('/').filter(Boolean).pop() || target;
}

function localizedTitleForKind(
  kind: ProcessStepKind | string | undefined,
  toolName: string | undefined,
  target: string | undefined,
  t: TFunction<'chat'>,
): string {
  const basename = displayBasename(target || '');
  switch (kind) {
    case 'thinking':
      return t('process.tool.thinking', { defaultValue: '思考' });
    case 'edit':
      return basename
        ? t('process.live.runningEditTarget', { target: basename, defaultValue: `正在编辑 ${basename}` })
        : t('process.live.runningEdit', { defaultValue: '正在编辑文件' });
    case 'read':
      return basename
        ? t('process.live.runningReadTarget', { target: basename, defaultValue: `正在读取 ${basename}` })
        : t('process.live.runningRead', { defaultValue: '正在读取文件' });
    case 'search':
      return basename
        ? t('process.live.runningSearchTarget', { target: basename, defaultValue: `正在搜索 ${basename}` })
        : formatToolDisplayName(toolName || 'web_search', t);
    case 'fetch':
      return basename || formatToolDisplayName(toolName || 'web_fetch', t);
    case 'command':
      return basename
        ? t('process.live.runningCommandTarget', { target: basename, defaultValue: `正在运行 ${basename}` })
        : t('process.live.runningCommand', { defaultValue: '正在运行命令' });
    case 'subagent':
      return t('process.live.runningSubagent', { defaultValue: '子任务进行中' });
    case 'compact':
      return t('process.live.compactCompleted', { defaultValue: '已压缩上下文' });
    case 'recovery':
      return t('process.clue.recovery', { defaultValue: '重试' });
    case 'milestone':
      return basename
        ? t('process.clue.milestoneWithFile', { file: basename, defaultValue: `已生成 ${basename}` })
        : t('process.clue.milestone', { defaultValue: '已生成' });
    case 'local_search':
      return formatToolDisplayName(toolName, t);
    case 'activity':
      if (target) return target;
      return formatToolDisplayName(toolName, t);
    default:
      if (toolName) {
        return formatToolDisplayName(toolName, t);
      }
      return t('process.step', { defaultValue: '步骤' });
  }
}

/** Resolve a persisted or live step into localized title/detail for UI. */
export function localizeProcessTraceStep(
  step: ProcessTraceStep,
  t: TFunction<'chat'>,
): { title: string; detail?: string } {
  const kind = step.kind as ProcessStepKind | undefined;
  const target = step.target || step.detail;
  const rawTitle = localizeRawProcessLabel(step.title, t);
  const rawDetail = localizeRawProcessLabel(step.detail, t);
  const rawTarget = localizeRawProcessLabel(step.target, t);

  if (rawTitle) {
    return {
      title: rawTitle,
      detail: rawDetail || step.detail === step.title || isKnownRawProcessLabel(step.detail) ? undefined : step.detail,
    };
  }

  if (kind) {
    return {
      title: rawDetail || rawTarget || localizedTitleForKind(kind, step.toolName, target, t),
      detail: kind === 'thinking' ? step.detail : (isKnownRawProcessLabel(step.detail) ? undefined : step.detail),
    };
  }

  // Legacy persisted steps may still carry English tool names as title
  if (step.toolName) {
    const toolLabel = formatToolDisplayName(step.toolName, t);
    const basename = displayBasename(step.target || step.detail || '');
    if (basename && basename !== step.toolName) {
      return { title: `${toolLabel}：${basename}`, detail: step.detail };
    }
    return { title: toolLabel, detail: step.detail };
  }

  if (step.title && !/^(thinking|tool|activity|web_search|grep|glob|bash)$/i.test(step.title)) {
    return { title: step.title, detail: rawDetail ? undefined : step.detail };
  }

  return {
    title: t('process.step', { defaultValue: '步骤' }),
    detail: step.detail,
  };
}

export function summarizeThinkingContent(content: string, maxLen = 120): string {
  const trimmed = String(content || '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen).trim()}…`;
}
