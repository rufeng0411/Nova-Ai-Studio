/**
 * PD-SAAS-FORK: 用户组与组级能力/全案权限（管理员）
 */
import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  loadUserGroupPermissions,
  normalizeUserGroupPermissionsDoc,
  saveUserGroupPermissions,
  invalidateUserGroupPermissionsCache,
} from '../../../../scripts/lib/userGroupPermissions.mjs';
import { capabilitiesHubKeyPattern } from '../cache/cacheKeys.js';
import { cacheDelByPattern } from '../cache/redisClient.js';

const router = express.Router();

router.use(authenticateToken, requireAdmin);

router.get('/', (_req, res) => {
  try {
    res.json(loadUserGroupPermissions());
  } catch (error) {
    console.error('[saas/admin/user-groups]', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      code: 'user_groups_read_failed',
    });
  }
});

router.put('/', async (req, res) => {
  try {
    const saved = saveUserGroupPermissions(normalizeUserGroupPermissionsDoc(req.body));
    invalidateUserGroupPermissionsCache();
    await cacheDelByPattern(capabilitiesHubKeyPattern());
    res.json(saved);
  } catch (error) {
    console.error('[saas/admin/user-groups]', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      code: 'user_groups_save_failed',
    });
  }
});

export default router;
