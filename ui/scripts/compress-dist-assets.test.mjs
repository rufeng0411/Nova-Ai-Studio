// PD-SAAS-FORK
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { compressDistAssets } from './compress-dist-assets.mjs';

test('compressDistAssets writes valid gzip and brotli siblings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-compress-'));
  const assetPath = path.join(root, 'assets', 'chunk.js');
  fs.mkdirSync(path.dirname(assetPath), { recursive: true });
  const source = Buffer.from(`console.log("${'x'.repeat(2048)}");`);
  fs.writeFileSync(assetPath, source);

  const result = compressDistAssets(root);
  assert.equal(result.compressed, 1);
  assert.ok(fs.existsSync(`${assetPath}.gz`));
  assert.ok(fs.existsSync(`${assetPath}.br`));

  const fromGzip = gunzipSync(fs.readFileSync(`${assetPath}.gz`));
  const fromBrotli = brotliDecompressSync(fs.readFileSync(`${assetPath}.br`));
  assert.equal(fromGzip.compare(source), 0);
  assert.equal(fromBrotli.compare(source), 0);
});

test('compressDistAssets skips tiny files and compressed siblings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-compress-'));
  const tinyPath = path.join(root, 'tiny.js');
  fs.writeFileSync(tinyPath, 'a');
  fs.writeFileSync(`${tinyPath}.gz`, Buffer.from('already'));

  const result = compressDistAssets(root);
  assert.equal(result.compressed, 0);
});
