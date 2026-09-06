#!/usr/bin/env node
/**
 * PD-SAAS-FORK: smoke — file/folder delete must not reappear in GET /files tree.
 * SaaS mode returns 403 on mutations; script auto-skips with PASS (skipped).
 */
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = process.env.SMOKE_BASE_URL || `http://127.0.0.1:${process.env.PILOTDECK_UI_PORT || '5173'}`;
const ADMIN_USER = process.env.SMOKE_USER || 'admin';
const ADMIN_PASS = process.env.SMOKE_PASS || 'SAAS_ADMIN_PASSWORD';

async function request(path, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { response, json };
}

function walkPaths(nodes, acc = []) {
  for (const node of nodes ?? []) {
    acc.push(node.path);
    if (node.children?.length) walkPaths(node.children, acc);
  }
  return acc;
}

async function main() {
  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!health?.ok) {
    console.error('[file-delete-smoke] FAIL: dev server not reachable');
    process.exit(1);
  }

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { username: ADMIN_USER, password: ADMIN_PASS },
  });
  const token = login.json?.token;
  if (!token) {
    console.error('[file-delete-smoke] FAIL: login failed');
    process.exit(1);
  }

  const projectsResp = await request('/api/projects?fresh=1', { token });
  const project = projectsResp.json?.find((p) => p?.name) || projectsResp.json?.[0];
  if (!project?.name) {
    console.error('[file-delete-smoke] FAIL: no project');
    process.exit(1);
  }

  const probePath = `_smoke-delete-probe-${Date.now()}.txt`;
  const createResp = await request(`/api/projects/${encodeURIComponent(project.name)}/files/create`, {
    method: 'POST',
    token,
    body: { path: probePath, type: 'file', content: 'smoke delete probe' },
  });

  if (createResp.response.status === 403) {
    console.log('[file-delete-smoke] SKIP: SaaS read-only file mutations (expected)');
    console.log('[file-delete-smoke] PASS (skipped)');
    return;
  }

  if (!createResp.response.ok) {
    console.error('[file-delete-smoke] FAIL: create probe file', createResp.response.status, createResp.json);
    process.exit(1);
  }

  const beforeTree = await request(`/api/projects/${encodeURIComponent(project.name)}/files`, { token });
  if (!beforeTree.response.ok) {
    console.error('[file-delete-smoke] FAIL: list files');
    process.exit(1);
  }
  if (!walkPaths(beforeTree.json).includes(probePath)) {
    console.error('[file-delete-smoke] FAIL: probe file missing before delete');
    process.exit(1);
  }

  const del = await request(`/api/projects/${encodeURIComponent(project.name)}/files`, {
    method: 'DELETE',
    token,
    body: { path: probePath, type: 'file' },
  });
  if (!del.response.ok) {
    console.error('[file-delete-smoke] FAIL: delete API', del.response.status, del.json);
    process.exit(1);
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await new Promise((r) => setTimeout(r, 300));
    const afterTree = await request(`/api/projects/${encodeURIComponent(project.name)}/files`, { token });
    const paths = walkPaths(afterTree.json);
    if (!paths.includes(probePath)) {
      console.log(`[file-delete-smoke] OK: probe absent after delete (attempt ${attempt + 1})`);
      console.log('[file-delete-smoke] PASS');
      return;
    }
  }

  console.error('[file-delete-smoke] FAIL: probe file still in tree after delete');
  process.exit(1);
}

main().catch((error) => {
  console.error('[file-delete-smoke] ERROR', error);
  process.exit(1);
});
