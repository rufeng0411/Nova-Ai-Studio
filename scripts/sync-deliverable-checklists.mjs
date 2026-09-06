#!/usr/bin/env node
/**
 * Sync process template「标准成果清单」with config/deliverable-checklist-authority.json
 * Run: node scripts/sync-deliverable-checklists.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const AUTHORITY_PATH = path.join(ROOT, 'config', 'deliverable-checklist-authority.json');
const TEMPLATES_PATH = path.join(ROOT, 'config', 'process-templates.json');

const authority = JSON.parse(readFileSync(AUTHORITY_PATH, 'utf8'));
const config = JSON.parse(readFileSync(TEMPLATES_PATH, 'utf8'));

function buildChecklistBlock(lines, locale) {
  const header = locale === 'zh-CN' ? '标准成果清单：' : 'Standard deliverables:';
  const numbered = lines.map((line, idx) => `${idx + 1}. ${line}`);
  return `\n\n${header}\n${numbered.join('\n')}`;
}

function replaceChecklistSection(prompt, block) {
  const text = String(prompt ?? '');
  const zhHeader = /\n\n标准成果清单：[\s\S]*$/;
  const enHeader = /\n\nStandard deliverables:[\s\S]*$/i;
  if (zhHeader.test(text)) return text.replace(zhHeader, block);
  if (enHeader.test(text)) return text.replace(enHeader, block);
  return `${text.trim()}${block}`;
}

const report = [];

for (const template of config.templates ?? []) {
  const spec = authority.templates?.[template.id];
  if (!spec?.syncChecklist) continue;

  let zhLines = spec.checklistZh;
  let enLines = spec.checklistEn;

  if (!zhLines && spec.profileId) {
    const profile = authority.profiles?.[spec.profileId];
    zhLines = profile?.checklistZh;
    enLines = profile?.checklistEn ?? profile?.checklistZh;
  }

  if (!zhLines?.length) {
    report.push({ id: template.id, status: 'skipped', reason: 'no checklist lines' });
    continue;
  }

  const beforeZh = template.prompt['zh-CN'];
  template.prompt['zh-CN'] = replaceChecklistSection(
    template.prompt['zh-CN'],
    buildChecklistBlock(zhLines, 'zh-CN'),
  );
  if (enLines?.length) {
    template.prompt.en = replaceChecklistSection(
      template.prompt.en,
      buildChecklistBlock(enLines, 'en'),
    );
  }
  if (spec.outputsZh) {
    template.outputs['zh-CN'] = spec.outputsZh;
  }
  if (spec.outputsEn) {
    template.outputs.en = spec.outputsEn;
  }

  report.push({
    id: template.id,
    status: beforeZh === template.prompt['zh-CN'] ? 'unchanged' : 'updated',
    checklistCount: zhLines.length,
  });
}

writeFileSync(TEMPLATES_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

const updated = report.filter((row) => row.status === 'updated');
console.log(`[sync-deliverable-checklists] templates=${report.length} updated=${updated.length}`);
for (const row of updated) {
  console.log(`  ✓ ${row.id} (${row.checklistCount} items)`);
}

const reportPath = path.join(ROOT, 'docs', 'deliverable-checklist-sync-report.json');
writeFileSync(reportPath, `${JSON.stringify({ at: new Date().toISOString(), report }, null, 2)}\n`, 'utf8');
console.log(`[sync-deliverable-checklists] report=${reportPath}`);
