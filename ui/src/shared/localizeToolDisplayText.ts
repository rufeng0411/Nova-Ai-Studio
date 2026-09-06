// PD-SAAS-FORK: localize tool call UI strings at render time (configs keep stable English keys)
import type { TFunction } from 'i18next';
import { getCanonicalToolName } from '../components/chat/tools/configs/toolConfigs';
import { formatToolDisplayName } from './processStepLabels';

const EXACT_KEYS: Record<string, string> = {
  Parameters: 'toolDisplay.parameters',
  Details: 'toolDisplay.details',
  Success: 'toolDisplay.success',
  Diff: 'toolDisplay.diff',
  Edit: 'toolDisplay.editBadge',
  New: 'toolDisplay.newBadge',
  Patch: 'toolDisplay.patchBadge',
  'Updating todo list': 'toolDisplay.updatingTodoList',
  'Todo list updated': 'toolDisplay.todoListUpdated',
  'reading list': 'toolDisplay.readingTodoList',
  'Task list': 'toolDisplay.taskListTitle',
  'Task details': 'toolDisplay.taskDetails',
  'Subagent result': 'toolDisplay.subagentResult',
  'Implementation Plan': 'toolDisplay.implementationPlan',
  'Question payload': 'toolDisplay.questionPayload',
  'No response text': 'toolDisplay.noResponseText',
  'No response': 'toolDisplay.noResponse',
  'Creating task': 'toolDisplay.creatingTask',
  'listing tasks': 'toolDisplay.listingTasks',
  fetching: 'toolDisplay.fetchingTask',
  updating: 'toolDisplay.updatingTask',
  'schedule job': 'toolDisplay.scheduleJob',
  'cancel scheduled job': 'toolDisplay.cancelScheduledJob',
  'listing scheduled jobs': 'toolDisplay.listingScheduledJobs',
  'Scheduled job': 'toolDisplay.scheduledJob',
  'Cancelled scheduled job': 'toolDisplay.cancelledScheduledJob',
  'Running task': 'toolDisplay.runningTask',
  Agent: 'toolDisplay.agent',
  Question: 'toolDisplay.question',
  Read: 'process.tool.read',
  Grep: 'process.tool.grep',
  Glob: 'process.tool.glob',
  TodoRead: 'process.tool.todoRead',
  CronCreate: 'process.tool.cronCreate',
  CronDelete: 'process.tool.cronDelete',
  CronList: 'process.tool.cronList',
  Task: 'process.tool.task',
  Tasks: 'process.tool.tasks',
};

const TODO_STATUS_KEYS: Record<string, string> = {
  completed: 'toolDisplay.todoStatus.completed',
  in_progress: 'toolDisplay.todoStatus.inProgress',
  pending: 'toolDisplay.todoStatus.pending',
};

function localizeDynamicString(text: string, t: TFunction<'chat'>): string | null {
  let match = text.match(/^Found (\d+) files?$/);
  if (match) {
    const count = Number(match[1]);
    return t('toolDisplay.foundFiles', {
      count,
      defaultValue: text,
    });
  }

  match = text.match(/^in (.+)$/);
  if (match) {
    return t('toolDisplay.inPath', { path: match[1], defaultValue: text });
  }

  match = text.match(/^Subagent \/ (.+): (.+)$/);
  if (match) {
    return t('toolDisplay.subagentTitle', {
      type: match[1] === 'Agent' ? t('toolDisplay.agent', { defaultValue: 'Agent' }) : match[1],
      description: match[2],
      defaultValue: text,
    });
  }

  match = text.match(/^Scheduled (.+)$/);
  if (match && match[1] !== 'job') {
    return t('toolDisplay.scheduledJobId', { id: match[1], defaultValue: text });
  }

  match = text.match(/^Cancelled (.+)$/);
  if (match && match[1] !== 'scheduled job') {
    return t('toolDisplay.cancelledJobId', { id: match[1], defaultValue: text });
  }

  match = text.match(/^(\d+) scheduled jobs?$/);
  if (match) {
    return t('toolDisplay.scheduledJobCount', {
      count: Number(match[1]),
      defaultValue: text,
    });
  }

  match = text.match(/^(.+) — answered$/);
  if (match) {
    return t('toolDisplay.questionAnswered', { header: match[1], defaultValue: text });
  }

  match = text.match(/^(\d+) questions — answered$/);
  if (match) {
    return t('toolDisplay.questionsAnswered', {
      count: Number(match[1]),
      defaultValue: text,
    });
  }

  match = text.match(/^(\d+) questions$/);
  if (match) {
    return t('toolDisplay.questionCount', {
      count: Number(match[1]),
      defaultValue: text,
    });
  }

  match = text.match(/^(.+) · (.+)$/);
  if (match && (match[1].startsWith('Scheduled ') || match[1].startsWith('Cancelled '))) {
    const localizedPrefix = localizeToolUiString(match[1], t);
    return `${localizedPrefix} · ${match[2]}`;
  }

  match = text.match(/^(.+) · (one-shot|recurring) · (durable|session)$/);
  if (match) {
    const cadence = t(`toolDisplay.cadence.${match[2]}`, { defaultValue: match[2] });
    const storage = t(`toolDisplay.storage.${match[3]}`, { defaultValue: match[3] });
    return `${match[1]} · ${cadence} · ${storage}`;
  }

  match = text.match(/^(one-shot|recurring) · (durable|session)$/);
  if (match) {
    const cadence = t(`toolDisplay.cadence.${match[1]}`, { defaultValue: match[1] });
    const storage = t(`toolDisplay.storage.${match[2]}`, { defaultValue: match[2] });
    return `${cadence} · ${storage}`;
  }

  return null;
}

/** Localize static tool UI labels (titles, badges, status chips). */
export function localizeToolUiString(text: string, t: TFunction<'chat'>): string {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return trimmed;

  const exactKey = EXACT_KEYS[trimmed];
  if (exactKey) {
    return t(exactKey, { defaultValue: trimmed });
  }

  const dynamic = localizeDynamicString(trimmed, t);
  if (dynamic) return dynamic;

  return trimmed;
}

/** Localize tool name shown in process/tool rows. */
export function localizeToolName(toolName: string, t: TFunction<'chat'>): string {
  const canonical = getCanonicalToolName(toolName);
  return formatToolDisplayName(canonical, t);
}

/** Localize todo/task status chips. */
export function localizeTodoStatus(status: string, t: TFunction<'chat'>): string {
  const key = TODO_STATUS_KEYS[status];
  if (key) {
    return t(key, { defaultValue: status.replace('_', ' ') });
  }
  return localizeToolUiString(status.replace('_', ' '), t);
}
