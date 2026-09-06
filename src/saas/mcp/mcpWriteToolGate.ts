// PD-SAAS-FORK: hide destructive / write MCP tools unless explicitly allowlisted via env

const DEFAULT_BLOCKED_SUBSTRINGS = [
  'save_bill',
  'submit_bill',
  'audit_bill',
  'unaudit_bill',
  'delete_bill',
  'push_bill',
  'execute_operation',
  'save_voucher',
  'delete_voucher',
  'account_create',
  'account_update',
  'currency_create',
  'currency_update',
  'vouchertype_create',
  'vouchertype_update',
  'erp_approve_document',
  'erp_self_update',
  'invoice_create',
  'invoice_issue',
  'invoice_red',
  'create_invoice',
  'red_invoice',
  'issue_invoice',
];

function blockedList(): string[] {
  const raw = process.env.PILOTDECK_MCP_WRITE_TOOL_ALLOW?.trim();
  if (raw === '*') return [];
  const extraBlock = process.env.PILOTDECK_MCP_WRITE_TOOL_BLOCK?.trim();
  const base = [...DEFAULT_BLOCKED_SUBSTRINGS];
  if (extraBlock) {
    for (const part of extraBlock.split(',')) {
      const t = part.trim().toLowerCase();
      if (t) base.push(t);
    }
  }
  return base;
}

export function isMcpWriteToolBlocked(toolName: string): boolean {
  const allow = process.env.PILOTDECK_MCP_WRITE_TOOL_ALLOW?.trim();
  if (allow === '*') return false;
  const lower = String(toolName || '').toLowerCase();
  if (allow) {
    const allowed = new Set(
      allow.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    );
    if (allowed.has(lower) || allowed.has(lower.replace(/^mcp__[^_]+__/, ''))) {
      return false;
    }
  }
  const bare = lower.includes('__') ? lower.split('__').pop() || lower : lower;
  for (const needle of blockedList()) {
    if (bare.includes(needle) || lower.includes(needle)) return true;
  }
  return false;
}

export function filterMcpWriteToolsForDefaultPolicy<T extends { name: string }>(
  defs: T[],
): T[] {
  return defs.filter((d) => !isMcpWriteToolBlocked(d.name));
}
