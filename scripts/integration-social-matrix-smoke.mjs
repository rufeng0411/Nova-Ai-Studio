#!/usr/bin/env node
/**
 * Smoke test for social-creative-matrix skill (read-only, no API).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_DIR = path.join(REPO_ROOT, 'skills', 'social-creative-matrix');
const ARTIFACT_DIR = path.join(REPO_ROOT, 'artifacts', 'social-matrix-smoke');
const PACK_SCRIPT = path.join(REPO_ROOT, 'scripts', 'pack-social-matrix-yixiaoer.mjs');

const REQUIRED_REFS = [
  'visual-ratio-matrix.md',
  'copy-platform-matrix.md',
  'deliverables-spec.md',
  'anti-patterns.md',
  'platform-deep-links.md',
  'yixiaoer-handoff.md',
  'creative-brief.md',
  'workflow-phases.md',
];

const REQUIRED_ASSETS = [
  'manifest.template.json',
  'copy-matrix.template.md',
  'creative-brief.template.md',
];

function runPack(manifestPath, uploadMapPath, outPath) {
  const result = spawnSync(
    process.execPath,
    [
      PACK_SCRIPT,
      '--manifest',
      manifestPath,
      '--upload-map',
      uploadMapPath,
      '--out',
      outPath,
      '--draft',
      'platform',
    ],
    { cwd: REPO_ROOT, encoding: 'utf8', shell: false },
  );
  return {
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function validatePublishDraft(draft) {
  const errors = [];
  if (draft.action !== 'publish') errors.push('action must be publish');
  if (draft.publishType !== 'imageText') errors.push('publishType must be imageText');
  if (!Array.isArray(draft.platforms) || draft.platforms.length === 0) {
    errors.push('platforms[] required');
  }
  if (!draft.coverKey) errors.push('coverKey required');
  const forms = draft.publishArgs?.accountForms;
  if (!Array.isArray(forms) || forms.length === 0) {
    errors.push('publishArgs.accountForms required');
  } else {
    for (const form of forms) {
      if (!form.platformAccountId) errors.push('accountForm.platformAccountId missing');
      if (!form.coverKey || !form.cover?.key) errors.push('accountForm.cover/coverKey missing');
      if (!Array.isArray(form.images) || !form.images[0]?.key) {
        errors.push('accountForm.images[0].key missing');
      }
    }
  }
  return errors;
}

function main() {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  const report = { generatedAt: new Date().toISOString(), checks: [], passed: false };

  const skillMd = path.join(SKILL_DIR, 'SKILL.md');
  report.checks.push({
    id: 'skill-md',
    ok: existsSync(skillMd),
    detail: existsSync(skillMd) ? 'SKILL.md present' : 'missing SKILL.md',
  });

  for (const ref of REQUIRED_REFS) {
    const p = path.join(SKILL_DIR, 'references', ref);
    const ok = existsSync(p);
    report.checks.push({ id: `ref-${ref}`, ok, detail: ok ? ref : `missing references/${ref}` });
  }

  for (const asset of REQUIRED_ASSETS) {
    const p = path.join(SKILL_DIR, 'assets', asset);
    const ok = existsSync(p);
    report.checks.push({ id: `asset-${asset}`, ok, detail: ok ? asset : `missing assets/${asset}` });
  }

  const templatePath = path.join(SKILL_DIR, 'assets', 'manifest.template.json');
  let templateOk = false;
  try {
    const t = JSON.parse(readFileSync(templatePath, 'utf8'));
    templateOk = Boolean(t.campaignId && t.platforms?.length && t.recommendedMapping);
  } catch {
    templateOk = false;
  }
  report.checks.push({
    id: 'manifest-template-schema',
    ok: templateOk,
    detail: templateOk ? 'manifest.template.json parseable' : 'invalid manifest template',
  });

  const mockDir = path.join(ARTIFACT_DIR, 'mock-campaign');
  mkdirSync(path.join(mockDir, 'yixiaoer'), { recursive: true });

  const manifest = {
    campaignId: 'mock-campaign',
    createdAt: new Date().toISOString(),
    status: 'ready',
    platforms: ['小红书', '抖音'],
    creativeAnchor: { valueProp: '冒烟测试', visualPrompt: 'test', tone: '中性', cta: '了解', avoid: '' },
    recommendedMapping: {
      小红书: 'visuals/image-3x4.png',
      抖音: 'visuals/image-9x16.png',
    },
    copy: {
      小红书: { title: '测', body: '正文', hashtags: ['测试'] },
      抖音: { title: '测', body: '正文', hashtags: [] },
    },
  };
  const uploadMap = {
    'artifacts/social-matrix-smoke/mock-campaign/visuals/image-3x4.png': {
      key: 'mock_key_3x4',
      width: 1104,
      height: 1472,
      size: 1000,
      format: 'png',
    },
    'artifacts/social-matrix-smoke/mock-campaign/visuals/image-9x16.png': {
      key: 'mock_key_9x16',
      width: 928,
      height: 1664,
      size: 1000,
      format: 'png',
    },
  };

  const manifestPath = path.join(mockDir, 'manifest.json');
  const uploadMapPath = path.join(mockDir, 'yixiaoer', 'upload-map.json');
  const draftPath = path.join(mockDir, 'yixiaoer', 'publish-draft.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  writeFileSync(uploadMapPath, JSON.stringify(uploadMap, null, 2));

  const packRun = runPack(
    path.relative(REPO_ROOT, manifestPath),
    path.relative(REPO_ROOT, uploadMapPath),
    path.relative(REPO_ROOT, draftPath),
  );
  let packOk = packRun.status === 0 && existsSync(draftPath);
  let packErrors = [];
  if (packOk) {
    try {
      const draft = JSON.parse(readFileSync(draftPath, 'utf8'));
      packErrors = validatePublishDraft(draft);
      packOk = packErrors.length === 0;
    } catch (e) {
      packOk = false;
      packErrors = [String(e.message || e)];
    }
  }
  report.checks.push({
    id: 'pack-script',
    ok: packOk,
    detail: packOk
      ? 'pack-social-matrix-yixiaoer.mjs produced valid publish-draft.json'
      : `pack failed: status=${packRun.status} ${packErrors.join('; ') || packRun.stderr}`,
  });

  report.passed = report.checks.every((c) => c.ok);
  const reportPath = path.join(ARTIFACT_DIR, 'report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(report.passed ? 'social-matrix-smoke: PASS' : 'social-matrix-smoke: FAIL');
  for (const c of report.checks) {
    console.log(`  [${c.ok ? 'ok' : 'FAIL'}] ${c.id}: ${c.detail}`);
  }
  process.exit(report.passed ? 0 : 1);
}

main();
