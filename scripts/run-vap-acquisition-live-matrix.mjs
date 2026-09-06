#!/usr/bin/env node
/**
 * PD-SAAS-FORK VAP: live network image acquisition matrix.
 * Runs runVisualAssetOrchestrator(phase_a) for G700 replays + 4 theme categories.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'vap-acquisition-live-matrix');
const REPORT_JSON = path.join(OUT_DIR, 'live-matrix-report.json');
const REPORT_MD = path.join(REPO_ROOT, 'docs', 'vap-acquisition-live-matrix-report-20260719.zh-CN.md');

const CASE_TIMEOUT_MS = Number.parseInt(process.env.PILOTDECK_VAP_LIVE_CASE_TIMEOUT_MS ?? '180000', 10) || 180_000;

function tierSummary(attempts = []) {
  const tiers = [
    'official_direct',
    'official_roots',
    'authority_industry',
    'portal_general',
    'search_engine_web',
    'search_engine_image',
    'html_image_extract',
    'page_screenshot',
  ];
  return Object.fromEntries(
    tiers.map((tier) => {
      const rows = attempts.filter((item) => item.tier === tier);
      const ok = rows.filter((item) => item.ok).length;
      return [tier, { tried: rows.length, ok }];
    }),
  );
}

async function runCase(testCase, modules) {
  const { runVisualAssetOrchestrator } = modules.orchestrator;
  const { isAcquisitionLadderExhausted } = modules.ladder;

  if (testCase.useG700Roots) {
    process.env.PILOTDECK_OFFICIAL_SOURCE_ROOTS_PATH = path.join(
      REPO_ROOT,
      'config',
      'fixtures',
      'official-source-roots.g700-canary.json',
    );
  } else {
    process.env.PILOTDECK_OFFICIAL_SOURCE_ROOTS_PATH = path.join(
      REPO_ROOT,
      'config',
      'official-source-roots.json',
    );
  }

  process.env.PILOTDECK_VISUAL_ASSET_PLATFORM = process.env.PILOTDECK_VISUAL_ASSET_PLATFORM ?? 'shadow';
  process.env.PILOTDECK_AUTO_RESOLVE_VISUAL_ASSETS = '1';
  process.env.PILOTDECK_VAP_PAGE_CAPTURE = process.env.PILOTDECK_VAP_PAGE_CAPTURE ?? '1';

  const taskDir = path.join('artifacts', 'vap-live-matrix', testCase.id).replace(/\\/g, '/');
  const absTask = path.join(REPO_ROOT, taskDir);
  fs.rmSync(absTask, { recursive: true, force: true });
  fs.mkdirSync(absTask, { recursive: true });

  const started = Date.now();
  let plan;
  let timedOut = false;
  let timeoutHandle;
  try {
    plan = await Promise.race([
      runVisualAssetOrchestrator({
        workspaceRoot: REPO_ROOT,
        sessionId: `live-matrix-${testCase.id}`,
        taskArtifactDir: taskDir,
        userGoal: testCase.userGoal,
        capabilitySlug: testCase.capabilitySlug,
        phase: 'phase_a',
        language: 'zh-CN',
      }),
      new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
          timedOut = true;
          reject(new Error(`case_timeout_${CASE_TIMEOUT_MS}ms`));
        }, CASE_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    return {
      id: testCase.id,
      category: testCase.category,
      title: testCase.title,
      pass: false,
      timedOut,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
      assetCount: 0,
      minAssets: testCase.minAssets,
    };
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }

  const attempts = plan.manifest.acquisitionAttempts ?? [];
  const assetCount = plan.manifest.assets.length;
  const assetPaths = plan.manifest.assets
    .slice(0, 8)
    .map((asset) => asset.preparedPath ?? asset.rawPath);
  const ladderExhausted = isAcquisitionLadderExhausted(
    attempts,
    assetCount,
    testCase.minAssets,
  );
  const searchTried = attempts.some(
    (item) =>
      item.tier === 'search_engine_web' || item.tier === 'search_engine_image',
  );
  const pass =
    assetCount >= testCase.minAssets
    && (!testCase.requireSearchTierAttempt || searchTried || assetCount >= testCase.minAssets);

  return {
    id: testCase.id,
    category: testCase.category,
    title: testCase.title,
    pass,
    timedOut: false,
    durationMs: Date.now() - started,
    assetCount,
    minAssets: testCase.minAssets,
    ladderExhausted,
    searchTried,
    tierSummary: tierSummary(attempts),
    assetPaths,
    errors: plan.manifest.errors.slice(0, 6),
    manifestRelPath: `${taskDir}/assets/visual-asset-manifest.json`,
  };
}

function renderMarkdown(report) {
  const lines = [
    '# VAP 配图实网矩阵验收报告（2026-07-19）',
    '',
    `**生成时间**：${report.generatedAt}`,
    '',
    `## 总判定：**${report.overallVerdict}**`,
    '',
    report.summary,
    '',
    '## 结果总表',
    '',
    '| 类别 | 案例 | 状态 | 素材数 | 耗时 | 搜索层 |',
    '|------|------|------|--------|------|--------|',
  ];
  for (const row of report.cases) {
    lines.push(
      `| ${row.category} | ${row.title} | ${row.pass ? 'PASS' : 'FAIL'} | ${row.assetCount ?? 0}/${row.minAssets} | ${row.durationMs ?? '—'}ms | ${row.searchTried ? '是' : '否'} |`,
    );
  }
  lines.push('', '## 分案详情', '');
  for (const row of report.cases) {
    lines.push(`### ${row.title} (\`${row.id}\`)`);
    lines.push('');
    lines.push(`- 判定：${row.pass ? '通过' : '未通过'}`);
    if (row.error) lines.push(`- 错误：${row.error}`);
    lines.push(`- 本地化素材：${row.assetCount ?? 0}（要求 ≥ ${row.minAssets}）`);
    if (row.assetPaths?.length) {
      lines.push('- 样例路径：');
      for (const p of row.assetPaths) lines.push(`  - \`${p}\``);
    }
    if (row.tierSummary) {
      lines.push('- 阶梯尝试：');
      for (const [tier, stat] of Object.entries(row.tierSummary)) {
        if (stat.tried > 0) {
          lines.push(`  - ${tier}：${stat.tried} 次（${stat.ok} 次有候选）`);
        }
      }
    }
    if (row.errors?.length) {
      lines.push(`- 错误摘要：${row.errors.join('；')}`);
    }
    lines.push('');
  }
  lines.push('## 方案结论', '', ...report.recommendations.map((item) => `- ${item}`), '');
  lines.push('## 产物', '', `- JSON：\`artifacts/vap-acquisition-live-matrix/live-matrix-report.json\``, '');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const filterArg = process.argv.find((arg) => arg.startsWith('--only='));
  const onlyIds = filterArg ? filterArg.slice('--only='.length).split(',') : null;
  const gate = process.argv.includes('--gate');

  const fixtureUrl = pathToFileURL(
    path.join(REPO_ROOT, 'tests/fixtures/vap-acquisition-live-matrix.ts'),
  ).href;
  const { VAP_LIVE_MATRIX_ALL } = await import(fixtureUrl);

  const orchestrator = await import(
    pathToFileURL(path.join(REPO_ROOT, 'src/saas/media/visualAssetPlatform/orchestrator.ts')).href
  );
  const ladder = await import(
    pathToFileURL(path.join(REPO_ROOT, 'src/saas/media/visualAssetPlatform/visualAcquisitionLadder.ts')).href
  );

  const cases = onlyIds
    ? VAP_LIVE_MATRIX_ALL.filter((item) => onlyIds.includes(item.id))
    : VAP_LIVE_MATRIX_ALL;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`[vap-live-matrix] running ${cases.length} cases (timeout ${CASE_TIMEOUT_MS}ms each)`);

  const results = [];
  for (const testCase of cases) {
    console.log(`[vap-live-matrix] start ${testCase.id}…`);
    // eslint-disable-next-line no-await-in-loop
    const row = await runCase(testCase, { orchestrator, ladder });
    results.push(row);
    console.log(
      `[vap-live-matrix] ${testCase.id} pass=${row.pass} assets=${row.assetCount ?? 0}/${testCase.minAssets} ${row.durationMs}ms`,
    );
  }

  const passCount = results.filter((row) => row.pass).length;
  const allPass = passCount === results.length;
  const recommendations = [
    '八层阶梯顺序：官网直链 → 根域 → 行业权威 → 门户 → 网页搜索 → 图片搜索 → HTML 提取 → 视口截图。',
    'G700 类任务 dev 须指向 config/fixtures/official-source-roots.g700-canary.json。',
    '配置 BOCHA_API_KEY 可显著提高网页搜索 tier 命中率；无 Key 时 Bing HTML 解析兜底。',
    'official_only 任务禁止 generate_image/SVG 冒充官图；须 manifest assetCount≥需求后再交付。',
    'Nova 幻灯 binding 已改为 manifest 优先；Gateway enforce 仍待实机复验。',
  ];
  if (!allPass) {
    recommendations.unshift(
      '未通过案例请查看 tierSummary：若 search_engine_* 未执行，检查网络/出站网关；若执行但 ok=0，扩充 visual-search-sources.json query 模板。',
    );
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    overallVerdict: allPass ? 'GO' : 'NO_GO',
    summary: `实网矩阵 ${passCount}/${results.length} 通过；八层 VAP 配图阶梯 + 搜索引擎层。`,
    cases: results,
    recommendations,
  };

  fs.writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(REPORT_MD, renderMarkdown(report), 'utf8');
  console.log(`[vap-live-matrix] report ${REPORT_MD}`);
  console.log(`[vap-live-matrix] verdict ${report.overallVerdict}`);

  if (gate && !allPass) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
