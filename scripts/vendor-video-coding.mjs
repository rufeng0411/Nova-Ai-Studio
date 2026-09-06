#!/usr/bin/env node
// PD-SAAS-FORK: HyperFrames + Remotion skills vendor (19 upstream HyperFrames skills)
/**
 * Env overrides for offline runs:
 *   HYPERFRAMES_LOCAL_DIR=<path to existing hyperframes clone>
 *   REMOTION_SKILLS_LOCAL_DIR=<path to existing remotion-dev/skills clone>
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { applySkillOverlays } from './lib/skillVendorOverlays/applySkillOverlays.mjs';
import { buildNovaExecBlock, injectNovaExec } from './lib/skillVendorOverlays/novaExecOverlay.mjs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR_ROOT = path.join(REPO_ROOT, 'skills', 'vendor');
export const HYPERFRAMES_CLI_VERSION = '0.7.70';

const HYPERFRAMES_SKILL_MAPPINGS = [
  { sourcePath: 'skills/hyperframes', vendoredSlug: 'hf-hyperframes' },
  { sourcePath: 'skills/hyperframes-core', vendoredSlug: 'hf-hyperframes-core' },
  { sourcePath: 'skills/hyperframes-animation', vendoredSlug: 'hf-hyperframes-animation' },
  { sourcePath: 'skills/hyperframes-keyframes', vendoredSlug: 'hf-hyperframes-keyframes' },
  { sourcePath: 'skills/hyperframes-creative', vendoredSlug: 'hf-hyperframes-creative' },
  { sourcePath: 'skills/hyperframes-cli', vendoredSlug: 'hf-hyperframes-cli' },
  { sourcePath: 'skills/hyperframes-registry', vendoredSlug: 'hf-hyperframes-registry' },
  { sourcePath: 'skills/media-use', vendoredSlug: 'hf-media-use' },
  { sourcePath: 'skills/product-launch-video', vendoredSlug: 'hf-product-launch-video' },
  { sourcePath: 'skills/faceless-explainer', vendoredSlug: 'hf-faceless-explainer' },
  { sourcePath: 'skills/pr-to-video', vendoredSlug: 'hf-pr-to-video' },
  { sourcePath: 'skills/embedded-captions', vendoredSlug: 'hf-embedded-captions' },
  { sourcePath: 'skills/talking-head-recut', vendoredSlug: 'hf-talking-head-recut' },
  { sourcePath: 'skills/motion-graphics', vendoredSlug: 'hf-motion-graphics' },
  { sourcePath: 'skills/music-to-video', vendoredSlug: 'hf-music-to-video' },
  { sourcePath: 'skills/slideshow', vendoredSlug: 'hf-slideshow' },
  { sourcePath: 'skills/general-video', vendoredSlug: 'hf-general-video' },
  { sourcePath: 'skills/remotion-to-hyperframes', vendoredSlug: 'hf-remotion-to-hyperframes' },
  { sourcePath: 'skills/figma', vendoredSlug: 'hf-figma' },
];

const LEGACY_REDIRECT_SLUGS = [
  { vendoredSlug: 'hf-website-to-video', redirectTo: 'hf-product-launch-video' },
  { vendoredSlug: 'hf-gsap', redirectTo: 'hf-hyperframes-animation' },
  { vendoredSlug: 'hf-hyperframes-media', redirectTo: 'hf-media-use' },
];

const SLASH_MAP = [
  ['/hyperframes', 'hf-hyperframes'],
  ['/hyperframes-core', 'hf-hyperframes-core'],
  ['/product-launch-video', 'hf-product-launch-video'],
  ['/motion-graphics', 'hf-motion-graphics'],
  ['/general-video', 'hf-general-video'],
  ['/faceless-explainer', 'hf-faceless-explainer'],
  ['/slideshow', 'hf-slideshow'],
  ['/website-to-video', 'hf-website-to-video'],
];

const SOURCES = [
  {
    source: 'hyperframes',
    repo: 'https://github.com/heygen-com/hyperframes.git',
    localDirEnv: 'HYPERFRAMES_LOCAL_DIR',
    sparsePaths: ['skills'],
    targetDir: 'hyperframes',
    license: 'Apache-2.0',
    skillMappings: HYPERFRAMES_SKILL_MAPPINGS,
  },
  {
    source: 'remotion-skills',
    repo: 'https://github.com/remotion-dev/skills.git',
    localDirEnv: 'REMOTION_SKILLS_LOCAL_DIR',
    targetDir: 'remotion',
    license: 'See upstream repository',
    skillMappings: [
      { sourcePath: 'skills/remotion', vendoredSlug: 'remotion-video' },
      { sourcePath: 'skills/remotion-best-practices', vendoredSlug: 'remotion-best-practices' },
    ],
  },
];

function run(command, args, cwd, env) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
  return (result.stdout || '').trim();
}

function copySkillDir(fromDir, toDir) {
  rmSync(toDir, { recursive: true, force: true });
  mkdirSync(toDir, { recursive: true });
  for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    cpSync(path.join(fromDir, entry.name), path.join(toDir, entry.name), { recursive: true });
  }
}

function writeLegacyRedirect(skillDir, slug, redirectTo) {
  mkdirSync(skillDir, { recursive: true });
  const block = [
    '<!-- NOVA-EXEC-BEGIN -->',
    '## 已迁移',
    '',
    `本能力已迁移至 \`${redirectTo}\`。请 read_skill ${redirectTo} 并按 Nova 约束在 taskArtifactDir/hf-project/ 交付 promo.mp4。`,
    '<!-- NOVA-EXEC-END -->',
    '',
    `# ${slug}（legacy）`,
    '',
    `> 请改用 **${redirectTo}**。`,
    '',
  ].join('\n');
  writeFileSync(path.join(skillDir, 'SKILL.md'), block, 'utf8');
  writeFileSync(path.join(skillDir, 'NOVA-EXEC.md'), block, 'utf8');
}

function resolveCloneDir(sourceConfig) {
  const localDir = process.env[sourceConfig.localDirEnv];
  if (localDir && existsSync(localDir)) {
    const commit = run('git', ['rev-parse', 'HEAD'], localDir);
    return { cloneDir: localDir, commit, cleanup: null };
  }
  const tempBase = path.join(os.tmpdir(), `pilotdeck-vendor-${sourceConfig.source}-${Date.now()}`);
  mkdirSync(tempBase, { recursive: true });
  const cloneDir = path.join(tempBase, 'repo');
  const cloneArgs = ['clone', '--depth', '1'];
  if (sourceConfig.sparsePaths) cloneArgs.push('--filter=blob:none', '--sparse');
  cloneArgs.push(sourceConfig.repo, cloneDir);
  run('git', cloneArgs, REPO_ROOT, { GIT_LFS_SKIP_SMUDGE: '1' });
  if (sourceConfig.sparsePaths) {
    run('git', ['sparse-checkout', 'set', ...sourceConfig.sparsePaths], cloneDir, {
      GIT_LFS_SKIP_SMUDGE: '1',
    });
  }
  const commit = run('git', ['rev-parse', 'HEAD'], cloneDir);
  return { cloneDir, commit, cleanup: () => rmSync(tempBase, { recursive: true, force: true }) };
}

function vendorSource(sourceConfig) {
  const { cloneDir, commit, cleanup } = resolveCloneDir(sourceConfig);
  const outParent = path.join(VENDOR_ROOT, sourceConfig.targetDir);
  mkdirSync(outParent, { recursive: true });

  const copied = [];
  for (const mapping of sourceConfig.skillMappings) {
    const skillDir = path.join(cloneDir, mapping.sourcePath);
    if (!existsSync(path.join(skillDir, 'SKILL.md'))) {
      console.warn(`[vendor-video-coding] skip missing ${mapping.sourcePath}`);
      continue;
    }
    const target = path.join(outParent, mapping.vendoredSlug);
    copySkillDir(skillDir, target);
    injectNovaExec(target, mapping.vendoredSlug);
    copied.push({ sourcePath: mapping.sourcePath, vendoredSlug: mapping.vendoredSlug });
  }

  if (sourceConfig.source === 'hyperframes') {
    for (const legacy of LEGACY_REDIRECT_SLUGS) {
      writeLegacyRedirect(path.join(outParent, legacy.vendoredSlug), legacy.vendoredSlug, legacy.redirectTo);
      copied.push({ sourcePath: '(legacy redirect)', vendoredSlug: legacy.vendoredSlug });
    }
    writeFileSync(
      path.join(outParent, 'NOVA-SLUG-MAP.md'),
      [
        '# HyperFrames slash → Nova slug',
        '',
        '| Slash | Nova slug |',
        '|---|---|',
        ...SLASH_MAP.map(([slash, slug]) => `| ${slash} | ${slug} |`),
        '',
      ].join('\n'),
      'utf8',
    );
  }

  writeFileSync(
    path.join(outParent, `ATTRIBUTION-${sourceConfig.source}.md`),
    [
      `# ${sourceConfig.source}`,
      '',
      `- Repository: ${sourceConfig.repo}`,
      `- Commit: ${commit}`,
      `- License: ${sourceConfig.license}`,
      sourceConfig.source === 'hyperframes' ? `- hyperframes CLI: ${HYPERFRAMES_CLI_VERSION}` : '',
      '',
      '| Source path | Slug |',
      '|---|---|',
      ...copied.map((c) => `| ${c.sourcePath} | ${c.vendoredSlug} |`),
      '',
    ].join('\n'),
    'utf8',
  );

  cleanup?.();
  return { source: sourceConfig.source, repo: sourceConfig.repo, commit, count: copied.length, copied };
}

function main() {
  mkdirSync(VENDOR_ROOT, { recursive: true });
  const reports = [];
  for (const source of SOURCES) {
    console.log(`[vendor-video-coding] vendoring ${source.source}...`);
    reports.push(vendorSource(source));
  }
  const summary = {
    generatedAt: new Date().toISOString(),
    hyperframesCliVersion: HYPERFRAMES_CLI_VERSION,
    totalSkills: reports.reduce((sum, r) => sum + r.count, 0),
    sources: reports,
  };
  const summaryPath = path.join(VENDOR_ROOT, 'video-coding-manifest.json');
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  const overlay = applySkillOverlays(['hf-*']);
  if (overlay.missing.length) {
    console.warn(`[vendor-video-coding] overlay missing: ${overlay.missing.join(', ')}`);
  }
  console.log(`[vendor-video-coding] done skills=${summary.totalSkills} manifest=${summaryPath}`);
}

main();
