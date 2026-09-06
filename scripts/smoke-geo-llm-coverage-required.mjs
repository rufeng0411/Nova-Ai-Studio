#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 必测十模型配置与 skill 引用 smoke
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRequiredModelIds, loadGeoLlmCoverageRequired } from './lib/geoLlmCoverageRequired.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = path.join(ROOT, 'config', 'geo-llm-coverage-required-models.json');
const PROBE_SKILL = path.join(ROOT, 'skills', 'geo-visibility-probe', 'SKILL.md');
const MATRIX = path.join(ROOT, 'skills', 'geo-visibility-probe', 'references', 'llm-coverage-matrix.md');

function main() {
  const errors = [];
  if (!existsSync(CONFIG)) errors.push('missing geo-llm-coverage-required-models.json');

  const cfg = loadGeoLlmCoverageRequired();
  const ids = getRequiredModelIds();
  if (ids.length !== 11) errors.push(`expected 11 required ids, got ${ids.length}`);

  const expectedCn = ['doubao', 'deepseek', 'qwen', 'baidu', 'kimi', 'yuanbao'];
  const expectedGlobal = ['openai', 'gemini', 'claude', 'grok', 'meta'];
  for (const id of [...expectedCn, ...expectedGlobal]) {
    if (!ids.includes(id)) errors.push(`missing required id ${id}`);
  }

  const probe = readFileSync(PROBE_SKILL, 'utf8');
  const matrix = readFileSync(MATRIX, 'utf8');
  for (const id of ids) {
    if (!probe.includes(id) && !matrix.includes(id)) {
      errors.push(`skill/matrix missing id ${id}`);
    }
  }

  if (cfg.minimumModelRows !== 11) errors.push('minimumModelRows should be 11');

  const ok = errors.length === 0;
  console.log(`[smoke:geo-llm-coverage-required] ok=${ok} ids=${ids.join(',')}`);
  if (errors.length) {
    for (const e of errors) console.log(`  - ${e}`);
    process.exitCode = 1;
  }
}

main();
