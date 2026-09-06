// PD-SAAS-FORK: T2「本回合成果」展示策略 — 只推用户可预览、与需求相关的成品
import type { DeliverableItem } from './collectDeliverables';
import { getArtifactFileName, normalizeArtifactPath } from './artifactPaths';
import { supportsOverlayPreview } from './projectPreviewCapabilities';
import { isNonUserDeliverablePath } from './nonDeliverablePaths';
import { extractDeliverableSessionUserGoal } from '../../shared/deliverableSessionGoal.mjs';

export type DeliverableDisplayContext = {
  /** 本回合用户首条消息，用于判断是否为编程/脚本类任务 */
  userGoalText?: string;
  /** 助手正文或末段工具锚定的路径 */
  anchorPaths?: string[];
  /** PD-SAAS-FORK: N2 Bot steward writes never enter user results panel */
  sessionKind?: string | null;
};

/** 实现用脚本扩展名：非用户交付物，默认不进成果区（规则 2、5） */
const IMPLEMENTATION_SCRIPT_EXTENSIONS = new Set([
  'py',
  'go',
  'rs',
  'java',
  'kt',
  'swift',
  'c',
  'cpp',
  'cc',
  'cxx',
  'h',
  'hpp',
  'cs',
  'rb',
  'php',
  'sh',
  'bash',
  'zsh',
  'bat',
  'cmd',
  'ps1',
  'mjs',
  'cjs',
]);

/** 对用户仍有价值的中间产物（规则 4） */
const USER_FACING_INTERMEDIATE_EXTENSIONS = new Set([
  'json',
  'jsonld',
  'html',
  'htm',
  'md',
  'markdown',
  'yaml',
  'yml',
  'xml',
  'csv',
  'tsv',
  'txt',
  'pdf',
  'docx',
  'doc',
  'pptx',
  'ppt',
  'xlsx',
  'xls',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'svg',
  'bmp',
  'ico',
  'mp4',
  'mov',
  'webm',
  'avi',
  'mkv',
  'mp3',
  'wav',
  'm4a',
  'ogg',
]);

const FAILED_ARTIFACT_NAME_PATTERNS = [
  /\.failed\./i,
  /\.error\./i,
  /-failed\./i,
  /-error\./i,
  /\.partial\./i,
  /\.incomplete\./i,
  /\.tmp\./i,
  /\.bak\./i,
];

const PROCESS_ONLY_PATH_SEGMENTS = [
  '/scripts/',
  '/script/',
  '/__pycache__/',
  '/.venv/',
  '/venv/',
  '/node_modules/',
  '/.git/',
  '/.pilotdeck/process/',
];

const PROGRAMMING_GOAL_PATTERNS = [
  /写(?:一个|个|一段|一份)?(?:程序|脚本|代码)/,
  /(?:开发|编写|实现|重构).{0,16}(?:程序|代码|脚本|函数|接口|组件|模块|类)/,
  /(?:python|golang|go语言|rust|typescript|javascript|react|vue|next\.js).{0,24}(?:程序|代码|脚本|项目)/i,
  /(?:React\s*程序化视频|Remotion|程序化视频|模板化视频|视频模板|批量渲染|render_html_video)/i,
  /\b(?:\.py|\.go|\.rs|\.tsx?|\.jsx?)\b/,
  /code review|refactor|debug|fix (?:the )?bug/i,
  /npm run|pip install|cargo build|pnpm (?:run|exec)/i,
  /(?:帮我|请).{0,8}(?:写|改|修).{0,8}(?:代码|程序|脚本)/,
];

const PRESENTATION_SCRIPT_BASENAME = /^create_.*\.(py|mjs|js)$/i;

function fileExtension(path: string): string {
  return getArtifactFileName(path).split('.').pop()?.toLowerCase() ?? '';
}

function pathsLooselyMatch(itemPath: string, anchorPath: string): boolean {
  const item = normalizeArtifactPath(itemPath);
  const anchor = normalizeArtifactPath(anchorPath);
  if (!item || !anchor) return false;
  if (item === anchor) return true;
  if (item.endsWith(`/${anchor}`) || anchor.endsWith(`/${item}`)) return true;
  const itemBase = getArtifactFileName(item).toLowerCase();
  const anchorBase = getArtifactFileName(anchor).toLowerCase();
  return itemBase === anchorBase;
}

export function userGoalImpliesProgramming(userText: string): boolean {
  const text = String(userText || '').trim();
  if (!text) return false;
  return PROGRAMMING_GOAL_PATTERNS.some((pattern) => pattern.test(text));
}

export function isFailedArtifactPath(path: string): boolean {
  const base = getArtifactFileName(normalizeArtifactPath(path)).toLowerCase();
  if (!base) return false;
  return FAILED_ARTIFACT_NAME_PATTERNS.some((pattern) => pattern.test(base));
}

