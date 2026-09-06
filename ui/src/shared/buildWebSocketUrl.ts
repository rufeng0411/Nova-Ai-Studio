import { DISABLE_LOCAL_AUTH, IS_PLATFORM, IS_SAAS_MODE } from '../constants/config';

export type BuildWebSocketUrlOptions = {
  protocol?: string;
  host?: string;
  isPlatform?: boolean;
  disableLocalAuth?: boolean;
  isSaasMode?: boolean;
};

export function buildWebSocketUrl(
  token: string | null,
  options: BuildWebSocketUrlOptions = {},
): string {
  const isPlatform = options.isPlatform ?? IS_PLATFORM;
  const disableLocalAuth = options.disableLocalAuth ?? DISABLE_LOCAL_AUTH;
  const isSaasMode = options.isSaasMode ?? IS_SAAS_MODE;

  const protocol =
    options.protocol ??
    (typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? 'wss:'
      : 'ws:');
  const host =
    options.host ??
    (typeof window !== 'undefined' ? window.location.host : 'localhost');

  // SaaS always attaches JWT to the WebSocket URL.
  if (isSaasMode) {
    if (!token) {
      return `${protocol}//${host}/ws`;
    }
    return `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`;
  }

  if (isPlatform || disableLocalAuth || !token) {
    return `${protocol}//${host}/ws`;
  }
  return `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`;
}
