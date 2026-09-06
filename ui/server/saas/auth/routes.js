/**
 * PD-SAAS-FORK: SaaS login/register handlers (control DB).
 */
import bcrypt from 'bcrypt';
import { controlTenantDb, controlUserDb } from '../db/control.js';
import { bootstrapTenantLayout } from '../legacyBridge.js';
import { DEFAULT_TENANT_ID, tenantIdForUsername } from '../tenant/paths.js';
import { billingDb } from '../billing/store.js';
import { verifyCaptcha } from '../billing/captcha.js';
import { recordAnalyticsEvent } from '../analytics/store.js';
import { getUserPreferences } from '../userPreferences.js';
import { checkLoginRateLimit } from './loginRateLimit.js';
import { isRegisterInviteCodeEnabled } from '../marketing/marketingPathMatch.js';
import { assertInviteAvailable, redeemInviteCode } from '../marketing/store.js';

async function publicUser(row) {
  if (!row) return null;
  const prefs = await getUserPreferences(row.id);
  return {
    id: row.id,
    username: row.username,
    tenantId: row.tenant_id,
    role: row.role,
    avatarUpdatedAt: prefs.avatarUpdatedAt ?? null,
  };
}

export async function saasAuthStatus(_req, res) {
  try {
    const hasUsers = await controlUserDb.hasUsers();
    res.json({
      needsSetup: !hasUsers,
      isAuthenticated: false,
      authDisabled: false,
      saasMode: true,
    });
  } catch (error) {
    console.error('[saas] auth status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function saasRegister(req, res, { generateToken }) {
  if (String(process.env.PILOTDECK_COMMUNITY_PERSONAL || '').trim() === '1'
    || String(process.env.PILOTDECK_COMMUNITY_PERSONAL || '').trim() === 'true') {
    return res.status(403).json({ error: 'Registration is disabled' });
  }
  try {
    const clientIp = req.ip || req.headers?.['x-forwarded-for'] || 'unknown';
    const rate = await checkLoginRateLimit({
      ip: String(clientIp).split(',')[0].trim(),
      username: req.body?.username,
    });
    if (!rate.ok) {
      return res.status(429).json({
        error: '尝试次数过多，请稍后再试',
        retryAfterSec: rate.retryAfterSec,
      });
    }
    const { username, password, captchaId, captchaAnswer, inviteCode } = req.body ?? {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (!(await verifyCaptcha(captchaId, captchaAnswer))) {
      return res.status(400).json({ error: 'Invalid or expired captcha' });
    }
    if (username.length < 3 || password.length < 6) {
      return res.status(400).json({
        error: 'Username must be at least 3 characters, password at least 6 characters',
      });
    }

    // PD-SAAS-FORK: optional forced invite code (PILOTDECK_REGISTER_INVITE_CODE)
    let inviteOk = null;
    if (isRegisterInviteCodeEnabled()) {
      inviteOk = await assertInviteAvailable(inviteCode);
      if (!inviteOk.ok) {
        return res.status(400).json({ error: inviteOk.error });
      }
    }

    const existing = await controlUserDb.getUserByUsername(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const tenantId = tenantIdForUsername(username);
    await controlTenantDb.ensureTenant(tenantId, username);
    bootstrapTenantLayout(tenantId);
    const user = await controlUserDb.createUser({
      tenantId,
      username,
      passwordHash,
      role: 'member',
    });

    if (inviteOk) {
      const redeemed = await redeemInviteCode(inviteOk.code, user.id);
      if (!redeemed.ok) {
        console.warn('[saas] invite redeem after create failed:', redeemed.error);
        return res.status(400).json({ error: redeemed.error || '邀请码已被使用' });
      }
    }

    const token = generateToken(user);
    await controlUserDb.updateLastLogin(user.id);
    await billingDb.ensureWallet(user.id, 0);
    await billingDb.subscribeUser(user.id, 'trial');
    await recordAnalyticsEvent('register', {
      userId: user.id,
      tenantId: user.tenant_id,
    });

    res.json({
      success: true,
      user: await publicUser(user),
      token,
    });
  } catch (error) {
    console.error('[saas] registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function saasLogin(req, res, { generateToken }) {
  try {
    const clientIp = req.ip || req.headers?.['x-forwarded-for'] || 'unknown';
    const { username, password } = req.body ?? {};
    const rate = await checkLoginRateLimit({
      ip: String(clientIp).split(',')[0].trim(),
      username,
    });
    if (!rate.ok) {
      return res.status(429).json({
        error: '尝试次数过多，请稍后再试',
        retryAfterSec: rate.retryAfterSec,
      });
    }

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await controlUserDb.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = generateToken(user);
    await controlUserDb.updateLastLogin(user.id);
    await recordAnalyticsEvent('login', {
      userId: user.id,
      tenantId: user.tenant_id,
    });

    res.json({
      success: true,
      user: await publicUser(user),
      token,
    });
  } catch (error) {
    console.error('[saas] login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function saasChangePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    const userId = req.user?.id ?? req.user?.userId;
    const user = await controlUserDb.getUserWithHashById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'New password must differ from the current password' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await controlUserDb.updatePassword(user.id, passwordHash);
    await recordAnalyticsEvent('password_change', {
      userId: user.id,
      tenantId: user.tenant_id,
    });
    res.json({ success: true });
  } catch (error) {
    console.error('[saas] change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function saasCurrentUser(req, res) {
  try {
    const user = req.user;
    const prefs = await getUserPreferences(user.id);
    res.json({
      user: {
        id: user.id,
        username: user.username,
        tenantId: user.tenant_id ?? user.tenantId,
        role: user.role,
        created_at: user.created_at,
        last_login: user.last_login,
        avatarUpdatedAt: prefs.avatarUpdatedAt ?? null,
      },
    });
  } catch (error) {
    console.error('[saas] current user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
