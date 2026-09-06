#!/usr/bin/env node
/**
 * Verify od-* surface skills use read_skill relativePath for checklist (P0 gate).
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = path.join(ROOT, 'skills');

const CHECKLIST_SLUGS = [
  'od-article-magazine', 'od-dashboard', 'od-data-report', 'od-deck-magazine',
  'od-email-marketing', 'od-faq-page', 'od-login-flow', 'od-mobile-app',
  'od-mobile-onboarding', 'od-poster-hero', 'od-pricing-page', 'od-pricing-upgrade',
  'od-resume', 'od-saas-landing', 'od-social-carousel', 'od-wireframe-sketch',
  // Batch B 2026-08-03
  'od-waitlist-page', 'od-web-prototype', 'od-team-okrs', 'od-kanban-board',
  'od-meeting-notes', 'od-docs-page', 'od-blog-post', 'od-finance-report',
  'od-hr-onboarding', 'od-pm-spec', 'od-gamified-app', 'od-deck-swiss',
  'od-social-x-card', 'od-creative-director', 'od-wireframe-mobile-flow',
];

const failures = [];
for (const slug of CHECKLIST_SLUGS) {
  const file = path.join(SKILLS, slug, 'SKILL.md');
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    failures.push(`${slug}: missing SKILL.md`);
    continue;
  }
  if (!/relativePath=\`references\/checklist\.md\`/i.test(text) && !/relativePath=`references\/checklist.md`/i.test(text)) {
    failures.push(`${slug}: no read_skill relativePath for checklist`);
  }
  if (/阅读 `references\/checklist\.md`/i.test(text)) {
    failures.push(`${slug}: still says 阅读 references/checklist (read_file pattern)`);
  }
}

if (failures.length) {
  console.error('od-* checklist gate FAILED:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log(`od-* checklist gate OK (${CHECKLIST_SLUGS.length} skills)`);
