// PD-SAAS-FORK: strip tools from T2 steward chat requests.

export function stripToolsFromChatPayload(body: Record<string, unknown>): Record<string, unknown> {
  const next = { ...body };
  delete next.tools;
  delete next.tool_choice;
  next.tools = [];
  next.n2BotTier = "T2";
  next.sessionKind = "n2_bot";
  next.acceptTurn = false;
  return next;
}

export function isForbiddenStewardAcceptTurn(sessionKind?: string | null): boolean {
  return sessionKind === "n2_bot";
}
