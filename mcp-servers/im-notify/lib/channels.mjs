/**
 * WeCom / DingTalk / WhatsApp Cloud API notify drivers (no LINE).
 */
import { createHmac } from 'node:crypto';
import { fetchWithTimeout, withRetry } from './resilience.mjs';

export const CHANNELS = /** @type {const} */ (['wecom', 'dingtalk', 'whatsapp']);

/**
 * @typedef {'wecom'|'dingtalk'|'whatsapp'} NotifyChannel
 */

/**
 * @param {NotifyChannel} channel
 */
export function isChannelConfigured(channel) {
  switch (channel) {
    case 'wecom':
      return Boolean(String(process.env.WECOM_WEBHOOK_URL || '').trim())
        || Boolean(
          String(process.env.WECOM_CORP_ID || '').trim()
          && String(process.env.WECOM_SECRET || '').trim()
          && String(process.env.WECOM_AGENT_ID || '').trim(),
        );
    case 'dingtalk':
      return Boolean(String(process.env.DINGTALK_WEBHOOK_URL || '').trim());
    case 'whatsapp':
      return Boolean(
        String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim()
        && String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim()
        && String(process.env.WHATSAPP_TO || '').trim(),
      );
    default:
      return false;
  }
}

/**
 * @returns {NotifyChannel[]}
 */
export function listConfiguredChannels() {
  return CHANNELS.filter((c) => isChannelConfigured(c));
}

/**
 * @param {NotifyChannel} channel
 * @param {{ text: string, title?: string, to?: string, format?: 'text'|'markdown', dryRun?: boolean }} payload
 */
export async function sendNotify(channel, payload) {
  if (!CHANNELS.includes(channel)) {
    return { ok: false, code: 'unknown_channel', retryable: false, channel };
  }
  if (!isChannelConfigured(channel)) {
    return { ok: false, code: 'not_configured', retryable: false, channel };
  }
  if (payload.dryRun) {
    return { ok: true, channel, dryRun: true, messageId: 'dry-run' };
  }
  const text = String(payload.text || '').trim();
  if (!text) {
    return { ok: false, code: 'empty_text', retryable: false, channel };
  }

  try {
    const result = await withRetry(
      () => dispatch(channel, { ...payload, text }),
      { channel },
    );
    return { ok: true, channel, ...result };
  } catch (err) {
    return {
      ok: false,
      channel,
      code: err?.code || 'send_failed',
      retryable: Boolean(err?.retryable),
      error: String(err?.message || err),
    };
  }
}

/**
 * @param {NotifyChannel} channel
 * @param {{ text: string, title?: string, to?: string, format?: 'text'|'markdown' }} payload
 */
async function dispatch(channel, payload) {
  switch (channel) {
    case 'wecom':
      return sendWecom(payload);
    case 'dingtalk':
      return sendDingtalk(payload);
    case 'whatsapp':
      return sendWhatsapp(payload);
    default: {
      const _exhaustive = channel;
      throw new Error(`unsupported ${_exhaustive}`);
    }
  }
}

/**
 * DingTalk custom robot sign: base64(hmac-sha256(secret, `${timestamp}\n${secret}`))
 * @param {string} secret
 * @param {number} timestamp
 */
export function buildDingtalkSign(secret, timestamp) {
  const stringToSign = `${timestamp}\n${secret}`;
  return createHmac('sha256', secret).update(stringToSign).digest('base64');
}

/**
 * @param {string} webhookUrl
 * @param {string} [secret]
 */
export function appendDingtalkSign(webhookUrl, secret) {
  const url = String(webhookUrl || '').trim();
  const sec = String(secret || '').trim();
  if (!sec) return url;
  const timestamp = Date.now();
  const sign = encodeURIComponent(buildDingtalkSign(sec, timestamp));
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}timestamp=${timestamp}&sign=${sign}`;
}

/** @param {{ text: string, title?: string, format?: 'text'|'markdown' }} payload */
export function buildWecomBody(payload) {
  const title = String(payload.title || '').trim();
  const text = payload.text;
  if (payload.format === 'markdown') {
    const content = title ? `**${title}**\n${text}` : text;
    return { msgtype: 'markdown', markdown: { content } };
  }
  const content = title ? `${title}\n${text}` : text;
  return { msgtype: 'text', text: { content } };
}

/** @param {{ text: string, title?: string, format?: 'text'|'markdown' }} payload */
export function buildDingtalkBody(payload) {
  const title = String(payload.title || '通知').trim() || '通知';
  const text = payload.text;
  if (payload.format === 'markdown') {
    return {
      msgtype: 'markdown',
      markdown: { title, text: title ? `### ${title}\n\n${text}` : text },
    };
  }
  return {
    msgtype: 'text',
    text: { content: title && title !== '通知' ? `${title}\n${text}` : text },
  };
}

