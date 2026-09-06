import { useEffect, useState } from 'react';

/** Responsive inline deliverable thumb count for chat strip (PWA-aware). */
export function useInlineDeliverableSlots(): number {
  const [slots, setSlots] = useState(() => resolveInlineDeliverableSlots());

  useEffect(() => {
    const update = () => setSlots(resolveInlineDeliverableSlots());
    window.addEventListener('resize', update, { passive: true });
    return () => window.removeEventListener('resize', update);
  }, []);

  return slots;
}

function resolveInlineDeliverableSlots(): number {
  if (typeof window === 'undefined') return 3;
  const w = window.innerWidth;
  if (w < 480) return 2;
  if (w < 768) return 3;
  return 4;
}
