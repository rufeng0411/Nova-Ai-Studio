import type { AuthUser } from '../../components/auth/types';

export const SAAS_ADMIN_ROLES = new Set(['super-admin', 'admin']);

export function isSaasAdmin(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  const role = typeof user.role === 'string' ? user.role : '';
  return SAAS_ADMIN_ROLES.has(role);
}

export function userInitials(username: string): string {
  const trimmed = username.trim();
  if (!trimmed) return '?';
  if (trimmed.length >= 2) return trimmed.slice(0, 2).toUpperCase();
  return trimmed[0].toUpperCase();
}
