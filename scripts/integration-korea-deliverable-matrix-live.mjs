#!/usr/bin/env node
/**
 * PD-SAAS-FORK: §五-B Korea deliverable matrix — Gateway live harness.
 *
 * Usage:
 *   npm run test:korea-deliverable:live
 *   KOREA_CASE=K3 npm run test:korea-deliverable:live
 *   KOREA_DRY=1 npm run test:korea-deliverable:live
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  connectGateway,
  newSession,
  submitTurn,
  submitTurnSequence,
  closeGateway,
  readGatewayToken,
} from './lib/gatewaySessionHarness.mjs';
import { resolveProjectWorkspaceCwdWithFallback } from './lib/resolveProjectWorkspaceCwd.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'korea-deliverable-matrix');
const OUT_FILE = path.join(OUT_DIR, 'live-matrix.json');

const TIMEOUT_MS = Number(process.env.KOREA_TIMEOUT_MS || 900_000);
const PROJECT_NAME = process.env.KOREA_PROJECT_NAME || '测试韩国项目';
const SINGLE_CASE = process.env.KOREA_CASE?.trim().toUpperCase();
const DRY = process.env.KOREA_DRY === '1' || process.argv.includes('--dry');

/** @type {Array<{ id: string; slug: string; prompt: string | string[]; expectMinRows?: number; expectMaxRows?: number; expectBasenames?: string[]; expectExt?: RegExp }>} */
const KOREA_MATRIX = [
  {
    id: 'K1',
    slug: 'df-image-generation',
    prompt: '用「image-generation」帮我：【2026世界杯，韩国出局】直接开始做，做完告诉我文件路径。',
    expectMinRows: 1,
    expectExt: /\.png$/i,
  },
  {
    id: 'K2',
    slug: 'mkt-ab-testing',
    prompt: '用「A/B 测试」帮我：【2026世界杯，韩国出局】直接开始做，做完告诉我文件路径。',
    expectMinRows: 1,
    expectExt: /\.md$/i,
  },
  {
    id: 'K3',
    slug: 'mkt-last30days',
    prompt: '用「last30days」帮我：【2026世界杯，韩国出局】直接开始做，做完告诉我文件路径。',
    expectMinRows: 1,
    expectMaxRows: 1,
    expectBasenames: ['marketing-deliverable.md'],
    expectExt: /\.md$/i,
  },
  // PD-SAAS-FORK: P0-1 retains the real legacy three-file content-flywheel contract.
  {
    id: 'K3L',
    slug: 'mkt-last30days',
    prompt: '运行 content-flywheel：须交付 01-topics.md、02-longform.md、03-social-slices.md，写入系统分配任务目录。',
    expectMinRows: 3,
    expectBasenames: ['01-topics.md', '02-longform.md', '03-social-slices.md'],
    expectExt: /\.md$/i,
  },
  {
    id: 'K4',
    slug: 'frontend-slides',
    prompt: '用「HTML 演示」帮我做 6 页横屏翻页 HTML 演示：【2026世界杯，韩国出局】直接开始做，做完告诉我文件路径。',
    expectMinRows: 1,
    expectExt: /\.html$/i,
  },
  {
    id: 'K5',
    slug: 'mkt-x-article-publisher',
    prompt: '用「x-article-publisher」帮我：【2026世界杯，韩国出局】直接开始做，做完告诉我文件路径。',
    expectMinRows: 1,
    expectExt: /\.(md|html)$/i,
  },
  {
    id: 'K6',
    slug: 'nova-ppt-aesthetic-slides',
    prompt: [
      '用「Nova-美学幻灯」帮我：【6】页 16:9，主题【2026世界杯，韩国出局】直接开始做，做完告诉我文件路径。',
      '6页，开始做',
    ],
    expectMinRows: 6,
    expectExt: /\.png$/i,
  },
  {
    id: 'K7',
    slug: 'hf-hyperframes',
    prompt: '用「HTML 代码做视频」帮我做 15 秒视频：【2026世界杯，韩国出局】直接开始做，做完告诉我文件路径。',
    expectMinRows: 1,
    expectExt: /\.mp4$/i,
  },
];

function classifyRow(row) {
  if (row.dry || row.skipReason === 'KOREA_DRY') return 'DRY';
  if (row.skipReason) return 'BLOCKED';
  if (row.timeout) return 'TIMEOUT';
  if (row.status === 'pass') return 'PASS';
  if (/api.?key|401|403|credential|missing.*key|blocked_config/i.test(row.detail || '')) return 'BLOCKED';
  return 'FAIL';
}

