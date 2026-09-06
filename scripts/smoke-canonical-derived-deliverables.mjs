#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 权威源 → 派生格式策略 smoke
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendCanonicalDerivedInstruction,
  loadDeliverableDerivationManifest,
} from './lib/deliverableDerivation.mjs';
import { finalizeHubTryPrompt } from './lib/promptTemplateStrategy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function main() {
  const errors = [];

  const derivationPath = path.join(ROOT, 'config', 'deliverable-derivation.manifest.json');
  if (!existsSync(derivationPath)) errors.push('missing deliverable-derivation.manifest.json');
  else {
    const doc = loadDeliverableDerivationManifest();
    if (!doc.globalRule?.['zh-CN']) errors.push('missing globalRule zh-CN');
    if (!Array.isArray(doc.exceptions) || doc.exceptions.length < 5) {
      errors.push('exceptions too few');
    }
  }

  const coreStrategy = readFileSync(
    path.join(ROOT, 'src', 'context', 'prompt', 'saasCoreStrategy.ts'),
    'utf8',
  );
  if (!coreStrategy.includes('CANONICAL_DERIVED_BLOCK_ZH')) {
    errors.push('saasCoreStrategy missing canonical derived block');
  }
  const policyTs = readFileSync(
    path.join(ROOT, 'src', 'saas', 'deliverableDerivationPolicy.ts'),
    'utf8',
  );
  if (!policyTs.includes('权威源')) {
    errors.push('deliverableDerivationPolicy missing 权威源');
  }

  const geoDualSkill = readFileSync(
    path.join(ROOT, 'skills', 'geo-dual-report', 'SKILL.md'),
    'utf8',
  );
  if (!/先.*\.md|write_file.*\.md/i.test(geoDualSkill)) {
    errors.push('geo-dual-report SKILL missing md-first rule');
  }
  if (!/read_file/i.test(geoDualSkill)) {
    errors.push('geo-dual-report SKILL missing read_file step');
  }

  const bindingPrompt = readFileSync(
    path.join(ROOT, 'src', 'saas', 'capabilityBindingPrompt.ts'),
    'utf8',
  );
  if (!bindingPrompt.includes('resolveCanonicalDerivedBindingHint')) {
    errors.push('capabilityBindingPrompt missing derived hint hook');
  }

  const hubPrompt = finalizeHubTryPrompt('帮【品牌】做 AI 可见度审计，直接开始做。', {
    slug: 'geo-aeo-audit',
    name: 'geo-aeo-audit',
    majorCategory: 'geo',
  });
  if (!/先.*\.md|未写 MD|read_file 确认/i.test(hubPrompt)) {
    errors.push('geo-aeo-audit try-prompt missing canonical-derived instruction');
  }
  if (/read_skill/i.test(hubPrompt)) {
    errors.push('geo-aeo-audit hub try-prompt must not contain read_skill');
  }

  const appended = appendCanonicalDerivedInstruction('测试', 'geo-keyword-research', 'geo', {
    hub: true,
  });
  if (!appended.includes('未写 MD') && !appended.includes('read_file')) {
    errors.push('appendCanonicalDerivedInstruction hub mode failed');
  }

  const ok = errors.length === 0;
  console.log(`[smoke:canonical-derived] ok=${ok}`);
  if (errors.length) {
    for (const e of errors) console.log(`  - ${e}`);
    process.exitCode = 1;
  }
}

main();
