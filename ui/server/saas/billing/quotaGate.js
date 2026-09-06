/**
 * PD-SAAS-FORK: Soft quota gate — blocks when wallet balance <= 0.
 * N2-COMMUNITY-OVERLAY: personal edition skips chat quota (no 402 on empty wallet).
 */
import { billingDb } from './store.js';
import { isCommunityPersonal } from '../communityPersonal.js';

export async function softQuotaGate(req, res, next) {
  if (isCommunityPersonal()) {
    return next();
  }
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Authentication required', softBlock: true });
  }
  const wallet = await billingDb.ensureWallet(req.user.id, 0);
  if ((wallet?.balance ?? 0) <= 0) {
    return res.status(402).json({
      error: '积分不足，请订阅计划或联系管理员充值',
      softBlock: true,
      code: 'quota_exhausted',
    });
  }
  return next();
}

/**
 * Pre-flight check before starting a chat turn (WebSocket / agent).
 * @param {number} userId
 */
export async function checkChatQuota(userId) {
  if (isCommunityPersonal()) {
    return { ok: true, balance: Number.MAX_SAFE_INTEGER, community: true };
  }
  const wallet = await billingDb.ensureWallet(userId, 0);
  if ((wallet?.balance ?? 0) <= 0) {
    return {
      ok: false,
      code: 'quota_exhausted',
      message: '积分不足，请订阅计划或联系管理员充值',
    };
  }
  return { ok: true, balance: wallet.balance };
}

export async function consumeCredit(userId, amount = 1, reason = 'consume') {
  if (isCommunityPersonal()) {
    return { ok: true, balance: Number.MAX_SAFE_INTEGER, community: true };
  }
  const wallet = await billingDb.ensureWallet(userId, 0);
  if ((wallet?.balance ?? 0) < amount) {
    return { ok: false, balance: wallet?.balance ?? 0 };
  }
  const updated = await billingDb.addCredit(userId, -amount, { reason, createdBy: userId });
  return { ok: true, balance: updated.balance };
}
