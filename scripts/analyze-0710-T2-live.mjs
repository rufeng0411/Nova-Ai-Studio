#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 0710-T2 十案实跑结果深度分析 + STDA/四线统一 + 优化建议。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactRoot = path.join(root, 'artifacts/0710-T2');
const logDir = path.join(artifactRoot, 'logs');
const manifestPath = path.join(root, 'tests/fixtures/goal-loop/0710-T2/cases.json');
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
  if (results.length === 0 && fs.existsSync(path.join(logDir, '0710-T2-live.jsonl'))) {
    for (const line of fs.readFileSync(path.join(logDir, '0710-T2-live.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean)) {
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

  const lowDock = results.filter((r) => ((r.dock?.rowCount) ?? 0) < 1 && r.outcome !== 'still_thinking');
  if (lowDock.length) patterns.push({ level: 'P0', text: `Dock 无可见行：${lowDock.map((r) => r.id).join(', ')}` });

  const noStda = results.filter((r) => {
    const dir = r.sessionTaskDirectory?.taskArtifactDir ?? '';
    return !/^artifacts\/task-\d{8}-[a-f0-9]{8}/i.test(dir);
  });
  if (noStda.length) patterns.push({ level: 'P0', text: `STDA 未分配 task 目录：${noStda.map((r) => r.id).join(', ')}` });

  const folderMismatch = results.filter((r) => {
    const checks = r.assess?.checks ?? {};
    return checks.folderHasFilesWhenDelivered === false || checks.folderScopeMatchesStda === false;
  });
  if (folderMismatch.length) {
    patterns.push({ level: 'P0', text: `四线 folder 与 STDA/Dock 不一致：${folderMismatch.map((r) => r.id).join(', ')}` });
  }

  const noContractHash = results.filter((r) => (r.sdmSlotCount ?? 0) > 0 && !r.contractHash);
  if (noContractHash.length) {
    patterns.push({ level: 'P1', text: `有 SDM 槽但 contractHash 缺失：${noContractHash.map((r) => r.id).join(', ')}` });
  }

  const earlyExit = results.filter((r) => r.outcome === 'still_thinking' || r.outcome === 'timeout');
  if (earlyExit.length) {
    patterns.push({ level: 'P0', text: `未收敛（still_thinking/timeout）：${earlyExit.map((r) => r.id).join(', ')}` });
  }

  const geoMisbind = results.filter((r) => {
    const def = caseDefs.get(r.id);
    return def?.expect?.profileIdNot === 'geo' && r.sdm?.manifest?.profileId === 'geo';
  });
  if (geoMisbind.length) {
    patterns.push({ level: 'P0', text: `增长案仍误绑 geo profile：${geoMisbind.map((r) => r.id).join(', ')}` });
  }

  const pptRepair = results.filter((r) => /^0710-PPT|^0710-SLD/.test(r.id) && r.hasRepairUi);
  if (pptRepair.length) {
    patterns.push({ level: 'P0', text: `PPT/幻灯 repair 风暴未消：${pptRepair.map((r) => r.id).join(', ')}` });
  }

  const forbiddenLeak = results.filter((r) => {
    const checks = r.assess?.checks ?? {};
    return checks.noForbiddenTerms === false;
  });
  if (forbiddenLeak.length) {
    patterns.push({ level: 'P1', text: `禁止词/串台仍出现：${forbiddenLeak.map((r) => r.id).join(', ')}` });
  }

  return patterns;
}

function buildRecommendations(results, patterns) {
  const recs = [];

  if (patterns.some((p) => p.text.includes('STDA 未分配'))) {
    recs.push({
      level: 'P0',
      title: 'STDA 写盘链路贯通',
      detail: '核查 `bootstrapSessionTaskDirectory` → JSONL `session_task_directory` → messages API `sessionTaskDirectory` → Agent write 守卫；首 turn 须在 write_file 前注入 `<task-artifact-dir>`。',
    });
  }
  if (patterns.some((p) => p.text.includes('folder 与 STDA'))) {
    recs.push({
      level: 'P0',
      title: '四线统一 scopeDir 锚定',
      detail: '`resolveContractScopeDir` STDA-first；Dock/汇总表/导出/task-folder-snapshot 均读同一 `taskArtifactDir`；禁止 legacy geo/slides 目录 mtime 猜测。',
    });
  }
  if (patterns.some((p) => p.text.includes('未收敛'))) {
    recs.push({
      level: 'P0',
      title: '长任务 auto-continue + 超时策略',
      detail: 'GEO/增长/PPT 案 timeout 已设 10–20min；若仍 timeout 须查 `shouldAutoContinueAfterIncompleteDeliverableStop` 与 stale-turn watchdog；Playwright 可单案 `O710_T1_CASES` 重跑。',
    });
  }
  if (patterns.some((p) => p.text.includes('repair'))) {
    recs.push({
      level: 'P0',
      title: 'needs_repair 收敛与 UI 去噪',
      detail: 'PPT 三线对照 `presentationDeliverablePolicy`；repair 仅注入模型侧，UI 勿展示「需要补齐」；verified∩broken 重叠须 `filterVerifiedForContractBinding` 修。',
    });
  }
  if (patterns.some((p) => p.text.includes('误绑 geo'))) {
    recs.push({
      level: 'P0',
      title: 'C8 增长 profile 守卫',
      detail: '增长八步走 growth/marketing profile，禁止 `mergeNumberedSlotsWithProfile` 误落 geo。',
    });
  }
  if (patterns.some((p) => p.text.includes('contractHash'))) {
    recs.push({
      level: 'P1',
      title: 'messages API envelope 写回',
      detail: '确保 `readSessionMessages` + `messages.js` 响应层带 `latestTurnAcceptanceMeta.contractSnapshot.rowsHash`，Harness 读 envelope 非 metadata 嵌套。',
    });
  }

  recs.push({
    level: 'P1',
    title: '0710-T2 纳入 prelaunch 切片',
    detail: '将 `test:0710:T1-live` 作为 STDA 回归门禁（workers=1，可 nightly）；sessionId 写入 `analyze:task-completion --gate`。',
  });

  recs.push({
    level: 'P2',
    title: '单案重跑与人工复查',
    detail: '侧栏打开项目 0710-T2，逐条 session URL 核对 Dock/文件夹/正文链接；JSONL 在 `artifacts/0710-T2/logs/`。',
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
    const checks = r.assess?.checks ?? {};
    const checkLines = Object.entries(checks).map(([k, v]) => `  - ${k}: ${v ? '✅' : '❌'}`);
    const stda = r.sessionTaskDirectory?.taskArtifactDir ?? '-';

    return [
      `### ${r.code ?? ''} ${r.id}`,
      '',
      `- **历史基线**：${r.baseline ?? def?.baseline ?? '-'}`,
      `- **本次 status / outcome**：${r.status} / ${r.outcome}`,
      `- **耗时**：${r.elapsedMs ? `${Math.round(r.elapsedMs / 1000)}s` : '-'}`,
      `- **sessionId**：\`${r.sessionId ?? '-'}\``,
      `- **URL**：${r.url ?? '-'}`,
      `- **STDA**：\`${stda}\``,
      `- **Dock**：行 ${r.dock?.rowCount ?? 0}，已交付 ${r.dock?.deliveredCount ?? 0}，进度 ${r.dock?.progressText || '-'}`,
      `- **SDM slots / profile**：${r.sdmSlotCount ?? 0} / ${r.sdm?.manifest?.profileId ?? '-'}`,
      `- **contractHash**：\`${r.contractHash ?? '-'}\``,
      `- **folderSnapshot 文件数**：${r.folderFileCount ?? '未拉取'}`,
      `- **repair / task-resume**：${r.hasRepairUi ? 'repair ⚠️' : '无'} / ${r.hasTaskResume ? 'task-resume ⚠️' : '无'}`,
      `- **自动检查**：${r.assess?.score ?? 'n/a'}`,
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
    '# 0710-T2 十案典型错误实机深度分析',
    '',
    `**生成时间**：${new Date().toISOString()}  `,
    `**数据源**：\`artifacts/0710-T2/logs/*.json\` + JSONL  `,
    `**用户**：admin / 项目 **0710-T2**  `,
    `**验证目标**：任务完成 · 任务稳定 · 成果稳定 · STDA + 四线统一  `,
    '',
    '## 1. 总览',
    '',
    '| 维度 | 数量 |',
    '|------|------|',
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
    '## 4. 与验收标准对照',
    '',
    '| case | 历史问题 | 实机结论 | STDA | 四线 |',
    '|------|----------|----------|------|------|',
    ...results.map((r) => {
      const def = caseDefs.get(r.id);
      const checks = r.assess?.checks ?? {};
      const fourLineOk = checks.folderScopeMatchesStda !== false
        && checks.folderHasFilesWhenDelivered !== false
        && (checks.contractHashPresent !== false);
      const stdaOk = checks.stdaAssigned === true;
      return `| ${r.id} | ${String(def?.baseline ?? '').slice(0, 36)} | ${r.status} / ${r.outcome} | ${stdaOk ? '✅' : '❌'} | ${fourLineOk ? '✅' : '⚠️'} |`;
    }),
    '',
    '## 5. 下一步提高建议（按优先级）',
    '',
    ...recs.map((rec, i) => `${i + 1}. **${rec.level} — ${rec.title}**\n   ${rec.detail}`),
    '',
    '## 6. 保留与复查',
    '',
    '- 项目 **0710-T2** 及十条会话、成果、截图均未删除。',
    '- 侧栏逐条打开 session URL 可人工复核 Dock / 文件夹 / 正文 task 路径。',
    '- 明细 JSONL：\`artifacts/0710-T2/logs/0710-T2-live.jsonl\`',
    '- 截图：\`artifacts/0710-T2/screenshots/\`',
    '',
  ].join('\n');
}

function main() {
  const results = loadResults();
  if (results.length === 0) {
    console.error('[analyze-0710-T2] no result files in', logDir);
    process.exit(1);
  }

  const analysisPath = path.join(root, 'docs', `0710-T2-live-analysis-${dateTag}.zh-CN.md`);
  fs.writeFileSync(analysisPath, `${buildAnalysisDoc(results)}\n`, 'utf8');
  console.log(`[analyze-0710-T2] wrote ${analysisPath} (${results.length} cases)`);
}

main();
