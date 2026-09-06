#!/usr/bin/env node
/** PD-SAAS-FORK: deliverable_repair bridge smoke (offline wiring check) */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const emitter = readFileSync(path.join(root, 'ui/server/saas/deliverables/deliverableRepairEmitter.js'), 'utf8');
const bridge = readFileSync(path.join(root, 'ui/server/pilotdeck-bridge.js'), 'utf8');
const hook = readFileSync(path.join(root, 'ui/src/components/chat-v2/hooks/useAutoRecoveryContinue.ts'), 'utf8');

assert.match(emitter, /maybeEmitDeliverableRepair/);
assert.match(emitter, /deliverable_repair/);
assert.match(bridge, /scheduleDeliverableRepairCheck|deliverable_repair/);
assert.match(hook, /deliverable_repair/);
console.log('[integration-deliverable-repair-bridge] ok');
