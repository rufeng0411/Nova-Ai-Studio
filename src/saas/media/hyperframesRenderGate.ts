// PD-SAAS-FORK: process-local HyperFrames render concurrency gate

import { hyperframesMaxConcurrent } from "./hyperframesEngineFlags.js";

let active = 0;
const waiters: Array<() => void> = [];

export type HyperframesRenderLease = {
  release: () => void;
};

export function tryAcquireHyperframesRenderSlot(): HyperframesRenderLease | null {
  const max = hyperframesMaxConcurrent();
  if (active >= max) return null;
  active += 1;
  let released = false;
  return {
    release: () => {
      if (released) return;
      released = true;
      active = Math.max(0, active - 1);
      const next = waiters.shift();
      next?.();
    },
  };
}

export function getHyperframesRenderActiveCount(): number {
  return active;
}
