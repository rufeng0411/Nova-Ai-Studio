import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateSlideManifest } from './novaSlideManifestValidate.mjs';

const baseManifest = {
  skill_version: '1.0.0',
  deck_title: 'Test Deck',
  idea_prompt: 'topic',
  preset_id: 'tech-modern',
  template_style: 'style text',
  aspect_ratio: '16:9',
  language: 'zh',
  detail_level: 'default',
  page_count: 2,
  pages: [
    {
      page_index: 1,
      title: 'Cover',
      page_description: 'Cover slide',
      image_path: 'slide-01.png',
      status: 'completed',
    },
    {
      page_index: 2,
      title: 'Body',
      page_description: 'Body slide',
      image_path: 'slide-02.png',
      status: 'completed',
    },
  ],
};

describe('validateSlideManifest', () => {
  it('accepts a well-formed manifest', () => {
    const result = validateSlideManifest(baseManifest);
    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
  });

  it('rejects invalid aspect_ratio like 9.md', () => {
    const result = validateSlideManifest({ ...baseManifest, aspect_ratio: '9.md' });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /aspect_ratio/);
  });

  it('rejects page_count mismatch', () => {
    const result = validateSlideManifest({ ...baseManifest, page_count: 3 });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /page_count/);
  });

  it('rejects non-contiguous page_index', () => {
    const broken = {
      ...baseManifest,
      pages: [
        { ...baseManifest.pages[0], page_index: 1 },
        { ...baseManifest.pages[1], page_index: 3 },
      ],
    };
    const result = validateSlideManifest(broken);
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /missing page_index 2/);
  });
});
