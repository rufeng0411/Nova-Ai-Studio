// PD-SAAS-FORK: Hub 必留能力/模板清单（默认展示，其余分组内「更多」展开）
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const PINNED_PATH = path.join(REPO_ROOT, 'config/capability-hub-pinned.json');

let cached = null;

function loadPinnedConfig() {
  if (cached) return cached;
  const raw = readFileSync(PINNED_PATH, 'utf8');
  const json = JSON.parse(raw);
  cached = {
    capabilities: new Set(json.capabilities || []),
    templates: new Set(json.templates || []),
  };
  return cached;
}

export function getPinnedCapabilitySlugs() {
  return loadPinnedConfig().capabilities;
}

export function getPinnedTemplateIds() {
  return loadPinnedConfig().templates;
}

export function isHubPinnedCapability(slug) {
  if (!slug) return false;
  return loadPinnedConfig().capabilities.has(slug);
}

export function isHubPinnedTemplate(id) {
  if (!id) return false;
  return loadPinnedConfig().templates.has(id);
}

export function applyHubPinnedToSkill(item) {
  if (!item || !item.slug) return item;
  return {
    ...item,
    hub_pinned: isHubPinnedCapability(item.slug),
  };
}

export function applyHubPinnedToTemplate(item) {
  if (!item || !item.id) return item;
  return {
    ...item,
    hub_pinned: isHubPinnedTemplate(item.id),
  };
}
