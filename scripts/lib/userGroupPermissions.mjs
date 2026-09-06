/**
 * PD-SAAS-FORK: 用户组与组级能力/全案可见性（在全局 hub-visibility 之上的额外隐藏层）
 * - 普通组（normal）：inherit_global，与现有后台 hub-visibility 完全一致
 * - 其它组：在全局可见结果上再叠加本组 false 条目（只能更严，不能突破全局已隐藏项）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeHubVisibilityDoc } from './hubVisibility.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const USER_GROUP_PERMISSIONS_PATH = path.join(ROOT, 'config', 'user-group-permissions.json');

export const DEFAULT_USER_GROUP_ID = 'normal';

const EMPTY_GROUP_DENY = {
  categories: {},
  subcategories: {},
  capabilities: {},
  templates: {},
  templateGroups: {},
};

const EMPTY_DOC = {
  version: 1,
  updatedAt: null,
  defaultGroupId: DEFAULT_USER_GROUP_ID,
  groups: [],
};

let cachedDoc = null;
let cachedMtimeMs = -1;

export function normalizeGroupDeny(raw) {
  const base = { ...EMPTY_GROUP_DENY, ...(raw && typeof raw === 'object' ? raw : {}) };
  for (const key of Object.keys(EMPTY_GROUP_DENY)) {
    base[key] = base[key] && typeof base[key] === 'object' ? base[key] : {};
  }
  return base;
}

export function normalizeUserGroupPermissionsDoc(raw) {
  const doc = { ...EMPTY_DOC, ...(raw && typeof raw === 'object' ? raw : {}) };
  const groups = Array.isArray(doc.groups) ? doc.groups : [];
  doc.groups = groups
    .filter((g) => g && typeof g === 'object' && typeof g.id === 'string' && g.id.trim())
    .map((g) => ({
      id: String(g.id).trim(),
      name: String(g.name || g.id).trim(),
      description: typeof g.description === 'string' ? g.description.trim() : '',
      isDefault: Boolean(g.isDefault) || String(g.id).trim() === DEFAULT_USER_GROUP_ID,
      mode: g.mode === 'restricted' ? 'restricted' : 'inherit_global',
      permissions: normalizeGroupDeny(g.permissions),
    }));
  if (!doc.groups.some((g) => g.id === DEFAULT_USER_GROUP_ID)) {
    doc.groups.unshift({
      id: DEFAULT_USER_GROUP_ID,
      name: '普通组',
      description: '默认用户组；可见性与后台「能力中心可见性」配置一致',
      isDefault: true,
      mode: 'inherit_global',
      permissions: normalizeGroupDeny(null),
    });
  }
  doc.defaultGroupId = doc.defaultGroupId || DEFAULT_USER_GROUP_ID;
  return doc;
}

export function loadUserGroupPermissions(force = false) {
  try {
    const stats = fs.statSync(USER_GROUP_PERMISSIONS_PATH);
    if (!force && cachedDoc && stats.mtimeMs === cachedMtimeMs) {
      return cachedDoc;
    }
    const parsed = JSON.parse(fs.readFileSync(USER_GROUP_PERMISSIONS_PATH, 'utf8'));
    cachedDoc = normalizeUserGroupPermissionsDoc(parsed);
    cachedMtimeMs = stats.mtimeMs;
    return cachedDoc;
  } catch {
    cachedDoc = normalizeUserGroupPermissionsDoc(null);
    cachedMtimeMs = -1;
    return cachedDoc;
  }
}

export function saveUserGroupPermissions(nextDoc) {
  const doc = normalizeUserGroupPermissionsDoc(nextDoc);
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(USER_GROUP_PERMISSIONS_PATH, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  cachedDoc = doc;
  cachedMtimeMs = fs.statSync(USER_GROUP_PERMISSIONS_PATH).mtimeMs;
  return doc;
}

export function findUserGroupById(groupId, doc = loadUserGroupPermissions()) {
  const id = String(groupId || DEFAULT_USER_GROUP_ID).trim() || DEFAULT_USER_GROUP_ID;
  return doc.groups.find((g) => g.id === id) ?? doc.groups.find((g) => g.isDefault) ?? doc.groups[0];
}

export function combineHubVisibilityWithGroup(globalDoc, group) {
  const base = normalizeHubVisibilityDoc(globalDoc);
  if (!group || group.mode !== 'restricted') {
    return base;
  }
  const deny = normalizeGroupDeny(group.permissions);
  const mergeDeny = (section) => {
    const out = { ...base[section] };
    for (const [key, value] of Object.entries(deny[section] || {})) {
      if (value === false) out[key] = false;
    }
    return out;
  };
  return {
    ...base,
    categories: mergeDeny('categories'),
    subcategories: mergeDeny('subcategories'),
    capabilities: mergeDeny('capabilities'),
    templates: mergeDeny('templates'),
    templateGroups: mergeDeny('templateGroups'),
  };
}

export function resolveEffectiveHubVisibilityForGroupId(groupId, globalDoc = null) {
  const groupDoc = loadUserGroupPermissions();
  const group = findUserGroupById(groupId, groupDoc);
  const global = globalDoc ?? normalizeHubVisibilityDoc(null);
  return {
    visibility: combineHubVisibilityWithGroup(global, group),
    group,
    groupPermissionsUpdatedAt: groupDoc.updatedAt || 'none',
  };
}

export function invalidateUserGroupPermissionsCache() {
  cachedDoc = null;
  cachedMtimeMs = -1;
}
