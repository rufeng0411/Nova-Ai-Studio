#!/usr/bin/env node
/**
 * Export skills deep rating JSON to Excel (.xlsx).
 * Input:  artifacts/capabilities-smoke/skills-deep-rating.json
 * Output: docs/skills-deep-rating-report-2026-06-10.xlsx
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IN_JSON = path.join(ROOT, 'artifacts', 'capabilities-smoke', 'skills-deep-rating.json');
const OUT_XLSX = path.join(ROOT, 'docs', 'skills-deep-rating-report-2026-06-10.xlsx');

const STARS_LABEL = { 5: '★★★★★', 4: '★★★★☆', 3: '★★★☆☆', 2: '★★☆☆☆', 1: '★☆☆☆☆' };
const FIT_LABEL = { high: '高', medium: '中', low: '低' };

function sortForTable(rows) {
  const sectionOrder = [];
  const seen = new Set();
  for (const r of rows) {
    if (!seen.has(r.section)) {
      seen.add(r.section);
      sectionOrder.push(r.section);
    }
  }
  const bySection = new Map(sectionOrder.map((s) => [s, []]));
  for (const r of rows) bySection.get(r.section)?.push(r);
  const out = [];
  for (const section of sectionOrder) {
    const items = bySection.get(section) || [];
    items.sort(
      (a, b) =>
        b.stars - a.stars
        || b.score - a.score
        || (a.hub_sort ?? 999) - (b.hub_sort ?? 999)
        || String(a.display_name).localeCompare(String(b.display_name), 'zh-CN'),
    );
    out.push(...items);
  }
  return out;
}

function formatAlternatives(alts) {
  if (!alts?.length) return '';
  return alts.map((a) => a.slug).join('、');
}

function formatReasons(reasons) {
  if (!reasons?.length) return '';
  return reasons.join('；');
}

async function main() {
  if (!existsSync(IN_JSON)) {
    console.error(`[export-skills-xlsx] missing ${IN_JSON} — run node scripts/audit-skills-deep-rating.mjs first`);
    process.exit(1);
  }

  const payload = JSON.parse(readFileSync(IN_JSON, 'utf8'));
  const rows = sortForTable(payload.skills || []);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Nova Ai-Studio / PilotDeck';
  wb.created = new Date();

  const wsAll = wb.addWorksheet('全库评估', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  wsAll.columns = [
    { header: '类别', key: 'section', width: 36 },
    { header: '星级', key: 'stars_label', width: 10 },
    { header: '星级值', key: 'stars', width: 8 },
    { header: '分数', key: 'score', width: 8 },
    { header: '名称', key: 'display_name', width: 22 },
    { header: 'slug', key: 'slug', width: 32 },
    { header: '级别', key: 'integration_level', width: 8 },
    { header: 'Hub', key: 'hub', width: 8 },
    { header: '系统契合', key: 'system_fit', width: 10 },
    { header: '使用建议', key: 'usage_label', width: 16 },
    { header: '替代方案', key: 'alternatives', width: 40 },
    { header: '评分原因', key: 'reasons', width: 60 },
    { header: '与系统不切合', key: 'misalignments', width: 40 },
    { header: '可用性', key: 'availability', width: 10 },
    { header: '有SKILL', key: 'has_skill_md', width: 10 },
  ];

  const headerRow = wsAll.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 22;

  for (const r of rows) {
    wsAll.addRow({
      section: r.section,
      stars_label: STARS_LABEL[r.stars] || r.stars,
      stars: r.stars,
      score: r.score,
      display_name: r.display_name,
      slug: r.slug,
      integration_level: r.integration_level || 'L1',
      hub: r.hidden_in_hub ? '隐藏' : '可见',
      system_fit: FIT_LABEL[r.system_fit] || r.system_fit,
      usage_label: r.usage_label,
      alternatives: formatAlternatives(r.alternatives),
      reasons: formatReasons(r.reasons),
      misalignments: (r.misalignments || []).join('；'),
      availability:
        r.availability === 'needs_config' ? '需配置' : r.availability === 'ready' ? '待确认' : '可用',
      has_skill_md: r.has_skill_md ? '是' : '否',
    });
  }

  wsAll.autoFilter = { from: 'A1', to: `O${rows.length + 1}` };

  for (let i = 2; i <= rows.length + 1; i++) {
    const row = wsAll.getRow(i);
    row.alignment = { vertical: 'top', wrapText: true };
  }

  const wsVisible = wb.addWorksheet('Hub可见', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  wsVisible.columns = wsAll.columns;
  const visHeader = wsVisible.getRow(1);
  visHeader.font = headerRow.font;
  visHeader.fill = headerRow.fill;
  visHeader.alignment = headerRow.alignment;
  visHeader.height = 22;

  const visibleRows = rows.filter((r) => !r.hidden_in_hub);
  for (const r of visibleRows) {
    wsVisible.addRow({
      section: r.section,
      stars_label: STARS_LABEL[r.stars] || r.stars,
      stars: r.stars,
      score: r.score,
      display_name: r.display_name,
      slug: r.slug,
      integration_level: r.integration_level || 'L1',
      hub: '可见',
      system_fit: FIT_LABEL[r.system_fit] || r.system_fit,
      usage_label: r.usage_label,
      alternatives: formatAlternatives(r.alternatives),
      reasons: formatReasons(r.reasons),
      misalignments: (r.misalignments || []).join('；'),
      availability:
        r.availability === 'needs_config' ? '需配置' : r.availability === 'ready' ? '待确认' : '可用',
      has_skill_md: r.has_skill_md ? '是' : '否',
    });
  }
  wsVisible.autoFilter = { from: 'A1', to: `O${visibleRows.length + 1}` };
  for (let i = 2; i <= visibleRows.length + 1; i++) {
    wsVisible.getRow(i).alignment = { vertical: 'top', wrapText: true };
  }

  const wsSummary = wb.addWorksheet('总览');
  wsSummary.columns = [
    { header: '星级', key: 'label', width: 12 },
    { header: '数量', key: 'count', width: 10 },
    { header: '占比', key: 'pct', width: 10 },
  ];
  wsSummary.getRow(1).font = { bold: true };
  const total = rows.length;
  const counts = payload.star_counts || {};
  for (const n of [5, 4, 3, 2, 1]) {
    const c = counts[String(n)] ?? 0;
    wsSummary.addRow({
      label: STARS_LABEL[n],
      count: c,
      pct: `${((c / total) * 100).toFixed(1)}%`,
    });
  }
  wsSummary.addRow({});
  wsSummary.addRow({ label: '全库合计', count: total, pct: '100%' });
  wsSummary.addRow({ label: 'Hub 可见', count: visibleRows.length, pct: `${((visibleRows.length / total) * 100).toFixed(1)}%` });
  wsSummary.addRow({ label: '生成时间', count: payload.generated_at || '', pct: '' });

  await wb.xlsx.writeFile(OUT_XLSX);

  console.log('[export-skills-xlsx] OK');
  console.log(`[export-skills-xlsx] rows=${rows.length} visible=${visibleRows.length}`);
  console.log(`[export-skills-xlsx] output=${OUT_XLSX}`);
}

main().catch((err) => {
  console.error('[export-skills-xlsx] FAIL', err);
  process.exit(1);
});
