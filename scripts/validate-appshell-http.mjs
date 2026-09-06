#!/usr/bin/env node
/** PD-SAAS-FORK: HTTP smoke against real ui/dist precompressed assets. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createPrecompressedStatic } from '../ui/server/utils/precompressedStatic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'ui/dist');
const assetsDir = path.join(distDir, 'assets');

function findAsset(pattern) {
  const name = fs.readdirSync(assetsDir).find((file) => pattern.test(file));
  return name ? `/assets/${name}` : null;
}

async function main() {
  if (!fs.existsSync(assetsDir)) {
    console.error('[validate-appshell-http] ui/dist missing');
    process.exit(1);
  }

  const appShellPath = findAsset(/^AppShellV2-.*\.js$/);
  assert.ok(appShellPath, 'AppShell asset missing');

  const app = express();
  const setHeaders = (res, filePath) => {
    if (/\.(js|css)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  };
  app.use(createPrecompressedStatic(distDir, setHeaders));
  app.use(express.static(distDir, { setHeaders }));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    const brRes = await fetch(`${base}${appShellPath}`, {
      headers: { 'Accept-Encoding': 'br, gzip' },
    });
    assert.equal(brRes.status, 200);
    assert.equal(brRes.headers.get('content-encoding'), 'br');
    const brBody = Buffer.from(await brRes.arrayBuffer());
    const rawPath = path.join(distDir, appShellPath);
    const raw = fs.readFileSync(rawPath);
    const brFile = fs.readFileSync(`${rawPath}.br`);
    assert.equal(brBody.compare(raw), 0, 'fetch body should match raw after auto-decode');
    assert.ok(brFile.length < 80 * 1024, `br file on disk should be <80KB, got ${brFile.length}`);

    const gzRes = await fetch(`${base}${appShellPath}`, {
      headers: { 'Accept-Encoding': 'gzip' },
    });
    assert.equal(gzRes.headers.get('content-encoding'), 'gzip');
    const gzBody = Buffer.from(await gzRes.arrayBuffer());
    assert.equal(gzBody.compare(raw), 0);

    const traversal = await fetch(`${base}/assets/../../package.json`, {
      headers: { 'Accept-Encoding': 'br' },
    });
    assert.notEqual(traversal.status, 200);

    console.log('[validate-appshell-http] PASS', {
      appShellPath,
      brBytes: brBody.length,
      gzBytes: gzBody.length,
      rawBytes: raw.length,
    });
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

main().catch((err) => {
  console.error('[validate-appshell-http] FAIL', err?.message || err);
  process.exit(1);
});
