/**
 * PD-SAAS-FORK: Admin API for outbound IM notify MCP config.
 */
import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { readMcpConfigFile, writeMcpConfigFile } from '../../services/mcpConfig.js';
import { getPilotDeckGateway, getPilotDeckGatewayIfReady } from '../../pilotdeck-bridge.js';
import { reloadGatewayExtensionsBestEffort } from '../../utils/reloadGatewayExtensionsBestEffort.js';
import {
  IM_NOTIFY_SERVER_KEY,
  buildImNotifyMcpServer,
  envToMaskedForm,
  validateNotifyWebhookUrl,
} from './configContract.mjs';

const router = express.Router();
router.use(authenticateToken, requireAdmin);

function resolveFlag() {
  const raw = String(process.env.PILOTDECK_IM_NOTIFY_MCP || 'off').trim().toLowerCase();
  if (raw === '1' || raw === 'true' || raw === 'enforce') return 'enforce';
  if (raw === 'shadow') return 'shadow';
  return 'off';
}

router.get('/', async (_req, res) => {
  try {
    const file = await readMcpConfigFile('global');
    const server = file.config?.mcpServers?.[IM_NOTIFY_SERVER_KEY] || null;
    const env = server?.env || {};
    res.json({
      flag: resolveFlag(),
      configured: Boolean(server),
      form: envToMaskedForm(env),
      serverKey: IM_NOTIFY_SERVER_KEY,
      path: file.path,
    });
  } catch (error) {
    console.error('[saas/admin/im-notify]', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      code: 'im_notify_read_failed',
    });
  }
});

router.put('/', async (req, res) => {
  try {
    const form = req.body?.form || req.body || {};
    if (form.wecom?.webhookUrl && !validateNotifyWebhookUrl(form.wecom.webhookUrl)
      && !String(form.wecom.webhookUrl).includes('••••')) {
      return res.status(400).json({ error: '企业微信 Webhook URL 无效', code: 'invalid_wecom_url' });
    }
    if (form.dingtalk?.webhookUrl && !validateNotifyWebhookUrl(form.dingtalk.webhookUrl)
      && !String(form.dingtalk.webhookUrl).includes('••••')) {
      return res.status(400).json({ error: '钉钉 Webhook URL 无效', code: 'invalid_dingtalk_url' });
    }

    const file = await readMcpConfigFile('global');
    const config = {
      ...file.config,
      mcpServers: { ...(file.config.mcpServers || {}) },
    };
    const existing = config.mcpServers[IM_NOTIFY_SERVER_KEY] || {};
    config.mcpServers[IM_NOTIFY_SERVER_KEY] = buildImNotifyMcpServer(form, existing);

    const saved = await writeMcpConfigFile('global', JSON.stringify(config));

    const reloadAttempt = await reloadGatewayExtensionsBestEffort({
      getIfReady: getPilotDeckGatewayIfReady,
      kickConnect: getPilotDeckGateway,
      input: { changedPaths: [saved.path] },
      timeoutMs: 4_000,
    });
    const reload = reloadAttempt.reloaded
      ? { reloaded: true }
      : { reloaded: false, error: reloadAttempt.warning };

    const server = saved.config?.mcpServers?.[IM_NOTIFY_SERVER_KEY];
    res.json({
      success: true,
      flag: resolveFlag(),
      form: envToMaskedForm(server?.env || {}),
      reload,
      reloadHint: reload?.reloaded
        ? '配置已保存，Gateway 已重载'
        : '配置已保存。若工具未出现，请重启 Gateway',
      path: saved.path,
    });
  } catch (error) {
    console.error('[saas/admin/im-notify]', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      code: 'im_notify_save_failed',
    });
  }
});

export default router;
