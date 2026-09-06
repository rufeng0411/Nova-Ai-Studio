// PD-SAAS-FORK: thin host — AppShellV2 mounts ChatInterfaceV2; this marks Beta chat scope for e2e/tour

import type { ReactNode } from 'react';

/**
 * Composition marker for Beta chat. Production Beta shell wraps AppShellV2 (same hooks /
 * pipeline); this host exists so routes/tests can target `[data-beta-chat-host]`.
 */
export default function BetaChatHost({ children }: { children?: ReactNode }) {
  return (
    <div data-testid="wb-beta-chat-host" data-beta-chat-host="1" className="contents h-full">
      {children}
    </div>
  );
}
