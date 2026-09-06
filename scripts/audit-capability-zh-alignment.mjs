#!/usr/bin/env node
/**
 * Audit capability hub: zh display_name vs summary/description language alignment,
 * and user-visible duplicate signals (same zh title/summary across different slugs).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = path.join(ROOT, 'config', 'capabilities.catalog.json');
const I18N_PATH = path.join(ROOT, 'config', 'capabilities.i18n.json');

const CJK = /[\u4e00-\u9fff]/;
const MOSTLY_EN = /^[\x00-\x7F\s.,;:!?'"()\-–—/\\[\]{}@#$%^&*+=<>|`~]*$/;

function hasCjk(text) {
  return typeof text === 'string' && CJK.test(text);
}

function isMostlyEnglish(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length < 8) return false;
  return !hasCjk(trimmed) && MOSTLY_EN.test(trimmed.slice(0, 120));
}

function main() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  const i18n = JSON.parse(readFileSync(I18N_PATH, 'utf8'));
  const skills = catalog.skills || [];

  const langMismatch = [];
  const summaryMismatch = [];
  const descMismatch = [];
  const noZhName = [];

  for (const skill of skills) {
    const zh = i18n.skills?.[skill.slug]?.['zh-CN'] || {};
    const visible = !skill.hidden_in_hub;
    const name = zh.display_name || '';
    const summary = zh.task_summary || '';
    const desc = zh.description || '';

    if (!hasCjk(name)) {
      noZhName.push({ slug: skill.slug, visible, name });
      continue;
    }

    if (isMostlyEnglish(summary)) {
      summaryMismatch.push({
        slug: skill.slug,
        visible,
        major: skill.major_category,
        display_name: name,
        task_summary: summary.slice(0, 100),
      });
    }

    if (isMostlyEnglish(desc)) {
      descMismatch.push({
        slug: skill.slug,
        visible,
        major: skill.major_category,
        display_name: name,
        description: desc.slice(0, 120),
      });
    }

    if (hasCjk(name) && (isMostlyEnglish(summary) || isMostlyEnglish(desc))) {
      langMismatch.push({
        slug: skill.slug,
        visible,
        major: skill.major_category,
        display_name: name,
        task_summary: summary.slice(0, 80),
        description: desc.slice(0, 80),
      });
    }
  }

  const visibleSkills = skills.filter((s) => !s.hidden_in_hub);
  const byZhName = new Map();
  const byZhSummary = new Map();
  const byEnDescPrefix = new Map();

  for (const skill of visibleSkills) {
    const zh = i18n.skills?.[skill.slug]?.['zh-CN'] || {};
    const name = zh.display_name || '';
    const summary = zh.task_summary || '';
    const catalogDesc = (skill.description || skill.task_summary || '').slice(0, 80);

    if (name) {
      if (!byZhName.has(name)) byZhName.set(name, []);
      byZhName.get(name).push(skill.slug);
    }
    if (summary) {
      if (!byZhSummary.has(summary)) byZhSummary.set(summary, []);
      byZhSummary.get(summary).push(skill.slug);
    }
    if (catalogDesc && !hasCjk(catalogDesc)) {
      const key = catalogDesc.toLowerCase().trim();
      if (!byEnDescPrefix.has(key)) byEnDescPrefix.set(key, []);
      byEnDescPrefix.get(key).push(skill.slug);
    }
  }

  const visibleZhNameDups = [...byZhName.entries()]
    .filter(([, slugs]) => slugs.length > 1)
    .map(([zhName, slugs]) => ({ zhName, count: slugs.length, slugs }));

  const visibleZhSummaryDups = [...byZhSummary.entries()]
    .filter(([, slugs]) => slugs.length > 1)
    .map(([zhSummary, slugs]) => ({ zhSummary, count: slugs.length, slugs }));

  const visibleEnDescDups = [...byEnDescPrefix.entries()]
    .filter(([, slugs]) => slugs.length > 1)
    .map(([descPrefix, slugs]) => ({ descPrefix, count: slugs.length, slugs }));

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      catalogSkills: skills.length,
      visibleInHub: visibleSkills.length,
      noZhDisplayName: noZhName.length,
      langMismatch: langMismatch.length,
      langMismatchVisible: langMismatch.filter((x) => x.visible).length,
      summaryEnglishVisible: summaryMismatch.filter((x) => x.visible).length,
      descEnglishVisible: descMismatch.filter((x) => x.visible).length,
      visibleZhNameDups: visibleZhNameDups.length,
      visibleZhSummaryDups: visibleZhSummaryDups.length,
      visibleEnDescDups: visibleEnDescDups.length,
    },
    langMismatchVisible: langMismatch.filter((x) => x.visible).slice(0, 200),
    langMismatchHidden: langMismatch.filter((x) => !x.visible).slice(0, 50),
    visibleZhNameDups,
    visibleZhSummaryDups: visibleZhSummaryDups.slice(0, 50),
    visibleEnDescDups: visibleEnDescDups.slice(0, 30),
    noZhNameVisible: noZhName.filter((x) => x.visible),
  };

  const outPath = path.join(ROOT, 'artifacts', 'capabilities-smoke', 'capability-zh-alignment-audit.json');
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log('[zh-alignment-audit] wrote', outPath);
  console.log('[zh-alignment-audit] visible in hub:', report.totals.visibleInHub);
  console.log('[zh-alignment-audit] lang mismatch (name zh, summary/desc en):', report.totals.langMismatch, 'visible:', report.totals.langMismatchVisible);
  console.log('[zh-alignment-audit] visible zh name dups:', report.totals.visibleZhNameDups);
  console.log('[zh-alignment-audit] visible zh summary dups:', report.totals.visibleZhSummaryDups);
  console.log('[zh-alignment-audit] visible same english desc:', report.totals.visibleEnDescDups);

  if (report.totals.langMismatchVisible > 0) {
    console.log('\n--- Visible: Chinese name but English intro (top 25) ---');
    for (const x of report.langMismatchVisible.slice(0, 25)) {
      console.log(`  ${x.slug} 「${x.display_name}」`);
      console.log(`    summary: ${x.task_summary}`);
    }
  }

  if (visibleZhNameDups.length > 0) {
    console.log('\n--- Visible duplicate zh display_name ---');
    for (const g of visibleZhNameDups) {
      console.log(`  「${g.zhName}」×${g.count}: ${g.slugs.join(', ')}`);
    }
  }

  if (visibleZhSummaryDups.length > 0) {
    console.log('\n--- Visible duplicate zh task_summary (top 15) ---');
    for (const g of visibleZhSummaryDups.slice(0, 15)) {
      console.log(`  「${g.zhSummary.slice(0, 40)}」×${g.count}: ${g.slugs.join(', ')}`);
    }
  }

  const weakVisibleNames = noZhName.filter((x) => x.visible);
  console.log('[zh-alignment-audit] visible weak zh names:', weakVisibleNames.length);
  if (weakVisibleNames.length > 0) {
    console.log('\n--- Visible: display_name lacks Chinese (top 20) ---');
    for (const x of weakVisibleNames.slice(0, 20)) {
      console.log(`  ${x.slug}: ${x.name}`);
    }
  }

  process.exit(
    report.totals.langMismatchVisible > 0
    || visibleZhNameDups.length > 0
    || weakVisibleNames.length > 0
      ? 1
      : 0,
  );
}

main();
