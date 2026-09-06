#!/usr/bin/env node
/**
 * PD-SAAS-FORK: convert hand-written *.bento.html (static slides) into valid Bento shell + doc
 * Usage:
 *   node repair-static-html-to-bento.mjs --in fake.bento.html --out deck.bento.html
 *   node repair-static-html-to-bento.mjs --in fake.bento.html --out deck.bento.html --upload \
 *     --project general --api http://127.0.0.1:8081 --token <jwt>
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  hasBentoDocBlock,
  repairStaticHtmlToBento,
} from '../../../scripts/lib/repairStaticHtmlToBento.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const SHELL = path.join(REPO_ROOT, 'ui/public/vendor/bento/Bento_Slides.bento.html');
const VALIDATE = path.join(__dirname, 'validate-bento-doc.mjs');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === '--in') args.in = argv[++i];
    else if (t === '--out') args.out = argv[++i];
    else if (t === '--title') args.title = argv[++i];
    else if (t === '--upload') args.upload = true;
    else if (t === '--project') args.project = argv[++i];
    else if (t === '--api') args.api = argv[++i];
    else if (t === '--token') args.token = argv[++i];
    else if (t === '--file-path') args.filePath = argv[++i];
  }
  return args;
}

async function uploadDeck({ api, token, project, filePath, content }) {
  const url = `${api.replace(/\/$/, '')}/api/projects/${encodeURIComponent(project)}/file`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ filePath, content }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Upload failed HTTP ${response.status}`);
  }
  return payload;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.in || !args.out) {
    console.error('Usage: repair-static-html-to-bento.mjs --in <fake.bento.html> --out <deck.bento.html>');
    process.exit(2);
  }

  const [html, shellHtml] = await Promise.all([
    readFile(path.resolve(args.in), 'utf8'),
    readFile(SHELL, 'utf8'),
  ]);

  if (hasBentoDocBlock(html)) {
    console.error('Input already contains #bento-doc — not a static fake deck.');
    process.exit(1);
  }

  const result = repairStaticHtmlToBento(html, shellHtml, { title: args.title });
  const outPath = path.resolve(args.out);
  const tmpPath = `${outPath}.repair-tmp`;
  await writeFile(tmpPath, result.html, 'utf8');
  const validate = spawnSync(process.execPath, [VALIDATE, '--strict', tmpPath], { encoding: 'utf8' });
  if (validate.status !== 0) {
    const { unlink } = await import('node:fs/promises');
    await unlink(tmpPath).catch(() => {});
    console.error(validate.stderr || validate.stdout);
    process.exit(validate.status ?? 1);
  }
  const { rename } = await import('node:fs/promises');
  await rename(tmpPath, outPath);

  if (args.upload) {
    if (!args.api || !args.token || !args.project || !args.filePath) {
      console.error('--upload requires --api --token --project --file-path');
      process.exit(2);
    }
    await uploadDeck({
      api: args.api,
      token: args.token,
      project: args.project,
      filePath: args.filePath,
      content: result.html,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    slides: result.slideCount,
    out: outPath,
    uploaded: Boolean(args.upload),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
