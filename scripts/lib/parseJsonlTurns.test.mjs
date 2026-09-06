import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { parseJsonlFile } from './parseJsonlTurns.mjs';

test('parseJsonlFile indexes task deliverable ledger rows by turn', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pd-parse-ledger-'));
  const filePath = path.join(dir, 'session.jsonl');
  const ledgerRow = {
    type: 'task_deliverable_ledger',
    sessionId: 'web-s_parse',
    turnId: 'turn-1',
    sequence: 1,
    createdAt: '2026-06-23T00:00:00.000Z',
    record: {
      sessionId: 'web-s_parse',
      turnId: 'turn-1',
      apiPath: 'index.html',
      resolvedPath: 'artifacts/demo/index.html',
      source: 'tool',
      validationStatus: 'verified',
      displayRole: 'primary',
      acceptanceRole: 'required',
      resolvedBy: 'ledger',
    },
  };
  fs.writeFileSync(filePath, `${JSON.stringify(ledgerRow)}\n`, 'utf8');

  const parsed = parseJsonlFile(filePath);

  assert.equal(parsed.ledgerByTurnId.get('turn-1').length, 1);
  assert.equal(parsed.ledgerByTurnId.get('turn-1')[0].resolvedPath, 'artifacts/demo/index.html');
});