export function isProcessOnlyArtifactPath(path: string): boolean {
  const normalized = normalizeArtifactPath(path).toLowerCase();
  if (!normalized) return false;
  if (PROCESS_ONLY_PATH_SEGMENTS.some((segment) => normalized.includes(segment))) return true;
  const top = normalized.split('/')[0] ?? '';
  return top === 'scripts' || top === 'script';
}

export function isImplementationScriptPath(path: string): boolean {
  const normalized = normalizeArtifactPath(path);
  if (!normalized) return false;
  const ext = fileExtension(normalized);
  if (IMPLEMENTATION_SCRIPT_EXTENSIONS.has(ext)) return true;
  const base = getArtifactFileName(normalized);
  return PRESENTATION_SCRIPT_BASENAME.test(base);
}

export function isPreviewableForDeliverablesPanel(item: DeliverableItem): boolean {
  if (item.kind === 'url') return true;
  if (item.kind === 'design_canvas') return true;
  const fileName = getArtifactFileName(item.apiPath || item.path);
  if (!fileName) return false;
  return supportsOverlayPreview(fileName, item.kind);
}

function isExplicitlyAnchored(item: DeliverableItem, anchorPaths: string[]): boolean {
  if (anchorPaths.length === 0) return false;
  const itemPath = normalizeArtifactPath(item.apiPath || item.path);
  return anchorPaths.some((anchor) => pathsLooselyMatch(itemPath, anchor));
}

function isPlatformInternalPath(path: string): boolean {
  const normalized = normalizeArtifactPath(path).toLowerCase();
  if (!normalized) return true;
  if (normalized.startsWith('src/') || normalized.startsWith('ui/') || normalized.startsWith('scripts/')) {
    return true;
  }
  if (/(^|\/)(node_modules|skills|\.pilotdeck)(\/|$)/.test(normalized)) {
    return true;
  }
  return false;
}

/**
 * 是否应在 T2「本回合成果」中展示。
 * 文件夹仍保留全部文件；此处只做对话内策展。
 */
export function shouldShowDeliverableInPanel(
  item: DeliverableItem,
  context: DeliverableDisplayContext = {},
): boolean {
  if (context.sessionKind === 'n2_bot') return false;
  if (item.kind === 'url') return true;

  const path = normalizeArtifactPath(item.apiPath || item.path);
  if (!path) return false;

  const anchorPaths = (context.anchorPaths ?? []).map((p) => normalizeArtifactPath(p)).filter(Boolean);
  const anchored = isExplicitlyAnchored(item, anchorPaths);
  const userWantsCode = userGoalImpliesProgramming(context.userGoalText ?? '');
  const userCodeDeliverable = userWantsCode && item.kind === 'code' && !isPlatformInternalPath(path);

  // 技能/平台内部文件不是用户交付物（如 last30days 的 SKILL.md）
  if (isNonUserDeliverablePath(path) && !userCodeDeliverable) return false;

  // 规则 3：失败/未完成命名
  if (isFailedArtifactPath(path)) return false;

  if (userCodeDeliverable) {
    return isPreviewableForDeliverablesPanel(item);
  }

  // 规则 3：过程目录中的无用产物（除非助手正文明确锚定）
  if (isProcessOnlyArtifactPath(path) && !anchored) return false;

  const ext = fileExtension(path);

  // 规则 2 & 5：实现脚本 — 非编程任务且未锚定则隐藏
  if (isImplementationScriptPath(path)) {
    if (userWantsCode || anchored) {
      return isPreviewableForDeliverablesPanel(item);
    }
    return false;
  }

  // 规则 4：对用户有用的中间文件
  if (USER_FACING_INTERMEDIATE_EXTENSIONS.has(ext)) {
    return isPreviewableForDeliverablesPanel(item);
  }

  // 规则 1：必须在超级预览中可预览
  if (!isPreviewableForDeliverablesPanel(item)) return false;

  // 其他 code 类（如 ts/js）在非编程任务下默认隐藏
  if (item.kind === 'code' && !userWantsCode && !anchored) {
    return false;
  }

  return true;
}

export function filterDeliverablesForDisplayPanel(
  items: DeliverableItem[],
  context: DeliverableDisplayContext = {},
): DeliverableItem[] {
  return items.filter((item) => shouldShowDeliverableInPanel(item, context));
}

/** 从整轮消息中提取用户首条诉求文本 */
export function extractUserGoalFromTurnMessages(
  messages: Array<{ type?: string; content?: unknown }>,
): string {
  for (const message of messages) {
    if (message.type === 'user') {
      return String(message.content ?? '');
    }
  }
  return '';
}

/** 从会话消息中提取原始交付型任务（忽略「？？」等追问） */
export function extractUserGoalFromSessionMessages(
  messages: Array<{ type?: string; role?: string; content?: unknown; metadata?: { synthetic?: boolean } }>,
): string {
  return extractDeliverableSessionUserGoal(messages);
}
