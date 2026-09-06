/**
 * PD-SAAS-FORK: Billing API routes.
 */
import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { billingDb } from './store.js';
import { consumeCredit, softQuotaGate } from './quotaGate.js';
import { recordAnalyticsEvent } from '../analytics/store.js';

const router = express.Router();

router.get('/plans', authenticateToken, async (_req, res) => {
  const plans = await billingDb.listPlans();
  res.json({ plans });
});

router.get('/wallet', authenticateToken, async (req, res) => {
  const wallet = await billingDb.ensureWallet(req.user.id, 0);
  res.json(wallet);
});

router.post('/subscribe', authenticateToken, async (req, res) => {
  try {
    const { planId } = req.body ?? {};
    if (!planId) {
      return res.status(400).json({ error: 'planId is required' });
    }
    const subscription = await billingDb.subscribeUser(req.user.id, planId);
    await recordAnalyticsEvent('subscription', {
      userId: req.user.id,
      tenantId: req.user.tenant_id,
      payload: { planId },
    });
    const wallet = await billingDb.getWallet(req.user.id);
    res.json({ subscription, wallet });
  } catch (error) {
    if (error instanceof Error && error.message === 'plan_not_found') {
      return res.status(404).json({ error: 'Plan not found' });
    }
    console.error('[saas] subscribe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/credit', authenticateToken, requireAdmin, async (req, res) => {
  const { userId, amount, reason } = req.body ?? {};
  if (!userId || typeof amount !== 'number' || !Number.isFinite(amount) || amount === 0) {
    return res.status(400).json({ error: 'userId and a non-zero numeric amount are required' });
  }
  const wallet = await billingDb.addCredit(Number(userId), Math.trunc(amount), {
    reason: reason || 'admin_credit',
    createdBy: req.user.id,
  });
  const ledger = await billingDb.listLedger(Number(userId), 50);
  res.json({ wallet, ledger });
});

router.get('/admin/wallet/:userId', authenticateToken, requireAdmin, async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'valid userId is required' });
  }
  const wallet = await billingDb.ensureWallet(userId, 0);
  const ledger = await billingDb.listLedger(userId, 50);
  res.json({ wallet, ledger });
});

router.post('/consume', authenticateToken, softQuotaGate, async (req, res) => {
  const amount = Number(req.body?.amount ?? 1);
  const result = await consumeCredit(req.user.id, amount, req.body?.reason || 'manual_consume');
  if (!result.ok) {
    return res.status(402).json({
      error: '积分不足',
      softBlock: true,
      balance: result.balance,
    });
  }
  res.json({ balance: result.balance });
});

export default router;
