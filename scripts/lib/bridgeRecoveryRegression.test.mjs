/**
 * PD-SAAS-FORK: regression guards for Goal-Loop Phase 2 recovery regressions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bridgePath = path.join(root, 'ui/server/pilotdeck-bridge.js');
const formalPath = path.join(root, 'ui/src/shared/formalRecoveryInterrupt.ts');

test('runChatViaGateway initializes gateway before stale-turn abort', () => {
  const src = fs.readFileSync(bridgePath, 'utf8');
  const fnStart = src.indexOf('export async function runChatViaGateway');
  assert.ok(fnStart >= 0, 'runChatViaGateway missing');
  const fnSlice = src.slice(fnStart, fnStart + 12_000);
  const gwDecl = fnSlice.indexOf('let gw = await getPilotDeckGateway()');
  const staleLog = fnSlice.indexOf('aborting stale turn');
  assert.ok(gwDecl >= 0, 'gateway acquisition missing');
  assert.ok(staleLog >= 0, 'stale abort block missing');
  assert.ok(
    gwDecl < staleLog,
    'gateway must be acquired before stale abort (prevents TDZ session_busy storm)',
  );
});

test('runChatViaGateway does not append success complete after turn_completed', () => {
  const src = fs.readFileSync(bridgePath, 'utf8');
  assert.match(src, /let sawTurnComplete = false/);
  assert.match(src, /if \(!sawTurnComplete\)/);
});

test('formalRecoveryInterrupt source never hides recoverable error bubbles', () => {
  const src = fs.readFileSync(formalPath, 'utf8');
  assert.match(src, /shouldHideTransientRecoveryNotice/);
  assert.doesNotMatch(
    src,
    /if \(options\.autoContinueEnabled\) return true/,
    'must not hide all notices when auto-continue is enabled',
  );
  assert.match(src, /return false;/);
});
