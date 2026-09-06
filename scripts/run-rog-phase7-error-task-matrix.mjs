#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 0706 错误任务矩阵复测 — 输出 JSONL + 控制台摘要
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { satisfyPresentationPptxAlias, dedupeVerifiedBrokenOverlap, novaDeckCompletePass } from '../src/saas/deliverables/reconcileDeliverableFacts.ts';
import { resolveProfile, shouldUpgradeDfPptHubRoute } from '../src/saas/deliverableCapabilityProfiles.ts';
import { recordSessionRepairGap } from '../src/saas/deliverables/sessionRepairCircuitBreaker.ts';
import { sanitizeSessionGoalAnchor } from '../src/saas/taskState/sessionDeliverableManifest.ts';
import { reconcileDeliverableGroundTruth } from '../src/saas/deliverables/deliverableGroundTruth.ts';
import os from 'node:os';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'artifacts', '0706雷神批次', 'logs');
const outPath = path.join(outDir, `error-task-matrix-retest-${new Date().toISOString().slice(0, 10)}.jsonl`);
const baselinePath = path.join(root, 'artifacts', '0706雷神批次', 'kpi-baseline-0706.jsonl');

const ERROR_TASKS = [
  {
    id: 'ET-PPT-01',
    t0706: 'T0706-07',
    session: 'aad78932',
    label: 'PPT 生成（df-ppt 误路由）',
    rc: 'RC-PPT-2',
    pr: 'G2',
    prompt: 'artifacts/0706雷神批次/prompts/T0706-07-ppt-generate.txt',
  },
  {
    id: 'ET-PPT-02',
    t0706: 'T0706-08',
    session: 'b2721bdd',
    label: '原生可编辑 PPT（pptx 别名假缺）',
    rc: 'RC-PPT-1',
    pr: 'G1',
    prompt: 'artifacts/0706雷神批次/prompts/T0706-08-native-pptx.txt',
  },
  {
    id: 'ET-PPT-03',
    t0706: 'T0706-09',
    session: '517c6c7e',
    label: 'Nova-美学幻灯（verified∩broken 双轨）',
    rc: 'RC-PPT-3/3b',
    pr: 'G3',
    prompt: 'artifacts/0706雷神批次/prompts/T0706-09-nova-aesthetic.txt',
  },
  {
    id: 'ET-RES-01',
    t0706: 'T0706-06',
    session: '0ffbb6a3',
    label: 'Nova-竞品对标（无路径仍 repair）',
    rc: 'RC-RES-1',
    pr: 'G5',
    prompt: 'artifacts/0706雷神批次/prompts/T0706-06-competitive.txt',
  },
  {
    id: 'ET-LOOP-01',
    t0706: '—',
    session: 'b2721bdd/aad78932/517c6c7e',
    label: '跨 turn repair 风暴（熔断兜底）',
    rc: 'RC-PPT-LOOP',
    pr: 'G0',
    prompt: '—',
  },
  {
    id: 'ET-ANCHOR-01',
    t0706: 'T0706-02',
    session: 'ebdf1cae',
    label: 'sessionGoalAnchor 被 meta 追问污染',
    rc: 'RC-ANCHOR-1',
    pr: 'G4',
    prompt: 'artifacts/0706雷神批次/prompts/T0706-02-last30days.txt',
  },
];

function readBaseline(sessionPrefix) {
  if (!fs.existsSync(baselinePath)) return null;
  const lines = fs.readFileSync(baselinePath, 'utf8').split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    const row = JSON.parse(line);
    if (row.sessionPrefix === sessionPrefix) return row;
  }
  return null;
}

