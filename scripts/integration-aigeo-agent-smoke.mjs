#!/usr/bin/env node
/**
 * Light agent-layer smoke: verifies pd-geo + geo_api wiring files (no live Gateway).
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(msg) {
  console.error(`[aigeo-agent-smoke] FAIL: ${msg}`);
  process.exit(1);
}

const geoApiTs = path.join(REPO_ROOT, 'src', 'tool', 'builtin', 'geoApi.ts');
const registry = path.join(REPO_ROOT, 'src', 'tool', 'registry', 'createBuiltinRegistry.ts');
const gateway = path.join(REPO_ROOT, 'src', 'cli', 'createLocalGateway.ts');

for (const f of [geoApiTs, registry, gateway]) {
  if (!existsSync(f)) fail(`missing ${f}`);
}

const regText = readFileSync(registry, 'utf8');
if (!regText.includes('createGeoApiTool')) fail('geo tool not registered');

const gwText = readFileSync(gateway, 'utf8');
if (!gwText.includes('applyGeoToolEnv')) fail('geo env not applied in gateway');

const skill = readFileSync(path.join(REPO_ROOT, 'skills', 'pd-geo', 'SKILL.md'), 'utf8');
if (!skill.includes('geo_api')) fail('pd-geo SKILL must reference geo_api');

console.log('[aigeo-agent-smoke] OK wiring files present');
