// PD-SAAS-FORK: risk + integration tests for precompressed static middleware
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import express from 'express';
import { createPrecompressedStatic } from './precompressedStatic.js';

function createMockRes() {
  const headers = {};
  return {
    headers,
    statusCode: 200,
    sentFile: null,
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    },
    type() {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    end() {},
    sendFile(filePath, cb) {
      this.sentFile = filePath;
      cb?.(null);
    },
  };
}

function makeDistFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-precomp-'));
  const assetPath = path.join(root, 'assets', 'app.js');
  fs.mkdirSync(path.dirname(assetPath), { recursive: true });
  const raw = Buffer.from('console.log("hello precompress");');
  fs.writeFileSync(assetPath, raw);
  fs.writeFileSync(`${assetPath}.br`, brotliCompressSync(raw));
  fs.writeFileSync(`${assetPath}.gz`, gzipSync(raw));
  return { root, assetPath, raw };
}

test('createPrecompressedStatic serves .br when Accept-Encoding includes br', () => {
  const { root, assetPath } = makeDistFixture();
  const middleware = createPrecompressedStatic(root);
  const req = {
    method: 'GET',
    path: '/assets/app.js',
    headers: { 'accept-encoding': 'br, gzip' },
  };
  const res = createMockRes();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.headers['content-encoding'], 'br');
  assert.equal(res.sentFile, `${assetPath}.br`);
});

test('createPrecompressedStatic prefers br over gzip', () => {
  const { root, assetPath } = makeDistFixture();
  const middleware = createPrecompressedStatic(root);
  const req = {
    method: 'GET',
    path: '/assets/app.js',
    headers: { 'accept-encoding': 'gzip, br' },
  };
  const res = createMockRes();

  middleware(req, res, () => assert.fail('should not fall through'));
  assert.equal(res.headers['content-encoding'], 'br');
  assert.equal(res.sentFile, `${assetPath}.br`);
});

test('createPrecompressedStatic serves gzip when br missing', () => {
  const { root, assetPath } = makeDistFixture();
  fs.unlinkSync(`${assetPath}.br`);
  const middleware = createPrecompressedStatic(root);
  const req = {
    method: 'GET',
    path: '/assets/app.js',
    headers: { 'accept-encoding': 'gzip' },
  };
  const res = createMockRes();

  middleware(req, res, () => assert.fail('should not fall through'));
  assert.equal(res.headers['content-encoding'], 'gzip');
  assert.equal(res.sentFile, `${assetPath}.gz`);
});

test('createPrecompressedStatic falls through when no precompressed file exists', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-precomp-'));
  const assetPath = path.join(root, 'assets', 'plain.js');
  fs.mkdirSync(path.dirname(assetPath), { recursive: true });
  fs.writeFileSync(assetPath, 'console.log("raw");');

  const middleware = createPrecompressedStatic(root);
  const req = {
    method: 'GET',
    path: '/assets/plain.js',
    headers: { 'accept-encoding': 'br, gzip' },
  };
  const res = createMockRes();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

test('createPrecompressedStatic blocks path traversal', () => {
  const { root } = makeDistFixture();
  fs.writeFileSync(path.join(root, 'secret.js'), 'leak');
  const middleware = createPrecompressedStatic(root);
  const attempts = [
    '/assets/../../secret.js',
    '/../secret.js',
    '/assets/../../../secret.js',
  ];

  for (const attempt of attempts) {
    const req = {
      method: 'GET',
      path: attempt,
      headers: { 'accept-encoding': 'br' },
    };
    const res = createMockRes();
    let nextCalled = false;
    middleware(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true, `expected fallthrough for traversal ${attempt}`);
    assert.equal(res.sentFile, null);
  }
});

test('createPrecompressedStatic ignores non-GET methods', () => {
  const { root } = makeDistFixture();
  const middleware = createPrecompressedStatic(root);
  const req = {
    method: 'POST',
    path: '/assets/app.js',
    headers: { 'accept-encoding': 'br' },
  };
  const res = createMockRes();
  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
});

test('createPrecompressedStatic sets cache headers via setHeaders callback', () => {
  const { root } = makeDistFixture();
  const middleware = createPrecompressedStatic(root, (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  });
  const req = {
    method: 'GET',
    path: '/assets/app.js',
    headers: { 'accept-encoding': 'br' },
  };
  const res = createMockRes();
  middleware(req, res, () => assert.fail('should serve br'));
  assert.match(res.headers['cache-control'], /immutable/);
});

test('express integration: br payload decompresses to raw asset', async () => {
  const { root, assetPath, raw } = makeDistFixture();
  const app = express();
  app.use(createPrecompressedStatic(root));
  app.use(express.static(root));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/assets/app.js`, {
      headers: { 'Accept-Encoding': 'br' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-encoding'), 'br');
    const body = Buffer.from(await response.arrayBuffer());
    // Node fetch auto-decompresses encoded bodies — payload must match raw source.
    assert.equal(body.compare(raw), 0);

    const gzipResponse = await fetch(`http://127.0.0.1:${port}/assets/app.js`, {
      headers: { 'Accept-Encoding': 'gzip' },
    });
    assert.equal(gzipResponse.headers.get('content-encoding'), 'gzip');
    const gzipBody = Buffer.from(await gzipResponse.arrayBuffer());
    assert.equal(gzipBody.compare(raw), 0);

    const plainResponse = await new Promise((resolve, reject) => {
      http.get(
        `http://127.0.0.1:${port}/assets/app.js`,
        { headers: { 'Accept-Encoding': 'identity' } },
        (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            resolve({
              status: res.statusCode,
              encoding: res.headers['content-encoding'] ?? null,
              body: Buffer.concat(chunks),
            });
          });
        },
      ).on('error', reject);
    });
    assert.equal(plainResponse.status, 200);
    assert.equal(plainResponse.encoding, null);
    assert.equal(plainResponse.body.compare(raw), 0);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
