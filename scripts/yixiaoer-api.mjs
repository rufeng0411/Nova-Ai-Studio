#!/usr/bin/env node
/**
 * PilotDeck wrapper for skills/yixiaoer/scripts/api.ts
 *
 * Usage:
 *   node scripts/yixiaoer-api.mjs --payload '{"action":"accounts","page":1,"size":5}'
 *   node scripts/yixiaoer-api.mjs --payload-file path/to/payload.json
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');

function parseArgs(argv) {
  let payload = null;
  let payloadFile = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--payload-file') {
      payloadFile = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith('--payload-file=')) {
      payloadFile = arg.slice('--payload-file='.length);
      continue;
    }
    if (arg === '--payload') {
      payload = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith('--payload=')) {
      payload = arg.slice('--payload='.length);
    }
  }
  return { payload, payloadFile };
}

function resolveSkillDir() {
  const candidates = [
    path.join(REPO_ROOT, 'skills', 'yixiaoer'),
    path.join(homedir(), '.pilotdeck', 'skills', 'yixiaoer'),
  ];
  for (const dir of candidates) {
    const apiPath = path.join(dir, 'scripts', 'api.ts');
    if (existsSync(apiPath)) {
      return dir;
    }
  }
  throw new Error(
    'yixiaoer skill not found. Run: node scripts/sync-yixiaoer-skill.mjs --force',
  );
}

function readPayload({ payload, payloadFile }) {
  if (payloadFile) {
    const abs = path.resolve(payloadFile);
    if (!existsSync(abs)) {
      throw new Error(`Payload file not found: ${abs}`);
    }
    return readFileSync(abs, 'utf8').trim();
  }
  if (payload) {
    return payload.trim();
  }
  throw new Error('Missing --payload or --payload-file');
}

function main() {
  const apiKey = process.env.YIXIAOER_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      JSON.stringify(
        {
          success: false,
          errorCode: 'YIXIAOER_AUTH_ERR',
          message: 'Missing YIXIAOER_API_KEY environment variable',
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  let payloadRaw;
  try {
    payloadRaw = readPayload(parseArgs(process.argv.slice(2)));
    JSON.parse(payloadRaw);
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          success: false,
          errorCode: 'YIXIAOER_USAGE_ERR',
          message: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const skillDir = resolveSkillDir();
  const apiScript = path.join(skillDir, 'scripts', 'api.ts');
  const tsxLocal = path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const runner = existsSync(tsxLocal) ? process.execPath : 'npx';
  const runnerArgs = existsSync(tsxLocal)
    ? [tsxLocal, apiScript, `--payload=${payloadRaw}`]
    : ['tsx', apiScript, `--payload=${payloadRaw}`];

  const result = spawnSync(runner, runnerArgs, {
    cwd: skillDir,
    env: process.env,
    encoding: 'utf8',
    shell: false,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

main();
