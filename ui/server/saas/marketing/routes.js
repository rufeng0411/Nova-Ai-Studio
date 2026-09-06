// PD-SAAS-FORK: public marketing APIs + admin leads/invite/analytics
import express from 'express';
import { verifyCaptcha } from '../billing/captcha.js';
import { recordAnalyticsEvent } from '../analytics/store.js';
import { authenticateToken } from '../../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { registerShowcaseRoutes } from './showcaseRoutes.js';
import {
  isMarketingAnalyticsEnabled,
  isMarketingContactEnabled,
} from './marketingPathMatch.js';
import {
  getMarketingPagePublic,
  loadMarketingPage,
  saveMarketingPage,
} from './marketingPages.js';
import { getDataRoot } from '../tenant/paths.js';
import { checkMarketingRateLimit } from './rateLimit.js';
import { validateCollectPayload, validateContactPayload } from './validate.js';
import {
  aggregateMarketingAnalytics,
  createInviteCode,
  ensureDefaultInviteCode,
  hashMarketingIp,
  insertContactLead,
  insertPageEvent,
  listContactLeads,
  listInviteCodes,
  revokeInviteCode,
  updateContactLeadStatus,
} from './store.js';
import { getDefaultInviteCode } from './validate.js';

function clientIp(req) {
  const raw = req.headers['x-forwarded-for'] || req.ip || 'unknown';
  return String(raw).split(',')[0].trim() || 'unknown';
}

const publicRouter = express.Router();

