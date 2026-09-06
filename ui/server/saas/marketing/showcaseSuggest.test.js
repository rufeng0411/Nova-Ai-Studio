import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { suggestShowcaseFromArtifacts } from './showcaseSuggest.js';

describe('suggestShowcaseFromArtifacts', () => {
  it('picks index.html + cover image and derives name from session title', () => {
    const files = [
      'artifacts/task-20260730-abcd1234/data-sources.md',
      'artifacts/task-20260730-abcd1234/assets/cover.png',
      'artifacts/task-20260730-abcd1234/report.md',
      'artifacts/task-20260730-abcd1234/index.html',
      'artifacts/task-20260730-abcd1234/skills/SKILL.md',
    ];
    const out = suggestShowcaseFromArtifacts(files, '南美旅居官网');
    assert.equal(out.name_zh, '南美旅居官网');
    assert.equal(out.href, 'artifacts/task-20260730-abcd1234/index.html');
    assert.equal(out.thumb, 'artifacts/task-20260730-abcd1234/assets/cover.png');
    assert.ok(out.sourceArtifactPaths.includes(out.href));
    assert.ok(out.sourceArtifactPaths.includes(out.thumb));
  });

  it('prefers slide-01 for nova decks when no html', () => {
    const files = [
      'artifacts/task-x/slide-03.png',
      'artifacts/task-x/slide-01.png',
      'artifacts/task-x/slide-manifest.json',
      'artifacts/task-x/presentation.pptx',
    ];
    const out = suggestShowcaseFromArtifacts(files, '');
    assert.equal(out.href, 'artifacts/task-x/presentation.pptx');
    assert.equal(out.thumb, 'artifacts/task-x/slide-01.png');
    assert.equal(out.name_zh, 'presentation');
  });
});
