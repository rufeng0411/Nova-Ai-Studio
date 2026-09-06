#!/usr/bin/env node
/**
 * Normalize od-* / open-design deliverable paths to STDA artifacts/task-*.
 * Run: node scripts/fix-od-stda-paths.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = path.join(ROOT, 'skills');

const CLEAN_INDEX =
  '- 交付：`write_file` 到**系统分配的任务目录**（`artifacts/task-*`）下的 `index.html`；对话只给路径，勿贴整页 html。**禁止**写入 `artifacts/design/` 语义目录。';
const CLEAN_REVIEW =
  '- 交付：`write_file` 到**系统分配的任务目录**（`artifacts/task-*`）下的 `review.md`（若改稿则同步更新 HTML）；对话只给路径。**禁止**写入 `artifacts/design/` 语义目录。';

function cleanSkillBody(text, slug) {
  let next = text;
  next = next.replace(/artifacts\/task-\*\/（禁止 artifacts\/task-\*\/（禁止再写 artifacts\/design\/））/g, 'artifacts/task-*/');
  next = next.replace(/artifacts\/task-\*\/（禁止 artifacts\/design\/）/g, 'artifacts/task-*/');
  next = next.replace(/artifacts\/task-\*\/（禁止再写 artifacts\/design\/）/g, 'artifacts/task-*/');
  next = next.replace(/- 交付：`write_file` 到[\s\S]*?语义目录。/g, () =>
    (slug === 'od-creative-director' ? CLEAN_REVIEW : CLEAN_INDEX));
  return next;
}

async function main() {
  const entries = await fs.readdir(SKILLS, { withFileTypes: true });
  let n = 0;
  for (const e of entries) {
    if (!e.isDirectory() || !e.name.startsWith('od-')) continue;
    const p = path.join(SKILLS, e.name, 'SKILL.md');
    const before = await fs.readFile(p, 'utf8');
    const after = cleanSkillBody(before, e.name);
    if (after !== before) {
      await fs.writeFile(p, after, 'utf8');
      n += 1;
      console.log('fixed', e.name);
    }
  }

  const odPath = path.join(SKILLS, 'open-design', 'SKILL.md');
  let od = await fs.readFile(odPath, 'utf8');
  const odBefore = od;
  od = od.replace(
    /- 优先交付可直接预览的 HTML 文件（\*\*`write_file` 落盘\*\*，[\s\S]*?细则见 `references\/artifact-naming\.md`）。/,
    '- 优先交付可直接预览的 HTML 文件（**`write_file` 落盘**到**系统分配的任务目录** `artifacts/task-*/`，细则见 `references/artifact-naming.md`）。**禁止**再写 `artifacts/design/` 语义目录。',
  );
  od = od.replace(
    /- 对话中必须引用\*\*完整相对路径\*\*（如[\s\S]*?），禁止只写 `index\.html`。/,
    '- 对话中必须引用**完整相对路径**（如 `artifacts/task-20260803-abcd1234/index.html`），禁止只写 `index.html`。',
  );
  if (!od.includes('od-waitlist-page')) {
    od = od.replace(
      /- 页面精修打磨：`od-web-artifacts-builder`/,
      `- 页面精修打磨：\`od-web-artifacts-builder\`
- 候补名单 / 网页原型：\`od-waitlist-page\` / \`od-web-prototype\`
- 团队协作页：\`od-team-okrs\` / \`od-kanban-board\` / \`od-meeting-notes\`
- 文档与内容：\`od-docs-page\` / \`od-blog-post\` / \`od-pm-spec\`
- 财务 / 入职 / 游戏化：\`od-finance-report\` / \`od-hr-onboarding\` / \`od-gamified-app\`
- 瑞士风 Deck / X 分享卡：\`od-deck-swiss\` / \`od-social-x-card\`
- 审稿 / 手机流程线框（内部）：\`od-creative-director\` / \`od-wireframe-mobile-flow\``,
    );
  }
  if (od !== odBefore) {
    await fs.writeFile(odPath, od, 'utf8');
    n += 1;
    console.log('fixed open-design');
  }

  const namingPath = path.join(SKILLS, 'open-design', 'references', 'artifact-naming.md');
  const naming = `# 成果目录与命名（防串台）

同一项目里多次做官网、幻灯、落地页时，若都写 \`index.html\` 或 \`slide-01.png\`，旧文件会被覆盖或对话链接指向错误版本。

## 目录规则（Nova STDA）

| 产物类型 | 目录模板 | 说明 |
| --- | --- | --- |
| 设计页 / 官网 / 原型 / Deck | \`artifacts/task-{YYYYMMDD}-{id8}/\` | **唯一权威**：系统分配任务目录；文件如 \`index.html\` |
| HTML 幻灯（非 Nova 美学 PNG 包） | 同上任务目录内 | 勿另起 \`artifacts/slides-*\` 除非用户明确要求独立 deck 包 |
| 历史 legacy | \`artifacts/design/<slug>/\` | **禁止新建**；仅兼容旧对话链接 |

- 任务目录由引擎 / SDM early-bind 分配；Agent **禁止**自造 \`artifacts/design/\` 语义目录。
- 页内文件名可保留通用名（\`index.html\`），**冲突由 task 目录隔离**。

## 交付时

1. \`write_file\` 必须写入当前会话的 \`artifacts/task-*/\`，**禁止**项目根或 \`artifacts/design/\`。
2. 对话与总结里引用**完整相对路径**，禁止只写 \`index.html\`。
3. 若用户要求覆盖旧稿，锚定旧路径后再写，勿串到其他 task 目录。

## 自检

- [ ] 本次所有 HTML/图片是否都在同一 \`artifacts/task-*\` 下？
- [ ] 回复中是否给出了完整路径而非裸文件名？
- [ ] 是否未再创建 \`artifacts/design/\`？
`;
  await fs.writeFile(namingPath, naming, 'utf8');
  console.log('rewrote artifact-naming.md');
  console.log(`done, skill files touched: ${n}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