function evaluateRow(entry, result) {
  const writePaths = [...new Set(result.toolWritePaths || [])];
  const matchedExt = entry.expectExt
    ? writePaths.some((p) => entry.expectExt.test(p))
    : writePaths.length > 0;
  const acceptanceOk = result.acceptanceStatus !== 'failed';
  const rowCountOk = writePaths.length >= (entry.expectMinRows ?? 1)
    && (entry.expectMaxRows == null || writePaths.length <= entry.expectMaxRows);
  const basenamesOk = !entry.expectBasenames?.length || entry.expectBasenames.every(
    (basename) => writePaths.some((filePath) => path.basename(filePath) === basename),
  );
  const ok = Boolean(result.ok) && matchedExt && acceptanceOk && rowCountOk && basenamesOk;
  return {
    ok,
    matchedExt,
    rowCountOk,
    basenamesOk,
    acceptanceStatus: result.acceptanceStatus,
    toolWritePaths: writePaths,
    assistantText: (result.assistantText || '').slice(0, 4000),
    durationMs: result.durationMs,
    recoveryAttempts: result.recoveryAttempts,
  };
}

async function runCase(ws, projectKey, workspaceCwd, entry) {
  const sessionKey = await newSession(ws, projectKey);
  const tag = `korea-${entry.id.toLowerCase()}`;
  if (DRY) {
    return {
      id: entry.id,
      slug: entry.slug,
      dry: true,
      status: 'dry',
      skipReason: 'KOREA_DRY',
    };
  }

  try {
    readGatewayToken();
  } catch (error) {
    return {
      id: entry.id,
      slug: entry.slug,
      status: 'fail',
      skipReason: String(error.message || error),
    };
  }

  const baseOpts = {
    sessionKey,
    projectKey,
    workspaceCwd,
    timeoutMs: TIMEOUT_MS,
    tag,
    maxTurns: 12,
    // PD-SAAS-FORK: exercise the real exact-capability TurnRunner path.
    capabilityContext: {
      slug: entry.slug,
      displayName: entry.slug,
    },
  };

  let result;
  if (Array.isArray(entry.prompt)) {
    const results = await submitTurnSequence(ws, {
      ...baseOpts,
      messages: entry.prompt,
    });
    result = results[results.length - 1] || { ok: false, timeout: true };
  } else {
    result = await submitTurn(ws, { ...baseOpts, message: entry.prompt });
  }

  const evaluated = evaluateRow(entry, result);
  return {
    id: entry.id,
    slug: entry.slug,
    status: evaluated.ok ? 'pass' : 'fail',
    timeout: Boolean(result.timeout),
    ...evaluated,
    detail: evaluated.ok ? undefined : `acceptance=${result.acceptanceStatus || 'unknown'} paths=${(result.toolWritePaths || []).join(', ')}`,
  };
}

async function main() {
  const cases = SINGLE_CASE
    ? KOREA_MATRIX.filter((c) => c.id === SINGLE_CASE)
    : KOREA_MATRIX;
  if (cases.length === 0) {
    console.error(`Unknown KOREA_CASE=${SINGLE_CASE}`);
    process.exit(1);
  }

  const { cwd, token, serverUrl } = await resolveProjectWorkspaceCwdWithFallback({
    projectName: PROJECT_NAME,
  });
  if (!cwd && !DRY) {
    console.error('Could not resolve project workspace cwd. Start dev:saas and ensure login works.');
    process.exit(1);
  }

  const projectKey = cwd ? path.basename(cwd) : PROJECT_NAME;
  const ws = DRY ? null : await connectGateway({ clientName: 'korea-deliverable-matrix' });
  const rows = [];

  try {
    for (const entry of cases) {
      console.log(`\n▶ ${entry.id} ${entry.slug}`);
      const row = ws
        ? await runCase(ws, projectKey, cwd, entry)
        : {
          id: entry.id,
          slug: entry.slug,
          dry: true,
          status: 'dry',
          skipReason: 'no gateway',
        };
      row.classification = classifyRow(row);
      rows.push(row);
      console.log(`  → ${row.classification}${row.detail ? `: ${row.detail}` : ''}`);
    }
  } finally {
    if (ws) closeGateway(ws);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    projectName: PROJECT_NAME,
    workspaceCwd: cwd,
    serverUrl,
    hasToken: Boolean(token),
    rows,
  };
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(report, null, 2)}\n`);

  const required = ['K1', 'K2', 'K3', 'K3L', 'K4', 'K6'];
  const requiredFails = rows.filter((r) => required.includes(r.id) && r.classification === 'FAIL');
  if (requiredFails.length > 0 && !DRY) {
    console.error(`\nRequired cases failed: ${requiredFails.map((r) => r.id).join(', ')}`);
    process.exit(1);
  }
  console.log(`\nWrote ${OUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
