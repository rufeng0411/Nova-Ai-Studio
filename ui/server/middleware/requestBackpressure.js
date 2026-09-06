/**
 * PD-SAAS-FORK: in-process request semaphores to prevent Bridge event-loop wedging.
 */
const DEFAULT_LIMITS = {
  messages: Number(process.env.PILOTDECK_BACKPRESSURE_MESSAGES || 2),
  /** PD-SAAS-FORK: sidebar HTML export — separate from live session open to avoid 503 storms. */
  messages_export: Number(process.env.PILOTDECK_BACKPRESSURE_MESSAGES_EXPORT || 2),
  validate: Number(process.env.PILOTDECK_BACKPRESSURE_VALIDATE || 2),
  projects: Number(process.env.PILOTDECK_BACKPRESSURE_PROJECTS || 1),
  resolve: Number(process.env.PILOTDECK_BACKPRESSURE_RESOLVE || 3),
  thumbnail: Number(process.env.PILOTDECK_BACKPRESSURE_THUMBNAIL || 3),
};

const inflight = new Map();

/** Hard cap so a hung handler cannot permanently wedge the messages bucket. */
function resolveLeaseTimeoutMs() {
  const raw = process.env.PILOTDECK_BACKPRESSURE_LEASE_MS;
  if (raw != null && String(raw).trim() !== '') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return Math.max(50, parsed);
  }
  return 20_000;
}

function routeKey(kind, scope) {
  return `${kind}:${scope || 'global'}`;
}

function acquire(kind, scope, limit) {
  const key = routeKey(kind, scope);
  const current = inflight.get(key) ?? 0;
  if (current >= limit) {
    return false;
  }
  inflight.set(key, current + 1);
  return true;
}

function release(kind, scope) {
  const key = routeKey(kind, scope);
  const current = inflight.get(key) ?? 0;
  if (current <= 1) {
    inflight.delete(key);
  } else {
    inflight.set(key, current - 1);
  }
}

/**
 * @param {'messages'|'messages_export'|'validate'|'projects'|'resolve'|'thumbnail'} kind
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requestBackpressure(kind) {
  const limit = Number(process.env[`PILOTDECK_BACKPRESSURE_${kind.toUpperCase()}`]
    ?? DEFAULT_LIMITS[kind]
    ?? 1);

  return (req, res, next) => {
    if (process.env.PILOTDECK_REQUEST_BACKPRESSURE === '0') {
      next();
      return;
    }

    const tenantId = req.user?.tenant_id ?? req.user?.tenantId ?? 'anon';
    const scope = kind === 'validate' || kind === 'resolve' || kind === 'thumbnail'
      ? `${tenantId}:${req.params?.projectName ?? 'unknown'}`
      : kind === 'messages' || kind === 'messages_export'
        ? tenantId
        : 'global';

    if (!acquire(kind, scope, limit)) {
      res.setHeader('Retry-After', '2');
      res.status(503).json({
        ok: false,
        retryable: true,
        error: 'Server is busy, please retry shortly.',
      });
      return;
    }

    let released = false;
    const done = () => {
      if (released) return;
      released = true;
      if (leaseTimer) clearTimeout(leaseTimer);
      release(kind, scope);
    };
    // PD-SAAS-FORK: release even if the route hangs (no finish/close) so session open cannot stay 503 forever.
    const leaseMs = resolveLeaseTimeoutMs();
    const leaseTimer = setTimeout(() => {
      console.warn(`[backpressure] lease expired kind=${kind} scope=${scope} after ${leaseMs}ms`);
      done();
    }, leaseMs);
    leaseTimer.unref?.();
    res.on('finish', done);
    res.on('close', done);
    next();
  };
}

/** Test-only */
export function resetBackpressureForTests() {
  inflight.clear();
}

/**
 * Non-blocking acquire for background cache refresh (e.g. projects list).
 * @param {'messages'|'messages_export'|'validate'|'projects'|'resolve'|'thumbnail'} kind
 * @param {string} scope
 */
export function tryAcquireBackpressure(kind, scope = 'global') {
  if (process.env.PILOTDECK_REQUEST_BACKPRESSURE === '0') {
    return { acquired: true, release: () => {} };
  }
  const limit = Number(process.env[`PILOTDECK_BACKPRESSURE_${kind.toUpperCase()}`]
    ?? DEFAULT_LIMITS[kind]
    ?? 1);
  if (!acquire(kind, scope, limit)) {
    return { acquired: false, release: () => {} };
  }
  let released = false;
  return {
    acquired: true,
    release: () => {
      if (released) return;
      released = true;
      release(kind, scope);
    },
  };
}
