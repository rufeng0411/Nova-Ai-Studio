#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 全量提示词升级 + 更新前后对比报告
 * Run: node scripts/upgrade-all-prompts.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  finalizeHubTryPrompt,
  upgradeProcessTemplatePrompt,
  hubPromptQualityIssues,
} from './lib/promptTemplateStrategy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CATALOG_PATH = path.join(REPO_ROOT, 'config', 'capabilities.catalog.json');
const TEMPLATES_PATH = path.join(REPO_ROOT, 'config', 'process-templates.json');
const TRY_PROMPTS_PATH = path.join(REPO_ROOT, 'scripts', 'lib', 'capabilityTryPrompts.mjs');
const SNAPSHOT_DIR = path.join(REPO_ROOT, 'artifacts', 'prompt-upgrade-20260711');
const REPORT_PATH = path.join(REPO_ROOT, 'docs', 'prompt-template-upgrade-report-20260711.zh-CN.md');

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function truncate(s, n = 120) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function loadTryPromptsFromFile() {
  const src = readFileSync(TRY_PROMPTS_PATH, 'utf8');
  const m = src.match(/export const TRY_PROMPT_ZH = (\{[\s\S]*?\n\});/);
  if (!m) throw new Error('cannot parse TRY_PROMPT_ZH');
  // eslint-disable-next-line no-eval
  return eval(`(${m[1]})`);
}

function snapshotBefore() {
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  copyFileSync(TEMPLATES_PATH, path.join(SNAPSHOT_DIR, 'process-templates.before.json'));
  copyFileSync(TRY_PROMPTS_PATH, path.join(SNAPSHOT_DIR, 'capabilityTryPrompts.before.mjs'));
  const beforeTry = loadTryPromptsFromFile();
  writeJson(path.join(SNAPSHOT_DIR, 'try-prompts.before.json'), beforeTry);
  return beforeTry;
}

function upgradeProcessTemplates() {
  const config = readJson(TEMPLATES_PATH);
  const changes = [];
  for (const t of config.templates) {
    const beforeZh = t.prompt['zh-CN'];
    const beforeEn = t.prompt.en;
    t.prompt['zh-CN'] = upgradeProcessTemplatePrompt(t, 'zh-CN');
    t.prompt.en = upgradeProcessTemplatePrompt(t, 'en');
    if (beforeZh !== t.prompt['zh-CN'] || beforeEn !== t.prompt.en) {
      changes.push({
        kind: 'process-template',
        id: t.id,
        title: t.title['zh-CN'],
        before: beforeZh,
        after: t.prompt['zh-CN'],
      });
    }
  }
  config.updatedAt = new Date().toISOString().slice(0, 19) + '+08:00';
  writeJson(TEMPLATES_PATH, config);
  return changes;
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: REPO_ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed`);
}

function buildReport(beforeTry, afterTry, templateChanges, catalog) {
  const visible = catalog.skills.filter((s) => !s.hidden_in_hub);
  const hubChanges = [];
  for (const skill of visible) {
    const slug = skill.slug;
    const b = beforeTry[slug] ?? '';
    const a = afterTry[slug] ?? '';
    if (b !== a) {
      hubChanges.push({ slug, name: skill.display_name, before: b, after: a });
    }
  }

  const lines = [
    '# 提示词模板全量升级报告',
    '',
    `> 生成时间：${new Date().toISOString()} · 策略源 \`scripts/lib/promptTemplateStrategy.mjs\``,
    '',
    '## 策略摘要',
    '',
    '| 层级 | 规则 |',
    '|------|------|',
    '| Hub「试一下」 | 用「能力名」+ 任务句 + **须交付**文件名 + **写入系统分配任务目录**；禁 read_skill/直接开始做/artifacts 语义目录 |',
    '| 流程模板 | 编号步骤 + read_skill + write_file + 降级说明 + **标准成果清单** + 收尾句 |',
    '| 系统注入 | capability-binding / processTemplateExecutionPrompt 仍负责 read_skill 与多步执行链 |',
    '',
    '## 统计',
    '',
    `| 项 | 数量 |`,
    `|----|------|`,
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

  lines.push('', '## Hub 能力变更明细（全量）', '');
  lines.push('| slug | 名称 | 更新前 | 更新后 |');
  lines.push('|------|------|--------|--------|');
  for (const c of hubChanges.sort((a, b) => a.slug.localeCompare(b.slug))) {
    lines.push(`| \`${c.slug}\` | ${c.name ?? ''} | ${truncate(c.before, 80)} | ${truncate(c.after, 80)} |`);
  }

  lines.push('', '## 快照路径', '', `- \`${SNAPSHOT_DIR}/\``, '');

  writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
  writeJson(path.join(SNAPSHOT_DIR, 'upgrade-summary.json'), {
    hubChanges: hubChanges.length,
    templateChanges: templateChanges.length,
    generatedAt: new Date().toISOString(),
  });

  return { hubChanges, templateChanges };
}

function main() {
  console.log('[upgrade-all-prompts] snapshot before…');
  const beforeTry = snapshotBefore();

  console.log('[upgrade-all-prompts] upgrade process-templates.json…');
  const templateChanges = upgradeProcessTemplates();

  console.log('[upgrade-all-prompts] regenerate try prompts + i18n…');
  run('node', ['scripts/generate-capability-try-prompts.mjs']);
  run('node', ['scripts/generate-process-templates.mjs']);
  run('node', ['scripts/generate-capabilities-i18n.mjs']);
  run('node', ['scripts/check-task-dir-prompts.mjs']);
  run('node', ['scripts/generate-prompt-upgrade-report.mjs']);

  const afterTry = loadTryPromptsFromFile();
  const catalog = readJson(CATALOG_PATH);
  const { hubChanges } = buildReport(beforeTry, afterTry, templateChanges, catalog);

  console.log(`[upgrade-all-prompts] hub changed=${hubChanges.length} templates=${templateChanges.length}`);
  console.log(`[upgrade-all-prompts] report=${REPORT_PATH}`);
}

main();
