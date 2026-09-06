/**
 * PD-SAAS-FORK: Log line classification for Nova dev launcher terminal UI.
 * Priority: error > success > info > muted > default
 */

/** @typedef {'default' | 'info' | 'success' | 'muted' | 'error'} LogLevel */

const ERROR_PATTERNS = [
  /\b(fatal|panic|ECONNREFUSED|EADDRINUSE|control database ping failed)\b/i,
  /\bexit code [1-9]\d*\b/i,
  /\[.*\]\s*(error|failed):/i,
  /^Error:/,
  /Could not find a free \w+ port/i,
];

/** 基础设施预期降级 — 优先于 ERROR 判定 */
const INFRA_MUTED_PATTERNS = [
  /docker\s*(desktop|不可用)/i,
  /error during connect/i,
  /dockerDesktopLinuxEngine/i,
  /cannot find the file specified/i,
  /PostgreSQL 未启动/i,
  /SQLite 回退/i,
  /内存缓存兜底/i,
  /ping failed/i,
  /gateway connect failed/i,
  /Electron Security Warning/i,
  /ExperimentalWarning/i,
];

const SUCCESS_PATTERNS = [
  /\b(ready|listening|connected|hello_ok|PONG|warmup complete)\b/i,
  /\bstatus[:\s]+ok\b/i,
  /\{"ok":\s*true\}/i,
];

const INFO_PATTERNS = [
  /^\[(dev-saas|dev-launcher|dev-infra|saas|nova-launcher)\]/i,
  /\bresolved dev ports\b/i,
  /\bSaaS mode\b/i,
  /\bDATA_ROOT:/i,
  /\bbrowser URLs\b/i,
];

const MUTED_PATTERNS = [
  /\b(warn|warning|deprecated)\b/i,
  /\bHMR\b/,
  /\bping\b/i,
  /\[redis\] cache(Get|Set) failed/i,
  /using memory fallback/i,
];

/**
 * @param {string} line
 * @returns {LogLevel}
 */
export function classifyLogLine(line) {
  const text = String(line ?? '').trimEnd();
  if (!text) return 'default';

  for (const pattern of INFRA_MUTED_PATTERNS) {
    if (pattern.test(text)) return 'muted';
  }
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(text)) return 'error';
  }
  for (const pattern of SUCCESS_PATTERNS) {
    if (pattern.test(text)) return 'success';
  }
  for (const pattern of INFO_PATTERNS) {
    if (pattern.test(text)) return 'info';
  }
  for (const pattern of MUTED_PATTERNS) {
    if (pattern.test(text)) return 'muted';
  }
  return 'default';
}

/** xterm.js ANSI foreground codes */
export const LOG_LEVEL_ANSI = {
  default: '\x1b[38;2;232;232;232m',
  info: '\x1b[38;2;110;181;255m',
  success: '\x1b[38;2;74;222;128m',
  muted: '\x1b[38;2;107;107;107m',
  error: '\x1b[38;2;248;113;113m',
  reset: '\x1b[0m',
};

/** CSS class names for non-xterm rendering */
export const LOG_LEVEL_CLASS = {
  default: 'log-default',
  info: 'log-info',
  success: 'log-success',
  muted: 'log-muted',
  error: 'log-error',
};

/**
 * @param {string} line
 * @param {LogLevel} [level]
 */
export function formatAnsiLogLine(line, level = classifyLogLine(line)) {
  return `${LOG_LEVEL_ANSI[level]}${line}${LOG_LEVEL_ANSI.reset}`;
}
