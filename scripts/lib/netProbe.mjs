/**
 * PD-SAAS-FORK: Lightweight TCP reachability (no child shell processes).
 */
import { connect } from 'node:net';

export function isPortOpen(host, port, timeoutMs = 1500) {
  return new Promise((resolveCheck) => {
    const socket = connect({ host, port, timeout: timeoutMs });
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolveCheck(ok);
    };
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}
