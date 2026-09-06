#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 0709-Test-2 UDC 六案实跑结果深度分析 + 优化建议。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactRoot = path.join(root, 'artifacts/0709-Test-2');
const logDir = path.join(artifactRoot, 'logs');
const manifestPath = path.join(root, 'tests/fixtures/goal-loop/0709-udc-live/cases.json');
const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const caseDefs = new Map(manifest.cases.map((c) => [c.id, c]));

function loadResults() {
  const results = [];
  for (const c of manifest.cases) {
    const p = path.join(logDir, `${c.id}.json`);
    if (fs.existsSync(p)) {
      try {
        results.push(JSON.parse(fs.readFileSync(p, 'utf8')));
      } catch {
        // skip
      }
    }
  }
  if (results.length === 0 && fs.existsSync(path.join(logDir, '0709-udc-live.jsonl'))) {
    for (const line of fs.readFileSync(path.join(logDir, '0709-udc-live.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean)) {
      try {
        results.push(JSON.parse(line));
      } catch {
        // skip
      }
    }
  }
  const byId = new Map();
  for (const r of results) {
    if (r.id) byId.set(r.id, r);
  }
  return manifest.cases.map((c) => byId.get(c.id)).filter(Boolean);
}

function classifyPatterns(results) {
  const patterns = [];
  const repair = results.filter((r) => r.hasRepairUi).map((r) => r.id);
  if (repair.length) patterns.push({ level: 'P0', text: `repair UI 仍可见：${repair.join(', ')}` });

  const lowDock = results.filter((r) => ((r.dock?.rowCount) ?? 0) < 1);
  if (lowDock.length) patterns.push({ level: 'P0', text: `Dock 无可见行：${lowDock.map((r) => r.id).join(', ')}` });

  const sdmZero = results.filter((r) => (r.sdmSlotCount ?? 0) === 0 && (r.dock?.rowCount ?? 0) > 0);
  if (sdmZero.length) patterns.push({ level: 'P1', text: `有 Dock 行但 SDM slots=0（消息 metadata 未写回）：${sdmZero.map((r) => r.id).join(', ')}` });

  const earlyExit = results.filter((r) => r.outcome === 'still_thinking' || r.outcome === 'timeout');
  if (earlyExit.length) patterns.push({ level: 'P0', text: `未收敛即结束（still_thinking/timeout）：${earlyExit.map((r) => r.id).join(', ')}` });

  const geoMisbind = results.filter((r) => {
    const def = caseDefs.get(r.id);
    return def?.expect?.profileIdNot === 'geo' && r.sdm?.manifest?.profileId === 'geo';
  });
  if (geoMisbind.length) patterns.push({ level: 'P0', text: `增长案仍误绑 geo profile：${geoMisbind.map((r) => r.id).join(', ')}` });

  const bindFail = results.filter((r) => {
    const checks = r.udcAssess?.checks ?? {};
    return checks.bindBasenameVisible === false;
  });
  if (bindFail.length) patterns.push({ level: 'P0', text: `slot_1 审计清单未在 Dock 可见：${bindFail.map((r) => r.id).join(', ')}` });

  return patterns;
}

function buildRecommendations(results, patterns) {
  const recs = [];

  if (patterns.some((p) => p.text.includes('still_thinking') || p.text.includes('timeout'))) {
    recs.push({
      level: 'P0',
      title: '拉长实机等待 + 引擎 auto-continue',
      detail: 'Playwright 已改为等「交付进度 N/M」或 Dock 已交付稳定 45s；若仍 timeout，须查 AgentLoop `shouldAutoContinueAfterIncompleteDeliverableStop` 是否在 GEO/增长长任务触发，以及 stale-turn watchdog 是否误停。',
    });
  }
  if (patterns.some((p) => p.text.includes('Dock 无可见行'))) {
    recs.push({
      level: 'P0',
      title: 'UDC 单内核与 SDM 写盘对齐',
      detail: '对照 `buildUnifiedDeliverableView` + `deriveDeliverablesDockState`：turn 末须写 sessionDeliverableManifest；DeliverableSummaryTable 找不到「已交付」的 acceptance 失败需一并修（阻塞 test:sdm:acceptance）。',
    });
  }
  if (patterns.some((p) => p.text.includes('误绑 geo'))) {
    recs.push({
      level: 'P0',
      title: 'C8 profile 守卫强化',
      detail: '确认 `mergeNumberedSlotsWithProfile` + C8 守卫在 live 路由生效；增长八步不应走 geo profile 或 geo pathHint。',
    });
  }
  if (patterns.some((p) => p.text.includes('审计清单'))) {
    recs.push({
      level: 'P0',
      title: 'C4/C5 slot_1 绑定 + strict GT',
      detail: '验证 `shouldApplyBaselineStrictGt()` 自动开启；`01-aeo-audit-checklist.md` 须经 pathHints/slotBindings 绑 slot_0；导出 contract 行数 ≤7 非 17 行假绿。',
    });
  }

  const videoCase = results.find((r) => r.id === 'UDC-C7-1d1bf62f');
  if (videoCase && ((videoCase.dock?.deliveredCount ?? 0) < 1 || videoCase.status !== 'pass')) {
    recs.push({
      level: 'P1',
      title: 'C7 视频交付链',
      detail: '检查 Seedance/DashScope Key、generate_video 首轮日志、media_video slot profile；无 mp4 时 UserActionRequired 应温和提示而非假绿。',
    });
  }

  recs.push({
    level: 'P1',
    title: '三分取证纳入 CI',
    detail: '每案保留 contractHash + task-folder-snapshot + slotBindings；将 0709-Test-2 sessionId 写入 `analyze:task-completion --gate` KPI。',
  });

  recs.push({
    level: 'P2',
    title: 'DeliverableSummaryTable acceptance',
    detail: '修 vitest 找不到「已交付」的 5 用例， unblock test:sdm:acceptance 与 prelaunch:quick。',
  });

  return recs;
}

function buildAnalysisDoc(results) {
  const patterns = classifyPatterns(results);
  const recs = buildRecommendations(results, patterns);
  const pass = results.filter((r) => r.status === 'pass').length;
  const partial = results.filter((r) => r.status === 'partial').length;
  const fail = results.filter((r) => r.status === 'fail').length;

  const caseSections = results.map((r) => {
    const def = caseDefs.get(r.id);
    const checks = r.udcAssess?.checks ?? {};
    const checkLines = Object.entries(checks).map(([k, v]) => `  - ${k}: ${v ? '✅' : '❌'}`);
    const folderFiles = r.folderSnapshot?.files?.length ?? r.folderSnapshot?.items?.length ?? null;

    return [
      `### ${r.code ?? ''} ${r.id}`,
      '',
      `- **历史基线**：${r.baseline ?? def?.baseline ?? '-'}`,
      `- **本次 status / outcome**：${r.status} / ${r.outcome}`,
      `- **耗时**：${r.elapsedMs ? `${Math.round(r.elapsedMs / 1000)}s` : '-'}`,
      `- **sessionId**：\`${r.sessionId ?? '-'}\``,
      `- **URL**：${r.url ?? '-'}`,
      `- **Dock**：行 ${r.dock?.rowCount ?? 0}，已交付 ${r.dock?.deliveredCount ?? 0}，进度 ${r.dock?.progressText || '-'}`,
      `- **SDM slots / profile**：${r.sdmSlotCount ?? 0} / ${r.sdm?.manifest?.profileId ?? '-'}`,
      `- **contractHash**：\`${r.contractHash ?? r.sdm?.contractHash ?? '-'}\``,
      `- **folderSnapshot 文件数**：${folderFiles ?? '未拉取'}`,
      `- **repair / task-resume 泄漏**：${r.hasRepairUi ? 'repair ⚠️' : '无'} / ${r.hasTaskResume ? 'task-resume ⚠️' : '无'}`,
      `- **UDC 自动检查**：${r.udcAssess?.udcScore ?? 'n/a'}`,
      ...checkLines,
      '',
      '<details><summary>Dock 行摘要</summary>',
      '',
      ...(r.dock?.rowTexts?.length
        ? r.dock.rowTexts.map((t) => `- ${t.slice(0, 100)}`)
        : ['- （无）']),
      '',
      '</details>',
      '',
    ].join('\n');
  });

  return [
    '# 0709-Test-2 UDC 六案实机深度分析',
    '',
    `**生成时间**：${new Date().toISOString()}  `,
    `**数据源**：\`artifacts/0709-Test-2/logs/*.json\` + JSONL  `,
    `**Playwright**：workers=2 并行  `,
    '',
    '## 1. 总览',
    '',
    `| 维度 | 数量 |`,
    `|------|------|`,
    `| 通过 | ${pass} |`,
    `| 部分 | ${partial} |`,
    `| 失败 | ${fail} |`,
    `| 合计 | ${results.length} |`,
    '',
    '## 2. 共性问题模式',
    '',
    ...(patterns.length
      ? patterns.map((p) => `- **${p.level}**：${p.text}`)
      : ['- 暂无跨案例共性失败']),
    '',
    '## 3. 分案详情',
    '',
    ...caseSections,
    '## 4. 与 UDC R11 验收标准对照',
    '',
    '| 案例 | 期望 | 实机结论 |',
    '|------|------|----------|',
    ...results.map((r) => {
      const def = caseDefs.get(r.id);
      const expectSummary = def?.expect?.slotCount
        ? `${def.expect.slotCount} 槽`
        : String(def?.baseline ?? '').slice(0, 40);
      const actual = `${r.status}；Dock ${r.dock?.rowCount ?? 0} 行；outcome ${r.outcome}`;
      return `| ${r.id} | ${expectSummary} | ${actual} |`;
    }),
    '',
    '## 5. 优化建议（按优先级）',
    '',
    ...recs.map((rec, i) => `${i + 1}. **${rec.level} — ${rec.title}**\n   ${rec.detail}`),
    '',
    '## 6. 保留与复查',
    '',
    '- 项目 **0709-Test-2** 及六条会话、成果文件、截图均未删除。',
    '- 侧栏逐条打开 session URL 可人工复核 Dock / 文件夹 / 导出 HTML。',
    '- 明细 JSONL：\`artifacts/0709-Test-2/logs/0709-udc-live.jsonl\`',
    '',
  ].join('\n');
}

function main() {
  const results = loadResults();
  if (results.length === 0) {
    console.error('[analyze-0709-udc] no result files in', logDir);
    process.exit(1);
  }

  const analysisPath = path.join(root, 'docs', `0709-Test-2-udc-live-analysis-${dateTag}.zh-CN.md`);
  fs.writeFileSync(analysisPath, `${buildAnalysisDoc(results)}\n`, 'utf8');
  console.log(`[analyze-0709-udc] wrote ${analysisPath} (${results.length} cases)`);
}

main();
