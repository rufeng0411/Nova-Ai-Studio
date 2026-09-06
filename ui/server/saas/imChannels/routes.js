/**
 * PD-SAAS-FORK: Admin API for App IM chat adapters (wecom/dingtalk/whatsapp).
 */
import express from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  readPilotDeckConfigFile,
  writePilotDeckConfig,
} from '../../services/pilotdeckConfig.js';
import {
  applyImChannelEnableGate,
  maskImChannelAdapters,
  mergeImChannelPut,
} from './channelGate.mjs';

const router = express.Router();
router.use(authenticateToken, requireAdmin);

function resolveFlag() {
  const raw = String(process.env.PILOTDECK_IM_CHANNELS || 'off').trim().toLowerCase();
  if (raw === '1' || raw === 'true' || raw === 'enforce') return 'enforce';
  if (raw === 'shadow') return 'shadow';
  return 'off';
}

router.get('/', (_req, res) => {
  try {
    const { config, configPath } = readPilotDeckConfigFile();
    const adapters = config.adapters || {};
    res.json({
      flag: resolveFlag(),
      canEnable: resolveFlag() !== 'off',
      adapters: maskImChannelAdapters(adapters),
      path: configPath,
      warning:
        resolveFlag() === 'off'
          ? '平台未开放 IM 通道（PILOTDECK_IM_CHANNELS=off）：可保存凭证，但无法启用连接'
          : null,
    });
  } catch (error) {
    console.error('[saas/admin/im-channels]', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      code: 'im_channels_read_failed',
    });
  }
});

router.put('/', async (req, res) => {
  try {
    const body = req.body?.adapters || req.body || {};
    const { config } = readPilotDeckConfigFile();
    const prevAdapters = config.adapters || {};
    const { adapters, blockedEnable, flag } = mergeImChannelPut(prevAdapters, body, process.env);

    const nextConfig = {
      ...config,
      adapters: {
        ...prevAdapters,
        ...adapters,
      },
    };

    // Ensure gated values applied even if merge missed keys
    const gated = applyImChannelEnableGate(nextConfig.adapters, process.env);
    nextConfig.adapters = { ...nextConfig.adapters, ...gated.adapters };

    await writePilotDeckConfig(nextConfig);

    res.json({
      success: true,
      flag,
      canEnable: flag !== 'off',
      blockedEnable: blockedEnable.length ? blockedEnable : gated.blockedEnable,
      adapters: maskImChannelAdapters(nextConfig.adapters),
      reloadHint:
        blockedEnable.length || gated.blockedEnable.length
          ? '凭证已保存；平台未开放 IM 通道，启用未生效。请将 PILOTDECK_IM_CHANNELS 设为 shadow 或 enforce 后重试启用'
          : '配置已保存。启用通道后通常需重启 Gateway 才会连接',
    });
  } catch (error) {
    console.error('[saas/admin/im-channels]', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      code: 'im_channels_save_failed',
    });
  }
});

export default router;
