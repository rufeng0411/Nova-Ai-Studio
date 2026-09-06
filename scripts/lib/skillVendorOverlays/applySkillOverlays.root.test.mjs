import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  applySkillOverlays,
  injectAfterFrontmatter,
  SKILL_OVERLAY_REPO_ROOT,
  skillAbsDir,
} from './applySkillOverlays.mjs';

const NOVA_BLOCK = `<!-- NOVA-EXEC-BEGIN -->
## Nova fixture
- presentation.pptx
<!-- NOVA-EXEC-END -->
`;

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

describe('applySkillOverlays repo root', () => {
  it('resolves anth-docx inside this repo (not parent of repo)', () => {
    const anthDir = skillAbsDir('skills/vendor/anthropics-skills/anth-docx');
    assert.equal(existsSync(anthDir), true);
    assert.equal(
      anthDir.startsWith(SKILL_OVERLAY_REPO_ROOT),
      true,
      `anthDir=${anthDir} root=${SKILL_OVERLAY_REPO_ROOT}`,
    );
    const result = applySkillOverlays(['anth-docx']);
    assert.deepEqual(result.missing, []);
    assert.equal(result.applied.includes('anth-docx'), true);
  });

  it('anth-docx SKILL is not polluted by HyperFrames nova_exec', () => {
    const skillPath = path.join(
      SKILL_OVERLAY_REPO_ROOT,
      'skills/vendor/anthropics-skills/anth-docx/SKILL.md',
    );
    const text = readFileSync(skillPath, 'utf8');
    assert.equal(text.includes('render_hyperframes'), false);
    assert.equal(text.includes('promo.mp4'), false);
  });
});

describe('injectAfterFrontmatter', () => {
  it('inserts after YAML and is idempotent', () => {
    const dir = path.join(os.tmpdir(), `overlay-ff-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const skillPath = path.join(dir, 'SKILL.md');
    writeFileSync(
      skillPath,
      '---\nname: fixture\n---\n\n# Body\n',
      'utf8',
    );
    injectAfterFrontmatter(skillPath, NOVA_BLOCK);
    let text = readFileSync(skillPath, 'utf8');
    assert.equal(text.startsWith('---\n'), true);
    assert.equal(count(text, '<!-- NOVA-EXEC-BEGIN -->'), 1);
    const secondClose = text.indexOf('\n---\n', 4);
    assert.ok(secondClose > 0);
    const beginIdx = text.indexOf('<!-- NOVA-EXEC-BEGIN -->');
    assert.ok(beginIdx > secondClose);

    injectAfterFrontmatter(skillPath, NOVA_BLOCK);
    text = readFileSync(skillPath, 'utf8');
    assert.equal(count(text, '<!-- NOVA-EXEC-BEGIN -->'), 1);
    assert.equal(text.startsWith('---\n'), true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('throws when frontmatter is missing', () => {
    const dir = path.join(os.tmpdir(), `overlay-nofm-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const skillPath = path.join(dir, 'SKILL.md');
    writeFileSync(skillPath, '# no yaml\n', 'utf8');
    assert.throws(
      () => injectAfterFrontmatter(skillPath, NOVA_BLOCK),
      /missing YAML frontmatter/,
    );
    rmSync(dir, { recursive: true, force: true });
  });
});
