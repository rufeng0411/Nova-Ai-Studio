import { isSyntheticSessionTitlePrompt } from "../../agent/errors/userFacingErrors.js";

type SessionPresentationInput = {
  sessionId: string;
  summary?: string;
  firstPrompt?: string;
  tag?: string;
};

export type LegacySessionPresentation = {
  title: string;
  summary: string;
  name: string;
  tag?: string;
};

const CRON_SESSION_PREFIX = "cron:";
const CRON_TITLE_PREFIX = "[Cron] ";

function resolveSessionBaseLabel(session: SessionPresentationInput): string {
  const candidates = [session.summary, session.firstPrompt, session.sessionId];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    if (!isSyntheticSessionTitlePrompt(trimmed)) {
      return trimmed;
    }
  }
  return session.sessionId;
}

export function mapLegacySessionPresentation(
  session: SessionPresentationInput,
): LegacySessionPresentation {
  const baseLabel = resolveSessionBaseLabel(session);
  const isCronSession = session.sessionId.startsWith(CRON_SESSION_PREFIX);
  const label = isCronSession && !baseLabel.startsWith(CRON_TITLE_PREFIX)
    ? `${CRON_TITLE_PREFIX}${baseLabel}`
    : baseLabel;

  return {
    title: label,
    summary: label,
    name: label,
    tag: session.tag ?? (isCronSession ? "cron" : undefined),
  };
}
