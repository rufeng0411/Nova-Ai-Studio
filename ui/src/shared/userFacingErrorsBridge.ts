// PD-SAAS-FORK: UI bridge to engine userFacingErrors (browser-safe re-exports)

export type RecoveryExhaustedCategory = 'network' | 'model' | 'tool' | 'stuck' | 'unknown';

export function classifyRecoveryExhaustedCategory(
  code?: string,
  raw?: string,
): RecoveryExhaustedCategory {
  const text = String(raw ?? '');
  if (/fetch failed|network|econnreset|etimedout|timeout/i.test(text)) {
    if (/econnreset|websocket|ws proxy|gateway|1006/i.test(text)) return 'stuck';
    return 'network';
  }
  if (code === 'agent_model_error' || /model|provider|api key|unauthorized|401|403/i.test(text)) {
    return 'model';
  }
  if (code === 'agent_tool_error_loop') return 'stuck';
  if (code?.startsWith('tool_') || code === 'agent_tool_error') return 'tool';
  return 'unknown';
}
