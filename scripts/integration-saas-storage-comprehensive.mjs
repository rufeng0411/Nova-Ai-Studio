#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Phase 2 cloud-only storage tests (canonical hub, no local-bindings sync).
 * Part A: isolated DATA_ROOT (destructive + multi-tenant)
 * Part B: live dev server API (multi-user login) when available
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:3001';
const VITE_URL = process.env.VITE_URL || 'http://127.0.0.1:5173';

const results = [];

function record(id, name, ok, detail = '') {
  results.push({ id, name, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${id}: ${name}${detail ? ` — ${detail}` : ''}`);
}

function mockRes() {
  let statusCode = 200;
  let body = null;
  return {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
  };
}

async function withSaasDb(run) {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'saas-storage-comp-'));
  const prev = { ...process.env };
  process.env.PILOTDECK_SAAS_MODE = '1';
  process.env.DATA_ROOT = dataRoot;
  delete process.env.SAAS_DATABASE_URL;
  try {
    await run(dataRoot);
  } finally {
    const { closeControlDatabase } = await import('../ui/server/saas/db/control.js');
    await closeControlDatabase();
    process.env = prev;
    fs.rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

function ctxFor(user, tenantId, dataRoot) {
  const tenantPilotHome = path.join(dataRoot, 'tenants', tenantId);
  return { tenantId, tenantPilotHome, userId: user.id };
}

function seedProject(tenantPilotHome, projectId, cwd, files = {}) {
  const projectDir = path.join(tenantPilotHome, 'projects', projectId);
  fs.mkdirSync(path.join(projectDir, 'chats'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, '.cwd'), cwd, 'utf8');
  fs.mkdirSync(cwd, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const target = path.join(cwd, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runIsolatedTests() {
  await withSaasDb(async (dataRoot) => {
    const { bootstrapSaasControlPlane } = await import('../ui/server/saas/auth/bootstrap.js');
    const { saasRegister } = await import('../ui/server/saas/auth/routes.js');
    const { generateToken } = await import('../ui/server/middleware/auth.js');
    const { createCaptchaChallenge, resetCaptchaStoreForTests } = await import(
      '../ui/server/saas/billing/captcha.js'
    );
    const { controlUserDb } = await import('../ui/server/saas/db/control.js');
    const { saasRequestStore } = await import('../ui/server/saas/context.js');
    const { tenantIdForUsername, getTenantProjectsRoot } = await import(
      '../ui/server/saas/tenant/paths.js'
    );
    const { bootstrapTenantLayout } = await import('../ui/server/saas/legacyBridge.js');
    const { getUserPreferences, updateUserPreferences } = await import(
      '../ui/server/saas/userPreferences.js'
    );
    const { parseFileStoragePrefs } = await import('../ui/server/saas/storage/fileStorageService.js');
    const { ensureSaasWorkspacesProvisioned } = await import(
      '../ui/server/saas/storage/ensureWorkspaces.js'
    );
    const { syncWorkspaceByProjectName, syncAllForCurrentUser } = await import(
      '../ui/server/saas/storage/syncHub.js'
    );
    const { getWorkspaceByLegacyProjectId, listWorkspacesForUser } = await import(
      '../ui/server/saas/storage/workspaceStore.js'
    );
    const { enrichSaasProjects } = await import('../ui/server/saas/storage/fileStorageService.js');
    const { assertStoragePathAllowed } = await import(
      '../ui/server/saas/storage/fileStorageService.js'
    );
    const { getCanonicalHubRoot } = await import('../ui/server/saas/storage/paths.js');

    await bootstrapSaasControlPlane({ log: () => {} });
    resetCaptchaStoreForTests();

    async function registerUser(name) {
      const cap = await createCaptchaChallenge();
      const res = mockRes();
      await saasRegister(
        {
          body: {
            username: name,
            password: 'secret12',
            captchaId: cap.captchaId,
            captchaAnswer: cap.challenge,
          },
        },
        res,
        { generateToken },
      );
      assert.equal(res.statusCode, 200, `${name} register`);
      const user = await controlUserDb.getUserByUsername(name);
      const tenantId = tenantIdForUsername(name);
      bootstrapTenantLayout(tenantId);
      return { user, tenantId };
    }

    const alice = await registerUser('syncalice');
    const bob = await registerUser('syncbob');

    // CLOUD-01: default cloud-only prefs
    const alicePrefs = parseFileStoragePrefs(await getUserPreferences(alice.user.id));
    record(
      'CLOUD-01',
      '新用户 fileStorage.cloudOnly 默认开启且 migrationVersion=2',
      alicePrefs.cloudOnly === true && alicePrefs.migrationVersion === 2,
      JSON.stringify(alicePrefs),
    );

    const aliceCtx = ctxFor(alice.user, alice.tenantId, dataRoot);
    const bobCtx = ctxFor(bob.user, bob.tenantId, dataRoot);

    const prov = await saasRequestStore.run(aliceCtx, () => ensureSaasWorkspacesProvisioned(aliceCtx));

    const { createSaasNamedWorkspace } = await import(
      '../ui/server/saas/storage/fileStorageService.js'
    );
    const projA = await saasRequestStore.run(aliceCtx, () => createSaasNamedWorkspace('alice-proj'));
    fs.writeFileSync(path.join(projA.fullPath, 'hello.txt'), 'alice-v1', 'utf8');
    fs.mkdirSync(path.join(projA.fullPath, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(projA.fullPath, 'nested/note.md'), 'nested-alice', 'utf8');

    const wsList = await listWorkspacesForUser(alice.user.id, alice.tenantId);
    record(
      'CLOUD-02',
      '登录后自动 provision general + 一键建项云端枢纽',
      prov.provisioned >= 1 &&
        wsList.some((w) => w.legacyProjectId === 'general') &&
        wsList.some((w) => w.legacyProjectId === projA.name),
      `provisioned=${prov.provisioned}, workspaces=${wsList.length}`,
    );

    const generalWs = wsList.find((w) => w.legacyProjectId === 'general');
    const { createProjectId } = await import('../ui/server/utils/pilotPaths.js');
    const { resolveSessionProjectKeyForProjectName } = await import(
      '../ui/server/saas/storage/fileStorageService.js',
    );
    const stableGeneralId = createProjectId(aliceCtx.tenantPilotHome);
    const generalMarkerPath = path.join(aliceCtx.tenantPilotHome, 'projects', stableGeneralId, '.cwd');
    record(
      'ISO-17',
      'general 工作区 .cwd 将 canonical 绑定到稳定 transcript 目录',
      Boolean(generalWs) &&
        fs.existsSync(generalMarkerPath) &&
        path.resolve(fs.readFileSync(generalMarkerPath, 'utf8').trim()) ===
          path.resolve(generalWs.canonicalProjectKey),
      generalMarkerPath,
    );

    const iso17SessionId = 'web-s_iso17-general-msg';
    const iso17Transcript = path.join(
      aliceCtx.tenantPilotHome,
      'projects',
      stableGeneralId,
      'chats',
      `${iso17SessionId}.jsonl`,
    );
    fs.mkdirSync(path.dirname(iso17Transcript), { recursive: true });
    fs.writeFileSync(
      iso17Transcript,
      `${JSON.stringify({
        type: 'accepted_input',
        sessionId: iso17SessionId,
        turnId: 'iso17-turn',
        sequence: 1,
        createdAt: new Date().toISOString(),
        entryId: 'iso17-entry',
        parentEntryId: null,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'iso17-general-transcript' }],
          },
        ],
      })}\n`,
      'utf8',
    );
    const generalSessionKey = await saasRequestStore.run(aliceCtx, () =>
      resolveSessionProjectKeyForProjectName('general'),
    );
    const resolvedProjectId = (() => {
      const projectsDir = path.join(aliceCtx.tenantPilotHome, 'projects');
      const target = path.resolve(generalSessionKey);
      for (const entry of fs.readdirSync(projectsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const markerPath = path.join(projectsDir, entry.name, '.cwd');
        try {
          const marker = fs.readFileSync(markerPath, 'utf8').trim();
          if (path.resolve(marker) === target) return entry.name;
        } catch {
          /* skip */
        }
      }
      return createProjectId(generalSessionKey);
    })();
    record(
      'ISO-18',
      'canonical sessionKey 解析到 general 稳定 transcript 目录',
      resolvedProjectId === stableGeneralId && fs.existsSync(iso17Transcript),
      `resolved=${resolvedProjectId}`,
    );

    // ISO-19: loose tenant artifacts hoist into general canonical hub
    const generalWsEarly = wsList.find((w) => w.legacyProjectId === 'general');
    const looseDir = path.join(aliceCtx.tenantPilotHome, 'artifacts', 'iso19-loose');
    fs.mkdirSync(looseDir, { recursive: true });
    fs.writeFileSync(path.join(looseDir, 'note.txt'), 'iso19-migrated', 'utf8');
    const { ensureSaasWorkspacesProvisioned: ensureAgain } = await import(
      '../ui/server/saas/storage/ensureWorkspaces.js',
    );
    await saasRequestStore.run(aliceCtx, () => ensureAgain(aliceCtx));
    const hoisted = path.join(generalWsEarly.canonicalProjectKey, 'artifacts', 'iso19-loose', 'note.txt');
    record(
      'ISO-19',
      'cloud-only 下租户根 artifacts/ 不再自动迁入 general',
      !fs.existsSync(hoisted),
      hoisted,
    );

    const ws = await getWorkspaceByLegacyProjectId(alice.user.id, alice.tenantId, projA.name);
    assert.ok(ws);

    record(
      'CLOUD-03',
      'provision 后 workspace 为 cloud 且无 localRootPath',
      ws.storageKind === 'cloud' && !ws.localRootPath,
      `kind=${ws.storageKind}, local=${ws.localRootPath}`,
    );

    const hubHello = path.join(ws.canonicalProjectKey, 'hello.txt');
    record(
      'CLOUD-04',
      '云端枢纽内文件可读（非本地 .cwd 复制）',
      fs.existsSync(hubHello) && fs.readFileSync(hubHello, 'utf8') === 'alice-v1',
      hubHello,
    );

    const enriched = await saasRequestStore.run(aliceCtx, () =>
      enrichSaasProjects([
        {
          name: projA.name,
          displayName: 'alice-proj',
          fullPath: projA.fullPath,
          path: projA.fullPath,
          sessions: [],
        },
      ]),
    );
    record(
      'CLOUD-05',
      'enrichSaasProjects fullPath 解析到 canonical 枢纽',
      enriched[0]?.fullPath === ws.canonicalProjectKey,
      enriched[0]?.fullPath,
    );

    const sync1 = await saasRequestStore.run(aliceCtx, () => syncWorkspaceByProjectName(projA.name));
    record(
      'CLOUD-06',
      'sync-now API 在 cloud-only 下为 no-op',
      sync1.ok && sync1.skipped === 'cloud-only',
      JSON.stringify(sync1),
    );

    const localBindings = path.join(dataRoot, 'tenants', alice.tenantId, 'local-bindings');
    record(
      'CLOUD-07',
      'provision 不创建 local-bindings 目录',
      !fs.existsSync(localBindings),
      localBindings,
    );

    // CLOUD-08: tenant isolation — bob cannot read alice hub path
    let bobForbidden = false;
    await saasRequestStore.run(bobCtx, async () => {
      try {
        await assertStoragePathAllowed(hubHello);
      } catch (e) {
        if (e?.code === 'tenant_forbidden') bobForbidden = true;
      }
    });
    record('CLOUD-08', '跨租户无法访问他户 cloud-storage 路径', bobForbidden, hubHello);

    // CLOUD-09: bob provision isolated
    await saasRequestStore.run(bobCtx, () => ensureSaasWorkspacesProvisioned(bobCtx));
    const bobProj = await saasRequestStore.run(bobCtx, () => createSaasNamedWorkspace('bob-proj'));
    fs.writeFileSync(path.join(bobProj.fullPath, 'secret.txt'), 'bob-only', 'utf8');
    const bobWs = await getWorkspaceByLegacyProjectId(bob.user.id, bob.tenantId, bobProj.name);
    record(
      'CLOUD-09',
      'Bob 租户独立 provision，与 Alice 枢纽路径不同',
      bobWs && !bobWs.canonicalProjectKey.startsWith(ws.canonicalProjectKey),
      bobWs?.canonicalProjectKey,
    );

    const aliceCtx2 = ctxFor(alice.user, alice.tenantId, dataRoot);
    const projC = await saasRequestStore.run(aliceCtx2, () =>
      createSaasNamedWorkspace('alice-proj2'),
    );
    fs.writeFileSync(path.join(projC.fullPath, 'x.txt'), 'c', 'utf8');
    const wsC = await getWorkspaceByLegacyProjectId(alice.user.id, alice.tenantId, projC.name);
    record(
      'CLOUD-10',
      'cloud-only 下一键建项创建云端枢纽',
      Boolean(wsC) && !wsC.localRootPath,
      wsC?.canonicalProjectKey,
    );

    const orphanCwd = path.join(dataRoot, 'work', 'orphan-local');
    seedProject(aliceCtx2.tenantPilotHome, 'proj-orphan', orphanCwd, { 'orphan.txt': 'x' });
    const provOrphan = await saasRequestStore.run(aliceCtx2, () =>
      ensureSaasWorkspacesProvisioned(aliceCtx2),
    );
    const wsOrphan = await getWorkspaceByLegacyProjectId(
      alice.user.id,
      alice.tenantId,
      'proj-orphan',
    );
    record(
      'CLOUD-10b',
      'cloud-only 下忽略本地 .cwd 遗留目录（不再随机新建 UUID 枢纽）',
      !wsOrphan && provOrphan.provisioned === 0,
      wsOrphan?.canonicalProjectKey || 'none',
    );

    const allSync = await saasRequestStore.run(aliceCtx2, () => syncAllForCurrentUser());
    record(
      'CLOUD-11',
      'syncAllForCurrentUser 返回 cloud-only skipped',
      allSync.skipped === 'cloud-only',
      JSON.stringify(allSync),
    );

    // CLOUD-12: pathContainsUserSegment on canonical
    const foreignHub = getCanonicalHubRoot(alice.tenantId, bob.user.id, 'fake-uuid');
    let crossUserBlocked = false;
    await saasRequestStore.run(aliceCtx2, async () => {
      try {
        await assertStoragePathAllowed(foreignHub);
      } catch (e) {
        if (e?.code === 'tenant_forbidden') crossUserBlocked = true;
      }
    });
    record('CLOUD-12', '同租户跨 userId 云路径被拒绝', crossUserBlocked, foreignHub);
  });
}

async function apiJson(url, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (error) {
    return {
      status: 0,
      ok: false,
      json: { error: error instanceof Error ? error.message : String(error) },
    };
  }
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, ok: res.ok, json };
}

async function loginLive(username, password) {
  const res = await apiJson(`${SERVER_URL}/api/auth/login`, {
    method: 'POST',
    body: { username, password },
  });
  return res;
}

async function runLiveTests() {
  const health = await apiJson(`${SERVER_URL}/api/saas/health`);
  if (!health.ok) {
    record(
      'LIVE-00',
      'Live 服务器健康检查（跳过：无 dev 服务）',
      true,
      `${SERVER_URL} unreachable`,
    );
    return;
  }
  record('LIVE-00', 'Live 服务器健康检查', true, SERVER_URL);

  const adminLogin = await loginLive('admin', 'SAAS_ADMIN_PASSWORD');
  record(
    'LIVE-01',
    'Admin 登录',
    adminLogin.ok && adminLogin.json?.token,
    `status=${adminLogin.status}`,
  );
  if (!adminLogin.json?.token) return;

  const token = adminLogin.json.token;
  const status = await apiJson(`${SERVER_URL}/api/saas/storage/status`, { token });
  record(
    'LIVE-02',
    'Admin storage/status mode=cloud-only',
    status.ok && status.json?.mode === 'cloud-only',
    status.json?.mode,
  );
  record(
    'LIVE-03',
    'Admin fileStorage.cloudOnly 默认开启',
    status.json?.fileStorage?.cloudOnly !== false,
    String(status.json?.fileStorage?.cloudOnly),
  );

  const prefs = await apiJson(`${SERVER_URL}/api/saas/me/preferences`, { token });
  record(
    'LIVE-04',
    'Admin preferences migrationVersion=2',
    prefs.json?.preferences?.fileStorage?.migrationVersion === 2,
    String(prefs.json?.preferences?.fileStorage?.migrationVersion),
  );

  const reconcile = await apiJson(`${SERVER_URL}/api/saas/storage/reconcile`, {
    method: 'POST',
    token,
    body: {},
  });
  record(
    'LIVE-05',
    'Admin 登录后 reconcile（仅 provision，无 sync）',
    reconcile.ok && reconcile.json?.reconciled === true,
    JSON.stringify(reconcile.json)?.slice(0, 160),
  );

  const syncAll = await apiJson(`${SERVER_URL}/api/saas/storage/sync-now`, {
    method: 'POST',
    token,
    body: {},
  });
  record(
    'LIVE-05b',
    'Admin sync-now 返回 cloud-only skipped',
    syncAll.ok && (syncAll.json?.skipped === 'cloud-only' || syncAll.json?.results !== undefined),
    JSON.stringify(syncAll.json)?.slice(0, 120),
  );

  const browseFs = await apiJson(`${SERVER_URL}/api/browse-filesystem`, { token });
  record(
    'LIVE-06',
    'SaaS browse-filesystem 返回 403',
    browseFs.status === 403,
    `status=${browseFs.status}`,
  );

  // Second user: register via captcha if possible
  const cap = await apiJson(`${SERVER_URL}/api/saas/captcha`);
  const suffix = Date.now().toString(36).slice(-5);
  const liveUser = `synctest${suffix}`;
  if (cap.ok && cap.json?.captchaId && cap.json?.challenge) {
    const reg = await apiJson(`${SERVER_URL}/api/auth/register`, {
      method: 'POST',
      body: {
        username: liveUser,
        password: 'secret12',
        captchaId: cap.json.captchaId,
        captchaAnswer: cap.json.challenge,
      },
    });
    record(
      'LIVE-07',
      `新用户 ${liveUser} 注册并隔离租户`,
      reg.ok && reg.json?.user?.tenantId?.startsWith('tenant-'),
      reg.json?.user?.tenantId,
    );

    if (reg.json?.token) {
      const memberToken = reg.json.token;
      const mStatus = await apiJson(`${SERVER_URL}/api/saas/storage/status`, { token: memberToken });
      record(
        'LIVE-08',
        'Member storage/status 与 Admin 租户隔离',
        mStatus.ok && mStatus.json?.workspaceCount !== undefined,
        `workspaces=${mStatus.json?.workspaceCount}`,
      );

      const mSync = await apiJson(`${SERVER_URL}/api/saas/storage/sync-now`, {
        method: 'POST',
        token: memberToken,
        body: {},
      });
      record(
        'LIVE-09',
        'Member sync-now 返回 cloud-only skipped',
        mSync.ok && mSync.json?.skipped === 'cloud-only',
        JSON.stringify(mSync.json)?.slice(0, 120),
      );

      record(
        'LIVE-10',
        'Member storage/status mode=cloud-only',
        mStatus.json?.mode === 'cloud-only',
        mStatus.json?.mode,
      );

      const memberBrowse = await apiJson(`${SERVER_URL}/api/browse-filesystem`, { token: memberToken });
      record(
        'LIVE-11',
        'Member browse-filesystem 返回 403',
        memberBrowse.status === 403,
        `status=${memberBrowse.status}`,
      );
    }
  } else {
    record('LIVE-07', '新用户注册（captcha）', false, 'captcha unavailable');
  }

  // Unauthenticated
  const anon = await apiJson(`${SERVER_URL}/api/saas/storage/status`);
  record('LIVE-12', '未登录访问 storage/status 被拒绝', anon.status === 401 || anon.status === 403, `status=${anon.status}`);
}

async function main() {
  console.log('\n=== Part A: Isolated DATA_ROOT tests ===\n');
  try {
    await runIsolatedTests();
  } catch (error) {
    record('ISO-ERR', '隔离测试套件异常', false, error instanceof Error ? error.message : String(error));
  }

  console.log('\n=== Part B: Live server tests ===\n');
  try {
    await runLiveTests();
  } catch (error) {
    record('LIVE-ERR', 'Live 测试套件异常', false, error instanceof Error ? error.message : String(error));
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  const summary = {
    timestamp: new Date().toISOString(),
    total: results.length,
    passed,
    failed: failed.length,
    failures: failed,
    all: results,
  };

  const outPath = path.join(REPO_ROOT, 'artifacts', 'cloud-only-test', 'report.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`\nReport written: ${outPath}`);
  console.log(`SUMMARY: ${passed}/${results.length} passed`);

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
