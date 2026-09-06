#!/usr/bin/env node
/**
 * P0: od-* skills — checklist / open-design refs via read_skill relativePath (UTF-8 safe).
 * Run: node scripts/fix-od-skill-checklist-refs.mjs
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_OD = path.join(ROOT, 'skills');

function parseSkillName(content) {
  const m = content.match(/^---\s*\n[\s\S]*?^name:\s*(.+)\s*$/m);
  return m?.[1]?.trim() ?? '';
}

function patchSkill(content, slug) {
  let next = content;

  next = next.replace(
    /2\. 阅读 `references\/checklist\.md` 并自检。/g,
    `2. 用 \`read_skill\` skillName=\`${slug}\` relativePath=\`references/checklist.md\` 读清单并自检（勿 \`read_file\`）。`,
  );

  next = next.replace(
    /3\. 阅读 `references\/checklist\.md`，交付前逐条自检。/g,
    `3. 用 \`read_skill\` skillName=\`${slug}\` relativePath=\`references/checklist.md\` 读清单，交付前逐条自检（勿 \`read_file\`）。`,
  );

  next = next.replace(
    /3\. 若 `references\/checklist\.md` 存在，交付前必须逐条自检。/g,
    `3. 交付前用 \`read_skill\` skillName=\`${slug}\` relativePath=\`references/checklist.md\` 读清单并逐条自检（勿 \`read_file\`）。`,
  );

  next = next.replace(
    /读 `open-design\/references\/official-product-images\.md`/g,
    '用 `read_skill` skillName=`open-design` relativePath=`references/official-product-images.md` 读取',
  );

  next = next.replace(
    /见 `open-design\/references\/official-product-images\.md`/g,
    '见 open-design `references/official-product-images.md`（经 read_skill relativePath 读取）',
  );

  if (!next.includes('经 read_skill relativePath 读取') && next.includes('- 清单：`references/checklist.md`')) {
    next = next.replace(
      /- 清单：`references\/checklist\.md`$/gm,
      '- 清单：`references/checklist.md`（经 read_skill relativePath 读取）',
    );
  }

  if (!next.includes('write_file') && next.includes('## 产物要求')) {
    // no-op
  }

  if (!next.includes('勿贴整页 html') && next.includes('## 产物要求')) {
    const deliverLine =
      '- 交付：`write_file` 到**系统分配的任务目录**（`artifacts/task-*`）下的 `index.html`；对话只给路径，勿贴整页 html。**禁止**写入 `artifacts/design/` 语义目录。';
    if (!next.includes('artifacts/task-*')) {
      next = next.replace(/(## 产物要求\r?\n)/, `$1\n${deliverLine}\n`);
    }
  }

  return next;
}

const entries = await readdir(SKILLS_OD, { withFileTypes: true });
const odDirs = entries.filter((e) => e.isDirectory() && e.name.startsWith('od-'));
let changed = 0;

for (const dir of odDirs) {
  const skillPath = path.join(SKILLS_OD, dir.name, 'SKILL.md');
  let content;
  try {
    content = await readFile(skillPath, 'utf8');
  } catch {
    continue;
  }
  const slug = parseSkillName(content) || dir.name;
  const patched = patchSkill(content, slug);
  if (patched !== content) {
    await writeFile(skillPath, patched, 'utf8');
    changed += 1;
    console.log('updated', path.relative(ROOT, skillPath));
  }
}

console.log(`\nDone. ${changed} od-* SKILL.md file(s) updated.`);
