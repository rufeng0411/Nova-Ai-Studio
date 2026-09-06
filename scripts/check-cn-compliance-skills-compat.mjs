#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Compatibility gate for skills/vendor/cn-compliance
 * @see npm run check:cn-compliance:compat
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.join(REPO_ROOT, 'skills', 'vendor', 'cn-compliance');
/** Instructional evasion — ignore Nova disclaimer lines that only forbid these acts */
const REDLINE_INSTRUCTION =
  /(?:如何|怎样|步骤).{0,24}(?:假发票|虚开|隐瞒收入|逃税)|teach.{0,20}evad(?:e|ing)\s+tax|fake\s+invoice\s+(?:scheme|tutorial)/i;

function listSkillDirs(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('ATTRIBUTION') || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory() && existsSync(path.join(p, 'SKILL.md'))) acc.push(p);
  }
  return acc;
}

function checkOne(dir) {
  const slug = path.basename(dir);
  const skillPath = path.join(dir, 'SKILL.md');
  const fails = [];
  const warns = [];
  if (!existsSync(skillPath)) fails.push('C1 missing SKILL.md');
  const text = existsSync(skillPath) ? readFileSync(skillPath, 'utf8') : '';
  if (!/^---\n/.test(text) && !/^---\r\n/.test(text)) fails.push('C2 missing frontmatter');
  else {
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const body = m?.[1] || '';
    if (!new RegExp(`^name:\\s*${slug}\\s*$`, 'm').test(body)) fails.push(`C2 name!=slug (${slug})`);
    if (!/^description:\s*\S/m.test(body)) fails.push('C2 empty description');
  }
  if (/~\/\.claude|\$HOME\/\.claude|\/tmp_workspace\//.test(text)) fails.push('C3 claude/tmp path');
  if (!/Nova 合规声明|不构成[\s\S]{0,40}执业意见|not professional advice/i.test(text)) {
    fails.push('C6 missing disclaimer');
  }
  const bodySansDisclaimer = text.replace(/## Nova 合规声明[\s\S]*?(?=\n## |\n# |$)/, '');
  if (REDLINE_INSTRUCTION.test(bodySansDisclaimer)) fails.push('C7 redline tax evasion guidance');
  if (/artifacts\/slides-/.test(text)) warns.push('C9 slides path');
  let bytes = 0;
  try {
    const walk = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else bytes += statSync(p).size;
      }
    };
    walk(dir);
  } catch {
    /* ignore */
  }
  if (bytes > 800 * 1024) warns.push(`C11 size ${(bytes / 1024).toFixed(0)}KB`);
  return { slug, ok: fails.length === 0, fails, warns, bytes };
}

function main() {
  const dirs = listSkillDirs(ROOT);
  if (dirs.length === 0) {
    console.error('[check:cn-compliance:compat] no skills under', ROOT);
    process.exit(1);
  }
  const rows = dirs.map(checkOne);
  const failN = rows.filter((r) => !r.ok).length;
  const report = [
    '# cn-compliance compat report',
    '',
    `Date: ${new Date().toISOString()}`,
    `Skills: ${rows.length}`,
    `FAIL: ${failN}`,
    '',
    '| slug | status | fails | warns |',
    '|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.slug} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.fails.join('; ') || '-'} | ${r.warns.join('; ') || '-'} |`,
    ),
    '',
  ].join('\n');
  const outPath = path.join(REPO_ROOT, 'docs', 'cn-compliance-compat-report-20260802.zh-CN.md');
  writeFileSync(outPath, report, 'utf8');
  console.log(report);
  console.log('wrote', outPath);
  process.exit(failN > 0 ? 1 : 0);
}

main();
