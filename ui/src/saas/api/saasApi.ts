import { authenticatedFetch } from '../../utils/api';

export type SaasUserRow = {
  id: number;
  username: string;
  role: string;
  group_id?: string;
  created_at?: string;
  last_login?: string | null;
  is_active?: boolean;
  balance?: number;
  subscription?: string;
  status?: string;
};

export type AdminUserLogEntry = {
  id: string;
  at: string;
  category: 'event' | 'credit';
  type: string;
  summary: string;
  detail?: string | null;
};

export type AdminUserLogsPayload = {
  user: {
    id: number;
    tenant_id?: string;
    username: string;
    role: string;
    created_at?: string;
    last_login?: string | null;
    is_active?: boolean;
  };
  wallet: SaasWallet;
  subscription: {
    id?: number;
    plan_id?: string;
    plan_name?: string;
    status?: string;
    started_at?: string;
  } | null;
  stats: {
    sessionCount: number;
    lastActivityAt: string | null;
    usage: UsageBucket | null;
  };
  timeline: AdminUserLogEntry[];
};

export type SaasPlan = {
  id: string;
  name: string;
  credits_monthly: number;
  price_cents: number;
};

export type SaasWallet = {
  balance: number;
  updated_at?: string;
};

export type SaasDashboardStats = {
  visits: { total: number; series: Array<{ date: string; count: number }> };
  users: { total: number; active: number; series: Array<{ date: string; count: number }> };
  ops: { total: number; series: Array<{ date: string; count: number }> };
  subscriptions: { active: number; trial: number; series: Array<{ date: string; count: number }> };
  aiUsage: { totalTokens: number; totalCost: number; series: Array<{ date: string; tokens: number }> };
};

export type CaptchaChallenge = {
  captchaId: string;
  challenge: string;
};

export type UsageBucket = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requestCount: number;
  estimatedCost: number;
};

export type UsageByUser = UsageBucket & {
  userId: number | null;
  username: string;
  tenantId?: string;
  attributionKind?: 'user' | 'background' | 'system';
};
export type UsageByProject = UsageBucket & { projectPath: string };
export type UsageByModel = UsageBucket & { model: string };

export type AdminUsage = {
  total: UsageBucket;
  byUser: UsageByUser[];
  byProject: UsageByProject[];
  byModel: UsageByModel[];
  attributed: number;
  backgroundAttributed?: number;
  unattributed: number;
  lastUpdatedAt: string;
};

export type MyUsage = {
  total: UsageBucket;
  byProject: UsageByProject[];
  byModel: UsageByModel[];
  lastUpdatedAt: string;
};

export type FileStoragePreferences = {
  defaultLocation: 'local' | 'cloud';
  syncLocalToCloud: boolean;
  activeDeviceId: string;
  activeDeviceLabel: string;
  lastSyncedAt: string | null;
  migrationVersion: number;
};

export type SyncNowWorkspaceResult = {
  projectId?: string;
  ok?: boolean;
  bytes?: number;
  error?: string;
};

export type SyncNowResponse = {
  results?: SyncNowWorkspaceResult[];
  ok?: boolean;
  error?: string;
};

export type StorageStatusResponse = {
  mode: string;
  storageHint?: 'local_other_device' | 'no_workspaces' | null;
  fileStorage?: FileStoragePreferences;
  workspaceCount?: number;
  visibleCount?: number;
  lastSyncedAt?: string | null;
  syncingProjectIds?: string[];
  isSyncing?: boolean;
};

export type CreditLedgerRow = {
  id: number;
  delta: number;
  reason: string | null;
  created_by: number | null;
  created_at: string;
};

export type AdminWallet = {
  wallet: SaasWallet & { user_id?: number };
  ledger: CreditLedgerRow[];
};

