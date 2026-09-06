/** PD-SAAS-FORK: 用户组与组级能力/全案可见性（客户端） */
import { authenticatedFetch } from '../utils/api';
import type { HubVisibilityDoc } from './hubVisibility';

export type UserGroupMode = 'inherit_global' | 'restricted';

export type UserGroupPermissions = Pick<
  HubVisibilityDoc,
  'categories' | 'subcategories' | 'capabilities' | 'templates' | 'templateGroups'
>;

export type UserGroupDefinition = {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  mode: UserGroupMode;
  permissions: UserGroupPermissions;
};

export type UserGroupPermissionsDoc = {
  version: number;
  updatedAt: string | null;
  defaultGroupId: string;
  groups: UserGroupDefinition[];
};

export const DEFAULT_USER_GROUP_ID = 'normal';

export const MAJOR_CATEGORY_OPTIONS = [
  { id: 'marketing', label: '营销' },
  { id: 'geo', label: 'GEO' },
  { id: 'media', label: '媒体' },
  { id: 'office', label: '办公' },
  { id: 'creation', label: '创作' },
  { id: 'development', label: '开发' },
  { id: 'brainstorming', label: '脑暴' },
  { id: 'finance', label: '金融' },
  { id: 'enterprise_compliance', label: '企业合规' },
  { id: 'education', label: '教育' },
] as const;

export const TEMPLATE_GROUP_OPTIONS = [
  { id: 'templates:marketing', label: '营销全案' },
  { id: 'templates:enterprise', label: '企业全案' },
  { id: 'templates:geo', label: 'GEO 全案' },
  { id: 'templates:office', label: '办公全案' },
  { id: 'templates:creation', label: '创作全案' },
] as const;

export function normalizeUserGroupPermissionsDoc(raw: unknown): UserGroupPermissionsDoc {
  const doc = {
    version: 1,
    updatedAt: null,
    defaultGroupId: DEFAULT_USER_GROUP_ID,
    groups: [],
    ...(raw && typeof raw === 'object' ? raw as UserGroupPermissionsDoc : {}),
  };
  doc.groups = Array.isArray(doc.groups)
    ? doc.groups.filter((g) => g && typeof g.id === 'string' && g.id.trim())
    : [];
  if (!doc.groups.some((g) => g.id === DEFAULT_USER_GROUP_ID)) {
    doc.groups.unshift({
      id: DEFAULT_USER_GROUP_ID,
      name: '普通组',
      description: '默认用户组；跟随后台能力/全案可见性',
      isDefault: true,
      mode: 'inherit_global',
      permissions: emptyGroupPermissions(),
    });
  }
  return doc;
}

export function emptyGroupPermissions(): UserGroupPermissions {
  return {
    categories: {},
    subcategories: {},
    capabilities: {},
    templates: {},
    templateGroups: {},
  };
}

export async function fetchUserGroupPermissionsAdmin(): Promise<UserGroupPermissionsDoc> {
  const endpoints = ['/api/saas/admin/user-groups', '/api/capabilities/admin/user-groups'];
  let lastError = '加载用户组失败';
  for (const path of endpoints) {
    const res = await authenticatedFetch(path);
    if (res.ok) {
      return normalizeUserGroupPermissionsDoc(await res.json());
    }
    const body = await res.json().catch(() => ({})) as { error?: string };
    lastError = typeof body.error === 'string'
      ? body.error
      : `加载用户组失败（HTTP ${res.status}）`;
    if (res.status !== 404) break;
  }
  throw new Error(lastError);
}

export async function saveUserGroupPermissionsAdmin(doc: UserGroupPermissionsDoc): Promise<UserGroupPermissionsDoc> {
  const endpoints = ['/api/saas/admin/user-groups', '/api/capabilities/admin/user-groups'];
  let lastError = '保存失败';
  for (const path of endpoints) {
    const res = await authenticatedFetch(path, {
      method: 'PUT',
      body: JSON.stringify(doc),
    });
    if (res.ok) {
      return normalizeUserGroupPermissionsDoc(await res.json());
    }
    const body = await res.json().catch(() => ({})) as { error?: string };
    lastError = typeof body.error === 'string'
      ? body.error
      : `保存失败（HTTP ${res.status}）`;
    if (res.status !== 404) break;
  }
  throw new Error(lastError);
}

export async function assignUserGroup(userId: number, groupId: string): Promise<void> {
  const res = await authenticatedFetch(`/api/saas/admin/users/${userId}/group`, {
    method: 'PATCH',
    body: JSON.stringify({ group_id: groupId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(typeof body.error === 'string' ? body.error : '分配用户组失败');
  }
}

export function isGroupCategoryAllowed(group: UserGroupDefinition, categoryId: string): boolean {
  if (group.mode !== 'restricted') return true;
  return group.permissions.categories[categoryId] !== false;
}

export function isGroupTemplateGroupAllowed(group: UserGroupDefinition, groupId: string): boolean {
  if (group.mode !== 'restricted') return true;
  return group.permissions.templateGroups[groupId] !== false;
}

export function setGroupCategoryAllowed(
  group: UserGroupDefinition,
  categoryId: string,
  visible: boolean,
): UserGroupDefinition {
  const permissions = {
    ...emptyGroupPermissions(),
    ...group.permissions,
    categories: { ...group.permissions.categories },
  };
  if (visible) delete permissions.categories[categoryId];
  else permissions.categories[categoryId] = false;
  return { ...group, permissions };
}

export function setGroupTemplateGroupAllowed(
  group: UserGroupDefinition,
  templateGroupId: string,
  visible: boolean,
): UserGroupDefinition {
  const permissions = {
    ...emptyGroupPermissions(),
    ...group.permissions,
    templateGroups: { ...group.permissions.templateGroups },
  };
  if (visible) delete permissions.templateGroups[templateGroupId];
  else permissions.templateGroups[templateGroupId] = false;
  return { ...group, permissions };
}
