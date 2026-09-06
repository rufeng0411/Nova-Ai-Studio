#!/usr/bin/env node
// PD-SAAS-FORK: inject NOVA-EXEC into local hyperframes skills (offline fallback when vendor git fails)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HF_ROOT = path.join(REPO_ROOT, 'skills', 'vendor', 'hyperframes');

const STUB_SLUGS = [
  'hf-hyperframes-core',
  'hf-hyperframes-animation',
  'hf-hyperframes-keyframes',
  'hf-hyperframes-creative',
  'hf-hyperframes-registry',
  'hf-media-use',
  'hf-product-launch-video',
  'hf-faceless-explainer',
  'hf-pr-to-video',
  'hf-embedded-captions',
  'hf-talking-head-recut',
  'hf-motion-graphics',
  'hf-music-to-video',
  'hf-slideshow',
  'hf-general-video',
  'hf-remotion-to-hyperframes',
  'hf-figma',
];

function buildNovaExecBlock(slug, isSlideshow) {
  return [
    '<!-- NOVA-EXEC-BEGIN -->',
    '## Nova 执行约束（必读）',
    '',
    `- 用 \`read_skill ${slug}\` 加载本技能；禁止依赖 slash 命令或 \`npx hyperframes skills update\`。`,
    '- HyperFrames 工程目录必须写在当前会话 **taskArtifactDir/hf-project/**（禁止仓库根或工作区根 init）。',
    isSlideshow
      ? '- 本技能为幻灯/HTML 工程：交付 deck HTML 或 slide 清单；**不要求** promo.mp4。'
      : '- 成片必须调用 Gateway 工具 **render_hyperframes**，输出 **promo.mp4**（或 manifest pathHints 指定 basename）。',
    '- 禁止 ask_user_question 偏好问卷挡交付；TTS 默认跳过或使用 Kokoro；缺 HeyGen/ElevenLabs 不阻断 mp4。',
    '- HyperFrames Studio URL 仅过程链接，**不得**作为终态交付；禁止仅交 md/分镜充数。',
    '- 官网/产品图须先 VAP/fetch 本地化进 task 目录；composition HTML **禁止渲染期外链**。',
    '<!-- NOVA-EXEC-END -->',
    '',
  ].join('\n');
}

function injectSkillDir(dir, slug) {
  const skillPath = path.join(dir, 'SKILL.md');
  if (!existsSync(skillPath)) {
    writeFileSync(skillPath, `# ${slug}\n\nVendored HyperFrames workflow (stub until upstream vendor refresh).\n`, 'utf8');
  }
  const isSlideshow = slug === 'hf-slideshow';
  const block = buildNovaExecBlock(slug, isSlideshow);
  writeFileSync(path.join(dir, 'NOVA-EXEC.md'), block, 'utf8');
  let content = readFileSync(skillPath, 'utf8');
  content = content.replace(/<!-- NOVA-EXEC-BEGIN -->[\s\S]*?<!-- NOVA-EXEC-END -->\n?/g, '');
  writeFileSync(skillPath, `${block}${content}`, 'utf8');
}

const LEGACY = [
  { slug: 'hf-website-to-video', redirect: 'hf-product-launch-video' },
  { slug: 'hf-gsap', redirect: 'hf-hyperframes-animation' },
  { slug: 'hf-hyperframes-media', redirect: 'hf-media-use' },
];

for (const entry of LEGACY) {
  const dir = path.join(HF_ROOT, entry.slug);
  mkdirSync(dir, { recursive: true });
  const block = buildNovaExecBlock(entry.slug, false);
  const legacy = [
    block,
    `# ${entry.slug}（legacy）`,
    '',
    `> 已迁移至 **${entry.redirect}**。`,
    '',
  ].join('\n');
  writeFileSync(path.join(dir, 'SKILL.md'), legacy, 'utf8');
  writeFileSync(path.join(dir, 'NOVA-EXEC.md'), block, 'utf8');
}

for (const slug of STUB_SLUGS) {
  const dir = path.join(HF_ROOT, slug);
  mkdirSync(dir, { recursive: true });
  injectSkillDir(dir, slug);
}

for (const slug of ['hf-hyperframes', 'hf-hyperframes-cli']) {
  const dir = path.join(HF_ROOT, slug);
  if (existsSync(dir)) injectSkillDir(dir, slug);
}

console.log(`[inject-hyperframes-nova-exec] updated ${STUB_SLUGS.length + LEGACY.length + 2} skill dirs under ${HF_ROOT}`);
