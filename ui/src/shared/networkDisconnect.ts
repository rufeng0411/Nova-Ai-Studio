// PD-SAAS-FORK: fail-fast Bridge cleanup when WS drops or browser goes offline.
import { cancelAllPendingNetworkRequests } from './networkFetchRegistry';
import { cancelSessionTailPrefetches } from '../stores/sessionMessageTailPrefetch';

let lastDisconnectAt = 0;

export function handleNetworkDisconnect(reason = 'network-disconnected'): void {
  const now = Date.now();
  if (now - lastDisconnectAt < 250) return;
  lastDisconnectAt = now;
  cancelSessionTailPrefetches();
  cancelAllPendingNetworkRequests(reason);
}

export function resetNetworkDisconnectGuardForTests(): void {
  lastDisconnectAt = 0;
}
