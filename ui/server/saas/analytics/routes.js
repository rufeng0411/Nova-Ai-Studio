/**
 * PD-SAAS-FORK: Admin analytics API.
 */
import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { aggregateDashboardStats, getAdminUserLogs, listAdminUsers } from './store.js';
import { getRouterStatsSummary } from '../../pilotdeck-bridge.js';

const router = express.Router();

router.use(authenticateToken, requireAdmin);

router.get('/dashboard', async (_req, res) => {
  try {
    let routerStats = null;
    try {
      routerStats = getRouterStatsSummary();
    } catch {
      routerStats = null;
    }
    const stats = await aggregateDashboardStats({ routerStats });
    res.json(stats);
  } catch (error) {
    console.error('[saas] dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/users/:id/logs', async (req, res) => {
  try {
    const userId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    const logs = await getAdminUserLogs(userId);
    if (!logs) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(logs);
  } catch (error) {
    console.error('[saas] user logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const users = await listAdminUsers(search);
    res.json({ users });
  } catch (error) {
    console.error('[saas] admin users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/users/:id/group', async (req, res) => {
  try {
    const userId = Number.parseInt(String(req.params.id), 10);
    const groupId = typeof req.body?.group_id === 'string' ? req.body.group_id.trim() : '';
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    if (!groupId) {
      return res.status(400).json({ error: 'group_id is required' });
    }
    const { controlUserDb } = await import('../db/control.js');
    const { findUserGroupById, loadUserGroupPermissions } = await import(
      '../../../../scripts/lib/userGroupPermissions.mjs'
    );
    const group = findUserGroupById(groupId, loadUserGroupPermissions());
    if (!group) {
      return res.status(400).json({ error: 'Unknown group_id' });
    }
    const user = await controlUserDb.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await controlUserDb.setUserGroupId(userId, groupId);
    res.json({ ok: true, user_id: userId, group_id: groupId, group_name: group.name });
  } catch (error) {
    console.error('[saas] admin user group patch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