export const saasApi = {
  captcha: (): Promise<Response> => fetch('/api/saas/captcha'),

  register: (body: {
    username: string;
    password: string;
    captchaId: string;
    captchaAnswer: string;
    inviteCode?: string;
  }) =>
    fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  adminMarketingLeads: (status = '') => {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return authenticatedFetch(`/api/saas/admin/marketing/leads${query}`);
  },

  adminMarketingLeadPatch: (id: number, status: string) =>
    authenticatedFetch(`/api/saas/admin/marketing/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  adminMarketingInviteCodes: () => authenticatedFetch('/api/saas/admin/marketing/invite-codes'),

  adminMarketingInviteCreate: (body: { count?: number; note?: string }) =>
    authenticatedFetch('/api/saas/admin/marketing/invite-codes', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  adminMarketingInviteRevoke: (code: string) =>
    authenticatedFetch(`/api/saas/admin/marketing/invite-codes/${encodeURIComponent(code)}/revoke`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  adminMarketingAnalytics: (days = 14) =>
    authenticatedFetch(`/api/saas/admin/marketing/analytics?days=${days}`),

  adminMarketingPageGet: (slug: string) =>
    authenticatedFetch(`/api/saas/admin/marketing/pages/${encodeURIComponent(slug)}`),

  adminMarketingPagePut: (
    slug: string,
    body: { title_zh: string; title_en: string; body_zh_md: string; body_en_md: string },
  ) =>
    authenticatedFetch(`/api/saas/admin/marketing/pages/${encodeURIComponent(slug)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  adminShowcaseFlags: () => authenticatedFetch('/api/saas/admin/showcase/flags'),

  adminShowcaseSections: () => authenticatedFetch('/api/saas/admin/showcase/sections'),

  adminShowcaseItems: (status = '', sectionId = '') => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (sectionId) params.set('sectionId', sectionId);
    const query = params.toString() ? `?${params}` : '';
    return authenticatedFetch(`/api/saas/admin/showcase/items${query}`);
  },

  adminShowcaseUpsertSection: (id: string, body: Record<string, unknown>) =>
    authenticatedFetch(`/api/saas/admin/showcase/sections/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  adminShowcaseUpsertItem: (id: string, body: Record<string, unknown>) =>
    authenticatedFetch(`/api/saas/admin/showcase/items/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  adminShowcasePublish: (id: string) =>
    authenticatedFetch(`/api/saas/admin/showcase/items/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  adminShowcaseUnpublish: (id: string) =>
    authenticatedFetch(`/api/saas/admin/showcase/items/${encodeURIComponent(id)}/unpublish`, {
      method: 'POST',
      body: JSON.stringify({ status: 'archived' }),
    }),

  adminShowcaseSessionCandidates: (limit = 50) =>
    authenticatedFetch(`/api/saas/admin/showcase/session-candidates?limit=${limit}`),

  adminShowcaseSessionArtifacts: (sessionId: string) =>
    authenticatedFetch(
      `/api/saas/admin/showcase/sessions/${encodeURIComponent(sessionId)}/artifacts`,
    ),

  adminShowcaseImportItem: (body: Record<string, unknown>) =>
    authenticatedFetch('/api/saas/admin/showcase/items/import', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  adminShowcaseUploadThumb: (id: string, dataUrl: string) =>
    authenticatedFetch(`/api/saas/admin/showcase/items/${encodeURIComponent(id)}/thumb`, {
      method: 'POST',
      body: JSON.stringify({ dataUrl }),
    }),

  adminUsers: (search = '') => {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return authenticatedFetch(`/api/saas/admin/users${query}`);
  },

  adminAssignUserGroup: (userId: number, groupId: string) =>
    authenticatedFetch(`/api/saas/admin/users/${userId}/group`, {
      method: 'PATCH',
      body: JSON.stringify({ group_id: groupId }),
    }),

  adminUserLogs: (userId: number) =>
    authenticatedFetch(`/api/saas/admin/users/${userId}/logs`, { noTimeout: true }),

  adminDashboard: () => authenticatedFetch('/api/saas/admin/dashboard'),

  platformSummary: () => authenticatedFetch('/api/saas/platform/summary'),

  billingPlans: () => authenticatedFetch('/api/saas/billing/plans'),

  billingWallet: () => authenticatedFetch('/api/saas/billing/wallet'),

  billingSubscribe: (planId: string) =>
    authenticatedFetch('/api/saas/billing/subscribe', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    }),

  billingCredit: (userId: number, amount: number, reason?: string) =>
    authenticatedFetch('/api/saas/billing/credit', {
      method: 'POST',
      body: JSON.stringify({ userId, amount, reason }),
    }),

  adminUserWallet: (userId: number) =>
    authenticatedFetch(`/api/saas/billing/admin/wallet/${userId}`),

  adminUsage: (userId?: number | null) => {
    const query = userId != null ? `?userId=${userId}` : '';
    return authenticatedFetch(`/api/saas/usage/admin${query}`);
  },

  myUsage: () => authenticatedFetch('/api/saas/usage/me'),

  currentUser: () => authenticatedFetch('/api/auth/user'),

  changePassword: (currentPassword: string, newPassword: string) =>
    authenticatedFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  getPreferences: () => authenticatedFetch('/api/saas/me/preferences'),

  updatePreferences: (preferences: {
    projectContinuity?: boolean;
    designCanvasEnabled?: boolean;
    fileStorage?: Partial<FileStoragePreferences>;
    hubFavorites?: { capabilities?: string[]; templates?: string[] };
  }) =>
    authenticatedFetch('/api/saas/me/preferences', {
      method: 'PUT',
      body: JSON.stringify({ preferences }),
    }),

  storageStatus: () => authenticatedFetch('/api/saas/storage/status'),

  reconcileStorage: () =>
    authenticatedFetch('/api/saas/storage/reconcile', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  syncStorageNow: (projectName?: string) =>
    authenticatedFetch('/api/saas/storage/sync-now', {
      method: 'POST',
      body: JSON.stringify(projectName ? { projectName } : {}),
    }),

  migrateStorage: (enableSync = false) =>
    authenticatedFetch('/api/saas/storage/migrate', {
      method: 'POST',
      body: JSON.stringify({ enableSync }),
    }),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    return authenticatedFetch('/api/saas/me/avatar', {
      method: 'POST',
      body: form,
    });
  },

  removeAvatar: () =>
    authenticatedFetch('/api/saas/me/avatar', {
      method: 'DELETE',
    }),
};
