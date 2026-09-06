#!/usr/bin/env node
/**
 * 校验 capability-hub-zh.json：display_name 长度、禁止常见英文术语。
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZH_PATH = path.join(ROOT, 'config', 'capability-hub-zh.json');

const I18N_PATH = path.join(ROOT, 'config', 'capabilities.i18n.json');
const CATALOG_PATH = path.join(ROOT, 'config', 'capabilities.catalog.json');

const BANNED = /\b(read_skill|ICP|JTBD|trigger|MCP|L1|L2|L3|slug)\b/i;
const CJK = /[\u4e00-\u9fff]/;

function main() {
  let errors = 0;
  if (existsSync(CATALOG_PATH) && existsSync(I18N_PATH)) {
    const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
    const i18n = JSON.parse(readFileSync(I18N_PATH, 'utf8'));
    for (const skill of catalog.skills || []) {
      const zh = i18n.skills?.[skill.slug]?.['zh-CN'];
      const name = zh?.display_name;
      if (!name || !CJK.test(name)) {
        console.error(`[i18n catalog] ${skill.slug} zh display_name 缺少中文: ${name || '(empty)'}`);
        errors += 1;
      }
    }
  }
  if (!existsSync(ZH_PATH)) {
    console.warn('[check-capabilities-i18n-zh] skip: no capability-hub-zh.json');
    process.exit(0);
  }
  const data = JSON.parse(readFileSync(ZH_PATH, 'utf8'));
  const skills = data.skills || {};
  for (const [slug, entry] of Object.entries(skills)) {
    const zh = entry['zh-CN'] || entry;
    const name = zh.display_name || zh.name;
    if (!name || name.length < 2 || name.length > 12) {
      console.error(`[${slug}] display_name 长度异常: ${name}`);
      errors += 1;
    }
    for (const field of ['task_summary', 'description', 'setup_hint']) {
      const v = zh[field];
      if (typeof v === 'string' && BANNED.test(v)) {
        console.error(`[${slug}] ${field} 含禁用术语: ${v.slice(0, 60)}`);
        errors += 1;
      }
    }
  }
  if (errors > 0) {
    console.error(`[check-capabilities-i18n-zh] ${errors} issue(s)`);
    process.exit(1);
  }
  console.log(`[check-capabilities-i18n-zh] ok (${Object.keys(skills).length} skills)`);
}

main();
