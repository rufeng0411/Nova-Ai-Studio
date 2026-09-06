#!/usr/bin/env node
/**
 * Audit duplicate / same-name skills across catalog + SKILL.md frontmatter.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = path.join(ROOT, 'config', 'capabilities.catalog.json');
const I18N_PATH = path.join(ROOT, 'config', 'capabilities.i18n.json');

function discoverSkillDirs(skillsRoot) {
  const found = [];
  const stack = [skillsRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    if (entries.some((e) => e.isFile() && /^skill\.md$/i.test(e.name))) {
      found.push(current);
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) stack.push(path.join(current, entry.name));
    }
  }
  return found;
}

function parseSkillFrontmatter(skillPath) {
  const content = readFileSync(skillPath, 'utf8');
  const match = content.match(/^---\s*[\r\n]+([\s\S]*?)\r?\n---/);
  let name = path.basename(path.dirname(skillPath));
  let description = '';
  if (match) {
    const n = match[1].match(/^name:\s*(.+)$/m);
    const d = match[1].match(/^description:\s*(.+)$/m);
    if (n) name = n[1].trim().replace(/^['"]|['"]$/g, '');
    if (d) description = d[1].trim().replace(/^['"]|['"]$/g, '');
  }
  return { name, description };
}

const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
const i18n = JSON.parse(readFileSync(I18N_PATH, 'utf8'));
const skills = catalog.skills || [];

const byFrontName = new Map();
for (const dir of discoverSkillDirs(path.join(ROOT, 'skills'))) {
  const slug = path.basename(dir);
  const { name, description } = parseSkillFrontmatter(path.join(dir, 'SKILL.md'));
  const key = name.toLowerCase().trim();
  if (!byFrontName.has(key)) byFrontName.set(key, []);
  byFrontName.get(key).push({ slug, name, description: description.slice(0, 100) });
}

const frontNameDups = [...byFrontName.entries()]
  .filter(([, arr]) => arr.length > 1)
  .sort((a, b) => b[1].length - a[1].length);

const byZhName = new Map();
for (const s of skills) {
  const zh = i18n.skills?.[s.slug]?.['zh-CN']?.display_name || '';
  if (!zh) continue;
  if (!byZhName.has(zh)) byZhName.set(zh, []);
  byZhName.get(zh).push(s);
}
const zhNameDups = [...byZhName.entries()]
  .filter(([, arr]) => new Set(arr.map((x) => x.slug)).size > 1)
  .sort((a, b) => b[1].length - a[1].length);

const brandSkills = skills.filter((s) => s.slug.startsWith('mkt-brand-skills-'));
const brandMirror = brandSkills.filter((s) =>
  skills.some((t) => t.slug === s.slug.replace('mkt-brand-skills-', 'mkt-brand-')),
);

const pmsPmdOverlap = [];
const pmsSlugs = skills.filter((s) => s.slug.startsWith('pms-'));
for (const p of pmsSlugs) {
  const tail = p.slug.replace(/^pms-/, '');
  const pmd = `pmd-${tail}`;
  if (skills.some((s) => s.slug === pmd)) {
    pmsPmdOverlap.push({ tail, pms: p.slug, pmd });
  }
}

const categories = {
  exactMirror: [],
  sameFrontNameDiffSlug: [],
  sameZhNameDiffFunc: [],
  pmsPmdOverlap: [],
  hiddenButOnDisk: [],
};

for (const s of brandMirror) {
  categories.exactMirror.push({
    slug: s.slug,
    twin: s.slug.replace('mkt-brand-skills-', 'mkt-brand-'),
    hidden: s.hidden_in_hub,
  });
}

for (const [name, arr] of frontNameDups) {
  const uniq = [...new Map(arr.map((x) => [x.slug, x])).values()];
  if (uniq.length < 2) continue;
  // skip brand mirror already counted
  const slugs = uniq.map((x) => x.slug);
  if (slugs.every((s) => s.startsWith('mkt-brand'))) continue;
  categories.sameFrontNameDiffSlug.push({
    frontmatterName: uniq[0].name,
    slugs: slugs.map((slug) => {
      const cat = skills.find((c) => c.slug === slug);
      return {
        slug,
        hidden: cat?.hidden_in_hub,
        major: cat?.major_category,
        summary: (cat?.task_summary || '').slice(0, 80),
        desc: uniq.find((x) => x.slug === slug)?.description?.slice(0, 80),
      };
    }),
  });
}

for (const [zhName, arr] of zhNameDups) {
  const uniq = [...new Map(arr.map((x) => [x.slug, x])).values()];
  if (uniq.length < 2) continue;
  const summaries = new Set(uniq.map((s) => (s.task_summary || '').slice(0, 60)));
  categories.sameZhNameDiffFunc.push({
    zhName,
    count: uniq.length,
    distinctSummaries: summaries.size,
    slugs: uniq.map((s) => ({
      slug: s.slug,
      hidden: s.hidden_in_hub,
      major: s.major_category,
      summary: (s.task_summary || '').slice(0, 60),
    })),
  });
}

for (const o of pmsPmdOverlap) {
  const p = skills.find((s) => s.slug === o.pms);
  const d = skills.find((s) => s.slug === o.pmd);
  const sameDesc = (p?.description || '').slice(0, 80) === (d?.description || '').slice(0, 80);
  categories.pmsPmdOverlap.push({
    ...o,
    sameDescriptionPrefix: sameDesc,
    pmsSummary: (p?.task_summary || '').slice(0, 60),
    pmdSummary: (d?.task_summary || '').slice(0, 60),
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    catalogSkills: skills.length,
    visibleInHub: skills.filter((s) => !s.hidden_in_hub).length,
    brandSkillsMirrorPairs: brandMirror.length,
    frontmatterNameDuplicateGroups: frontNameDups.length,
    zhDisplayNameDuplicateGroups: zhNameDups.length,
    pmsPmdTailOverlap: pmsPmdOverlap.length,
  },
  categories,
};

const outPath = path.join(ROOT, 'artifacts', 'capabilities-smoke', 'skill-duplicates-audit.json');
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log('[skill-duplicates-audit] wrote', outPath);
console.log('[skill-duplicates-audit] brand mirror pairs', brandMirror.length);
console.log('[skill-duplicates-audit] frontmatter name dup groups', frontNameDups.length);
console.log('[skill-duplicates-audit] zh display_name dup groups', zhNameDups.length);
console.log('[skill-duplicates-audit] pms/pmd tail overlap', pmsPmdOverlap.length);

console.log('\n--- Same zh display_name, different function (top 15) ---');
for (const g of categories.sameZhNameDiffFunc.filter((x) => x.distinctSummaries > 1).slice(0, 15)) {
  console.log(`\n「${g.zhName}」×${g.count} (${g.distinctSummaries} distinct summaries)`);
  for (const s of g.slugs) console.log(`  ${s.slug} [${s.major}] ${s.summary}`);
}

console.log('\n--- pms vs pmd same tail (visible) ---');
for (const o of categories.pmsPmdOverlap.slice(0, 20)) {
  const p = skills.find((s) => s.slug === o.pms);
  const d = skills.find((s) => s.slug === o.pmd);
  if (p?.hidden_in_hub && d?.hidden_in_hub) continue;
  console.log(`\n${o.tail}:`);
  console.log(`  ${o.pms}: ${o.pmsSummary}`);
  console.log(`  ${o.pmd}: ${o.pmdSummary}`);
}
