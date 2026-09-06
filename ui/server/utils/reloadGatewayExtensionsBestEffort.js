/**
 * PD-SAAS-FORK: admin save must not wait for a cold Gateway connect (up to 60s)
 * or an unbounded reload_extensions RPC — the UI fetch aborts at 12s (`fetch-timeout`).
 */

function withTimeout(promise, timeoutMs, label) {
  if (!timeoutMs || timeoutMs <= 0) return promise;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), timeoutMs);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function startBackgroundReload(kickConnect, reloadInput) {
  if (typeof kickConnect !== 'function') return;
  let pending;
  try {
    pending = Promise.resolve(kickConnect());
  } catch {
    return;
  }
  void pending
    .then((gateway) => {
      if (gateway?.reloadExtensions) return gateway.reloadExtensions(reloadInput);
      if (gateway?.reloadConfig) return gateway.reloadConfig();
      return undefined;
    })
    .catch(() => undefined);
}

/**
 * @param {{
 *   getIfReady: () => Promise<{ reloadExtensions?: Function, reloadConfig?: Function }|null|undefined>,
 *   kickConnect?: () => Promise<{ reloadExtensions?: Function, reloadConfig?: Function }|null|undefined>,
 *   input?: Record<string, unknown>,
 *   timeoutMs?: number,
 * }} options
 * @returns {Promise<{ reloaded: boolean, warning: string|null }>}
 */
export async function reloadGatewayExtensionsBestEffort(options) {
  const timeoutMs = Number(options?.timeoutMs) > 0 ? Number(options.timeoutMs) : 4_000;
  const reloadInput = options?.input && typeof options.input === 'object' ? options.input : {};

  let gateway = null;
  try {
    gateway = await options.getIfReady();
  } catch {
    gateway = null;
  }

  if (!gateway?.reloadExtensions && !gateway?.reloadConfig) {
    startBackgroundReload(options.kickConnect, reloadInput);
    return {
      reloaded: false,
      warning: '已保存，Gateway 未就绪，将在后台尝试重载企业 MCP。',
    };
  }

  try {
    const pending = gateway.reloadExtensions
      ? gateway.reloadExtensions(reloadInput)
      : gateway.reloadConfig();
    await withTimeout(pending, timeoutMs, 'mcp_reload_timeout');
    return { reloaded: true, warning: null };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    startBackgroundReload(options.kickConnect, reloadInput);
    return {
      reloaded: false,
      warning: `已保存功能开关，MCP 重载未完成（${detail}）。可稍后刷新或重启服务。`,
    };
  }
}
