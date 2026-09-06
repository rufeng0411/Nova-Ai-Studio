// PD-SAAS-FORK: 运行时 UI feature flags — Bridge 读 env，覆盖 Vite 构建默认值

import express from 'express';
import {
  resolveBentoDeckEditorEnabledEffective,
  resolveMdBrowserToolEnabledEffective,
  resolveN2BotModeEffective,
  resolvePreflightStudioModeEffective,
} from '../../../scripts/lib/platformFeatures.mjs';
import { resolveAllBatch1McpFeaturesEffective } from '../../../scripts/lib/mcpFeatureFlags.mjs';



const router = express.Router();



function envEnabled(key, defaultOn = false) {

  const raw = process.env[key];

  if (raw === '1' || raw === 'true' || raw === 'on') return true;

  if (raw === '0' || raw === 'false' || raw === 'off') return false;

  return defaultOn;

}



/** GET /api/runtime/feature-flags */

router.get('/', (_req, res) => {

  res.set('Cache-Control', 'no-store');

  res.json({

    PILOTDECK_UI_DELIVERABLE_CERTIFICATE: envEnabled('PILOTDECK_UI_DELIVERABLE_CERTIFICATE'),

    PILOTDECK_UI_DELIVERABLE_QUALITY: envEnabled('PILOTDECK_UI_DELIVERABLE_QUALITY'),

    PILOTDECK_UI_EXPORT_SNAPSHOT_V2: envEnabled('PILOTDECK_UI_EXPORT_SNAPSHOT_V2'),

    PILOTDECK_UI_EXPORT_USER_AUDIT_MODES: envEnabled('PILOTDECK_UI_EXPORT_USER_AUDIT_MODES'),

    PILOTDECK_UI_VISUAL_BINDING_AUDIT: envEnabled('PILOTDECK_UI_VISUAL_BINDING_AUDIT'),

    PILOTDECK_UI_DELIVERABLE_SETTLED_ACCEPTANCE_AUTHORITY: envEnabled(
      'PILOTDECK_UI_DELIVERABLE_SETTLED_ACCEPTANCE_AUTHORITY',
      true,
    ),

    PILOTDECK_UI_DELIVERABLE_TRUST_COPY_V2: envEnabled(
      'PILOTDECK_UI_DELIVERABLE_TRUST_COPY_V2',
      true,
    ),

    PILOTDECK_UI_STRICT_COMPLETION_GATE: envEnabled(
      'PILOTDECK_UI_STRICT_COMPLETION_GATE',
      true,
    ),

    PILOTDECK_HYPERFRAMES_HUB_V2: envEnabled(
      'PILOTDECK_HYPERFRAMES_HUB_V2',
      true,
    ),

    // PD-SAAS-FORK: product marketing site (SEO/GEO)
    PILOTDECK_MARKETING_SITE: envEnabled('PILOTDECK_MARKETING_SITE', false),

    // PD-SAAS-FORK: Preflight 模板选型（默认 off；后台 platform-features.json 或 env 开启）
    PILOTDECK_PREFLIGHT_STUDIO: resolvePreflightStudioModeEffective(),

    // PD-SAAS-FORK: Bento 演示稿编辑器（默认 off；后台 platform-features.json 或 env 开启）
    PILOTDECK_BENTO_DECK_EDITOR: resolveBentoDeckEditorEnabledEffective(),

    // PD-SAAS-FORK: Markdown 浏览器工具（Hub 插件；默认 on；env/后台可关）
    PILOTDECK_MD_BROWSER_TOOL: resolveMdBrowserToolEnabledEffective(),

    // PD-SAAS-FORK: 企业 MCP 功能开关（本批 6 键；默认 off）
    mcpFeatures: resolveAllBatch1McpFeaturesEffective(),

    // PD-SAAS-FORK: workbench beta 1.1（默认 off；不改变 /app）
    PILOTDECK_UI_WORKBENCH_BETA_11: process.env.PILOTDECK_UI_WORKBENCH_BETA_11
      || process.env.VITE_WORKBENCH_BETA_11
      || 'off',
    PILOTDECK_UI_WORKBENCH_TOUR: process.env.PILOTDECK_UI_WORKBENCH_TOUR
      || process.env.VITE_WORKBENCH_TOUR
      || 'off',
    PILOTDECK_UI_TURN_USAGE_FOOTER: process.env.PILOTDECK_UI_TURN_USAGE_FOOTER
      || process.env.VITE_TURN_USAGE_FOOTER
      || 'off',
    PILOTDECK_UI_POST_DELIVERABLE_NEXT: process.env.PILOTDECK_UI_POST_DELIVERABLE_NEXT
      || process.env.VITE_POST_DELIVERABLE_NEXT
      || 'off',
    // PD-SAAS-FORK: N2 Bot — env shadow|enforce 强制开；否则读后台 platform-features.json（默认关）
    PILOTDECK_N2_BOT: resolveN2BotModeEffective(),

  });

});



export default router;

