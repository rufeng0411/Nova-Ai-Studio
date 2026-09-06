#!/usr/bin/env node
/**
 * L1 smoke: IM notify MCP + App chat channels (no live send).
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function check(file, pattern, label) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    failures.push(`missing ${file}`);
    return;
  }
  const text = fs.readFileSync(full, 'utf8');
  if (!pattern.test(text)) failures.push(label);
}

function mustExist(file) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
}

mustExist('mcp-servers/im-notify/index.mjs');
mustExist('mcp-servers/im-notify/lib/channels.mjs');
mustExist('ui/server/saas/imNotify/routes.js');
mustExist('ui/server/saas/imChannels/routes.js');
mustExist('ui/src/saas/admin/platform/PlatformImChannelsPage.tsx');
mustExist('docs/im-channels-admin-guide.zh-CN.md');

check('products/_example/config/mcp.json.example', /"im-notify"/, 'mcp.json.example im-notify');
check('docs/im-channels-admin-guide.zh-CN.md', /消息通道/, 'admin guide title');
check('docs/im-channels-admin-guide.zh-CN.md', /LINE/, 'guide should mention LINE exclusion');
check('deploy/Dockerfile.prod', /mcp-servers/, 'Dockerfile copies mcp-servers');
check('scripts/lib/devLauncherCore.mjs', /PILOTDECK_IM_NOTIFY_MCP/, 'devLauncher IM_NOTIFY flag');
check('scripts/lib/devLauncherCore.mjs', /PILOTDECK_IM_CHANNELS/, 'devLauncher IM_CHANNELS flag');
check('scripts/release/pack.mjs', /PILOTDECK_IM_NOTIFY_MCP/, 'pack IM_NOTIFY flag');
check('scripts/release/pack.mjs', /PILOTDECK_IM_CHANNELS/, 'pack IM_CHANNELS flag');
check('scripts/release/apply-cloud-perf-env.sh', /PILOTDECK_IM_NOTIFY_MCP/, 'apply-cloud IM_NOTIFY');
check('scripts/release/apply-cloud-perf-env.sh', /PILOTDECK_IM_CHANNELS/, 'apply-cloud IM_CHANNELS');
check('scripts/lib/capabilityHubTaxonomy.mjs', /mcp-im-notify/, 'hub virtual mcp-im-notify');
check('src/adapters/channel/loadEnabledChannels.ts', /PILOTDECK_IM_CHANNELS/, 'loadEnabledChannels gate');
check('ui/server/saas/index.js', /im-notify/, 'saas mounts im-notify');
check('ui/server/saas/index.js', /im-channels/, 'saas mounts im-channels');

// No LINE in notify drivers
const channels = fs.readFileSync(path.join(root, 'mcp-servers/im-notify/lib/channels.mjs'), 'utf8');
if (/\bline\b/i.test(channels) && !/no LINE/i.test(channels)) {
  failures.push('channels.mjs unexpectedly references line');
}
if (!/wecom|dingtalk|whatsapp/.test(channels)) {
  failures.push('channels.mjs missing expected drivers');
}

if (failures.length) {
  console.error('FAIL smoke:im-channels', failures.join(', '));
  process.exit(1);
}
console.log('smoke:im-channels passed');
