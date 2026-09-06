#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Phase 5 prelaunch live tasks (T-01/T-02/T-05/T-09).
 *
 * Usage:
 *   SERVER_URL=http://127.0.0.1:7991 node scripts/integration-prelaunch-live-tasks.mjs
 *   LIVE_TASK=T-05 node scripts/integration-prelaunch-live-tasks.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  closeGateway,
  connectGateway,
  newSession,
  submitTurn,
  submitTurnSequence,
} from './lib/gatewaySessionHarness.mjs';
import { resolveGeneralWorkspaceCwd } from './lib/resolveGeneralWorkspaceCwd.mjs';
import { checkProfileRequiredDeliverables } from '../src/saas/deliverables/profileRequiredDeliverables.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:7991';
const PROJECT_KEY = process.env.LIVE_PROJECT || 'general';
const FILTER = process.env.LIVE_TASK?.trim().toUpperCase();
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'prelaunch-live-tasks');
const STAMP = new Date().toISOString().slice(0, 10).replace(/-/g, '');

const TASKS = [
  {
    id: 'T-09',
    name: '脑爆纯聊天（无交付文件）',
    timeoutMs: Number(process.env.LIVE_T09_TIMEOUT_MS || 180_000),
    maxTurns: 4,
    message:
      '【脑爆】帮我想 5 个面向设计师的 SaaS 产品名字，简短说明每个名字的含义。只要文字回复，不要 write_file，不要交付任何文件。',
    verify(cwd, result) {
      const wroteArtifact = (result.toolWritePaths || []).some((p) => /artifacts\//i.test(p));
      const ok = Boolean(result.turnCompleted) && !wroteArtifact;
      return {
        ok,
        detail: wroteArtifact
          ? `unexpected writes: ${result.toolWritePaths.join(', ')}`
          : `turnCompleted=${result.turnCompleted} recovery=${result.recoveryAttempts}`,
      };
    },
  },
  {
    id: 'T-05',
    name: '雷蛇 5 页官网 HTML 落地页',
    timeoutMs: Number(process.env.LIVE_T05_TIMEOUT_MS || 720_000),
    maxTurns: 16,
    message: [
      '做雷蛇 2026 官网落地页，共 5 页 HTML，风格高端电竞。全部写入 artifacts/razer-landing-2026/，至少包含 index.html。',
      '直接开始做，做完告诉我各文件完整路径。单次 write_file 不超过 80 行，长页用 edit_file 追加。',
    ].join('\n'),
    verify(cwd, result) {
      const dir = path.join(cwd, 'artifacts', 'razer-landing-2026');
      const htmlFiles = listFilesRecursive(dir).filter((f) => /\.html?$/i.test(f));
      const ok = htmlFiles.length >= 1 && htmlFiles.some((f) => fs.statSync(f).size > 200);
      return {
        ok,
        detail: ok
          ? `html=${htmlFiles.length} primary=${path.relative(cwd, htmlFiles[0])}`
          : `missing html under artifacts/razer-landing-2026`,
        paths: htmlFiles.map((f) => path.relative(cwd, f).replace(/\\/g, '/')),
      };
    },
  },
  {
    id: 'T-02',
    name: 'Nova 美学幻灯 6 页 PNG',
    timeoutMs: Number(process.env.LIVE_T02_TIMEOUT_MS || 900_000),
    maxTurns: 14,
    messages: [
      '用「Nova-美学幻灯」做 6 页 16:9 配图 PNG 幻灯，主题【阿根廷旅游】。写入独立 artifacts/slides-* 目录，必须含 slide-manifest.json。',
      '6页，直接开始做，做完告诉我 manifest 与各页 PNG 路径。',
    ],
    verify(cwd, result) {
      const slidesDirs = findSlideDeckDirs(cwd);
      let best = null;
      for (const dir of slidesDirs) {
        const manifest = path.join(dir, 'slide-manifest.json');
        if (!fs.existsSync(manifest)) continue;
        const pngs = fs.readdirSync(dir).filter((n) => /^slide-\d+\.png$/i.test(n));
        if (pngs.length >= 6) {
          best = { dir, manifest, pngs };
          break;
        }
      }
      const ok = Boolean(best);
      return {
        ok,
        detail: ok
          ? `deck=${path.relative(cwd, best.dir)} pages=${best.pngs.length}`
          : `no deck with manifest+6 png (dirs=${slidesDirs.length})`,
        paths: best
          ? [path.relative(cwd, best.manifest).replace(/\\/g, '/'), ...best.pngs.map((p) => path.relative(cwd, path.join(best.dir, p)).replace(/\\/g, '/'))]
          : [],
      };
    },
  },
  {
    id: 'T-01',
    name: '品牌 GEO 全案 smoke',
    timeoutMs: Number(process.env.LIVE_T01_TIMEOUT_MS || 900_000),
    maxTurns: Number(process.env.LIVE_T01_MAX_TURNS || 28),
    artifactDir: 'artifacts/razer-blade-prelaunch-geo',
    message: process.env.LIVE_T01_CONTINUE === '1'
      ? [
          '继续补齐 artifacts/razer-blade-prelaunch-geo/ 中缺失的交付物。',
          '已有：geo-aeo-audit-checklist.md、keywords-research.md、zhihu-article.md、xiaohongshu-article.md。',
          '仍须产出：wechat-article.md、optimized.md、schema.jsonld、citability-report.md、visibility-report.html。',
          '联网失败请降级仍交付；直接开始做，做完告诉我各文件路径。',
        ].join('\n')
      : [
      '帮【雷蛇灵刃2026】做品牌 GEO 全案 smoke，按阶段一次执行。',
      '全部写入 artifacts/razer-blade-prelaunch-geo/，联网失败请降级仍交付。',
      '必须产出：geo-aeo-audit-checklist.md、keywords-research.md、zhihu-article.md、xiaohongshu-article.md、wechat-article.md、optimized.md、schema.jsonld、citability-report.md、visibility-report.html。',
      '直接开始做，做完告诉我各文件路径。',
    ].join('\n'),
    async verify(cwd, result, task) {
      const checks = await checkProfileRequiredDeliverables({
        cwd,
        userGoal: task.message,
        capabilitySlug: 'pd-geo',
      });
      const pass = checks.filter((c) => c.exists && c.sizeBytes > 0);
      const missing = checks.filter((c) => !c.exists || c.sizeBytes <= 0);
      const ok = missing.length === 0 && (result.turnCompleted || pass.length >= 7);
      return {
        ok,
        detail: `${pass.length}/${checks.length} required files`,
        paths: pass.map((c) => c.path),
        missing: missing.map((c) => c.basename),
      };
    },
  },
];

function listFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(abs));
    else out.push(abs);
  }
  return out;
}

