/**
 * PD-SAAS-FORK: synthesize mcpServers.im-notify from admin form fields.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');

export const IM_NOTIFY_SERVER_KEY = 'im-notify';
const MASK = '••••';

export function resolveImNotifyEntryPath(repoRoot = REPO_ROOT) {
  return path.join(repoRoot, 'mcp-servers', 'im-notify', 'index.mjs');
}

export function isMasked(value) {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  return !s || s === MASK || s === '********' || s.includes('••••');
}

/**
 * @typedef {{
 *   wecom?: { enabled?: boolean, webhookUrl?: string, corpId?: string, secret?: string, agentId?: string, toUser?: string },
 *   dingtalk?: { enabled?: boolean, webhookUrl?: string, secret?: string },
 *   whatsapp?: { enabled?: boolean, accessToken?: string, phoneNumberId?: string, to?: string, graphVersion?: string },
 * }} ImNotifyForm
 */

/**
 * @param {ImNotifyForm} form
 * @param {Record<string, string>} [prevEnv]
 */
export function formToImNotifyEnv(form, prevEnv = {}) {
  const env = { ...prevEnv };
  const apply = (key, value, keepIfMasked = true) => {
    if (value === undefined || value === null) return;
    const s = String(value);
    if (keepIfMasked && isMasked(s)) return;
    if (!s.trim()) {
      delete env[key];
      return;
    }
    env[key] = s.trim();
  };

  if (form.wecom) {
    apply('WECOM_WEBHOOK_URL', form.wecom.webhookUrl);
    apply('WECOM_CORP_ID', form.wecom.corpId);
    apply('WECOM_SECRET', form.wecom.secret);
    apply('WECOM_AGENT_ID', form.wecom.agentId);
    apply('WECOM_TO_USER', form.wecom.toUser);
  }
  if (form.dingtalk) {
    apply('DINGTALK_WEBHOOK_URL', form.dingtalk.webhookUrl);
    apply('DINGTALK_SECRET', form.dingtalk.secret);
  }
  if (form.whatsapp) {
    apply('WHATSAPP_ACCESS_TOKEN', form.whatsapp.accessToken);
    apply('WHATSAPP_PHONE_NUMBER_ID', form.whatsapp.phoneNumberId);
    apply('WHATSAPP_TO', form.whatsapp.to);
    apply('WHATSAPP_GRAPH_VERSION', form.whatsapp.graphVersion || 'v21.0');
  }
  return env;
}

/**
 * @param {Record<string, string>} env
 */
export function envToMaskedForm(env = {}) {
  const mask = (v) => (v && String(v).trim() ? MASK : '');
  return {
    wecom: {
      enabled: Boolean(env.WECOM_WEBHOOK_URL || (env.WECOM_CORP_ID && env.WECOM_SECRET)),
      webhookUrl: mask(env.WECOM_WEBHOOK_URL) || '',
      hasWebhook: Boolean(env.WECOM_WEBHOOK_URL),
      corpId: env.WECOM_CORP_ID || '',
      secret: mask(env.WECOM_SECRET),
      hasSecret: Boolean(env.WECOM_SECRET),
      agentId: env.WECOM_AGENT_ID || '',
      toUser: env.WECOM_TO_USER || '',
    },
    dingtalk: {
      enabled: Boolean(env.DINGTALK_WEBHOOK_URL),
      webhookUrl: mask(env.DINGTALK_WEBHOOK_URL),
      hasWebhook: Boolean(env.DINGTALK_WEBHOOK_URL),
      secret: mask(env.DINGTALK_SECRET),
      hasSecret: Boolean(env.DINGTALK_SECRET),
    },
    whatsapp: {
      enabled: Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID),
      accessToken: mask(env.WHATSAPP_ACCESS_TOKEN),
      hasAccessToken: Boolean(env.WHATSAPP_ACCESS_TOKEN),
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || '',
      to: env.WHATSAPP_TO || '',
      graphVersion: env.WHATSAPP_GRAPH_VERSION || 'v21.0',
    },
  };
}

/**
 * @param {ImNotifyForm} form
 * @param {object} [existingServer]
 */
export function buildImNotifyMcpServer(form, existingServer = {}) {
  const prevEnv = existingServer?.env && typeof existingServer.env === 'object'
    ? { ...existingServer.env }
    : {};
  const env = formToImNotifyEnv(form, prevEnv);
  const entry = resolveImNotifyEntryPath();
  return {
    command: 'node',
    args: [entry],
    env,
  };
}

export function validateNotifyWebhookUrl(url) {
  const s = String(url || '').trim();
  if (!s) return true;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}