/** WhatsApp Cloud API text body (no markdown). */
export function buildWhatsappBody(to, text) {
  return {
    messaging_product: 'whatsapp',
    to: String(to).replace(/\s+/g, ''),
    type: 'text',
    text: { preview_url: false, body: String(text).slice(0, 4096) },
  };
}

async function sendWecom(payload) {
  const webhook = String(process.env.WECOM_WEBHOOK_URL || '').trim();
  if (webhook) {
    const body = buildWecomBody(payload);
    const res = await fetchWithTimeout(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await safeJson(res);
    if (!res.ok || (data && data.errcode && data.errcode !== 0)) {
      const err = new Error(data?.errmsg || `HTTP ${res.status}`);
      err.status = res.status;
      err.retryable = res.status === 429 || res.status >= 500;
      throw err;
    }
    return { messageId: String(data?.msgid || data?.jobid || 'wecom-ok') };
  }
  // App message path (corpId/secret/agentId)
  const corpId = String(process.env.WECOM_CORP_ID || '').trim();
  const secret = String(process.env.WECOM_SECRET || '').trim();
  const agentId = String(process.env.WECOM_AGENT_ID || '').trim();
  const toUser = String(payload.to || process.env.WECOM_TO_USER || '@all').trim();
  const tokenRes = await fetchWithTimeout(
    `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(corpId)}&corpsecret=${encodeURIComponent(secret)}`,
  );
  const tokenData = await safeJson(tokenRes);
  if (!tokenData?.access_token) {
    const err = new Error(tokenData?.errmsg || '获取企微 token 失败');
    err.retryable = true;
    throw err;
  }
  const content = payload.title ? `${payload.title}\n${payload.text}` : payload.text;
  const sendRes = await fetchWithTimeout(
    `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${tokenData.access_token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        touser: toUser,
        msgtype: 'text',
        agentid: Number(agentId) || agentId,
        text: { content },
        safe: 0,
      }),
    },
  );
  const sendData = await safeJson(sendRes);
  if (sendData?.errcode && sendData.errcode !== 0) {
    const err = new Error(sendData.errmsg || '企微应用消息失败');
    err.status = sendRes.status;
    err.retryable = sendRes.status >= 500;
    throw err;
  }
  return { messageId: String(sendData?.msgid || 'wecom-app-ok') };
}

async function sendDingtalk(payload) {
  const base = String(process.env.DINGTALK_WEBHOOK_URL || '').trim();
  const secret = String(process.env.DINGTALK_SECRET || '').trim();
  const url = appendDingtalkSign(base, secret);
  const body = buildDingtalkBody(payload);
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await safeJson(res);
  if (!res.ok || (data && data.errcode && data.errcode !== 0)) {
    const err = new Error(data?.errmsg || `HTTP ${res.status}`);
    err.status = res.status;
    err.retryable = res.status === 429 || res.status >= 500;
    throw err;
  }
  return { messageId: String(data?.processQueryKey || 'dingtalk-ok') };
}

async function sendWhatsapp(payload) {
  const token = String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const to = String(payload.to || process.env.WHATSAPP_TO || '').trim();
  const version = String(process.env.WHATSAPP_GRAPH_VERSION || 'v21.0').trim() || 'v21.0';
  // WhatsApp does not support WeCom-style markdown — always plain text
  const body = buildWhatsappBody(to, payload.title ? `${payload.title}\n${payload.text}` : payload.text);
  const res = await fetchWithTimeout(
    `https://graph.facebook.com/${version}/${phoneId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  const data = await safeJson(res);
  if (!res.ok) {
    const err = new Error(data?.error?.message || `HTTP ${res.status}`);
    err.status = res.status;
    // 131047 = outside 24h window — not retryable as free-form text
    err.retryable = res.status === 429 || res.status >= 500;
    err.code = data?.error?.code ? `whatsapp_${data.error.code}` : 'whatsapp_send_failed';
    throw err;
  }
  const mid = data?.messages?.[0]?.id;
  return { messageId: String(mid || 'whatsapp-ok') };
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
