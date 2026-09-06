/**
 * PD-SAAS-FORK: Per-user avatar files under tenant DATA_ROOT.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { getTenantRoot } from '../tenant/paths.js';
import { avatarExtensionForMime } from '../../../shared/userAvatarConstraints.mjs';

const AVATAR_FILE_NAMES = ['avatar.jpg', 'avatar.jpeg', 'avatar.png', 'avatar.webp'];

/**
 * @param {string} tenantId
 * @param {number | string} userId
 */
export function getUserAvatarDir(tenantId, userId) {
  return path.join(getTenantRoot(tenantId), 'account', 'users', String(userId));
}

/**
 * @param {string} tenantId
 * @param {number | string} userId
 */
export async function findUserAvatarPath(tenantId, userId) {
  const dir = getUserAvatarDir(tenantId, userId);
  for (const name of AVATAR_FILE_NAMES) {
    const fullPath = path.join(dir, name);
    try {
      await fs.access(fullPath);
      return fullPath;
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * @param {string} tenantId
 * @param {number | string} userId
 */
export async function removeUserAvatarFiles(tenantId, userId) {
  const dir = getUserAvatarDir(tenantId, userId);
  await Promise.all(
    AVATAR_FILE_NAMES.map(async (name) => {
      try {
        await fs.unlink(path.join(dir, name));
      } catch {
        /* ignore missing */
      }
    }),
  );
}

/**
 * @param {{ tenantId: string; userId: number | string; buffer: Buffer; mimeType: string }} input
 */
export async function saveUserAvatarFile({ tenantId, userId, buffer, mimeType }) {
  const ext = avatarExtensionForMime(mimeType);
  if (!ext) {
    throw new Error('AVATAR_FILE_TYPE_INVALID');
  }
  const dir = getUserAvatarDir(tenantId, userId);
  await fs.mkdir(dir, { recursive: true });
  await removeUserAvatarFiles(tenantId, userId);
  const fileName = ext === 'jpg' ? 'avatar.jpg' : `avatar.${ext}`;
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

/**
 * @param {string} filePath
 */
export function avatarContentTypeForPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}
