/**
 * PD-SAAS-FORK: tenant user preferences API.
 */
import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { getSaasRequestContext } from '../context.js';
import { getUserPreferences, updateUserPreferences } from '../userPreferences.js';
import { ensureSaasWorkspacesProvisioned } from '../storage/ensureWorkspaces.js';

const router = express.Router();

router.get('/me/preferences', authenticateToken, async (req, res) => {
  try {
    const prefs = await getUserPreferences(req.user?.id);
    res.json({ preferences: prefs });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.put('/me/preferences', authenticateToken, async (req, res) => {
  try {
    const partial = req.body?.preferences ?? req.body ?? {};
    const prefs = await updateUserPreferences(req.user?.id, partial);
    if (partial?.fileStorage) {
      const ctx = getSaasRequestContext();
      if (ctx?.userId && ctx?.tenantId) {
        await ensureSaasWorkspacesProvisioned(ctx);
      }
    }
    res.json({ preferences: prefs });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
