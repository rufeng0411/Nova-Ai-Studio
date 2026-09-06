#!/usr/bin/env node
/**
 * Vendor Nova-1 portable skills from nova-1/skills into skills/vendor/nova-1/.
 * Slugs are prefixed with nova- for capability hub branding.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_ROOT = path.join(REPO_ROOT, 'nova-1', 'skills');
const TARGET_PARENT = path.join(REPO_ROOT, 'skills', 'vendor', 'nova-1');

/** @type {Array<{ sourceSlug: string; vendoredSlug: string }>} */
const SKILL_MAPPINGS = [
  { sourceSlug: 'research-general', vendoredSlug: 'nova-research-general' },
  { sourceSlug: 'research-user-general', vendoredSlug: 'nova-research-user-general' },
  { sourceSlug: 'research-industry-market', vendoredSlug: 'nova-research-industry-market' },
  { sourceSlug: 'research-product-user', vendoredSlug: 'nova-research-product-user' },
  { sourceSlug: 'research-competitor', vendoredSlug: 'nova-research-competitor' },
  { sourceSlug: 'research-academic-professional', vendoredSlug: 'nova-research-academic-professional' },
  { sourceSlug: 'ppt-aesthetic-slides', vendoredSlug: 'nova-ppt-aesthetic-slides' },
  { sourceSlug: 'customer-acquisition-leads', vendoredSlug: 'nova-customer-acquisition-leads' },
];

const SLUG_RENAMES = Object.fromEntries(
  SKILL_MAPPINGS.map(({ sourceSlug, vendoredSlug }) => [sourceSlug, vendoredSlug]),
);

function copySkillDir(fromDir, toDir) {
  rmSync(toDir, { recursive: true, force: true });
  mkdirSync(toDir, { recursive: true });
  for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    cpSync(path.join(fromDir, entry.name), path.join(toDir, entry.name), { recursive: true });
  }
}

function patchSkillMarkdown(skillDir, vendoredSlug, sourceSlug) {
  const skillMd = path.join(skillDir, 'SKILL.md');
  if (!existsSync(skillMd)) return;
  let content = readFileSync(skillMd, 'utf8');
  content = content.replace(/^name:\s*.+$/m, `name: ${vendoredSlug}`);
  for (const [oldSlug, newSlug] of Object.entries(SLUG_RENAMES)) {
    if (oldSlug === newSlug) continue;
    content = content.replaceAll(`\`${oldSlug}\``, `\`${newSlug}\``);
    content = content.replaceAll(`skills/${oldSlug}/`, `skills/vendor/nova-1/${newSlug}/`);
  }
  writeFileSync(skillMd, content, 'utf8');
}

function main() {
  if (!existsSync(SOURCE_ROOT)) {
    throw new Error(`Nova-1 skills source not found: ${SOURCE_ROOT}`);
  }

  mkdirSync(TARGET_PARENT, { recursive: true });
  const copied = [];

  for (const mapping of SKILL_MAPPINGS) {
    const sourceDir = path.join(SOURCE_ROOT, mapping.sourceSlug);
    const targetDir = path.join(TARGET_PARENT, mapping.vendoredSlug);
    const skillMd = path.join(sourceDir, 'SKILL.md');
    if (!existsSync(skillMd)) {
      console.warn(`[vendor-nova-1] skip missing ${mapping.sourceSlug}`);
      continue;
    }
    copySkillDir(sourceDir, targetDir);
    patchSkillMarkdown(targetDir, mapping.vendoredSlug, mapping.sourceSlug);
    copied.push({ slug: mapping.vendoredSlug, source: mapping.sourceSlug });
    console.log(`[vendor-nova-1] ${mapping.sourceSlug} → ${mapping.vendoredSlug}`);
  }

  const manifestPath = path.join(TARGET_PARENT, 'nova-1-manifest.json');
  writeFileSync(
    manifestPath,
    `${JSON.stringify({ vendoredAt: new Date().toISOString(), skills: copied }, null, 2)}\n`,
    'utf8',
  );
  console.log(`[vendor-nova-1] done skills=${copied.length} manifest=${manifestPath}`);
}

main();
