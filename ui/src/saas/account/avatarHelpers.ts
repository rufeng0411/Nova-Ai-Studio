import { AUTH_TOKEN_STORAGE_KEY } from '../../components/auth/constants';

export function buildUserAvatarUrl(avatarUpdatedAt: string | null | undefined): string | null {
  if (!avatarUpdatedAt) return null;
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (!token) return null;
  const v = encodeURIComponent(avatarUpdatedAt);
  const t = encodeURIComponent(token);
  return `/api/saas/me/avatar?token=${t}&v=${v}`;
}

export function readAvatarUpdatedAt(user: { avatarUpdatedAt?: unknown } | null | undefined): string | null {
  const value = user?.avatarUpdatedAt;
  return typeof value === 'string' && value.trim() ? value : null;
}
