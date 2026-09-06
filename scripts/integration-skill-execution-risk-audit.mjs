#!/usr/bin/env node
/**
 * Audit SKILL.md for execution patterns that fail in SaaS tenant cwd.
 * Run: node scripts/integration-skill-execution-risk-audit.mjs
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = path.join(ROOT, 'skills');

const RISK_PATTERNS = [
  { id: 'read_file_skills', re: /read_file[`\s→]*[`\s]*skills\//gi, severity: 'high', fix: 'read_skill(skill, relativePath)' },
  { id: 'read_file_references', re: /(?:read_file|阅读)\s*[`'"]?references\//gi, severity: 'high', fix: 'read_skill(skillName, "references/...")' },
  { id: 'node_scripts', re: /node\s+scripts\/[\w.-]+\.mjs/gi, severity: 'medium', fix: 'builtin tool or API' },
  { id: 'bash_curl', re: /\b(bash|curl|grep|findstr)\b/gi, severity: 'medium', fix: 'web_fetch / fetch_page_images' },
  { id: 'paste_html', re: /```html/gi, severity: 'medium', fix: 'write_file to artifacts/' },
  { id: 'python_skills', re: /python\s+skills\//gi, severity: 'high', fix: 'builtin tool or mark optional' },
];

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, out);
    else if (e.name === 'SKILL.md') out.push(full);
  }
  return out;
}

const files = await walk(SKILLS);
const hits = [];

for (const file of files) {
  const text = await readFile(file, 'utf8');
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  for (const pat of RISK_PATTERNS) {
    const lines = text.split('\n');
    let count = 0;
    for (const line of lines) {
      if (!pat.re.test(line)) continue;
      if (pat.id === 'read_file_references' && /read_skill|relativePath|勿 read_file/i.test(line)) continue;
      if (pat.id === 'read_file_skills' && /禁止|勿|不要|do not/i.test(line)) continue;
      count += 1;
    }
    pat.re.lastIndex = 0;
    if (count > 0) {
      hits.push({
        file: rel,
        pattern: pat.id,
        severity: pat.severity,
        count,
        fix: pat.fix,
      });
    }
  }
}

const bySeverity = { high: [], medium: [] };
for (const h of hits) {
  (bySeverity[h.severity] ?? bySeverity.medium).push(h);
}

console.log('# Skill execution risk audit\n');
console.log(`Scanned ${files.length} SKILL.md files under skills/\n`);
console.log(`| Severity | Hits |`);
console.log(`|----------|------|`);
console.log(`| high | ${bySeverity.high.length} |`);
console.log(`| medium | ${bySeverity.medium.length} |`);

const grouped = new Map();
for (const h of hits) {
  if (!grouped.has(h.pattern)) grouped.set(h.pattern, []);
  grouped.get(h.pattern).push(h);
}

console.log('\n## By pattern\n');
for (const [id, list] of [...grouped.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const sample = list.slice(0, 5).map((x) => x.file).join(', ');
  console.log(`- **${id}** (${list.length}): ${sample}${list.length > 5 ? '…' : ''}`);
}

if (bySeverity.high.length > 0) {
  const blockingHigh = bySeverity.high.filter(
    (h) => !h.file.includes('skills/vendor/education-ecosystem/'),
  );
  console.log('\n## High severity (sample)\n');
  for (const h of bySeverity.high.slice(0, 20)) {
    const known = h.file.includes('skills/vendor/education-ecosystem/');
    console.log(`- ${h.file} — ${h.pattern} ×${h.count} → ${h.fix}${known ? ' (known vendor doc)' : ''}`);
  }
  if (blockingHigh.length > 0) {
    process.exitCode = 1;
  } else {
    console.log('\nOnly known vendor education-ecosystem doc examples remain (non-blocking).');
  }
} else {
  console.log('\nNo high-severity patterns in scan (or all remediated).');
}
