import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDeliverableLinkContract } from './deliverableLinkContract.mjs';

test('buildDeliverableLinkContract uses one resolved path for all five entries', () => {
  const contract = buildDeliverableLinkContract({
    apiPath: 'index.html',
    resolvedPath: 'artifacts/campaign/demo/index.html',
    hintDir: 'artifacts/campaign/demo',
    turnArtifactDir: 'artifacts/campaign/demo',
    validationStatus: 'verified',
  });

  assert.equal(contract.path, 'artifacts/campaign/demo/index.html');
  assert.deepEqual(contract.entries, {
    bodyLink: 'artifacts/campaign/demo/index.html',
    deliverableCard: 'artifacts/campaign/demo/index.html',
    fileTree: 'artifacts/campaign/demo/index.html',
    rightDock: 'artifacts/campaign/demo/index.html',
    overlay: 'artifacts/campaign/demo/index.html',
  });
  assert.equal(contract.folderPath, 'artifacts/campaign/demo');
  assert.equal(contract.displayStatus, 'verified');
});

test('buildDeliverableLinkContract rejects phantom and internal process paths', () => {
  assert.equal(buildDeliverableLinkContract({
    apiPath: 'skills/open-design/SKILL.md',
    validationStatus: 'verified',
  }).displayStatus, 'hidden');
  assert.equal(buildDeliverableLinkContract({
    apiPath: 'artifacts/demo/create_ppt.py',
    validationStatus: 'verified',
  }).displayStatus, 'hidden');
});
