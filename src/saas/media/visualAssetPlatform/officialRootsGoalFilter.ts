// PD-SAAS-FORK VAP: scope official-source-roots registry per task — URL + registry hints only (no brand hardcoding).
import type { OfficialSourceRoot } from "../officialSourceRoots.js";
import { sanitizeUrlFromText } from "./urlSanitize.js";

const SKIP_HOST_LABELS = new Set(["com", "cn", "net", "org", "www"]);

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./u, "");
  } catch {
    return null;
  }
}

function registrableBase(host: string): string {
  const parts = host.split(".").filter(Boolean);
  if (parts.length >= 2) return parts.slice(-2).join(".");
  return host;
}

function normalizeGoalText(goalText: string): string {
  return goalText.trim().toLowerCase();
}

function goalContainsToken(goal: string, token: string): boolean {
  const normalized = token.trim().toLowerCase();
  if (!normalized || normalized.length < 2) return false;
  return goal.includes(normalized);
}

/** Host labels derived from rootUrl (e.g. nike.com → nike). Generic, not brand-specific. */
function hostnameHintTokens(root: OfficialSourceRoot): string[] {
  const host = hostnameOf(root.rootUrl);
  if (!host) return [];
  return host
    .split(".")
    .filter((label) => label.length >= 3 && !SKIP_HOST_LABELS.has(label));
}

/** Optional id segments (e.g. zongheng-chery → zongheng, chery). */
function rootIdHintTokens(root: OfficialSourceRoot): string[] {
  return root.id
    .split(/[._-]+/u)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length >= 3);
}

export function sourceUrlMatchesOfficialRoot(
  sourceUrl: string,
  root: OfficialSourceRoot,
): boolean {
  const sanitized = sanitizeUrlFromText(sourceUrl);
  if (!sanitized) return false;
  const sourceHost = hostnameOf(sanitized);
  const rootHost = hostnameOf(root.rootUrl);
  if (!sourceHost || !rootHost) return false;
  if (sourceHost === rootHost) return true;
  if (root.includeSubdomains !== false && sourceHost.endsWith(`.${rootHost}`)) {
    return true;
  }
  return registrableBase(sourceHost) === registrableBase(rootHost);
}

/**
 * Text match uses only registry-owned signals: matchHints[], id segments, rootUrl host labels.
 * Ops extend `config/official-source-roots.json` per brand — no TS allowlist.
 */
export function goalMentionsOfficialRoot(
  goalText: string,
  root: OfficialSourceRoot,
): boolean {
  const goal = normalizeGoalText(goalText);
  if (!goal) return false;

  for (const hint of root.matchHints ?? []) {
    if (goalContainsToken(goal, hint)) return true;
  }

  for (const token of rootIdHintTokens(root)) {
    if (goalContainsToken(goal, token)) return true;
  }

  for (const token of hostnameHintTokens(root)) {
    if (goalContainsToken(goal, token)) return true;
  }

  return false;
}

export function filterOfficialRootsForGoal(
  roots: OfficialSourceRoot[],
  input: {
    userGoal?: string;
    subject?: string;
    sourceUrls?: string[];
  },
): OfficialSourceRoot[] {
  if (roots.length === 0) return [];

  const goalText = `${input.userGoal ?? ""}\n${input.subject ?? ""}`.trim();
  const urls = (input.sourceUrls ?? [])
    .map((url) => sanitizeUrlFromText(url))
    .filter((url): url is string => Boolean(url));

  return roots.filter((root) => {
    if (urls.some((url) => sourceUrlMatchesOfficialRoot(url, root))) {
      return true;
    }
    return goalMentionsOfficialRoot(goalText, root);
  });
}
