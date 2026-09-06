#!/usr/bin/env node
// PD-SAAS-FORK: re-apply Nova skill overlays after vendor rmSync bump
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOverlayEntry, resolveOverlaySlugs } from './manifest.mjs';
import { injectNovaExec } from './novaExecOverlay.mjs';

/** Repo root: scripts/lib/skillVendorOverlays → ../../.. */
export const SKILL_OVERLAY_REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const OVERLAY_ROOT = path.dirname(fileURLToPath(import.meta.url));

const NOVA_BEGIN = '<!-- NOVA-EXEC-BEGIN -->';
const NOVA_END = '<!-- NOVA-EXEC-END -->';
const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;

export function overlaySource(relFromOverlayRoot) {
  return path.join(OVERLAY_ROOT, relFromOverlayRoot);
}

export function skillAbsDir(relSkillDir) {
  return path.join(SKILL_OVERLAY_REPO_ROOT, relSkillDir);
}

function toLf(text) {
  return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function ensureSection(skillPath, marker, sectionBody) {
  const content = readFileSync(skillPath, 'utf8');
  const trimmed = sectionBody.trim();
  if (!content.includes(marker)) {
    writeFileSync(skillPath, `${content.trimEnd()}\n\n${trimmed}\n`, 'utf8');
    return;
  }
  const markerIdx = content.indexOf(marker);
  const afterMarker = content.slice(markerIdx);
  const nextHeading = afterMarker.slice(marker.length).search(/\n## /);
  const endIdx = nextHeading >= 0 ? markerIdx + marker.length + nextHeading : content.length;
  const before = content.slice(0, markerIdx);
  const after = nextHeading >= 0 ? content.slice(endIdx) : '';
  writeFileSync(skillPath, `${before}${trimmed}\n${after}`, 'utf8');
}

function ensureContains(skillPath, needle, appendFrom) {
  const content = readFileSync(skillPath, 'utf8');
  if (content.includes(needle)) return;
  const append = readFileSync(appendFrom, 'utf8').trim();
  writeFileSync(skillPath, `${content.trimEnd()}\n\n${append}\n`, 'utf8');
}

/**
 * Insert or replace a NOVA-EXEC block immediately after YAML frontmatter.
 * Never prepends before `---`. Never silently appends when frontmatter is missing.
 * @param {string} skillPath
 * @param {string} sectionBody
 */
export function injectAfterFrontmatter(skillPath, sectionBody) {
  const raw = readFileSync(skillPath, 'utf8');
  const trimmed = String(sectionBody).trim();
  if (!trimmed.includes(NOVA_BEGIN) || !trimmed.includes(NOVA_END)) {
    throw new Error(`${skillPath}: overlay body must include NOVA-EXEC BEGIN/END markers`);
  }
  const block = `${trimmed}\n`;

  if (raw.includes(NOVA_BEGIN)) {
    const beginIdx = raw.indexOf(NOVA_BEGIN);
    const endIdx = raw.indexOf(NOVA_END, beginIdx);
    if (endIdx < 0) {
      throw new Error(`${skillPath}: ${NOVA_BEGIN} without ${NOVA_END}`);
    }
    const afterEnd = endIdx + NOVA_END.length;
    const rest = raw.slice(afterEnd).replace(/^\r?\n/, '');
    const before = raw.slice(0, beginIdx);
    writeFileSync(skillPath, toLf(`${before}${block}${rest}`), 'utf8');
    return;
  }

  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    throw new Error(`${skillPath}: missing YAML frontmatter; refuse append`);
  }
  const rest = raw.slice(match[0].length).replace(/^\r?\n*/, '');
  const fm = toLf(match[0]);
  writeFileSync(skillPath, toLf(`${fm}\n${block}\n${rest}`), 'utf8');
}

/**
 * @param {{ type: string, from?: string, to?: string, marker?: string, text?: string }} action
 * @param {string} skillDir
 * @param {string} slug
 */
function applyOverlayAction(action, skillDir, slug) {
  switch (action.type) {
    case 'copy': {
      const src = overlaySource(action.from);
      const dest = path.join(skillDir, action.to);
      mkdirSync(path.dirname(dest), { recursive: true });
      copyFileSync(src, dest);
      return;
    }
    case 'ensure_section': {
      ensureSection(
        path.join(skillDir, 'SKILL.md'),
        action.marker,
        readFileSync(overlaySource(action.from), 'utf8'),
      );
      return;
    }
    case 'ensure_contains': {
      ensureContains(
        path.join(skillDir, 'SKILL.md'),
        action.text,
        overlaySource(action.from),
      );
      return;
    }
    case 'nova_exec': {
      injectNovaExec(skillDir, slug);
      return;
    }
    case 'inject_after_frontmatter': {
      injectAfterFrontmatter(
        path.join(skillDir, 'SKILL.md'),
        readFileSync(overlaySource(action.from), 'utf8'),
      );
      return;
    }
    default: {
      const unknown = action.type;
      throw new Error(`unknown overlay action: ${unknown}`);
    }
  }
}

/**
 * @param {string[]} [slugs] — empty = all overlays
 * @returns {{ applied: string[]; skipped: string[]; missing: string[] }}
 */
export function applySkillOverlays(slugs) {
  const resolved = resolveOverlaySlugs(slugs);
  const applied = [];
  const skipped = [];
  const missing = [];

  for (const slug of resolved) {
    const entry = getOverlayEntry(slug);
    if (!entry) {
      skipped.push(slug);
      continue;
    }
    const skillDir = skillAbsDir(entry.skillDir);
    if (!existsSync(skillDir)) {
      missing.push(slug);
      continue;
    }
    for (const action of entry.actions) {
      applyOverlayAction(action, skillDir, slug);
    }
    applied.push(slug);
  }

  return { applied, skipped, missing };
}

function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const result = applySkillOverlays(args.length ? args : undefined);
  console.log(`[apply-skill-overlays] applied=${result.applied.length} missing=${result.missing.length}`);
  if (result.applied.length) console.log(result.applied.join(', '));
  if (result.missing.length) {
    console.warn(`[apply-skill-overlays] missing dirs: ${result.missing.join(', ')}`);
  }
  if (result.missing.length > 0) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
