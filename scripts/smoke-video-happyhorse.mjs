#!/usr/bin/env node
/** PD-SAAS-FORK (ROG Phase 8 PR-V1): happyhorse video registry smoke. */
import { resolveVideoModelFallbackChain, isModelNotExistError } from '../src/saas/media/videoModelRegistry.ts';

const chain = resolveVideoModelFallbackChain('happyhorse-1.0-t2v');
if (chain.length < 2) {
  console.error('[fail] fallback chain too short', chain);
  process.exit(1);
}
if (!chain[0].includes('happyhorse')) {
  console.error('[fail] expected happyhorse first', chain);
  process.exit(1);
}
if (!isModelNotExistError('Model not exist')) {
  console.error('[fail] model not exist pattern');
  process.exit(1);
}
console.log('[ok] smoke:video:happyhorse registry', chain.join(' → '));
