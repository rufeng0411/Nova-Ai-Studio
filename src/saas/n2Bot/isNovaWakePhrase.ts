// PD-SAAS-FORK: Hello Nova wake — sentence-start only.

const WAKE_RE =
  /^\s*(?:hello\s+nova|hey\s+nova|hi\s+nova|你好\s*nova|嗨\s*nova|嘿\s*nova)\b/i;

export function isNovaWakePhrase(text: string): boolean {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return false;
  return WAKE_RE.test(trimmed);
}

export function isNovaWakePhraseOnly(text: string): boolean {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return false;
  return /^(?:hello\s+nova|hey\s+nova|hi\s+nova|你好\s*nova|嗨\s*nova|嘿\s*nova)[.!?。！？\s]*$/i.test(
    trimmed,
  );
}
