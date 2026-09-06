import { describe, expect, it } from 'vitest';
import {
  USER_AVATAR_MAX_BYTES,
  formatAvatarMaxSizeLabel,
  validateUserAvatarFile,
} from './userAvatarConstraints.mjs';

describe('userAvatarConstraints', () => {
  it('accepts allowed image types within size limit', () => {
    expect(
      validateUserAvatarFile({ size: 1024, type: 'image/png', name: 'avatar.png' }),
    ).toEqual({ ok: true });
  });

  it('rejects oversize files', () => {
    expect(
      validateUserAvatarFile({ size: USER_AVATAR_MAX_BYTES + 1, type: 'image/jpeg', name: 'a.jpg' }),
    ).toEqual({ ok: false, code: 'AVATAR_FILE_TOO_LARGE' });
  });

  it('rejects unsupported mime types', () => {
    expect(
      validateUserAvatarFile({ size: 100, type: 'image/gif', name: 'a.gif' }),
    ).toEqual({ ok: false, code: 'AVATAR_FILE_TYPE_INVALID' });
  });

  it('formats max size label', () => {
    expect(formatAvatarMaxSizeLabel(USER_AVATAR_MAX_BYTES)).toBe('2MB');
  });
});
