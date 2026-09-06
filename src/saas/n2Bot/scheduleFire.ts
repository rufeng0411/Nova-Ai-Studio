// PD-SAAS-FORK: schedule fire — worker sessionKey only; never steward.

import { isN2BotSession } from "./n2BotFlags.js";

export type ScheduleFireInput = {
  sessionKey: string;
  message: string;
  expression?: string;
  runAt?: string;
  stewardSessionId?: string | null;
};

export type ScheduleFireResult =
  | { ok: true; sessionKey: string; message: string; schedule: { type: "cron"; expression: string } | { type: "once"; runAt: string } }
  | { ok: false; reason: "steward_session" | "missing_worker" | "missing_when" | "missing_message" };

export function assertWorkerScheduleTarget(
  sessionKey: string,
  stewardSessionId?: string | null,
): boolean {
  if (!sessionKey) return false;
  if (isN2BotSession(sessionKey)) return false;
  if (stewardSessionId && sessionKey === stewardSessionId) return false;
  return true;
}

export function buildScheduleFire(input: ScheduleFireInput): ScheduleFireResult {
  const sessionKey = String(input.sessionKey ?? "").trim();
  const message = String(input.message ?? "").trim();
  if (!message) return { ok: false, reason: "missing_message" };
  if (!assertWorkerScheduleTarget(sessionKey, input.stewardSessionId)) {
    return { ok: false, reason: "steward_session" };
  }
  if (!sessionKey) return { ok: false, reason: "missing_worker" };
  if (input.expression) {
    return {
      ok: true,
      sessionKey,
      message,
      schedule: { type: "cron", expression: input.expression },
    };
  }
  if (input.runAt) {
    return {
      ok: true,
      sessionKey,
      message,
      schedule: { type: "once", runAt: input.runAt },
    };
  }
  return { ok: false, reason: "missing_when" };
}

const NINE_AM = /每天\s*(?:早上)?\s*九[点時时]|每天\s*9\s*点|every\s+day\s+at\s+9/i;

export function parseScheduleUtterance(text: string): { expression?: string; message: string } | null {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return null;
  if (NINE_AM.test(trimmed)) {
    return {
      expression: "0 9 * * *",
      message: trimmed.replace(NINE_AM, "").replace(/^[，,。.\s]+/, "") || trimmed,
    };
  }
  if (/每天|every\s+day/i.test(trimmed)) {
    return { expression: "0 9 * * *", message: trimmed };
  }
  return { message: trimmed };
}

export function rewriteStewardCronSessionKey(input: {
  requestedSessionKey: string;
  stewardSessionId: string;
  workerSessionId: string;
}): string {
  if (input.requestedSessionKey === input.stewardSessionId) return input.workerSessionId;
  if (isN2BotSession(input.requestedSessionKey)) return input.workerSessionId;
  return input.requestedSessionKey;
}
