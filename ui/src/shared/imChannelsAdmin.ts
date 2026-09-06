/** PD-SAAS-FORK: client helpers for admin IM channels APIs */

import { authenticatedFetch } from '../utils/api';

export type ImNotifyForm = {
  wecom: {
    enabled?: boolean;
    webhookUrl?: string;
    hasWebhook?: boolean;
    corpId?: string;
    secret?: string;
    hasSecret?: boolean;
    agentId?: string;
    toUser?: string;
  };
  dingtalk: {
    enabled?: boolean;
    webhookUrl?: string;
    hasWebhook?: boolean;
    secret?: string;
    hasSecret?: boolean;
  };
  whatsapp: {
    enabled?: boolean;
    accessToken?: string;
    hasAccessToken?: boolean;
    phoneNumberId?: string;
    to?: string;
    graphVersion?: string;
  };
};

export type ImChatAdapters = {
  wecom?: {
    enabled?: boolean;
    token?: string;
    hasToken?: boolean;
    extra?: { secret?: string; has_secret?: boolean; [k: string]: unknown };
  };
  dingtalk?: {
    enabled?: boolean;
    extra?: {
      clientId?: string;
      clientSecret?: string;
      has_clientSecret?: boolean;
      [k: string]: unknown;
    };
  };
  whatsapp?: {
    enabled?: boolean;
    extra?: {
      bridgePath?: string;
      bridgeUrl?: string;
      [k: string]: unknown;
    };
  };
};

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error
        || `HTTP ${res.status}`,
    );
  }
  return data;
}

export async function fetchImNotifyAdmin() {
  const res = await authenticatedFetch('/api/saas/admin/im-notify');
  return readJson(res) as Promise<{
    flag: string;
    form: ImNotifyForm;
    configured: boolean;
    path?: string;
  }>;
}

export async function saveImNotifyAdmin(form: ImNotifyForm) {
  const res = await authenticatedFetch('/api/saas/admin/im-notify', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ form }),
  });
  return readJson(res) as Promise<{
    success: boolean;
    form: ImNotifyForm;
    reloadHint?: string;
    flag: string;
  }>;
}

export async function fetchImChannelsAdmin() {
  const res = await authenticatedFetch('/api/saas/admin/im-channels');
  return readJson(res) as Promise<{
    flag: string;
    canEnable: boolean;
    adapters: ImChatAdapters;
    warning?: string | null;
  }>;
}

export async function saveImChannelsAdmin(adapters: ImChatAdapters) {
  const res = await authenticatedFetch('/api/saas/admin/im-channels', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adapters }),
  });
  return readJson(res) as Promise<{
    success: boolean;
    adapters: ImChatAdapters;
    blockedEnable?: string[];
    reloadHint?: string;
    canEnable: boolean;
    flag: string;
  }>;
}
