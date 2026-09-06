#!/usr/bin/env node
/**
 * Audit process templates + hub try-prompts for deliverable checklist alignment.
 * Run: node scripts/audit-deliverable-checklist-alignment.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const templates = JSON.parse(readFileSync(path.join(ROOT, 'config', 'process-templates.json'), 'utf8'));
const authority = JSON.parse(readFileSync(path.join(ROOT, 'config', 'deliverable-checklist-authority.json'), 'utf8'));

const CHECKLIST_HEADER = /标准成果清单|standard deliverables/i;
const VAGUE_CHECKLIST = /全套|整包|多份|各文件|geo 目录|物料包/i;
const CONCRETE_FILE = /[\w.-]+\.(md|html|docx|pptx|pdf|jsonld|png|mp4)/i;

const rows = [];

for (const t of templates.templates ?? []) {
  const zh = t.prompt?.['zh-CN'] ?? '';
  const hasChecklist = CHECKLIST_HEADER.test(zh);
  const checklistSection = hasChecklist ? zh.slice(zh.search(CHECKLIST_HEADER)) : '';
  const numberedInChecklist = (checklistSection.match(/^\s*\d+[.、)]/gm) ?? []).length;
  const vague = hasChecklist && VAGUE_CHECKLIST.test(checklistSection) && !CONCRETE_FILE.test(checklistSection);
  const authoritySpec = authority.templates?.[t.id];
  rows.push({
    id: t.id,
    complexity: t.complexity,
    flowSteps: t.flow?.length ?? 0,
    hasChecklist,
    checklistItems: numberedInChecklist,
    vagueChecklist: vague,
    authoritySynced: Boolean(authoritySpec?.syncChecklist),
    profileId: authoritySpec?.profileId ?? null,
  });
}

const stats = {
  totalTemplates: rows.length,
  withChecklist: rows.filter((r) => r.hasChecklist).length,
  vagueChecklist: rows.filter((r) => r.vagueChecklist).length,
  authoritySynced: rows.filter((r) => r.authoritySynced).length,
  concreteFileInChecklist: rows.filter((r) => r.hasChecklist && !r.vagueChecklist).length,
};

const report = { at: new Date().toISOString(), stats, rows };
const outPath = path.join(ROOT, 'docs', 'deliverable-checklist-audit-report.json');
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log('[audit-deliverable-checklist] stats', stats);
console.log(`[audit-deliverable-checklist] report=${outPath}`);
if (stats.vagueChecklist > 0) {
  console.log('[audit-deliverable-checklist] vague templates:');
  for (const row of rows.filter((r) => r.vagueChecklist)) {
    console.log(`  - ${row.id} (${row.checklistItems} items)`);
  }
}
