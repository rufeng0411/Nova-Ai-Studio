#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Multi-skill / process-template matrix — offline copy + prompt binding checks.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const BANNED_ZH = /重试|多次尝试|失败|卡住/;
const SCENARIOS = [
  {
    id: 'research-report',
    prompt: '帮我就【北京地区企业人工智能业务转型研究】做一份正式调研报告，3 步一次做完',
    detect: 'detectResearchReportTurn',
    build: 'buildResearchReportExecutionPrompt',
  },
  {
    id: 'content-flywheel',
    prompt: '帮我围绕纵横 G700 做一轮内容营销，3 步一次做完',
    detect: 'detectContentFlywheelTurn',
    build: 'buildContentFlywheelExecutionPrompt',
  },
  {
    id: 'content-matrix',
    prompt: '帮我写一篇关于 ROG 油条的多平台内容矩阵，一文多发五平台',
    detect: 'detectContentMatrixTurn',
    build: 'buildContentMatrixExecutionPrompt',
  },
  {
    id: 'nova-ppt',
    prompt: '用 Nova 美学幻灯做 3 页关于夏日营销的 PNG 幻灯片，带 slide-manifest.json',
    detect: null,
    build: null,
  },
];

function loadChatLocale(locale) {
  const p = path.join(REPO_ROOT, 'ui/src/i18n/locales', locale, 'chat.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function flattenStrings(obj, prefix = '') {
  if (typeof obj === 'string') return [[prefix, obj]];
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    return Object.entries(obj).flatMap(([k, v]) => flattenStrings(v, prefix ? `${prefix}.${k}` : k));
  }
  return [];
}

async function main() {
  const mod = await import(
    pathToFileURL(path.join(REPO_ROOT, 'src/saas/processTemplateExecutionPrompt.ts')).href
  );

  for (const scenario of SCENARIOS) {
    if (scenario.detect) {
      assert.equal(
        mod[scenario.detect](scenario.prompt),
        true,
        `${scenario.id}: detect should match`,
      );
      const block = mod[scenario.build]('zh-CN');
      assert.ok(block.length > 40, `${scenario.id}: execution block too short`);
      assert.ok(
        !block.includes('read_file skills/') || block.includes('禁止'),
        `${scenario.id}: should discourage skills/ reads`,
      );
    }
    const append = mod.resolveProcessTemplateAppendFromMessages(
      [{ role: 'user', content: scenario.prompt }],
      'zh-CN',
    );
    if (scenario.detect) {
      assert.ok(append.length > 0, `${scenario.id}: append should be non-empty`);
    }
    console.log(`[matrix] ${scenario.id} OK`);
  }

  const zhChat = loadChatLocale('zh-CN');
  const voiceKeys = flattenStrings(zhChat).filter(([key]) =>
    /^(working|recovery\.handling|recovery\.pause|recovery\.guidance|process\.clue|process\.recovery)\./.test(key),
  );
  for (const [key, text] of voiceKeys) {
    assert.ok(!BANNED_ZH.test(text), `zh-CN ${key} contains banned term: ${text}`);
  }

  const templatesPath = path.join(REPO_ROOT, 'config/process-templates.json');
  const templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
  const ids = new Set((templates.templates || templates).map((t) => t.id));
  for (const required of ['research-report', 'content-flywheel']) {
    assert.ok(ids.has(required), `missing process template ${required}`);
  }

  console.log('[test:multi-skill:matrix] OK');
}

main().catch((error) => {
  console.error('[test:multi-skill:matrix] FAIL:', error instanceof Error ? error.message : error);
  process.exit(1);
});
