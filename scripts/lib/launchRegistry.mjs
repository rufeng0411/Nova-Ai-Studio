// PD-SAAS-FORK: Launch Registry — who gets LaunchSheet (creation launcher)
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REGISTRY_PATH = path.join(REPO_ROOT, 'config', 'launch-registry.json');
const SKILLS_ROOT = path.join(REPO_ROOT, 'skills');
const AUDIT_DOC_PATH = path.join(REPO_ROOT, 'docs', 'launch-registry-audit.md');

const HTML_PPT_SEED = {
  launch_mode: 'visual',
  launch_tier: 'theme_deck',
  launch_profile_ref: 'skills/vendor/html-ppt/launch.profile.json',
  replaces_elicitation: true,
  seeded_by: 'vendor:html-ppt',
};

export function loadLaunchRegistry() {
  if (!existsSync(REGISTRY_PATH)) {
    return { version: 1, auto_seed: ['html-ppt'], capabilities: {}, process_templates: {} };
  }
  return JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
}

export function saveLaunchRegistry(registry) {
  writeFileSync(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
}

/** Idempotent: ensure html-ppt registry row after vendor. */
export function ensureLaunchRegistrySeed(slug = 'html-ppt') {
  const registry = loadLaunchRegistry();
  registry.version = registry.version ?? 1;
  registry.auto_seed = Array.isArray(registry.auto_seed) ? registry.auto_seed : ['html-ppt'];
  if (!registry.auto_seed.includes(slug)) registry.auto_seed.push(slug);
  registry.capabilities = registry.capabilities ?? {};
  registry.process_templates = registry.process_templates ?? {};
  registry.capabilities[slug] = { ...HTML_PPT_SEED, ...registry.capabilities[slug], launch_mode: 'visual' };
  saveLaunchRegistry(registry);
  return registry;
}

export function getLaunchEntry(slug) {
  const registry = loadLaunchRegistry();
  return registry.capabilities?.[slug] ?? registry.process_templates?.[slug] ?? null;
}

export function mergeLaunchIntoSkill(skillEntry) {
  const slug = skillEntry.slug;
  const cap = getLaunchEntry(slug);
  const template = loadLaunchRegistry().process_templates?.[slug];
  const entry = cap ?? template;
  if (!entry) {
    return { ...skillEntry, launch_mode: 'skip' };
  }
  return {
    ...skillEntry,
    launch_mode: entry.launch_mode ?? 'skip',
    launch_tier: entry.launch_tier,
    launch_profile_ref: entry.launch_profile_ref,
    launch_replaces_elicitation: Boolean(entry.replaces_elicitation),
  };
}

function discoverSkillDirs(root, acc = []) {
  if (!existsSync(root)) return acc;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(root, entry.name);
    if (existsSync(path.join(full, 'SKILL.md'))) acc.push(full);
    else discoverSkillDirs(full, acc);
  }
  return acc;
}

function auditHeuristic(slug, skillDir) {
  let score = 0;
  const signals = [];
  if (existsSync(path.join(skillDir, 'launch.profile.json'))) {
    score += 3;
    signals.push('launch.profile.json');
  }
  for (const sub of ['presets', 'themes', 'templates/full-decks', 'styles']) {
    if (existsSync(path.join(skillDir, sub))) {
      score += 2;
      signals.push(sub);
    }
  }
  const skillMd = path.join(skillDir, 'SKILL.md');
  if (existsSync(skillMd)) {
    const text = readFileSync(skillMd, 'utf8');
    if (/STYLE_PRESETS|design-systems|theme-showcase|pick a theme/i.test(text)) {
      score += 1;
      signals.push('SKILL visual keywords');
    }
  }
  if (slug.startsWith('od-') && slug !== 'od-mobile-app') {
    score -= 2;
    signals.push('od-* (open-design upstream)');
  }
  if (slug.startsWith('mkt-') || slug.startsWith('edu-')) {
    score -= 2;
  }
  return { score, signals };
}

export function runLaunchCheck() {
  const errors = [];
  const registry = loadLaunchRegistry();
  const caps = registry.capabilities ?? {};
  for (const [slug, entry] of Object.entries(caps)) {
    if (entry.launch_mode === 'skip') continue;
    const ref = entry.launch_profile_ref;
    if (!ref) {
      errors.push(`${slug}: missing launch_profile_ref`);
      continue;
    }
    const abs = path.join(REPO_ROOT, ref.replace(/\//g, path.sep));
    if (!existsSync(abs)) {
      errors.push(`${slug}: profile not found: ${ref}`);
    }
  }
  if (errors.length) {
    console.error('[launch:check] FAILED');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`[launch:check] OK (${Object.keys(caps).length} registry entries)`);
}

export function runLaunchAudit() {
  const registry = loadLaunchRegistry();
  const registered = new Set(Object.keys(registry.capabilities ?? {}));
  const registeredNonSkip = Object.entries(registry.capabilities ?? {})
    .filter(([, v]) => v.launch_mode && v.launch_mode !== 'skip')
    .map(([k]) => k);

  const suggested = [];
  const explicitSkip = [];

  for (const skillDir of discoverSkillDirs(SKILLS_ROOT)) {
    const slug = path.basename(skillDir);
    if (registered.has(slug)) continue;
    const { score, signals } = auditHeuristic(slug, skillDir);
    if (score >= 3) {
      suggested.push({ slug, score, signals });
    } else if (slug.startsWith('mkt-') || slug.startsWith('od-') || slug.startsWith('edu-')) {
      explicitSkip.push(slug);
    }
  }

  suggested.sort((a, b) => b.score - a.score);

  const lines = [
    '# Launch Registry Audit',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## 已注册（non-skip）',
    '',
    ...registeredNonSkip.map((s) => `- \`${s}\``),
    ...(registeredNonSkip.length === 0 ? ['- _(none)_'] : []),
    '',
    '## 建议登记（待产品决议，不自动写入）',
    '',
    ...suggested.slice(0, 25).map((s) => `- \`${s.slug}\` (score ${s.score}: ${s.signals.join(', ')})`),
    ...(suggested.length === 0 ? ['- _(none)_'] : []),
    '',
    '## 明确 skip（抽样）',
    '',
    ...explicitSkip.slice(0, 20).map((s) => `- \`${s}\``),
    '',
  ];

  writeFileSync(AUDIT_DOC_PATH, lines.join('\n'), 'utf8');
  console.log(`[launch:audit] wrote ${AUDIT_DOC_PATH} (suggested=${suggested.length})`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const cmd = process.argv[2];
  if (cmd === 'check') runLaunchCheck();
  else if (cmd === 'audit') runLaunchAudit();
  else if (cmd === 'seed') ensureLaunchRegistrySeed(process.argv[3] || 'html-ppt');
  else {
    console.log('Usage: node launchRegistry.mjs check|audit|seed [slug]');
    process.exit(1);
  }
}
