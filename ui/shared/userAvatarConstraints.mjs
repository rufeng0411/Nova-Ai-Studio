/**
 * PD-SAAS-FORK: Shared avatar upload constraints (client + server).
 */

export const USER_AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const USER_AVATAR_ALLOWED_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const USER_AVATAR_ALLOWED_EXTENSIONS = Object.freeze(['jpg', 'jpeg', 'png', 'webp']);

export const USER_AVATAR_ACCEPT_ATTR = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

export const USER_AVATAR_FORMATS_LABEL = 'JPG、PNG、WebP';

export const USER_AVATAR_MAX_SIZE_LABEL = '2MB';

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * @param {number} bytes
 */
export function formatAvatarMaxSizeLabel(bytes = USER_AVATAR_MAX_BYTES) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1 && Number.isInteger(mb)) {
    return `${mb}MB`;
  }
  const kb = Math.round(bytes / 1024);
  return `${kb}KB`;
}

/**
 * @param {string} mime
 */
export function avatarExtensionForMime(mime) {
  return MIME_TO_EXT[mime] ?? null;
}

/**
 * @param {File | { size?: number; type?: string; name?: string }} file
 * @returns {{ ok: true } | { ok: false; code: string }}
 */
export function validateUserAvatarFile(file) {
  if (!file || typeof file.size !== 'number') {
    return { ok: false, code: 'AVATAR_FILE_REQUIRED' };
  }
  if (file.size <= 0) {
    return { ok: false, code: 'AVATAR_FILE_REQUIRED' };
  }
  if (file.size > USER_AVATAR_MAX_BYTES) {
    return { ok: false, code: 'AVATAR_FILE_TOO_LARGE' };
  }

  const mime = String(file.type || '').toLowerCase();
  if (!USER_AVATAR_ALLOWED_MIME_TYPES.includes(mime)) {
    const ext = String(file.name || '')
      .split('.')
      .pop()
      ?.toLowerCase();
    if (!ext || !USER_AVATAR_ALLOWED_EXTENSIONS.includes(ext)) {
      return { ok: false, code: 'AVATAR_FILE_TYPE_INVALID' };
    }
  }

  return { ok: true };
}
