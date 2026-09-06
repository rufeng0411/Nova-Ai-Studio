import { describe, expect, it } from 'vitest';
import { isLikelyDeliverablePath } from './artifactPaths';
import {
  isSkillResourceUri,
  parseSkillResourceUri,
  skillAssetEditorPath,
  parseSkillAssetEditorPath,
} from './skillResourcePaths';

describe('skillResourcePaths', () => {
  it('detects diagram-maker reference URIs', () => {
    expect(isSkillResourceUri('diagram-maker:references:svg-template')).toBe(true);
    expect(isSkillResourceUri('diagram-maker:references:svg-template.md')).toBe(true);
    expect(isLikelyDeliverablePath('diagram-maker:references:svg-template.md')).toBe(false);
  });

  it('parses reference URI into slug and relative markdown path', () => {
    expect(parseSkillResourceUri('diagram-maker:references:svg-template')).toEqual({
      slug: 'diagram-maker',
      relativePath: 'references/svg-template.md',
    });
    expect(parseSkillResourceUri('C:/Users/demo/report.md')).toBeNull();
  });

  it('round-trips skill editor paths', () => {
    const editorPath = skillAssetEditorPath('diagram-maker', 'references/svg-template.md');
    expect(parseSkillAssetEditorPath(editorPath)).toEqual({
      slug: 'diagram-maker',
      relativePath: 'references/svg-template.md',
    });
  });
});
