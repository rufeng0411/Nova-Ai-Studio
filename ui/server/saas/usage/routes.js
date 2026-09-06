/**
 * PD-SAAS-FORK: Router token-usage API.
 */
import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { aggregateRouterUsage } from './store.js';
import { getRouterDashboardData } from '../../pilotdeck-bridge.js';

const router = express.Router();

function loadDashboard() {
  try {
    return getRouterDashboardData();
  } catch (error) {
    console.warn('[saas] usage dashboard load failed:', error instanceof Error ? error.message : error);
    return { projects: [], overall: {} };
  }
}

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const dashboard = loadDashboard();
    const usage = await aggregateRouterUsage(dashboard, { filterUserId: req.user.id });
    res.json({
      total: usage.total,
      byProject: usage.byProject,
      byModel: usage.byModel,
      lastUpdatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[saas] usage/me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/admin', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const dashboard = loadDashboard();
    const filterUserId = req.query.userId ? Number(req.query.userId) : null;
    const usage = await aggregateRouterUsage(dashboard, { filterUserId });
    res.json({
      total: usage.total,
      byUser: usage.byUser,
      byProject: usage.byProject,
      byModel: usage.byModel,
      attributed: usage.attributed,
      backgroundAttributed: usage.backgroundAttributed,
      unattributed: usage.unattributed,
      lastUpdatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[saas] usage/admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
