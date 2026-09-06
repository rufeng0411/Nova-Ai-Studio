/**
 * PD-SAAS-FORK: User avatar upload / serve / remove.
 */
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { authenticateToken } from '../../middleware/auth.js';
import {
  USER_AVATAR_MAX_BYTES,
  validateUserAvatarFile,
} from '../../../shared/userAvatarConstraints.mjs';
import { updateUserPreferences } from '../userPreferences.js';
import {
  avatarContentTypeForPath,
  findUserAvatarPath,
  removeUserAvatarFiles,
  saveUserAvatarFile,
} from './avatarStore.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: USER_AVATAR_MAX_BYTES, files: 1 },
});

function resolveSaasUser(req) {
  const user = req.user;
  const userId = user?.id ?? user?.userId;
  const tenantId = user?.tenant_id ?? user?.tenantId;
  if (!userId || !tenantId) {
    return null;
  }
  return { userId, tenantId };
}

async function assertImageBuffer(buffer) {
  try {
    const meta = await sharp(buffer).metadata();
    if (!meta.width || !meta.height) {
      throw new Error('AVATAR_IMAGE_INVALID');
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'AVATAR_IMAGE_INVALID') {
      throw error;
    }
    throw new Error('AVATAR_IMAGE_INVALID');
  }
}

router.get('/me/avatar', authenticateToken, async (req, res) => {
  try {
    const identity = resolveSaasUser(req);
    if (!identity) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const filePath = await findUserAvatarPath(identity.tenantId, identity.userId);
    if (!filePath) {
      return res.status(404).json({ error: 'Avatar not found' });
    }
    res.setHeader('Content-Type', avatarContentTypeForPath(filePath));
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.sendFile(filePath);
  } catch (error) {
    console.error('[saas] avatar get error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/me/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    const identity = resolveSaasUser(req);
    if (!identity) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const file = req.file;
    if (!file?.buffer) {
      return res.status(400).json({ error: 'Avatar file is required', code: 'AVATAR_FILE_REQUIRED' });
    }

    const validation = validateUserAvatarFile({
      size: file.size,
      type: file.mimetype,
      name: file.originalname,
    });
    if (!validation.ok) {
      return res.status(400).json({ error: validation.code, code: validation.code });
    }

    await assertImageBuffer(file.buffer);

    await saveUserAvatarFile({
      tenantId: identity.tenantId,
      userId: identity.userId,
      buffer: file.buffer,
      mimeType: file.mimetype,
    });

    const avatarUpdatedAt = new Date().toISOString();
    const preferences = await updateUserPreferences(identity.userId, { avatarUpdatedAt });

    return res.json({
      success: true,
      avatarUpdatedAt: preferences.avatarUpdatedAt ?? avatarUpdatedAt,
    });
  } catch (error) {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'AVATAR_FILE_TOO_LARGE', code: 'AVATAR_FILE_TOO_LARGE' });
    }
    if (error instanceof Error && error.message.startsWith('AVATAR_')) {
      return res.status(400).json({ error: error.message, code: error.message });
    }
    console.error('[saas] avatar upload error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/me/avatar', authenticateToken, async (req, res) => {
  try {
    const identity = resolveSaasUser(req);
    if (!identity) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await removeUserAvatarFiles(identity.tenantId, identity.userId);
    const preferences = await updateUserPreferences(identity.userId, { avatarUpdatedAt: null });

    return res.json({ success: true, avatarUpdatedAt: preferences.avatarUpdatedAt ?? null });
  } catch (error) {
    console.error('[saas] avatar delete error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
