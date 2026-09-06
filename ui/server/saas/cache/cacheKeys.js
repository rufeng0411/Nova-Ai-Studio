/**
 * PD-SAAS-FORK: Redis cache key helpers for SaaS API caching.
 */

const DEFAULT_PREFIX = 'nova:';

export function getCacheKeyPrefix() {
  return process.env.REDIS_KEY_PREFIX || DEFAULT_PREFIX;
}

export function captchaKey(captchaId) {
  return `${getCacheKeyPrefix()}captcha:${captchaId}`;
}

export function capabilitiesHubKey({
  tenantId,
  userId,
  projectPath,
  locale,
  catalogMtimeMs,
  skillsRevision,
  hubVisibilityUpdatedAt,
  userGroupId,
  userGroupPermissionsUpdatedAt,
}) {
  const tenant = tenantId ?? 'platform';
  const user = userId ?? 'anon';
  const path = projectPath || '_';
  const vis = hubVisibilityUpdatedAt || 'none';
  const group = userGroupId || 'normal';
  const groupVis = userGroupPermissionsUpdatedAt || 'none';
  return `${getCacheKeyPrefix()}t:${tenant}:u:${user}:capabilities:${locale}:${catalogMtimeMs}:${skillsRevision}:${vis}:${group}:${groupVis}:${path}`;
}

export function capabilitiesHubKeyPattern() {
  return `${getCacheKeyPrefix()}t:*:u:*:capabilities:*`;
}

export function capabilitiesWelcomeKey({ tenantId, userId, projectPath, catalogMtimeMs, skillsRevision }) {
  const tenant = tenantId ?? 'platform';
  const user = userId ?? 'anon';
  const path = projectPath || '_';
  return `${getCacheKeyPrefix()}t:${tenant}:u:${user}:capabilities:welcome:${catalogMtimeMs}:${skillsRevision}:${path}`;
}

export function projectsKey({ tenantId, userId, catalogVersion = '' }) {
  const tenant = tenantId ?? 'platform';
  const user = userId ?? 'anon';
  const version = catalogVersion ? `:cv:${catalogVersion}` : '';
  return `${getCacheKeyPrefix()}t:${tenant}:u:${user}:projects${version}`;
}

export function sessionCatalogKey({ tenantId, userId }) {
  const tenant = tenantId ?? 'platform';
  const user = userId ?? 'anon';
  return `${getCacheKeyPrefix()}t:${tenant}:u:${user}:conversation-catalog`;
}

export function sessionMessagesTailKey({
  tenantId,
  userId,
  sessionId,
  transcriptMtimeMs,
  cursor,
  limit,
}) {
  const tenant = tenantId ?? 'platform';
  const user = userId ?? 'anon';
  const sid = sessionId ?? '_';
  const mtime = Number.isFinite(transcriptMtimeMs) ? Math.trunc(transcriptMtimeMs) : 0;
  const cur = cursor ?? 'tail';
  const lim = limit ?? 0;
  return `${getCacheKeyPrefix()}t:${tenant}:u:${user}:messages:${sid}:${mtime}:${cur}:${lim}`;
}

export function sessionMessagesTailKeyPrefix({ tenantId, userId, sessionId }) {
  const tenant = tenantId ?? 'platform';
  const user = userId ?? 'anon';
  const sid = sessionId ?? '_';
  return `${getCacheKeyPrefix()}t:${tenant}:u:${user}:messages:${sid}:*`;
}

export function pluginsListKey() {
  return `${getCacheKeyPrefix()}plugins:list`;
}

export function processTemplatesKey({ locale, userGroupId, userGroupPermissionsUpdatedAt }) {
  const group = userGroupId || 'normal';
  const groupVis = userGroupPermissionsUpdatedAt || 'none';
  return `${getCacheKeyPrefix()}process-templates:${locale || 'zh-CN'}:${group}:${groupVis}`;
}

export function taskmasterStatusKey() {
  return `${getCacheKeyPrefix()}taskmaster:installation-status`;
}
