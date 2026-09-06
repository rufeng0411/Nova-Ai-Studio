#!/usr/bin/env node
/**
 * PD-SAAS-FORK: hintDir must not walk full artifacts tree.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findArtifactFileMatches } from '../../ui/server/utils/pathInProject.js';

test('hintDir scopes search to turn directory only', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pd-hint-'));
  const hintDir = 'artifacts/deck-a';
  const otherDir = 'artifacts/deck-b';
  fs.mkdirSync(path.join(root, hintDir), { recursive: true });
  fs.mkdirSync(path.join(root, otherDir), { recursive: true });
  fs.writeFileSync(path.join(root, hintDir, 'slide-01.png'), 'a');
  fs.writeFileSync(path.join(root, otherDir, 'slide-01.png'), 'b');

  const matches = findArtifactFileMatches(root, 'slide-01.png', { hintDir });
  assert.equal(matches.length, 1);
  assert.match(matches[0].relative, /deck-a\/slide-01\.png$/);
});
