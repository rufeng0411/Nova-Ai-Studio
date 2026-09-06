#!/usr/bin/env node
/**
 * PD-SAAS-FORK: vendor Bento_Slides.bento.html into ui/public/vendor/bento/
 */
import { mkdir, writeFile, copyFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'ui/public/vendor/bento');
const OUT_FILE = path.join(OUT_DIR, 'Bento_Slides.bento.html');
const NOTICE_FILE = path.join(OUT_DIR, 'NOTICE');
const VERSION = '1.0.11';

const CANDIDATE_URLS = [
  'https://github.com/nyblnet/bento/releases/latest/download/Bento_Slides.bento.html',
  'https://raw.githubusercontent.com/nyblnet/bento/main/packages/slides/dist/Bento_Slides.bento.html',
  'https://raw.githubusercontent.com/nyblnet/bento/main/dist/Bento_Slides.bento.html',
];

const FALLBACK_SHELL = path.join(ROOT, 'ui/public/vendor/bento/Bento_Slides.minimal.bento.html');

async function tryDownload(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  const text = await res.text();
  if (!text.includes('id="bento-doc"') && !text.includes("id='bento-doc'")) {
    throw new Error(`${url} missing #bento-doc`);
  }
  if (Buffer.byteLength(text, 'utf8') < 10_000) {
    throw new Error(`${url} too small`);
  }
  return text;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  let html = null;
  let source = 'network';

  for (const url of CANDIDATE_URLS) {
    try {
      html = await tryDownload(url);
      console.log(`Downloaded Bento shell from ${url}`);
      break;
    } catch (err) {
      console.warn(`Skip ${url}: ${err.message}`);
    }
  }

  if (!html) {
    try {
      await access(FALLBACK_SHELL);
      await copyFile(FALLBACK_SHELL, OUT_FILE);
      source = 'minimal-fallback';
      console.warn('Using minimal fallback shell — run again when network allows official shell.');
    } catch {
      throw new Error('Could not download Bento shell and no minimal fallback found');
    }
  } else {
    await writeFile(OUT_FILE, html, 'utf8');
  }

  const notice = `Bento Slides shell (bento/slides v1)
Guide version: ${VERSION}
Source: ${source}
License: MIT — see https://github.com/nyblnet/bento
Nova vendors this file for splice + iframe preview only; document JSON in #bento-doc is authoritative.
`;
  await writeFile(NOTICE_FILE, notice, 'utf8');
  console.log(JSON.stringify({ ok: true, out: OUT_FILE, source, version: VERSION }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