publicRouter.post('/contact', async (req, res) => {
  try {
    if (!isMarketingContactEnabled()) {
      return res.status(404).json({ error: '联系功能暂未开放' });
    }
    const ip = clientIp(req);
    const global = checkMarketingRateLimit({
      key: 'mkt:contact:global',
      limit: 60,
      windowSec: 60,
    });
    if (!global.ok) {
      return res.status(429).json({
        error: '提交较多，请稍后再试',
        retryAfterSec: global.retryAfterSec,
      });
    }
    const perIp = checkMarketingRateLimit({
      key: `mkt:contact:ip:${ip}`,
      limit: 5,
      windowSec: 600,
    });
    if (!perIp.ok) {
      return res.status(429).json({
        error: '提交较多，请稍后再试',
        retryAfterSec: perIp.retryAfterSec,
      });
    }

    const parsed = validateContactPayload(req.body ?? {});
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }
    if (parsed.honeypot) {
      return res.status(204).end();
    }

    const { value } = parsed;
    if (!(await verifyCaptcha(value.captchaId, value.captchaAnswer))) {
      return res.status(400).json({ error: '验证码无效或已过期，请刷新后重试' });
    }

    await insertContactLead({
      displayName: value.displayName,
      email: value.email,
      phone: value.phone,
      company: value.company,
      message: value.message,
      ipHash: hashMarketingIp(ip),
      userAgent: String(req.headers['user-agent'] || '').slice(0, 512),
    });

    await recordAnalyticsEvent('marketing_contact_submit', {
      tenantId: null,
      userId: null,
      payload: { path: '/contact/' },
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error('[marketing] contact error:', error);
    return res.status(500).json({ error: '提交未成功，请稍后再试' });
  }
});

publicRouter.post('/collect', async (req, res) => {
  try {
    if (!isMarketingAnalyticsEnabled()) {
      return res.status(204).end();
    }
    const ip = clientIp(req);
    const perIp = checkMarketingRateLimit({
      key: `mkt:collect:ip:${ip}`,
      limit: 120,
      windowSec: 60,
    });
    if (!perIp.ok) {
      return res.status(429).json({ ok: false });
    }

    const parsed = validateCollectPayload(req.body ?? {});
    if (!parsed.ok) {
      return res.status(400).json({ ok: false });
    }

    const countryHint = String(
      req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || '',
    ).slice(0, 8);

    await insertPageEvent({
      ...parsed.value,
      ipHash: hashMarketingIp(ip),
      userAgent: String(req.headers['user-agent'] || '').slice(0, 512),
      countryHint: countryHint || null,
    });

    await recordAnalyticsEvent('marketing_page_view', {
      tenantId: null,
      userId: null,
      payload: { path: parsed.value.path },
    });

    return res.status(204).end();
  } catch (error) {
    console.error('[marketing] collect error:', error);
    return res.status(204).end();
  }
});

const adminRouter = express.Router();
adminRouter.use(authenticateToken, requireAdmin);

adminRouter.get('/leads', async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const leads = await listContactLeads({ status });
    res.json({ leads });
  } catch (error) {
    console.error('[marketing] list leads:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.patch('/leads/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body?.status || '').trim();
    if (!id || !['new', 'processing', 'done', 'spam'].includes(status)) {
      return res.status(400).json({ error: '无效状态' });
    }
    await updateContactLeadStatus(id, status);
    res.json({ ok: true });
  } catch (error) {
    console.error('[marketing] update lead:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.get('/invite-codes', async (_req, res) => {
  try {
    await ensureDefaultInviteCode();
    const codes = await listInviteCodes();
    res.json({ codes, defaultCode: getDefaultInviteCode() });
  } catch (error) {
    console.error('[marketing] list invites:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.post('/invite-codes', async (req, res) => {
  try {
    const note = String(req.body?.note || '').slice(0, 200);
    const count = Math.min(Math.max(Number(req.body?.count) || 1, 1), 20);
    const created = [];
    for (let i = 0; i < count; i += 1) {
      const row = await createInviteCode({
        createdBy: req.user?.id ?? null,
        note,
      });
      created.push(row.code);
    }
    res.json({ codes: created });
  } catch (error) {
    console.error('[marketing] create invite:', error);
    res.status(500).json({ error: '生成邀请码失败' });
  }
});

adminRouter.post('/invite-codes/:code/revoke', async (req, res) => {
  try {
    await revokeInviteCode(req.params.code);
    res.json({ ok: true });
  } catch (error) {
    if (String(error?.message || '') === 'default_invite_not_revocable') {
      return res.status(400).json({ error: '默认邀请码不可作废' });
    }
    console.error('[marketing] revoke invite:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.get('/analytics', async (req, res) => {
  try {
    const days = Number(req.query.days) || 14;
    const stats = await aggregateMarketingAnalytics({ days });
    res.json(stats);
  } catch (error) {
    console.error('[marketing] analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

publicRouter.get('/pages/:slug', (req, res) => {
  try {
    const lang = String(req.query.lang || 'zh');
    const payload = getMarketingPagePublic(req.params.slug, lang, { dataRoot: getDataRoot() });
    res.setHeader('Cache-Control', 'no-store');
    res.json(payload);
  } catch (error) {
    if (error?.code === 'invalid_slug' || error?.message === 'invalid_slug') {
      return res.status(404).json({ error: 'not_found' });
    }
    console.error('[marketing] public page:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.get('/pages/:slug', (req, res) => {
  try {
    const page = loadMarketingPage(req.params.slug, { dataRoot: getDataRoot() });
    res.json(page);
  } catch (error) {
    if (error?.code === 'invalid_slug' || error?.message === 'invalid_slug') {
      return res.status(404).json({ error: 'not_found' });
    }
    console.error('[marketing] admin get page:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.put('/pages/:slug', (req, res) => {
  try {
    const saved = saveMarketingPage(req.params.slug, req.body || {}, { dataRoot: getDataRoot() });
    res.json(saved);
  } catch (error) {
    if (error?.code === 'invalid_slug' || error?.message === 'invalid_slug') {
      return res.status(404).json({ error: 'not_found' });
    }
    if (error?.code === 'data_root_missing') {
      return res.status(500).json({ error: 'DATA_ROOT missing' });
    }
    console.error('[marketing] admin put page:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @param {import('express').Express} app
 */
export function registerMarketingRoutes(app) {
  app.use('/api/marketing', publicRouter);
  app.use('/api/saas/admin/marketing', adminRouter);
  registerShowcaseRoutes(app);
  void ensureDefaultInviteCode().catch((err) => {
    console.warn('[marketing] ensure default invite:', err?.message || err);
  });
}

export { publicRouter, adminRouter };
