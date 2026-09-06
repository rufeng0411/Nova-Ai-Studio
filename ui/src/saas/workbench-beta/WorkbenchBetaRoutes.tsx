// PD-SAAS-FORK: Beta route composition — AppShellV2 owns /p/... after prefix strip

import type { ReactNode } from 'react';
import BetaChatHost from './chat/BetaChatHost';
import { useBetaSidebarAnchors } from './layout/BetaSidebar';
import { useBetaTopbarAnchors } from './layout/BetaTopbar';

/**
 * Parallel chrome enhancers for the Beta shell. Welcome card grid mounts from
 * ChatInterfaceV2 when WorkbenchBetaSurface.active (not here).
 */
export default function WorkbenchBetaRoutes({ children }: { children: ReactNode }) {
  useBetaSidebarAnchors(true);
  useBetaTopbarAnchors(true);
  return <BetaChatHost>{children}</BetaChatHost>;
}
