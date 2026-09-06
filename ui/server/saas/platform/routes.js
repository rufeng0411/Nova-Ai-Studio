/**
 * PD-SAAS-FORK: Platform-wide config summary (admin only).
 */
import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { getLegacyPilotHome } from '../legacyBridge.js';
import { billingDb } from '../billing/store.js';
import { getPilotDeckConfigPath } from '../../services/pilotdeckConfig.js';
import { getControlDbBackend } from '../db/control.js';

const router = express.Router();

router.get('/summary', authenticateToken, requireAdmin, async (_req, res) => {
  const plans = await billingDb.listPlans();
  res.json({
    legacyPilotHome: getLegacyPilotHome(process.env),
    configPath: getPilotDeckConfigPath(),
    plans,
    controlDbBackend: getControlDbBackend(),
    layers: {
      platform: 'Skills、MCP、模型池与 pilotdeck.yaml（全局共享）',
      tenant: '各租户 projects/ 与对话产物（DATA_ROOT 隔离）',
      shell: '登录、订阅、运营后台（control DB）',
    },
  });
});

export default router;
