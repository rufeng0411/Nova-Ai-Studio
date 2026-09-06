#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT_DIR = path.join(ROOT, 'artifacts', 'prompt-upgrade-20260711');
const REPORT_PATH = path.join(ROOT, 'docs', 'prompt-template-upgrade-report-20260711.zh-CN.md');

function truncate(s, n = 120) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function loadAfterTry() {
  const src = readFileSync(path.join(ROOT, 'scripts/lib/capabilityTryPrompts.mjs'), 'utf8');
  const m = src.match(/export const TRY_PROMPT_ZH = (\{[\s\S]*?\n\});/);
  if (!m) throw new Error('parse TRY_PROMPT_ZH failed');
  // eslint-disable-next-line no-eval
  return eval(`(${m[1]})`);
}

const before = JSON.parse(readFileSync(path.join(SNAPSHOT_DIR, 'try-prompts.before.json'), 'utf8'));
const after = loadAfterTry();
const catalog = JSON.parse(readFileSync(path.join(ROOT, 'config/capabilities.catalog.json'), 'utf8'));
const templatesBefore = JSON.parse(
  readFileSync(path.join(SNAPSHOT_DIR, 'process-templates.before.json'), 'utf8'),
);
const templatesAfter = JSON.parse(readFileSync(path.join(ROOT, 'config/process-templates.json'), 'utf8'));

const visible = catalog.skills.filter((s) => !s.hidden_in_hub);
const hubChanges = [];
for (const skill of visible) {
  const slug = skill.slug;
  const b = before[slug] ?? '';
  const a = after[slug] ?? '';
  if (b !== a) {
    hubChanges.push({ slug, name: skill.display_name, before: b, after: a });
  }
}

const templateChanges = [];
for (const t of templatesAfter.templates) {
  const b = templatesBefore.templates.find((x) => x.id === t.id);
  if (!b) continue;
  if (b.prompt['zh-CN'] !== t.prompt['zh-CN']) {
    templateChanges.push({
      id: t.id,
      title: t.title['zh-CN'],
      before: b.prompt['zh-CN'],
      after: t.prompt['zh-CN'],
    });
  }
}

const lines = [
  '# 提示词模板全量升级报告',
  '',
  `> 生成时间：${new Date().toISOString()} · 策略 \`scripts/lib/promptTemplateStrategy.mjs\``,
  '',
  '## 策略摘要',
  '',
  '| 层级 | 规则 |',
  '|------|------|',
  '| Hub「试一下」 | 任务句 + **须交付** + **写入系统分配任务目录**；系统侧 capability-binding 注入 read_skill |',
  '| 流程模板 | read_skill 分步 + 禁止 read_file skills/ + 降级 + **标准成果清单** + 收尾句 |',
  '',
  '## 统计',
  '',
  '| 项 | 数量 |',
  '|----|------|',
  `| Hub 可见能力 | ${visible.length} |`,
  `| Hub 提示词变更 | ${hubChanges.length} |`,
  `| 流程模板变更 | ${templateChanges.length} / 35 |`,
  '',
  '## 流程模板变更明细',
  '',
  '| 模板 | 更新前（摘要） | 更新后（摘要） |',
  '|------|----------------|----------------|',
];

for (const c of templateChanges) {
  lines.push(`| ${c.title} (\`${c.id}\`) | ${truncate(c.before)} | ${truncate(c.after)} |`);
}

lines.push('', '## Hub 能力变更明细（全量）', '', '| slug | 名称 | 更新前 | 更新后 |', '|------|------|--------|--------|');
for (const c of hubChanges.sort((a, b) => a.slug.localeCompare(b.slug))) {
  lines.push(`| \`${c.slug}\` | ${c.name ?? ''} | ${truncate(c.before, 80)} | ${truncate(c.after, 80)} |`);
}

lines.push('', '## 快照', '', `- \`${SNAPSHOT_DIR}/\``, '');

writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`);
console.log(`[report] hub=${hubChanges.length} templates=${templateChanges.length} → ${REPORT_PATH}`);
