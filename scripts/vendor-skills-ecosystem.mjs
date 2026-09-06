#!/usr/bin/env node
/**
 * Vendor third-party agent skills into skills/vendor/* ecosystem packs.
 * PD-SAAS-FORK: Nova SaaS skills ecosystem batch vendor script.
 * @see npm run vendor:skills-ecosystem
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR_ROOT = path.join(REPO_ROOT, 'skills', 'vendor');
const LOG = '[vendor-skills-ecosystem]';

function run(command, args, cwd, env) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    const msg = (result.stderr || result.stdout || '').trim();
    throw new Error(`${command} ${args.join(' ')} failed: ${msg}`);
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

function resolveSkillDir(cloneDir, sourcePath) {
  const direct = path.join(cloneDir, sourcePath);
  if (existsSync(path.join(direct, 'SKILL.md'))) return direct;
  if (sourcePath === '.') {
    const dirs = findSkillDirs(cloneDir);
    if (dirs.length === 1) return dirs[0];
  }
  return null;
}

function slugifySegment(name) {
  return name
    .replace(/\.skill$/i, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function findSkillDirs(rootDir, skipDirNames = ['.git', 'node_modules']) {
  const found = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const hasSkill = existsSync(path.join(dir, 'SKILL.md'));
    let childSkill = false;
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      if (skipDirNames.includes(ent.name)) continue;
      walk(path.join(dir, ent.name));
      if (found.some((f) => f.startsWith(path.join(dir, ent.name)))) childSkill = true;
    }
    if (hasSkill && !childSkill) found.push(dir);
  }
  walk(rootDir);
  return found;
}

function cloneRepo(repo, ref = 'main', sparsePaths) {
  const tempBase = path.join(os.tmpdir(), `pilotdeck-vendor-eco-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(tempBase, { recursive: true });
  const cloneDir = path.join(tempBase, 'repo');
  const cloneArgs = ['clone', '--depth', '1'];
  if (ref) cloneArgs.push('--branch', ref);
  if (sparsePaths?.length) cloneArgs.push('--filter=blob:none', '--sparse');
  cloneArgs.push(repo, cloneDir);
  run('git', cloneArgs, REPO_ROOT, { GIT_LFS_SKIP_SMUDGE: '1' });
  if (sparsePaths?.length) {
    run('git', ['sparse-checkout', 'set', ...sparsePaths], cloneDir, { GIT_LFS_SKIP_SMUDGE: '1' });
  }
  const commit = run('git', ['rev-parse', 'HEAD'], cloneDir);
  return { cloneDir, commit, cleanup: () => rmSync(tempBase, { recursive: true, force: true }) };
}

function writePackAttribution(packDir, packName, sections) {
  writeFileSync(path.join(packDir, 'ATTRIBUTION.md'), [`# ${packName}`, '', ...sections, ''].join('\n'), 'utf8');
}

function appendAttributionSection(packDir, packName, sectionLines) {
  const attrPath = path.join(packDir, 'ATTRIBUTION.md');
  if (!existsSync(attrPath)) {
    writePackAttribution(packDir, packName, sectionLines);
    return;
  }
  writeFileSync(attrPath, `${readFileSync(attrPath, 'utf8').trimEnd()}\n\n${sectionLines.join('\n')}\n`, 'utf8');
}

function vendorMappings(opts) {
  const { pack, packTitle, targetDir, repo, ref = 'main', mappings, needsConfig = false, sparsePaths } = opts;
  const packDir = path.join(VENDOR_ROOT, targetDir);
  mkdirSync(packDir, { recursive: true });
  const { cloneDir, commit, cleanup } = cloneRepo(repo, ref, sparsePaths);
  const copied = [];
  const failures = [];
  for (const mapping of mappings) {
    const skillDir = resolveSkillDir(cloneDir, mapping.sourcePath);
    if (!skillDir) {
      failures.push({ vendoredSlug: mapping.vendoredSlug, reason: `SKILL.md missing at ${mapping.sourcePath}` });
      console.warn(`${LOG} skip missing ${mapping.sourcePath} -> ${mapping.vendoredSlug}`);
      continue;
    }
    copySkillDir(skillDir, path.join(packDir, mapping.vendoredSlug));
    copied.push({ ...mapping, commit, needsConfig });
  }
  appendAttributionSection(packDir, packTitle || pack, [
    `## ${pack}`,
    '',
    `- Repository: ${repo}`,
    `- Ref: ${ref}`,
    `- Commit: ${commit}`,
    ...(needsConfig ? ['- **needs_config**: API keys or external services may be required.'] : []),
    '',
    '| Source path | Slug |',
    '|---|---|',
    ...copied.map((c) => `| ${c.sourcePath} | ${c.vendoredSlug} |`),
  ]);
  cleanup();
  return { pack, copied, failures };
}

function vendorDiscover(opts) {
  const { pack, packTitle, targetDir, repo, ref = 'main', searchRoot = '.', slugPrefix, slugFn, needsConfig = false, sparsePaths } = opts;
  const packDir = path.join(VENDOR_ROOT, targetDir);
  mkdirSync(packDir, { recursive: true });
  const { cloneDir, commit, cleanup } = cloneRepo(repo, ref, sparsePaths);
  const root = path.join(cloneDir, searchRoot);
  const skillDirs = findSkillDirs(root);
  const copied = [];
  const failures = [];
  const usedSlugs = new Set();
  for (const skillDir of skillDirs) {
    const folderName = path.basename(skillDir);
    let vendoredSlug = slugFn ? slugFn(skillDir, folderName) : `${slugPrefix}${slugifySegment(folderName)}`;
    if (!vendoredSlug) continue;
    if (usedSlugs.has(vendoredSlug)) {
      const rel = path.relative(cloneDir, skillDir).replace(/\\/g, '/');
      vendoredSlug = `${slugPrefix}${slugifySegment(rel.replace(/\//g, '-'))}`;
    }
    usedSlugs.add(vendoredSlug);
    try {
      copySkillDir(skillDir, path.join(packDir, vendoredSlug));
      copied.push({ sourcePath: path.relative(cloneDir, skillDir).replace(/\\/g, '/'), vendoredSlug, commit, needsConfig });
    } catch (e) {
      failures.push({ vendoredSlug, reason: String(e.message || e) });
    }
  }
  appendAttributionSection(packDir, packTitle || pack, [
    `## ${pack}`,
    '',
    `- Repository: ${repo}`,
    `- Ref: ${ref}`,
    `- Commit: ${commit}`,
    ...(needsConfig ? ['- **needs_config**: API keys or external services may be required.'] : []),
    '',
    '| Source path | Slug |',
    '|---|---|',
    ...copied.map((c) => `| ${c.sourcePath} | ${c.vendoredSlug} |`),
  ]);
  cleanup();
  return { pack, copied, failures };
}

function createStubSkill(packDir, vendoredSlug, title, bodyLines) {
  mkdirSync(packDir, { recursive: true });
  const skillDir = path.join(packDir, vendoredSlug);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    [
      '---',
      `name: ${vendoredSlug}`,
      `description: ${title} (vendored stub — configure API credentials before use).`,
      '---',
      '',
      `# ${title}`,
      '',
      ...bodyLines,
      '',
      '> **needs_config**: Replace this stub with the official skill when upstream is available.',
      '',
    ].join('\n'),
    'utf8',
  );
  return { sourcePath: '(stub)', vendoredSlug, commit: 'stub', needsConfig: true };
}

function tryVendor(taskFn, label) {
  try {
    return taskFn();
  } catch (e) {
    console.error(`${LOG} FAILED ${label}: ${e.message || e}`);
    return { pack: label, copied: [], failures: [{ vendoredSlug: label, reason: String(e.message || e) }] };
  }
}

function main() {
  mkdirSync(VENDOR_ROOT, { recursive: true });
  const allCopied = [];
  const allFailures = [];
  const record = (result) => {
    for (const c of result.copied) allCopied.push({ ...c, pack: result.pack });
    for (const f of result.failures || []) allFailures.push({ ...f, pack: result.pack });
  };

  record(tryVendor(() => vendorMappings({
    pack: 'anthropics-skills', packTitle: 'Anthropics official skills', targetDir: 'anthropics-skills',
    repo: 'https://github.com/anthropics/skills.git',
    mappings: [
      { sourcePath: 'skills/pptx', vendoredSlug: 'anth-pptx' },
      { sourcePath: 'skills/xlsx', vendoredSlug: 'anth-xlsx' },
      { sourcePath: 'skills/mcp-builder', vendoredSlug: 'anth-mcp-builder' },
      { sourcePath: 'skills/canvas-design', vendoredSlug: 'anth-canvas-design' },
    ],
  }), 'anthropics-skills'));

  record(tryVendor(() => vendorMappings({
    pack: 'writing-polish-humanizer', packTitle: 'Writing polish', targetDir: 'writing-polish',
    repo: 'https://github.com/blader/humanizer.git', mappings: [{ sourcePath: '.', vendoredSlug: 'humanizer' }],
  }), 'writing-polish-humanizer'));

  record(tryVendor(() => vendorMappings({
    pack: 'writing-polish-unslop', packTitle: 'Writing polish', targetDir: 'writing-polish',
    repo: 'https://github.com/MohamedAbdallah-14/unslop.git', mappings: [{ sourcePath: 'skills/unslop', vendoredSlug: 'unslop' }],
  }), 'writing-polish-unslop'));

  record(tryVendor(() => vendorDiscover({
    pack: 'pm-skills-phuryn', packTitle: 'Product management skills', targetDir: 'pm-skills',
    repo: 'https://github.com/phuryn/pm-skills.git', slugPrefix: 'pms-',
  }), 'pm-skills-phuryn'));

  record(tryVendor(() => vendorDiscover({
    pack: 'pm-methodology-deanpeters', packTitle: 'Product management skills', targetDir: 'pm-skills',
    repo: 'https://github.com/deanpeters/Product-Manager-Skills.git', slugPrefix: 'pmd-',
  }), 'pm-methodology'));

  for (const entry of [
    { repo: 'https://github.com/AgriciDaniel/claude-seo.git', mappings: [{ sourcePath: 'skills/seo', vendoredSlug: 'mkt-claude-seo' }] },
    { repo: 'https://github.com/mvanhorn/last30days-skill.git', mappings: [{ sourcePath: 'skills/last30days', vendoredSlug: 'mkt-last30days' }] },
    { repo: 'https://github.com/wshuyi/x-article-publisher-skill.git', mappings: [{ sourcePath: 'skills/x-article-publisher', vendoredSlug: 'mkt-x-article-publisher' }] },
    { repo: 'https://github.com/CosmoBlk/email-marketing-bible.git', mappings: [{ sourcePath: '.', vendoredSlug: 'mkt-email-bible' }] },
  ]) {
    const slug = entry.mappings[0].vendoredSlug;
    record(tryVendor(() => vendorMappings({
      pack: slug, packTitle: 'Marketing ecosystem', targetDir: 'marketing-ecosystem', repo: entry.repo, mappings: entry.mappings,
    }), slug));
  }

  record(tryVendor(() => vendorDiscover({
    pack: 'digital-marketing-pro', packTitle: 'Marketing ecosystem', targetDir: 'marketing-ecosystem',
    repo: 'https://github.com/indranilbanerjee/digital-marketing-pro.git', slugPrefix: 'mkt-dmp-',
  }), 'digital-marketing-pro'));

  record(tryVendor(() => vendorDiscover({
    pack: 'advertising-skills', packTitle: 'Marketing ecosystem', targetDir: 'marketing-ecosystem',
    repo: 'https://github.com/realkimbarrett/advertising-skills.git', slugPrefix: 'mkt-adv-',
  }), 'advertising-skills'));

  record(tryVendor(() => vendorDiscover({
    pack: 'aso-skills', packTitle: 'Marketing ecosystem', targetDir: 'marketing-ecosystem',
    repo: 'https://github.com/Eronred/aso-skills.git', slugPrefix: 'mkt-aso-',
  }), 'aso-skills'));

  record(tryVendor(() => vendorDiscover({
    pack: 'brand-build-skills', packTitle: 'Marketing ecosystem', targetDir: 'marketing-ecosystem',
    repo: 'https://github.com/rampstackco/claude-skills.git', slugPrefix: 'mkt-brand-',
    slugFn: (skillDir, folderName) => {
      const normalized = skillDir.replace(/\\/g, '/');
      // Skip nested skills/skills/* mirror tree (would become mkt-brand-skills-* duplicates).
      if (/\/skills\/skills(\/|$)/i.test(normalized)) return null;
      if (folderName === 'skills') return null;
      return `mkt-brand-${slugifySegment(folderName)}`;
    },
  }), 'brand-build-skills'));

  const screenshotsResult = tryVendor(() => vendorMappings({
    pack: 'mkt-screenshots', packTitle: 'Marketing ecosystem', targetDir: 'marketing-ecosystem',
    repo: 'https://github.com/Shpigford/skills.git', mappings: [{ sourcePath: 'screenshots', vendoredSlug: 'mkt-screenshots' }],
  }), 'mkt-screenshots');
  if (screenshotsResult.copied.length === 0) {
    const mktPack = path.join(VENDOR_ROOT, 'marketing-ecosystem');
    screenshotsResult.copied.push(createStubSkill(mktPack, 'mkt-screenshots', 'Marketing screenshots', [
      'Upstream Shpigford/skills repo is unavailable; stub for catalog taxonomy.',
      'Install Playwright locally for screenshot automation when upstream is restored.',
    ]));
  }
  record(screenshotsResult);

  record(tryVendor(() => vendorDiscover({
    pack: 'ui-skills', packTitle: 'Creation ecosystem', targetDir: 'creation-ecosystem',
    repo: 'https://github.com/ibelick/ui-skills.git', searchRoot: 'skills', slugPrefix: 'create-ui-',
  }), 'create-ui-skills'));

  record(tryVendor(() => vendorDiscover({
    pack: 'threejs-skills', packTitle: 'Creation ecosystem', targetDir: 'creation-ecosystem',
    repo: 'https://github.com/CloudAI-X/threejs-skills.git', searchRoot: 'skills', slugPrefix: 'create-threejs-',
  }), 'create-threejs'));

  for (const m of [
    { repo: 'https://github.com/meodai/skill.color-expert.git', vendoredSlug: 'create-color-expert' },
    // taste-skill 全量见 npm run vendor:taste-skill-full
    { repo: 'https://github.com/op7418/Youtube-clipper-skill.git', vendoredSlug: 'create-youtube-clipper' },
    { repo: 'https://github.com/smerchek/claude-epub-skill.git', vendoredSlug: 'office-epub', sourcePath: 'markdown-to-epub' },
  ]) {
    record(tryVendor(() => vendorMappings({
      pack: m.vendoredSlug, packTitle: 'Creation ecosystem', targetDir: 'creation-ecosystem', repo: m.repo,
      mappings: [{ sourcePath: m.sourcePath || '.', vendoredSlug: m.vendoredSlug }],
    }), m.vendoredSlug));
  }

  record(tryVendor(() => vendorMappings({
    pack: 'dev-playwright', packTitle: 'Developer ecosystem', targetDir: 'dev-ecosystem',
    repo: 'https://github.com/testdino-hq/playwright-skill.git', mappings: [{ sourcePath: '.', vendoredSlug: 'dev-playwright' }],
  }), 'dev-playwright'));

  record(tryVendor(() => vendorDiscover({
    pack: 'hamelsmu-evals', packTitle: 'Developer ecosystem', targetDir: 'dev-ecosystem',
    repo: 'https://github.com/hamelsmu/prompts.git', slugPrefix: 'dev-hamel-',
  }), 'hamelsmu-evals'));

  for (const m of [
    { vendoredSlug: 'office-minimax-docx', sourcePath: 'skills/docx-generator' },
    { vendoredSlug: 'office-minimax-xlsx', sourcePath: 'skills/xlsx-generator' },
    { vendoredSlug: 'office-minimax-pptx', sourcePath: 'skills/pptx-generator' },
  ]) {
    record(tryVendor(() => vendorMappings({
      pack: m.vendoredSlug, packTitle: 'Office ecosystem', targetDir: 'office-ecosystem',
      repo: 'https://github.com/MiniMax-AI/agent-skills.git', mappings: [{ sourcePath: m.sourcePath, vendoredSlug: m.vendoredSlug }],
    }), m.vendoredSlug));
  }

  record(tryVendor(() => vendorMappings({
    pack: 'dev-next-best-practices', packTitle: 'Developer ecosystem', targetDir: 'dev-ecosystem',
    repo: 'https://github.com/vercel-labs/agent-skills.git',
    mappings: [{ sourcePath: 'skills/react-best-practices', vendoredSlug: 'dev-next-best-practices' }],
  }), 'dev-next-best-practices'));

  record(tryVendor(() => vendorMappings({
    pack: 'brainstorm-structured', packTitle: 'Developer ecosystem', targetDir: 'dev-ecosystem',
    repo: 'https://github.com/obra/superpowers.git',
    mappings: [{ sourcePath: 'skills/brainstorming', vendoredSlug: 'brainstorm-structured' }],
  }), 'brainstorm-structured'));

  record(tryVendor(() => vendorMappings({
    pack: 'edu-recursive-research', packTitle: 'Education ecosystem', targetDir: 'education-ecosystem',
    repo: 'https://github.com/Anjos2/recursive-research.git', mappings: [{ sourcePath: 'plugins/recursive-research/skills/recursive-research', vendoredSlug: 'edu-recursive-research' }],
  }), 'edu-recursive-research'));

  record(tryVendor(() => vendorMappings({
    pack: 'edu-tutor-skills', packTitle: 'Education ecosystem', targetDir: 'education-ecosystem',
    repo: 'https://github.com/RoundTable02/tutor-skills.git', mappings: [{ sourcePath: 'skills/tutor', vendoredSlug: 'edu-tutor-skills' }],
  }), 'edu-tutor-skills'));

  record(tryVendor(() => vendorDiscover({
    pack: 'claude-scientific-skills', packTitle: 'Education ecosystem', targetDir: 'education-ecosystem',
    repo: 'https://github.com/K-Dense-AI/claude-scientific-skills.git', slugPrefix: 'edu-sci-',
  }), 'claude-scientific-skills'));

  record(tryVendor(() => vendorMappings({
    pack: 'office-ecom', packTitle: 'Office ecosystem', targetDir: 'office-ecosystem',
    repo: 'https://github.com/takechanman1228/claude-ecom.git', mappings: [{ sourcePath: 'skills/ecom', vendoredSlug: 'office-ecom' }],
  }), 'office-ecom'));

  for (const b of [
    { slug: 'create-nanobanana-ppt', repo: 'https://github.com/op7418/NanoBanana-PPT-Skills.git', targetDir: 'creation-ecosystem', packTitle: 'Creation ecosystem' },
    { slug: 'create-ai-music', repo: 'https://github.com/bitwize-music-studio/claude-ai-music-skills.git', targetDir: 'creation-ecosystem', packTitle: 'Creation ecosystem', sourcePath: 'skills/session-start' },
    { slug: 'create-wonda', repo: 'https://github.com/degausai/wonda.git', targetDir: 'creation-ecosystem', packTitle: 'Creation ecosystem', sourcePath: 'skills/wonda-cli' },
    { slug: 'office-nutrient', repo: 'https://github.com/PSPDFKit-labs/nutrient-agent-skill.git', targetDir: 'office-ecosystem', packTitle: 'Office ecosystem', sourcePath: 'nutrient-document-processing' },
  ]) {
    record(tryVendor(() => vendorMappings({
      pack: b.slug, packTitle: b.packTitle, targetDir: b.targetDir, repo: b.repo,
      mappings: [{ sourcePath: b.sourcePath || '.', vendoredSlug: b.slug }], needsConfig: true,
    }), b.slug));
  }

  record(tryVendor(() => vendorDiscover({
    pack: 'video-db', packTitle: 'Creation ecosystem', targetDir: 'creation-ecosystem',
    repo: 'https://github.com/video-db/skills.git', slugPrefix: 'video-db-', needsConfig: true,
  }), 'video-db'));

  const mktPack = path.join(VENDOR_ROOT, 'marketing-ecosystem');
  const typefullyResult = tryVendor(() => vendorDiscover({
    pack: 'typefully', packTitle: 'Marketing ecosystem', targetDir: 'marketing-ecosystem',
    repo: 'https://github.com/typefully/agent-skills.git', slugPrefix: 'mkt-typefully-', needsConfig: true,
  }), 'typefully');
  if (typefullyResult.copied.length === 0) {
    typefullyResult.copied.push(createStubSkill(mktPack, 'mkt-typefully', 'Typefully publishing', [
      'Upstream typefully/agent-skills could not be vendored automatically.',
      'Configure a Typefully API key before use.',
    ]));
    appendAttributionSection(mktPack, 'Marketing ecosystem', [
      '## typefully (stub)', '', '- Repository: https://github.com/typefully/agent-skills.git',
      '- **needs_config**: Typefully API key required.', '', '| Source path | Slug |', '|---|---|', '| (stub) | mkt-typefully |',
    ]);
  }
  record(typefullyResult);

  record(tryVendor(() => vendorDiscover({
    pack: 'fal-ai', packTitle: 'Creation ecosystem', targetDir: 'creation-ecosystem',
    repo: 'https://github.com/fal-ai-community/skills.git', slugPrefix: 'fal-', needsConfig: true,
    slugFn: (_skillDir, folderName) => {
      const base = folderName.startsWith('fal-') ? folderName.slice(4) : folderName;
      if (!base || base === 'skills') return null;
      return `fal-${slugifySegment(base)}`;
    },
  }), 'fal-ai'));

  record(tryVendor(() => {
    const packDir = path.join(VENDOR_ROOT, 'dev-ecosystem');
    mkdirSync(packDir, { recursive: true });
    const { cloneDir, commit, cleanup } = cloneRepo('https://github.com/getsentry/skills.git');
    let candidates = findSkillDirs(cloneDir).filter((d) => /sentry-sdk-setup/i.test(d));
    if (!candidates.length) {
      candidates = findSkillDirs(cloneDir).filter((d) => /sdk/i.test(path.basename(d)) && /sentry/i.test(d));
    }
    if (!candidates.length) {
      cleanup();
      const packDir = path.join(VENDOR_ROOT, 'dev-ecosystem');
      mkdirSync(packDir, { recursive: true });
      const vendoredSlug = 'dev-sentry-sdk-setup';
      createStubSkill(packDir, vendoredSlug, 'Sentry SDK setup', [
        'Upstream getsentry/skills layout changed; stub retained for needs_config wiring.',
        'Configure Sentry DSN or org token in Settings → Skill services.',
      ]);
      appendAttributionSection(packDir, 'Developer ecosystem', [
        '## sentry (stub)', '', '- Repository: https://github.com/getsentry/skills.git',
        '- **needs_config**: Sentry DSN / org tokens may be required.', '', '| Source path | Slug |', '|---|---|', '| (stub) | dev-sentry-sdk-setup |',
      ]);
      return { pack: 'sentry', copied: [{ sourcePath: '(stub)', vendoredSlug, commit: 'stub', needsConfig: true }], failures: [] };
    }
    const skillDir = candidates[0];
    const vendoredSlug = 'dev-sentry-sdk-setup';
    copySkillDir(skillDir, path.join(packDir, vendoredSlug));
    appendAttributionSection(packDir, 'Developer ecosystem', [
      '## sentry', '', '- Repository: https://github.com/getsentry/skills.git', `- Commit: ${commit}`,
      '- **needs_config**: Sentry DSN / org tokens may be required.', '', '| Source path | Slug |', '|---|---|',
      `| ${path.relative(cloneDir, skillDir).replace(/\\/g, '/')} | ${vendoredSlug} |`,
    ]);
    cleanup();
    return { pack: 'sentry', copied: [{ sourcePath: path.relative(cloneDir, skillDir), vendoredSlug, commit, needsConfig: true }], failures: [] };
  }, 'sentry'));

  const manifest = {
    generatedAt: new Date().toISOString(),
    totalSkills: allCopied.length,
    totalFailures: allFailures.length,
    skills: allCopied.map(({ vendoredSlug, sourcePath, pack, needsConfig, commit }) => ({
      vendoredSlug, sourcePath, pack, needsConfig: Boolean(needsConfig), commit,
    })),
    failures: allFailures,
    packPaths: ['anthropics-skills', 'writing-polish', 'pm-skills', 'marketing-ecosystem', 'creation-ecosystem', 'dev-ecosystem', 'education-ecosystem', 'office-ecosystem']
      .map((p) => path.join('skills', 'vendor', p)),
  };
  const manifestPath = path.join(VENDOR_ROOT, 'skills-ecosystem-manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`${LOG} done skills=${manifest.totalSkills} failures=${manifest.totalFailures} manifest=${manifestPath}`);
  if (allFailures.length) for (const f of allFailures) console.log(`${LOG} FAIL ${f.vendoredSlug}: ${f.reason}`);
  console.log(`${LOG} slugs: ${allCopied.map((s) => s.vendoredSlug).sort().join(', ')}`);
}

main();