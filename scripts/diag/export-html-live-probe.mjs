#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Live probe for sidebar HTML export pipeline (messages + snapshot).
 */
import { chromium } from 'playwright';

const BASE_URL = (process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8081').replace(/\/$/, '');
const SERVER_URL = (process.env.SERVER_URL || process.env.PLAYWRIGHT_SERVER_URL || 'http://127.0.0.1:7990').replace(/\/$/, '');
const USER = process.env.SAAS_E2E_USER || 'admin';
const PASS = process.env.SAAS_E2E_PASSWORD || 'SAAS_ADMIN_PASSWORD';

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('#saas-login-username').fill(USER);
  await page.locator('#saas-login-password').fill(PASS);
  await page.getByRole('button', { name: /登录工作区|Log in/i }).click();
  await page.waitForFunction(() => Boolean(localStorage.getItem('auth-token')), undefined, { timeout: 30_000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await login(page);
  await page.goto(`${BASE_URL}/p/general`, { waitUntil: 'networkidle', timeout: 120_000 });

  const token = await page.evaluate(() => localStorage.getItem('auth-token'));
  if (!token) throw new Error('missing auth token');

  const projectsRes = await fetch(`${SERVER_URL}/api/projects?fresh=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!projectsRes.ok) throw new Error(`projects HTTP ${projectsRes.status}`);
  const projects = await projectsRes.json();
  const project = (Array.isArray(projects) ? projects : projects.projects ?? [])[0];
  if (!project?.name) throw new Error('no project');

  const sessionsRes = await fetch(`${SERVER_URL}/api/projects/${encodeURIComponent(project.name)}/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!sessionsRes.ok) throw new Error(`sessions HTTP ${sessionsRes.status}`);
  const sessionsPayload = await sessionsRes.json();
  const sessions = Array.isArray(sessionsPayload) ? sessionsPayload : sessionsPayload.sessions ?? [];
  const session = sessions.find((s) => s.id) ?? null;
  if (!session?.id) throw new Error('no session to export');

  const started = Date.now();
  const msgUrl = `${SERVER_URL}/api/sessions/${encodeURIComponent(session.id)}/messages?provider=pilotdeck&projectName=${encodeURIComponent(project.name)}&limit=120&direction=backward`;
  const msgRes = await fetch(msgUrl, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(60_000),
  });
  const msgElapsed = Date.now() - started;
  const msgBody = msgRes.ok ? await msgRes.json() : await msgRes.text();
  const messageCount = msgRes.ok ? (msgBody.messages?.length ?? 0) : 0;

  let snapshotStatus = 'skipped';
  let snapshotElapsed = 0;
  const firstUser = msgRes.ok
    ? (msgBody.messages ?? []).find((m) => m.role === 'user' || m.kind === 'text' && m.role === 'user')
    : null;
  const scopeGuess = 'artifacts/task-';
  if (msgRes.ok) {
    const snapStarted = Date.now();
    const snapUrl = `${SERVER_URL}/api/projects/${encodeURIComponent(project.name)}/deliverables/task-folder-snapshot?scopeDir=${encodeURIComponent(scopeGuess)}&force=1`;
    const snapRes = await fetch(snapUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    }).catch((err) => ({ ok: false, status: 0, text: async () => String(err) }));
    snapshotElapsed = Date.now() - snapStarted;
    snapshotStatus = snapRes.ok ? String(snapRes.status) : `err:${snapRes.status}`;
  }

  const exportResult = await page.evaluate(async ({ projectName, sessionId }) => {
    try {
      const mod = await import('/src/shared/exportSessionHtml.ts');
      const project = { name: projectName, path: projectName, workspaceUuid: null };
      const session = { id: sessionId, title: 'probe', executionStatus: 'idle' };
      const labels = {
        exportedAt: '导出时间',
        project: '项目',
        sessionId: '会话 ID',
        messageCount: '消息数',
        messageId: '消息 ID',
        messageKind: '消息类型',
        messageIndex: '序号',
        turnId: '轮次 ID',
        toolId: '工具 ID',
        runId: '运行 ID',
        sequence: '序列号',
        messageIndexTable: '索引',
        debugManifest: 'JSON',
        timestamp: '时间',
        user: '用户',
        assistant: '助手',
        toolCall: '工具',
        toolResult: '结果',
        thinking: '思考',
        error: '错误',
        system: '系统',
        attachments: '附件',
        images: '图片',
        activity: '活动',
        noMessages: '无消息',
      };
      const out = await mod.exportSessionToHtmlFile({ project, session, labels, mode: 'user_archive' });
      return { ok: true, filename: out.filename, messageCount: out.messageCount };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }, { projectName: project.name, sessionId: session.id });

  console.log(JSON.stringify({
    project: project.name,
    sessionId: session.id,
    sessionTitle: session.title ?? session.displayTitle,
    messages: { status: msgRes.status, elapsedMs: msgElapsed, count: messageCount },
    snapshot: { status: snapshotStatus, elapsedMs: snapshotElapsed },
    export: exportResult,
    consoleErrors: consoleErrors.slice(0, 10),
  }, null, 2));

  await browser.close();
  if (!exportResult.ok) process.exit(1);
}

main().catch((err) => {
  console.error('[export-html-live-probe] FAIL', err);
  process.exit(1);
});
