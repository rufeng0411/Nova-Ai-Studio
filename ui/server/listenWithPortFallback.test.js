import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import {
  listenWithPortFallback,
  pickRandomHighPort,
  PORT_FALLBACK_ATTEMPTS,
} from './lib/listenWithPortFallback.js';

function createMockServer(sequence) {
  const srv = new EventEmitter();
  srv.address = () => ({ port: sequence.boundPort ?? 3001 });
  srv.listen = vi.fn((port, host, cb) => {
    const step = sequence.steps.shift();
    if (step?.error) {
      queueMicrotask(() => srv.emit('error', step.error));
      return srv;
    }
    sequence.boundPort = step?.port ?? port;
    queueMicrotask(() => srv.emit('listening'));
    if (typeof cb === 'function') cb();
    return srv;
  });
  srv.removeListener = EventEmitter.prototype.removeListener.bind(srv);
  srv.once = EventEmitter.prototype.once.bind(srv);
  return srv;
}

describe('listenWithPortFallback', () => {
  it('pickRandomHighPort stays within the high port band', () => {
    expect(pickRandomHighPort(() => 0)).toBe(20000);
    expect(pickRandomHighPort(() => 0.999)).toBeLessThan(60000);
  });

  it('resolves the preferred port when it is free', async () => {
    const srv = createMockServer({ steps: [{ port: 3001 }] });
    const bound = await listenWithPortFallback(srv, 3001, '0.0.0.0', {
      pickPort: () => 24001,
    });
    expect(bound).toBe(3001);
  });

  it('retries on EADDRINUSE and resolves the fallback port', async () => {
    const srv = createMockServer({
      steps: [
        { error: Object.assign(new Error('in use'), { code: 'EADDRINUSE' }) },
        { port: 24002 },
      ],
    });
    const bound = await listenWithPortFallback(srv, 3001, '0.0.0.0', {
      pickPort: () => 24002,
      log: () => {},
    });
    expect(bound).toBe(24002);
  });

  it('returns null after max attempts are exhausted', async () => {
    const steps = Array.from({ length: PORT_FALLBACK_ATTEMPTS }, () => ({
      error: Object.assign(new Error('in use'), { code: 'EADDRINUSE' }),
    }));
    const srv = createMockServer({ steps });
    const bound = await listenWithPortFallback(srv, 3001, '0.0.0.0', {
      pickPort: () => 24003,
      log: () => {},
    });
    expect(bound).toBeNull();
  });

  it('rejects non-EADDRINUSE errors', async () => {
    const srv = createMockServer({
      steps: [{ error: Object.assign(new Error('permission denied'), { code: 'EACCES' }) }],
    });
    await expect(
      listenWithPortFallback(srv, 3001, '0.0.0.0', { pickPort: () => 24004, log: () => {} }),
    ).rejects.toMatchObject({ code: 'EACCES' });
  });
});
