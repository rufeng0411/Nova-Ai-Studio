/** PD-SAAS-FORK: user-visible product name (not internal PilotDeck identifiers). */
export const USER_FACING_PRODUCT_NAME = "NovaStudio";

export const ENGINE_LOG_PREFIX = `[${USER_FACING_PRODUCT_NAME}]`;

export function replaceUserFacingPilotDeckBrand(text: string): string {
  return String(text ?? "")
    .replace(/\[PilotDeck\]/gi, ENGINE_LOG_PREFIX)
    .replace(/\bPilotDeck\b/g, USER_FACING_PRODUCT_NAME);
}

export function formatEngineLog(message: string): string {
  return `${ENGINE_LOG_PREFIX} ${message}`;
}

export function subagentBudgetExceededUserMessage(estimated: number, budget: number): string {
  const est = estimated.toLocaleString("en-US");
  const cap = budget.toLocaleString("en-US");
  return `${ENGINE_LOG_PREFIX} 子任务上下文过大（约 ${est} tokens，上限 ${cap}），已停止执行。`;
}
