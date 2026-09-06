#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Serial Playwright F-chapter + radiation specs (workers=1).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  acquireGateLock,
  assertGatePhaseAllowed,
  releaseGateLock,
} from './lib/gateMutex.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const E2E_SPECS = [
  'ui/e2e/chat-experience.spec.ts',
  'ui/e2e/saas/isolation.spec.ts',
  'ui/e2e/saas/resilience-recovery.spec.ts',
  'ui/e2e/saas/long-session.spec.ts',
  'ui/e2e/saas/deep-uat.spec.ts',
  'ui/e2e/saas/process-ux-live.spec.ts',
  'ui/e2e/saas/deliverable-ppt.spec.ts',
  'ui/e2e/saas/deliverable-doc.spec.ts',
  'ui/e2e/path-folder-picker.spec.ts',
  'ui/e2e/saas/history-messages-perf.spec.ts',
  'ui/e2e/design-canvas/phase6-dock-deliverable.spec.ts',
];

function runPlaywright() {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  return new Promise((resolve, reject) => {
    const child = spawn(
      npx,
      [
        'playwright',
        'test',
        '-c',
        'ui/playwright.config.ts',
        '--workers=1',
        ...E2E_SPECS,
      ],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, PLAYWRIGHT_BASE_URL: baseUrl },
        stdio: 'inherit',
        shell: process.platform === 'win32',
        windowsHide: true,
      },
    );
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve(0);
      else reject(new Error(`playwright exit ${code}`));
    });
  });
}

async function main() {
  const phaseCheck = assertGatePhaseAllowed('e2e');
  if (!phaseCheck.ok) {
    console.error(`[prelaunch-e2e-serial] blocked: ${phaseCheck.reason}`);
    process.exit(1);
  }
  const lock = acquireGateLock({ phase: 'e2e', holder: 'run-prelaunch-e2e-serial.mjs' });
  if (!lock.ok) {
    console.error(`[prelaunch-e2e-serial] cannot acquire lock: ${lock.reason}`);
    process.exit(1);
  }

  console.log(`[prelaunch-e2e-serial] ${E2E_SPECS.length} specs, workers=1`);
  try {
    await runPlaywright();
    console.log('[prelaunch-e2e-serial] PASS');
  } finally {
    releaseGateLock({ phase: 'e2e' });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  releaseGateLock({ phase: 'e2e' });
  process.exit(1);
});
