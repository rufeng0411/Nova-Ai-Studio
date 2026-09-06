// PD-SAAS-FORK VAP: sanitize URLs embedded in user goal text.

const URL_RE = /https?:\/\/[^\s，。；、）)\]】」"'<>]+/giu;

export function sanitizeUrlFromText(raw: string): string | null {
  let trimmed = String(raw ?? "").trim();
  const urlMatch = trimmed.match(/https?:\/\/[^\s，。；、）)\]】」"'<>]+/iu);
  if (urlMatch) {
    trimmed = urlMatch[0]!;
  }
  trimmed = trimmed.replace(/[),.]+$/u, "");
  trimmed = trimmed.replace(/[\u3000-\u303f\uff0c-\uff65，。；、）】」"'<>]+$/u, "");
  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function extractSourceUrlsFromGoal(userGoal: string): string[] {
  const matches = String(userGoal ?? "").match(URL_RE) ?? [];
  const unique = new Set<string>();
  for (const match of matches) {
    const sanitized = sanitizeUrlFromText(match);
    if (sanitized) unique.add(sanitized);
  }
  return [...unique];
}
