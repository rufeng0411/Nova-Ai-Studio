/**
 * PD-SAAS-FORK: group project-list WebSocket updates by SaaS tenant/user.
 */

const OPEN_READY_STATE = 1;

export function getProjectUpdateScope(client) {
  if (!client || client.readyState !== OPEN_READY_STATE) return null;
  const tenantId = typeof client.__pilotdeckTenantId === 'string'
    ? client.__pilotdeckTenantId.trim()
    : '';
  if (!tenantId) return null;
  const rawUserId = client.__pilotdeckUserId;
  const userId = rawUserId === null || rawUserId === undefined ? null : Number(rawUserId);
  const role = typeof client.__pilotdeckRole === 'string' ? client.__pilotdeckRole : null;
  return {
    tenantId,
    userId: Number.isFinite(userId) ? userId : null,
    role,
  };
}

export function groupProjectUpdateClients(clients) {
  const groups = new Map();
  for (const client of clients) {
    const scope = getProjectUpdateScope(client);
    if (!scope) continue;
    const key = `${scope.tenantId}:${scope.userId ?? 'anon'}:${scope.role ?? ''}`;
    const existing = groups.get(key);
    if (existing) {
      existing.clients.push(client);
    } else {
      groups.set(key, { scope, clients: [client] });
    }
  }
  return [...groups.values()];
}
