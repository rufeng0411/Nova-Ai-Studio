import { describe, expect, it } from 'vitest';
import {
  isScopeIdArtifactDir,
  resolveLegacyPathMode,
  shouldPreferMetaPath,
  shouldRejectHintDirMtimeGuess,
} from './legacyPathMode';

describe('legacyPathMode', () => {
  it('uses legacy mode when persisted meta exists', () => {
    expect(resolveLegacyPathMode({
      hasPersistedMeta: true,
      turnArtifactDir: 'artifacts/slides-argentina-a1b2c3d4',
    })).toBe('legacy');
  });

  it('uses strict mode for scopeId artifact dirs on new turns', () => {
    expect(resolveLegacyPathMode({
      turnArtifactDir: 'artifacts/slides-argentina-a1b2c3d4',
      scopeId: 'a1b2c3d4',
    })).toBe('strict');
    expect(isScopeIdArtifactDir('artifacts/slides-argentina-a1b2c3d4')).toBe(true);
  });

  it('uses legacy mode for old slides dirs without scopeId suffix', () => {
    expect(resolveLegacyPathMode({
      turnArtifactDir: 'artifacts/slides-argentina',
    })).toBe('legacy');
    expect(isScopeIdArtifactDir('artifacts/slides-argentina')).toBe(false);
  });

  it('maps mode to meta preference and mtime rejection', () => {
    expect(shouldPreferMetaPath('legacy')).toBe(true);
    expect(shouldPreferMetaPath('strict')).toBe(false);
    expect(shouldRejectHintDirMtimeGuess('strict')).toBe(true);
    expect(shouldRejectHintDirMtimeGuess('legacy')).toBe(false);
  });
});
