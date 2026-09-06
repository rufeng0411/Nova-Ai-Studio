import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { catalogStore } from './CatalogStore.js';
import { normalizeSessionId } from './normalizeSessionId.js';

describe('conversation catalog store', () => {
  let dataRoot;
  let previousEnv;

  beforeEach(async () => {
    previousEnv = { ...process.env };
    dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-store-'));
    process.env.PILOTDECK_SAAS_MODE = '1';
    process.env.DATA_ROOT = dataRoot;
    const { bootstrapSaasControlPlane } = await import('../auth/bootstrap.js');
    await bootstrapSaasControlPlane({ log: () => {} });
  });

  afterEach(async () => {
    const { closeControlDatabase } = await import('../db/control.js');
    await closeControlDatabase();
    process.env = previousEnv;
    fs.rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });

  it('upserts and lists by project with tenant isolation', async () => {
    const { openControlDatabase } = await import('../db/control.js');
    const db = await openControlDatabase();
    const admin = await db.queryOne('SELECT id, tenant_id FROM users WHERE username = ?', ['admin']);
    assert.ok(admin);

    await catalogStore.upsert({
      tenantId: admin.tenant_id,
      userId: admin.id,
      sessionId: 'web-s_test-001',
      legacyProjectId: 'general',
      transcriptRelPath: 'projects/general/chats/web-s_test-001.jsonl',
      summary: '测试对话',
    });

    const row = await catalogStore.getBySessionId({
      tenantId: admin.tenant_id,
      userId: admin.id,
      sessionId: 'web:s_test-001',
    });
    assert.equal(row?.sessionId, normalizeSessionId('web:s_test-001'));
    assert.equal(row?.summary, '测试对话');

    const list = await catalogStore.listByProject({
      tenantId: admin.tenant_id,
      userId: admin.id,
      legacyProjectId: 'general',
      limit: 10,
    });
    assert.equal(list.length, 1);

    const count = await catalogStore.countByProject({
      tenantId: admin.tenant_id,
      userId: admin.id,
      legacyProjectId: 'general',
    });
    assert.equal(count, 1);
  });

  it('soft deletes and excludes from list', async () => {
    const { openControlDatabase } = await import('../db/control.js');
    const db = await openControlDatabase();
    const admin = await db.queryOne('SELECT id, tenant_id FROM users WHERE username = ?', ['admin']);

    await catalogStore.upsert({
      tenantId: admin.tenant_id,
      userId: admin.id,
      sessionId: 'web-s_del-001',
      legacyProjectId: 'general',
      transcriptRelPath: 'projects/general/chats/web-s_del-001.jsonl',
      summary: '待删除',
    });

    const deleted = await catalogStore.softDelete({
      tenantId: admin.tenant_id,
      userId: admin.id,
      sessionId: 'web-s_del-001',
    });
    assert.equal(deleted, true);

    const list = await catalogStore.listByProject({
      tenantId: admin.tenant_id,
      userId: admin.id,
      legacyProjectId: 'general',
    });
    assert.equal(list.length, 0);
  });

  it('upsert after soft delete does not resurrect deleted_at', async () => {
    const { openControlDatabase } = await import('../db/control.js');
    const db = await openControlDatabase();
    const admin = await db.queryOne('SELECT id, tenant_id FROM users WHERE username = ?', ['admin']);

    await catalogStore.upsert({
      tenantId: admin.tenant_id,
      userId: admin.id,
      sessionId: 'web-s_resurrect-001',
      legacyProjectId: 'general',
      transcriptRelPath: 'projects/general/chats/web-s_resurrect-001.jsonl',
      summary: '待删除',
    });

    await catalogStore.softDelete({
      tenantId: admin.tenant_id,
      userId: admin.id,
      sessionId: 'web-s_resurrect-001',
    });

    await catalogStore.upsert({
      tenantId: admin.tenant_id,
      userId: admin.id,
      sessionId: 'web-s_resurrect-001',
      legacyProjectId: 'general',
      transcriptRelPath: 'projects/general/chats/web-s_resurrect-001.jsonl',
      summary: 'reconcile 试图复活',
      source: 'reconcile',
    });

    const deletedRow = await catalogStore.getBySessionId({
      tenantId: admin.tenant_id,
      userId: admin.id,
      sessionId: 'web-s_resurrect-001',
      includeDeleted: true,
    });
    assert.ok(deletedRow?.deletedAt, 'deleted_at must stay set after upsert on deleted row');

    const visible = await catalogStore.listByProject({
      tenantId: admin.tenant_id,
      userId: admin.id,
      legacyProjectId: 'general',
    });
    assert.equal(
      visible.some((row) => row.sessionId === 'web-s_resurrect-001'),
      false,
      'soft-deleted session must not reappear in listByProject',
    );
  });

  it('upsert preserves existing summary and ai_title on conflict', async () => {
    const { openControlDatabase } = await import('../db/control.js');
    const db = await openControlDatabase();
    const admin = await db.queryOne('SELECT id, tenant_id FROM users WHERE username = ?', ['admin']);

    await catalogStore.upsert({
      tenantId: admin.tenant_id,
      userId: admin.id,
      sessionId: 'web-s_title-freeze-001',
      legacyProjectId: 'general',
      transcriptRelPath: 'projects/general/chats/web-s_title-freeze-001.jsonl',
      summary: '首条标题',
      aiTitle: '首次 AI 标题',
      firstPrompt: '首条用户消息',
    });

    await catalogStore.upsert({
      tenantId: admin.tenant_id,
      userId: admin.id,
      sessionId: 'web-s_title-freeze-001',
      legacyProjectId: 'general',
      transcriptRelPath: 'projects/general/chats/web-s_title-freeze-001.jsonl',
      summary: '续聊后标题',
      aiTitle: '后续 AI 标题',
      firstPrompt: '续聊用户消息',
    });

    const row = await catalogStore.getBySessionId({
      tenantId: admin.tenant_id,
      userId: admin.id,
      sessionId: 'web-s_title-freeze-001',
    });
    assert.equal(row?.summary, '首条标题');
    assert.equal(row?.aiTitle, '首次 AI 标题');
    assert.equal(row?.firstPrompt, '首条用户消息');
  });

  it('updateCustomTitle persists', async () => {
    const { openControlDatabase } = await import('../db/control.js');
    const db = await openControlDatabase();
    const admin = await db.queryOne('SELECT id, tenant_id FROM users WHERE username = ?', ['admin']);

    await catalogStore.upsert({
      tenantId: admin.tenant_id,
      userId: admin.id,
      sessionId: 'web-s_rename-001',
      legacyProjectId: 'general',
      transcriptRelPath: 'projects/general/chats/web-s_rename-001.jsonl',
      summary: '旧标题',
    });

    await catalogStore.updateCustomTitle({
      tenantId: admin.tenant_id,
      userId: admin.id,
      sessionId: 'web-s_rename-001',
      customTitle: '新标题',
    });

    const row = await catalogStore.getBySessionId({
      tenantId: admin.tenant_id,
      userId: admin.id,
      sessionId: 'web-s_rename-001',
    });
    assert.equal(row?.customTitle, '新标题');
  });

  it('softDelete matches web:s_ alias and listSoftDeletedSessionIdsForUser is cross-project', async () => {
    const { openControlDatabase } = await import('../db/control.js');
    const db = await openControlDatabase();
    const admin = await db.queryOne('SELECT id, tenant_id FROM users WHERE username = ?', ['admin']);

    await catalogStore.upsert({
      tenantId: admin.tenant_id,
      userId: admin.id,
      sessionId: 'web-s_alias-del-001',
      legacyProjectId: 'general',
      transcriptRelPath: 'projects/general/chats/web-s_alias-del-001.jsonl',
      summary: '别名删除',
    });

    const deleted = await catalogStore.softDelete({
      tenantId: admin.tenant_id,
      userId: admin.id,
      sessionId: 'web:s_alias-del-001',
    });
    assert.equal(deleted, true);

    const ids = await catalogStore.listSoftDeletedSessionIdsForUser({
      tenantId: admin.tenant_id,
      userId: admin.id,
    });
    assert.equal(ids.has('web-s_alias-del-001'), true);
    assert.equal(ids.has('web:s_alias-del-001'), true);

    const perProject = await catalogStore.listSoftDeletedSessionIds({
      tenantId: admin.tenant_id,
      userId: admin.id,
      legacyProjectId: 'other-project-slug',
    });
    assert.equal(perProject.has('web-s_alias-del-001'), false);

    const forUser = await catalogStore.listSoftDeletedSessionIdsForUser({
      tenantId: admin.tenant_id,
      userId: admin.id,
    });
    assert.equal(forUser.has('web-s_alias-del-001'), true);
  });

  it('hardDelete physically removes catalog row and outbox', async () => {
    const { openControlDatabase } = await import('../db/control.js');
    const db = await openControlDatabase();
    const admin = await db.queryOne('SELECT id, tenant_id FROM users WHERE username = ?', ['admin']);

    await catalogStore.upsert({
      tenantId: admin.tenant_id,
      userId: admin.id,
      sessionId: 'web-s_hard-del-001',
      legacyProjectId: 'general',
      transcriptRelPath: 'projects/general/chats/web-s_hard-del-001.jsonl',
      summary: '物理删除',
    });
    await catalogStore.enqueueOutbox({
      tenantId: admin.tenant_id,
      userId: admin.id,
      sessionId: 'web-s_hard-del-001',
      payload: {
        tenantId: admin.tenant_id,
        userId: admin.id,
        sessionId: 'web-s_hard-del-001',
        legacyProjectId: 'general',
        transcriptRelPath: 'projects/general/chats/web-s_hard-del-001.jsonl',
      },
    });

    const deleted = await catalogStore.hardDelete({
      tenantId: admin.tenant_id,
      userId: admin.id,
      sessionId: 'web:s_hard-del-001',
    });
    assert.equal(deleted, true);

    const row = await catalogStore.getBySessionId({
      tenantId: admin.tenant_id,
      userId: admin.id,
      sessionId: 'web-s_hard-del-001',
      includeDeleted: true,
    });
    assert.equal(row, null);

    const outboxCount = await db.queryOne(
      'SELECT COUNT(*) AS count FROM conversation_catalog_outbox WHERE session_id = ?',
      ['web-s_hard-del-001'],
    );
    assert.equal(Number(outboxCount?.count ?? 0), 0);
  });

  it('hardDeleteByProject removes all sessions for a legacy project id', async () => {
    const { openControlDatabase } = await import('../db/control.js');
    const db = await openControlDatabase();
    const admin = await db.queryOne('SELECT id, tenant_id FROM users WHERE username = ?', ['admin']);

    for (const sessionId of ['web-s_proj-a', 'web-s_proj-b']) {
      await catalogStore.upsert({
        tenantId: admin.tenant_id,
        userId: admin.id,
        sessionId,
        legacyProjectId: 'workspaces-demo',
        transcriptRelPath: `projects/workspaces-demo/chats/${sessionId}.jsonl`,
        summary: sessionId,
      });
    }

    const removed = await catalogStore.hardDeleteByProject({
      tenantId: admin.tenant_id,
      userId: admin.id,
      legacyProjectId: 'workspaces-demo',
    });
    assert.equal(removed, 2);

    const remaining = await catalogStore.listByProject({
      tenantId: admin.tenant_id,
      userId: admin.id,
      legacyProjectId: 'workspaces-demo',
    });
    assert.equal(remaining.length, 0);
  });
});