async function runStaticChecks(task) {
  const checks = [];
  const goal07 = '用「PPT 生成」做一套演示稿：【雷神笔记本主题 + 6页数 + 产品展示】';
  const goal08 = '用「原生可编辑 PPT」帮我：【雷神笔记本主题 + 6页数 + 产品展示】';
  const goal09 = '用「Nova-美学幻灯」把【雷神笔记本主题 + 6页数 + 产品展示】';
  const goal06 = 'Nova-竞品对标 雷神笔记本';

  if (task.id === 'ET-PPT-01') {
    const profile = resolveProfile('df-ppt-generation', undefined, goal07);
    checks.push({
      name: 'df-ppt→ppt-master 路由',
      pass: shouldUpgradeDfPptHubRoute('df-ppt-generation', goal07) && profile.id === 'ppt-master',
      detail: `profileId=${profile.id}`,
    });
  }

  if (task.id === 'ET-PPT-02') {
    const missing = satisfyPresentationPptxAlias({
      missing: ['artifacts/slides/thunderobot-laptop/presentation.pptx'],
      verified: ['artifacts/slides/thunderobot-laptop/thunderobot-laptop.pptx'],
    });
    checks.push({
      name: 'presentation.pptx 别名满足',
      pass: missing.length === 0,
      detail: `missingAfter=${JSON.stringify(missing)}`,
    });
  }

  if (task.id === 'ET-PPT-03') {
    const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'rog-et-'));
    const deckDir = 'artifacts/slides-thunder-517';
    const pages = Array.from({ length: 6 }, (_, i) => ({
      image_path: `slide-${String(i + 1).padStart(2, '0')}.png`,
    }));
    await fs.promises.mkdir(path.join(tmp, deckDir), { recursive: true });
    await fs.promises.writeFile(
      path.join(tmp, deckDir, 'slide-manifest.json'),
      JSON.stringify({ pages, aspect_ratio: '16:9' }),
    );
    for (const p of pages) {
      await fs.promises.writeFile(path.join(tmp, deckDir, p.image_path), Buffer.alloc(256, 1));
    }
    const verified = pages.map((p) => `${deckDir}/${p.image_path}`);
    verified.unshift(`${deckDir}/slide-manifest.json`);
    const broken = [...pages.map((p) => `${deckDir}/${p.image_path}`)];
    const deduped = await dedupeVerifiedBrokenOverlap({ cwd: tmp, verified, broken });
    const novaPass = await novaDeckCompletePass({
      cwd: tmp,
      userGoal: goal09,
      capabilitySlug: 'nova-ppt-aesthetic-slides',
      verified,
      missing: [],
      broken: deduped,
    });
    checks.push({
      name: 'verified∩broken 去重',
      pass: deduped.length === 0,
      detail: `brokenLeft=${deduped.length}`,
    });
    checks.push({
      name: 'novaDeckCompletePass',
      pass: novaPass.broken.length === 0 && novaPass.failuresDropped,
      detail: `deckBroken=${novaPass.broken.length}`,
    });
    checks.push({
      name: 'profile=nova-slide-deck',
      pass: resolveProfile('nova-ppt-aesthetic-slides', undefined, goal09).id === 'nova-slide-deck',
      detail: '',
    });
  }

  if (task.id === 'ET-RES-01') {
    const gt = reconcileDeliverableGroundTruth({
      userGoal: goal06,
      capabilitySlug: 'nova-research-competitor',
      verified: ['artifacts/research/competitive-benchmark.md'],
      missing: [],
      broken: [],
    });
    checks.push({
      name: 'research 报告 passed GT',
      pass: gt.reconciled && gt.acceptance === 'passed',
      detail: `acceptance=${gt.acceptance}`,
    });
    checks.push({
      name: 'profile=research',
      pass: resolveProfile('nova-research-competitor', undefined, goal06).id === 'research',
      detail: '',
    });
  }

  if (task.id === 'ET-LOOP-01') {
    let manifest = { manifestVersion: 2, goalVersion: 1, sessionGoalAnchor: 'ppt' };
    let tripped = false;
    for (let i = 0; i < 3; i += 1) {
      const r = recordSessionRepairGap({
        manifest,
        missing: ['artifacts/deck/presentation.pptx'],
        broken: [],
        verified: [],
      });
      manifest = { ...manifest, repairCircuit: r.circuit };
      tripped = r.tripped;
    }
    checks.push({
      name: '同 gap 跨 3 turn 熔断',
      pass: tripped,
      detail: `tripped=${tripped}`,
    });
    checks.push({
      name: 'alias gap 不计入 repair',
      pass: !recordSessionRepairGap({
        manifest: { manifestVersion: 2, goalVersion: 1, sessionGoalAnchor: 'ppt' },
        missing: ['artifacts/deck/presentation.pptx'],
        broken: [],
        verified: ['artifacts/deck/real-deck.pptx'],
      }).circuit.totalRepairs,
      detail: 'totalRepairs=0',
    });
  }

  if (task.id === 'ET-ANCHOR-01') {
    const sanitized = sanitizeSessionGoalAnchor('这俩结果是本任务的吗？？');
    checks.push({
      name: 'meta 追问过滤',
      pass: sanitized === '',
      detail: `sanitized="${sanitized}"`,
    });
  }

  const pass = checks.every((c) => c.pass);
  return { checks, pass };
}

function runFixtureGate() {
  const r = spawnSync('node', ['--import', 'tsx', 'scripts/test-rog-phase7-integration.mjs'], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return r.status === 0;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

  const fixtureOk = runFixtureGate();
  const rows = [];

  for (const task of ERROR_TASKS) {
    const baseline = task.session.includes('/')
      ? null
      : readBaseline(task.session);
    const { checks, pass } = await runStaticChecks(task);
    const row = {
      id: task.id,
      t0706: task.t0706,
      session: task.session,
      label: task.label,
      rc: task.rc,
      pr: task.pr,
      baseline: baseline
        ? {
            lastAcceptanceStatus: baseline.lastAcceptanceStatus,
            repairCount: baseline.repairCount,
            falseIncomplete: baseline.falseIncomplete,
            verifiedBrokenOverlap: baseline.verifiedBrokenOverlap ?? 0,
            lastProfileId: baseline.lastProfileId,
          }
        : { note: 'multi-session or aggregate' },
      staticRetest: { pass, checks },
      fixtureGate: fixtureOk,
      liveRetest: { status: 'pending', reason: '需 dev:saas + 生图 Key Gateway 实跑' },
      matrixVerdict: pass && fixtureOk ? 'STATIC_PASS' : 'STATIC_FAIL',
      at: new Date().toISOString(),
    };
    rows.push(row);
    fs.appendFileSync(outPath, `${JSON.stringify(row)}\n`);
    console.log(`[${row.matrixVerdict}] ${task.id} ${task.label} — ${checks.filter((c) => c.pass).length}/${checks.length} checks`);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    totalErrorTasks: rows.length,
    staticPass: rows.filter((r) => r.matrixVerdict === 'STATIC_PASS').length,
    staticFail: rows.filter((r) => r.matrixVerdict === 'STATIC_FAIL').length,
    fixtureGate: fixtureOk,
    livePending: rows.length,
    outPath,
  };
  fs.writeFileSync(path.join(outDir, 'error-task-matrix-summary.json'), JSON.stringify(summary, null, 2));
  console.log('\n' + JSON.stringify(summary, null, 2));
  if (summary.staticFail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
