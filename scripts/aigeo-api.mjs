#!/usr/bin/env node
/**
 * PilotDeck wrapper for scripts/aigeo-cli.py
 *
 * Usage:
 *   node scripts/aigeo-api.mjs --payload '{"action":"score",...}'
 *   node scripts/aigeo-api.mjs --payload-file path/to/payload.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const CLI_PATH = path.join(REPO_ROOT, 'scripts', 'aigeo-cli.py');

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

function resolvePython() {
  for (const bin of ['python3', 'python']) {
    const probe = spawnSync(bin, ['--version'], { encoding: 'utf8', shell: false });
    if (probe.status === 0) {
      return [bin];
    }
  }
  const py = spawnSync('py', ['-3', '--version'], { encoding: 'utf8', shell: false });
  if (py.status === 0) {
    return ['py', '-3'];
  }
  return null;
}

function main() {
  if (!existsSync(CLI_PATH)) {
    console.error(JSON.stringify({ ok: false, error: `missing ${CLI_PATH}` }));
    process.exit(1);
  }
  const python = resolvePython();
  if (!python) {
    console.error(
      JSON.stringify({
        ok: false,
        error: 'Python not found. Install Python 3.10+.',
        degradation: 'no_python',
      }),
    );
    process.exit(1);
  }
  let body;
  try {
    body = readPayload(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: String(error) }));
    process.exit(1);
  }
  const tempPayload = path.join(REPO_ROOT, '.cache', 'aigeo-last-payload.json');
  mkdirSync(path.dirname(tempPayload), { recursive: true });
  writeFileSync(tempPayload, body, 'utf8');
  const run = spawnSync(python[0], [...python.slice(1), CLI_PATH, '--payload-file', tempPayload], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  const text = (run.stdout || run.stderr || '').trim();
  if (run.status !== 0) {
    try {
      console.log(text);
    } catch {
      console.log(
        JSON.stringify({
          ok: false,
          error: text || `aigeo-cli exited ${run.status}`,
          degradation: 'cli_exit',
        }),
      );
    }
    process.exit(run.status === null ? 1 : run.status);
  }
  console.log(text || JSON.stringify({ ok: false, error: 'empty cli output' }));
}

main();
