/**
 * PD-SAAS-FORK: visualViewport-driven keyboard avoidance for the mobile shell.
 *
 * iOS Safari does not shrink the layout viewport when the soft keyboard opens,
 * so a `fixed inset-0` shell keeps its full height and the composer ends up
 * hidden behind the keyboard. This hook mirrors the *visual* viewport height
 * into the `--vvh` CSS variable (consumed by `.mobile-vvh-shell`) and reports
 * whether the keyboard is likely open so chrome (e.g. the bottom tab bar) can
 * get out of the way.
 */
import { useEffect, useState } from 'react';

const KEYBOARD_THRESHOLD_PX = 120;

export function useMobileViewport(enabled: boolean): { isKeyboardOpen: boolean } {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    const viewport = window.visualViewport;
    if (!viewport) return undefined;

    const root = document.documentElement;
    const sync = () => {
      const height = Math.round(viewport.height);
      root.style.setProperty('--vvh', `${height}px`);
      setIsKeyboardOpen(window.innerHeight - height > KEYBOARD_THRESHOLD_PX);
    };

    sync();
    viewport.addEventListener('resize', sync);
    viewport.addEventListener('scroll', sync);
    return () => {
      viewport.removeEventListener('resize', sync);
      viewport.removeEventListener('scroll', sync);
      root.style.removeProperty('--vvh');
    };
  }, [enabled]);

  return { isKeyboardOpen };
}
