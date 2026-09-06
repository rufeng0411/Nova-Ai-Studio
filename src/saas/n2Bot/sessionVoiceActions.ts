// PD-SAAS-FORK: voice/text session actions for lock/complete/delete. Delete needs confirmToken.

import { isN2BotSession } from "./n2BotFlags.js";
import type { N2ElicitCard, N2OpsItem } from "./n2BotTypes.js";
import { novaLine, type NovaLocale } from "./novaPersona.js";

export type SessionVoiceAction =
  | { type: "lock"; sessionIds: string[] }
  | { type: "unlock"; sessionIds: string[] }
  | { type: "complete"; sessionIds: string[] }
  | { type: "uncomplete"; sessionIds: string[] }
  | { type: "delete_card"; card: N2ElicitCard }
  | { type: "delete_blocked_locked"; card: N2ElicitCard }
  | { type: "delete_execute"; sessionIds: string[]; confirmToken: string }
  | { type: "cancel" }
  | { type: "reject"; reason: "steward" | "cross_user" | "empty" };

export type SessionVoiceFlags = {
  locked?: boolean;
  completed?: boolean;
};

export type ResolveSessionVoiceInput = {
  kind:
    | "lock"
    | "unlock"
    | "complete_task"
    | "uncomplete_task"
    | "delete_record"
    | "confirm_delete"
    | "close";
  text: string;
  cards: N2OpsItem[];
  lastFocusCardId?: string;
  flagsBySessionId?: Record<string, SessionVoiceFlags>;
  pendingDelete?: { sessionIds: string[]; confirmToken: string };
  stewardSessionId?: string | null;
  viewerOwnedIds: string[];
  locale?: NovaLocale;
};

function matchCards(text: string, cards: N2OpsItem[], lastFocusCardId?: string): N2OpsItem[] {
  const t = text.toLowerCase();
  const named = cards.filter((c) => {
    const title = c.title.toLowerCase();
    if (title.length >= 2 && t.includes(title)) return true;
    const parts = title.split(/[\s_/.-]+/).filter((p) => p.length >= 2);
    return parts.some((p) => t.includes(p));
  });
  if (named.length) return named;
  if (/进行中|都锁/.test(text)) return cards.filter((c) => c.status === "run");
  if (lastFocusCardId) {
    const hit = cards.find((c) => c.workerSessionId === lastFocusCardId);
    if (hit) return [hit];
  }
  if (cards.length === 1) return [cards[0]];
  return [];
}

function makeToken(sessionIds: string[]): string {
  return `n2del:${sessionIds.slice().sort().join(",")}:${sessionIds.length}`;
}

export function resolveSessionVoiceAction(input: ResolveSessionVoiceInput): SessionVoiceAction {
  const locale = input.locale ?? "zh-CN";
  if (input.kind === "close") return { type: "cancel" };

  if (input.kind === "confirm_delete") {
    if (!input.pendingDelete?.confirmToken) {
      return { type: "reject", reason: "empty" };
    }
    return {
      type: "delete_execute",
      sessionIds: input.pendingDelete.sessionIds,
      confirmToken: input.pendingDelete.confirmToken,
    };
  }

  const matched = matchCards(input.text, input.cards, input.lastFocusCardId);
  const owned = new Set(input.viewerOwnedIds);
  const filtered = matched.filter((c) => {
    if (isN2BotSession(c.sessionKind) || c.workerSessionId === input.stewardSessionId) return false;
    return owned.has(c.workerSessionId);
  });
  const rejectedSteward = matched.some(
    (c) => isN2BotSession(c.sessionKind) || c.workerSessionId === input.stewardSessionId,
  );
  if (rejectedSteward && filtered.length === 0) return { type: "reject", reason: "steward" };
  const rejectedCross = matched.some((c) => !owned.has(c.workerSessionId));
  if (rejectedCross && filtered.length === 0) return { type: "reject", reason: "cross_user" };
  if (!filtered.length) return { type: "reject", reason: "empty" };
  const ids = filtered.map((c) => c.workerSessionId);

  if (input.kind === "lock") return { type: "lock", sessionIds: ids };
  if (input.kind === "unlock") return { type: "unlock", sessionIds: ids };
  if (input.kind === "complete_task") return { type: "complete", sessionIds: ids };
  if (input.kind === "uncomplete_task") return { type: "uncomplete", sessionIds: ids };

  if (input.kind === "delete_record") {
    const locked = ids.filter((id) => input.flagsBySessionId?.[id]?.locked);
    if (locked.length) {
      const card: N2ElicitCard = {
        id: "unlock-then-delete",
        kind: "unlock_then_delete",
        title: locale === "en" ? "Unlock first?" : "要先解锁再删吗？",
        body: novaLine("deleteBody", locale),
        sessionIds: ids,
        options: [
          { id: "unlock_delete", label: locale === "en" ? "Unlock and delete" : "解锁并删", recommended: true },
          { id: "unlock_only", label: locale === "en" ? "Unlock only" : "只解锁" },
          { id: "cancel", label: locale === "en" ? "Cancel" : "取消" },
        ],
      };
      return { type: "delete_blocked_locked", card };
    }
    const confirmToken = makeToken(ids);
    const card: N2ElicitCard = {
      id: "confirm-delete",
      kind: "confirm_delete",
      title: novaLine("deleteAsk", locale),
      body: novaLine("deleteBody", locale),
      confirmToken,
      sessionIds: ids,
      options: [
        { id: "confirm", label: locale === "en" ? "Delete" : "确定", recommended: true },
        { id: "cancel", label: locale === "en" ? "Skip" : "算了" },
      ],
    };
    return { type: "delete_card", card };
  }

  return { type: "reject", reason: "empty" };
}

export function isValidDeleteConfirmToken(token: string, sessionIds: string[]): boolean {
  return token === makeToken(sessionIds);
}
