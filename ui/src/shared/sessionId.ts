/** Disk / Windows form: `web-s_<uuid>`; live WS form may use `web:s_<uuid>`. */
export function normalizeSessionId(id: string): string {
  return id.replace(/^web:s_/, 'web-s_');
}

export function isSameSessionId(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return normalizeSessionId(a) === normalizeSessionId(b);
}

export function sessionIdSetHas(set: Set<string> | undefined, sessionId: string): boolean {
  if (!set || set.size === 0) return false;
  if (set.has(sessionId)) return true;
  const normalized = normalizeSessionId(sessionId);
  for (const id of set) {
    if (isSameSessionId(id, normalized)) return true;
  }
  return false;
}
