/**
 * Pro SVG charts for Nova product PR article.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../artifacts/nova-product-pr-20260812/charts');
fs.mkdirSync(OUT, { recursive: true });

const COLORS = {
  ink: '#1c1f24',
  muted: '#5c6570',
  line: '#d7dbe0',
  panel: '#f4f5f7',
  card: '#ffffff',
  accent: '#4a6fa5',
  accentSoft: '#e8eef6',
  nova: '#3d4450',
  good: '#3d6b5a',
  warn: '#8a7355',
};

function flowSvg() {
  const stages = [
    ['产品研发', '竞品·用户·技术研判'],
    ['市场营销', '全案·物料·投放'],
    ['法务合规', '广告词·风险筛查'],
    ['全域分发', '短视频·自媒体'],
    ['销售获客', '线索·谈判话术'],
    ['财务风控', '对账·补贴申报'],
    ['经营驾驶舱', '诊断·战略优化'],
  ];
  const w = 1120;
  const h = 280;
  const gap = 12;
  const boxW = (w - 80 - gap * (stages.length - 1)) / stages.length;
  const y = 90;
  let boxes = '';
  let arrows = '';
  stages.forEach(([title, sub], i) => {
    const x = 40 + i * (boxW + gap);
    boxes += `
      <rect x="${x}" y="${y}" width="${boxW}" height="96" rx="10" fill="${COLORS.card}" stroke="${COLORS.line}"/>
      <text x="${x + boxW / 2}" y="${y + 38}" text-anchor="middle" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" font-size="14" font-weight="600" fill="${COLORS.ink}">${title}</text>
      <text x="${x + boxW / 2}" y="${y + 62}" text-anchor="middle" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" font-size="11" fill="${COLORS.muted}">${sub}</text>`;
    if (i < stages.length - 1) {
      const ax = x + boxW + 2;
      arrows += `<path d="M${ax} ${y + 48} h${gap - 4}" stroke="${COLORS.accent}" stroke-width="1.5" fill="none" marker-end="url(#arrow)"/>`;
    }
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="${COLORS.accent}"/>
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="${COLORS.panel}"/>
  <text x="40" y="42" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" font-size="16" font-weight="600" fill="${COLORS.ink}">端到端经营闭环</text>
  <text x="40" y="64" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" font-size="12" fill="${COLORS.muted}">产品构思 → 营销落地 → 获客成交 → 合规风控 → 经营复盘</text>
  ${boxes}
  ${arrows}
  <text x="40" y="240" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" font-size="11" fill="${COLORS.muted}">整套流程无需人工反复切换工具、传递文件，一站式闭环落地。</text>
</svg>`;
}

function architectureSvg() {
  const w = 1120;
  const h = 420;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" fill="${COLORS.panel}"/>
  <text x="40" y="40" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" font-size="16" font-weight="600" fill="${COLORS.ink}">NOVA AI 企业级平台架构（逻辑视图）</text>
  <text x="40" y="62" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" font-size="12" fill="${COLORS.muted}">原生协同 · 多 Agent 统一目标 · 私有化与权限隔离</text>

  <!-- Top: interaction -->
  <rect x="40" y="90" width="1040" height="64" rx="12" fill="${COLORS.card}" stroke="${COLORS.line}"/>
  <text x="560" y="118" text-anchor="middle" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" font-size="14" font-weight="600" fill="${COLORS.ink}">统一工作台 · 能力中心 · 流程模板 · 成果清单</text>
  <text x="560" y="140" text-anchor="middle" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" font-size="12" fill="${COLORS.muted}">对话驱动任务 · 跨部门成果流转 · 成套物料一次产出</text>

  <!-- Agents row -->
  ${[
    ['产品研发', 40],
    ['市场营销', 220],
    ['销售商务', 400],
    ['行政办公', 580],
    ['财务法务', 760],
    ['经营决策', 940],
  ].map(([t, x]) => `
    <rect x="${x}" y="180" width="160" height="72" rx="10" fill="${COLORS.accentSoft}" stroke="${COLORS.accent}" stroke-opacity="0.35"/>
    <text x="${x + 80}" y="212" text-anchor="middle" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" font-size="13" font-weight="600" fill="${COLORS.ink}">${t}</text>
    <text x="${x + 80}" y="232" text-anchor="middle" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" font-size="11" fill="${COLORS.muted}">总监级智能体</text>
  `).join('')}

  <!-- orchestration -->
  <rect x="40" y="280" width="1040" height="56" rx="12" fill="${COLORS.card}" stroke="${COLORS.line}"/>
  <text x="560" y="314" text-anchor="middle" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" font-size="13" font-weight="600" fill="${COLORS.ink}">多 Agent 统一目标管控 · 任务编排 · 验收与成果契约</text>

  <!-- foundation -->
  <rect x="40" y="360" width="330" height="40" rx="8" fill="${COLORS.nova}" />
  <text x="205" y="385" text-anchor="middle" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" font-size="12" fill="#f5f6f7">私有知识库 / 数字资产</text>
  <rect x="390" y="360" width="330" height="40" rx="8" fill="${COLORS.nova}" />
  <text x="555" y="385" text-anchor="middle" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" font-size="12" fill="#f5f6f7">多租户隔离 · 分级权限 · 审计</text>
  <rect x="740" y="360" width="340" height="40" rx="8" fill="${COLORS.nova}" />
  <text x="910" y="385" text-anchor="middle" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" font-size="12" fill="#f5f6f7">私有化部署 / 本地数据可控</text>
</svg>`;
}

function compareBarsSvg() {
  // Qualitative radar-like bars: 6 dimensions Nova vs Doubao style generic
  const dims = [
    ['组织协同', 95, 25],
    ['经营闭环', 96, 18],
    ['专家研判', 92, 30],
    ['成套物料', 94, 28],
    ['安全合规', 98, 22],
    ['零提示词落地', 90, 35],
  ];
  const w = 1120;
  const h = 360;
  const left = 200;
  const maxBar = 720;
  let rows = '';
  dims.forEach(([name, nova, other], i) => {
    const y = 90 + i * 42;
    rows += `
      <text x="40" y="${y + 14}" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" font-size="13" fill="${COLORS.ink}">${name}</text>
      <rect x="${left}" y="${y}" width="${(nova / 100) * maxBar}" height="14" rx="4" fill="${COLORS.accent}"/>
      <rect x="${left}" y="${y + 18}" width="${(other / 100) * maxBar}" height="10" rx="3" fill="${COLORS.line}"/>
    `;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" fill="${COLORS.panel}"/>
  <text x="40" y="40" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" font-size="16" font-weight="600" fill="${COLORS.ink}">能力维度对照（示意）</text>
  <text x="40" y="62" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" font-size="12" fill="${COLORS.muted}">深蓝：NOVA AI　浅灰：大众 C 端通用 AI（定性示意，非第三方实测分数）</text>
  ${rows}
  <rect x="40" y="330" width="14" height="10" rx="2" fill="${COLORS.accent}"/>
  <text x="60" y="339" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" font-size="11" fill="${COLORS.muted}">NOVA AI</text>
  <rect x="140" y="330" width="14" height="10" rx="2" fill="${COLORS.line}"/>
  <text x="160" y="339" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" font-size="11" fill="${COLORS.muted}">大众通用 AI</text>
</svg>`;
}

fs.writeFileSync(path.join(OUT, 'flow-e2e.svg'), flowSvg(), 'utf8');
fs.writeFileSync(path.join(OUT, 'architecture.svg'), architectureSvg(), 'utf8');
fs.writeFileSync(path.join(OUT, 'compare-bars.svg'), compareBarsSvg(), 'utf8');
console.log('charts written', OUT);
