/**
 * PD-SAAS-FORK: GEO 必测大模型 id 清单
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'geo-llm-coverage-required-models.json');

let cached;

export function loadGeoLlmCoverageRequired() {
  if (cached) return cached;
  if (!existsSync(CONFIG_PATH)) throw new Error(`missing ${CONFIG_PATH}`);
  cached = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  return cached;
}

export function getRequiredModelIds() {
  const cfg = loadGeoLlmCoverageRequired();
  const cn = (cfg.cn?.models || []).map((m) => m.id);
  const global = (cfg.global?.models || []).map((m) => m.id);
  return [...cn, ...global];
}

export function normalizeModelId(id, cfg = loadGeoLlmCoverageRequired()) {
  if (!id) return id;
  const aliases = cfg.idAliases || {};
  return aliases[id] || id;
}

/** @param {{ id?: string }[]} models */
export function validateLlmCoverageModels(models) {
  const cfg = loadGeoLlmCoverageRequired();
  const required = getRequiredModelIds();
  const present = new Set((models || []).map((m) => normalizeModelId(m.id, cfg)));
  const missing = required.filter((id) => !present.has(id));
  return { ok: missing.length === 0, missing, required, count: present.size };
}
