// PD-SAAS-FORK: forbid Postgres MCP pointing at SaaS control-plane DB

export type PostgresGuardResult =
  | { ok: true }
  | { ok: false; reason: string };

function parsePgUrl(raw: string): { host: string; port: string; database: string } | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  try {
    const withProto = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `postgresql://${trimmed}`;
    const u = new URL(withProto);
    const database = decodeURIComponent((u.pathname || '').replace(/^\//, '').split('/')[0] || '');
    return {
      host: (u.hostname || '').toLowerCase(),
      port: u.port || '5432',
      database: database.toLowerCase(),
    };
  } catch {
    return null;
  }
}

/**
 * Reject when business MCP URL targets the same host+port+dbname as SAAS_DATABASE_URL.
 */
export function assertPostgresMcpUrlAllowed(
  mcpConnectionString: string,
  controlPlaneUrl: string | undefined = process.env.SAAS_DATABASE_URL,
): PostgresGuardResult {
  const mcp = parsePgUrl(mcpConnectionString);
  if (!mcp) {
    return { ok: false, reason: 'invalid_postgres_url' };
  }
  if (!mcp.host || !mcp.database) {
    return { ok: false, reason: 'incomplete_postgres_url' };
  }
  const control = parsePgUrl(controlPlaneUrl || '');
  if (!control || !control.host || !control.database) {
    return { ok: true };
  }
  if (
    mcp.host === control.host
    && mcp.port === control.port
    && mcp.database === control.database
  ) {
    return { ok: false, reason: 'control_plane_database_forbidden' };
  }
  return { ok: true };
}

/** Strip or block postgres server env DATABASE_URL / args that hit control plane. */
export function sanitizePostgresMcpServerSpec(
  spec: { env?: Record<string, string>; args?: string[] },
  controlPlaneUrl?: string,
): { allowed: boolean; reason?: string } {
  const candidates: string[] = [];
  if (spec.env) {
    for (const key of ['POSTGRES_CONNECTION_STRING', 'DATABASE_URL', 'POSTGRES_URL']) {
      if (spec.env[key]) candidates.push(spec.env[key]);
    }
  }
  if (Array.isArray(spec.args)) {
    for (const arg of spec.args) {
      if (/postgres(ql)?:\/\//i.test(arg) || arg.includes('@')) candidates.push(arg);
    }
  }
  for (const c of candidates) {
    const r = assertPostgresMcpUrlAllowed(c, controlPlaneUrl);
    if (!r.ok) return { allowed: false, reason: r.reason };
  }
  return { allowed: true };
}
