// PD-SAAS-FORK (ROG Phase 8 PR-C1): user explicitly confirms task complete → stop repair.
import type { CanonicalMessage } from "../../model/index.js";

const ACK_PATTERN =
  /(?:已完成|没问题|可以了|不用改了|就这样|满意了|done|looks?\s*good|ok(?:ay)?)\s*[.!。！]?$/i;

const NEW_DELIVERABLE_PATTERN =
  /(?:再(?:做|改|加|来)|另外|改成|增加|页数|帮我|请做|重新做|还需要|还要|补充)/i;

/** User message indicates satisfaction without a new deliverable request. */
export function detectUserDeliverableAcknowledgment(text: string): boolean {
  const trimmed = String(text ?? "").trim();
  if (!trimmed || trimmed.length > 240) return false;
  if (!ACK_PATTERN.test(trimmed)) return false;
  if (NEW_DELIVERABLE_PATTERN.test(trimmed)) return false;
  return true;
}

export function findLatestUserDeliverableAcknowledgment(
  messages: CanonicalMessage[],
): { acknowledged: boolean; text?: string } {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.role !== "user") continue;
    const text = msg.content
      .filter((block): block is { type: "text"; text: string } => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!text) continue;
    if (detectUserDeliverableAcknowledgment(text)) {
      return { acknowledged: true, text };
    }
    break;
  }
  return { acknowledged: false };
}

export function isUserAcknowledgmentEnabled(): boolean {
  const raw = process.env.PILOTDECK_USER_DELIVERABLE_ACK;
  if (raw == null) return true;
  const value = raw.trim().toLowerCase();
  if (value === "0" || value === "false" || value === "off") return false;
  return true;
}
