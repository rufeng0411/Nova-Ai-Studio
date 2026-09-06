// PD-SAAS-FORK: non-blocking token saver fast path for first-turn TTFT

import type { CanonicalMessage } from "../../model/index.js";
import type { RouterTokenSaverConfig } from "../config/schema.js";
import { extractLastUserMessage } from "./extractLastUserMessage.js";

const SHORT_MESSAGE_CHAR_LIMIT = 240;

export type FastTokenSaverDecision = {
  tier: string;
  selection: { id: string; provider: string; model: string };
};

export function shouldUseNonBlockingTokenSaver(input: {
  isMainAgent: boolean;
  messages: CanonicalMessage[];
  orchestrating: boolean;
  customRouterActive: boolean;
}): boolean {
  if (!input.isMainAgent || input.orchestrating || input.customRouterActive) {
    return false;
  }
  return true;
}

export function resolveFastTokenSaverDecision(
  config: RouterTokenSaverConfig,
  messages: CanonicalMessage[],
): FastTokenSaverDecision {
  const defaultTierName = config.defaultTier;
  const defaultTier = config.tiers[defaultTierName];
  if (!defaultTier) {
    throw new Error(`Token saver default tier "${defaultTierName}" is not configured`);
  }

  const userMessage = extractLastUserMessage(messages);
  if (userMessage && userMessage.length <= SHORT_MESSAGE_CHAR_LIMIT && config.tiers.simple) {
    return {
      tier: "simple",
      selection: config.tiers.simple.model,
    };
  }

  return {
    tier: defaultTierName,
    selection: defaultTier.model,
  };
}
