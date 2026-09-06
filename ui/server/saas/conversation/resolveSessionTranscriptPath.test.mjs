import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import {
  resolveSessionTranscriptAbsPath,
  sessionTranscriptBasenames,
} from './resolveSessionTranscriptPath.js';

test('sessionTranscriptBasenames includes web-s/web:s aliases', () => {
  const names = sessionTranscriptBasenames('web-s_abc');
  assert.ok(names.includes('web-s_abc'));
  assert.ok(names.includes('web:s_abc'));
});

test('resolveSessionTranscriptAbsPath prefers catalog rel path', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pd-transcript-'));
  const rel = 'projects/workspaces-test/chats/web-s_demo.jsonl';
  const abs = path.join(root, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, '{"type":"session_started"}\n', 'utf8');

  const resolved = await resolveSessionTranscriptAbsPath({
    sessionId: 'web-s_demo',
    tenantPilotHome: root,
    catalogTranscriptRel: rel,
  });
  assert.equal(resolved, abs);
  await fs.rm(root, { recursive: true, force: true });
});

test('resolveSessionTranscriptAbsPath scans tenant projects when catalog missing', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pd-transcript-'));
  const abs = path.join(root, 'projects', 'workspaces-x', 'chats', 'web-s_scan.jsonl');
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, '{"type":"session_started"}\n', 'utf8');

  const resolved = await resolveSessionTranscriptAbsPath({
    sessionId: 'web-s_scan',
    tenantPilotHome: root,
    catalogTranscriptRel: null,
  });
  assert.equal(resolved, abs);
  await fs.rm(root, { recursive: true, force: true });
});
