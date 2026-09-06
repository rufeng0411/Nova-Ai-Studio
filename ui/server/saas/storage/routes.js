/**
 * PD-SAAS-FORK: file storage API (Phase 2 cloud-only).
 */
import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { getStorageStatus, reconcileStorageForCurrentUser } from './fileStorageService.js';
import { syncAllForCurrentUser, syncWorkspaceByProjectName } from './syncHub.js';

const router = express.Router();

router.get('/storage/status', authenticateToken, async (req, res) => {
  try {
    const status = await getStorageStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/storage/reconcile', authenticateToken, async (req, res) => {
  try {
    const result = await reconcileStorageForCurrentUser();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/storage/sync-now', authenticateToken, async (req, res) => {
  try {
    const projectName = req.body?.projectName;
    const result = projectName
      ? await syncWorkspaceByProjectName(String(projectName))
      : await syncAllForCurrentUser();
    res.json({ ...result, skipped: 'cloud-only' });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