function findSlideDeckDirs(cwd) {
  const root = path.join(cwd, 'artifacts');
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^slides-/i.test(e.name))
    .map((e) => path.join(root, e.name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

async function runTask(ws, workspaceCwd, task) {
  console.log(`\n[live-task] ▶ ${task.id} ${task.name}`);
  const sessionKey = await newSession(ws, PROJECT_KEY);
  const base = {
    sessionKey,
    projectKey: PROJECT_KEY,
    workspaceCwd,
    timeoutMs: task.timeoutMs,
    maxTurns: task.maxTurns,
    tag: task.id.toLowerCase(),
  };

  let result;
  if (task.messages?.length) {
    const seq = await submitTurnSequence(ws, { ...base, messages: task.messages });
    result = seq[seq.length - 1] || { ok: false, timeout: true };
  } else {
    result = await submitTurn(ws, { ...base, message: task.message });
  }

  const verification = task.verify.length >= 3
    ? await task.verify(workspaceCwd, result, task)
    : await task.verify(workspaceCwd, result);
  const row = {
    id: task.id,
    name: task.name,
    sessionKey,
    ok: verification.ok && !result.timeout,
    turnCompleted: result.turnCompleted,
    timeout: result.timeout,
    recoveryAttempts: result.recoveryAttempts,
    acceptanceStatus: result.acceptanceStatus,
    durationMs: result.durationMs,
    toolWritePaths: result.toolWritePaths || [],
    verification,
    resolvedBy: result.resolvedBy,
  };
  console.log(
    `[live-task] ${task.id} ${row.ok ? 'PASS' : 'FAIL'} `
    + `${Math.round((result.durationMs || 0) / 1000)}s recovery=${result.recoveryAttempts} `
    + `${verification.detail}`,
  );
  return row;
}

async function main() {
  const workspaceCwd = await resolveGeneralWorkspaceCwd({ serverUrl: SERVER_URL });
  if (!workspaceCwd) {
    console.error(`[live-task] cannot resolve workspace (SERVER_URL=${SERVER_URL})`);
    process.exit(1);
  }
  console.log(`[live-task] SERVER_URL=${SERVER_URL} cwd=${workspaceCwd}`);

  const tasks = FILTER ? TASKS.filter((t) => t.id === FILTER) : TASKS;
  if (!tasks.length) {
    console.error(`[live-task] unknown LIVE_TASK=${FILTER}`);
    process.exit(1);
  }

  let ws = null;
  const rows = [];
  try {
    for (const task of tasks) {
      if (ws) {
        try {
          closeGateway(ws);
        } catch {
          // ignore
        }
      }
      ws = await connectGateway({ clientName: `prelaunch-live-${task.id.toLowerCase()}` });
      try {
        rows.push(await runTask(ws, workspaceCwd, task));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[live-task] ${task.id} ERROR ${message}`);
        rows.push({
          id: task.id,
          name: task.name,
          ok: false,
          error: message,
          verification: { ok: false, detail: message },
        });
      }
    }
  } finally {
    try {
      closeGateway(ws);
    } catch {
      // ignore
    }
  }

  const passCount = rows.filter((r) => r.ok).length;
  const report = {
    at: new Date().toISOString(),
    serverUrl: SERVER_URL,
    workspaceCwd,
    passCount,
    total: rows.length,
    rows,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jsonPath = path.join(OUT_DIR, `live-tasks-${STAMP}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

  const mdPath = path.join(REPO_ROOT, 'docs', `prelaunch-live-tasks-${STAMP}.md`);
  const md = [
    '# 实任务 Live 验收',
    '',
    `- **时间**：${report.at}`,
    `- **环境**：${SERVER_URL}`,
    `- **结果**：${passCount}/${rows.length} PASS`,
    '',
    '| ID | 任务 | 结果 | 耗时 | repair | 主成果 |',
    '|----|------|------|------|--------|--------|',
    ...rows.map((r) => {
      const paths = (r.verification.paths || r.toolWritePaths || []).slice(0, 2).join('; ') || '—';
      return `| ${r.id} | ${r.name} | ${r.ok ? 'PASS' : 'FAIL'} | ${Math.round((r.durationMs || 0) / 1000)}s | ${r.recoveryAttempts} | ${paths} |`;
    }),
    '',
    '## 明细',
    '',
    ...rows.map((r) => [
      `### ${r.id} ${r.name}`,
      '',
      `- sessionKey: \`${r.sessionKey}\``,
      `- turnCompleted: ${r.turnCompleted}`,
      `- acceptance: ${r.acceptanceStatus ?? '—'}`,
      `- verification: ${r.verification.detail}`,
      ...(r.verification.missing?.length ? [`- missing: ${r.verification.missing.join(', ')}`] : []),
      '',
    ].join('\n')),
  ].join('\n');
  fs.writeFileSync(mdPath, md, 'utf8');

  console.log(`\n[live-task] report ${mdPath}`);
  console.log(`[live-task] json ${jsonPath}`);
  console.log(`[live-task] ${passCount}/${rows.length} PASS`);

  if (passCount < rows.length) process.exit(1);
}

main().catch((err) => {
  console.error('[live-task]', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
