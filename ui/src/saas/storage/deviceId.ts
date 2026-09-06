/**
 * PD-SAAS-FORK: stable browser device id for local workspace bindings.
 */
const STORAGE_KEY = 'nova-saas-device-id';

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && existing.trim()) {
      return existing.trim();
    }
    const next = randomId();
    localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return randomId();
  }
}

export function getDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Browser';
  const ua = navigator.userAgent;
  if (/iPhone|iPad/i.test(ua)) return 'Safari · iOS';
  if (/Android/i.test(ua)) return 'Chrome · Android';
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/Chrome/i.test(ua)) return 'Chrome';
  if (/Firefox/i.test(ua)) return 'Firefox';
  if (/Safari/i.test(ua)) return 'Safari';
  return 'Browser';
}
