/** Redact secrets from logs / tool text. */

const PATTERNS = [
  /(access[_-]?token|api[_-]?key|secret|password|authorization)\s*[:=]\s*["']?([^\s"',}]+)/gi,
  /(Bearer)\s+([A-Za-z0-9._\-]+)/gi,
  /(key=)([A-Za-z0-9_\-]+)/gi,
  /(qyapi\.weixin\.qq\.com\/cgi-bin\/webhook\/send\?key=)([A-Za-z0-9_\-]+)/gi,
  /(oapi\.dingtalk\.com\/robot\/send\?access_token=)([A-Za-z0-9_\-]+)/gi,
];

export function redactSecrets(input) {
  let text = String(input ?? '');
  for (const re of PATTERNS) {
    text = text.replace(re, (_m, p1) => `${p1}***`);
  }
  return text;
}

export function maskSecret(value) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  if (s.length <= 8) return '••••';
  return `${s.slice(0, 2)}••••${s.slice(-2)}`;
}
