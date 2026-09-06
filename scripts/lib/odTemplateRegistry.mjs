/**
 * Open Design template shadow registry flag + loader.
 * PILOTDECK_OD_TEMPLATE_REGISTRY=off|shadow|1
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REGISTRY_PATH = path.join(REPO_ROOT, 'config', 'open-design-template-registry.json');

/** @returns {'off'|'shadow'|'enforce'} */
export function resolveOdTemplateRegistryMode(env = process.env) {
  const raw = String(env.PILOTDECK_OD_TEMPLATE_REGISTRY ?? 'shadow').trim().toLowerCase();
  if (raw === '0' || raw === 'off' || raw === 'false') return 'off';
  if (raw === '1' || raw === 'enforce' || raw === 'on' || raw === 'true') return 'enforce';
  return 'shadow';
}

export function loadOdTemplateRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) return null;
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
}

/** Hub must never list registry templates as capabilities — even in enforce. */
export function registryHubVisibleAllowed() {
  return false;
}
