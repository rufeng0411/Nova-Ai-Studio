// Shared deliverable path expansion for UI server + client.
// Agents often cite shortened paths; real files live under artifacts/.

import {
  isRepairEligiblePath,
  isRepairPlaceholderDeliverablePath,
} from './repairEligiblePath.mjs';

export { isRepairEligiblePath, isRepairPlaceholderDeliverablePath } from './repairEligiblePath.mjs';

export const ARTIFACT_DELIVERABLE_PREFIXES = [
  '',
  'artifacts/social-matrix/',
  'artifacts/geo/',
  'artifacts/design/',
  'artifacts/creative/',
  'artifacts/',
];

export function normalizeRelativeDeliverablePath(raw) {
  return String(raw || '')
    .replace(/\\/g, '/')
    .trim()
    .replace(/^\/+/, '');
}

/**
 * Strip tenant DATA_ROOT fragments mistakenly cited as deliverable paths
 * (e.g. `data/saas/tenants/default/foo.md` or `artifacts/geo/data/saas/...`).
 */
export function stripLeakedStoragePath(normalized) {
  let s = normalizeRelativeDeliverablePath(normalized);
  if (!s) return s;

  const geoTenantLeak = s.match(/^artifacts\/geo\/(?:data\/)?saas\/tenants\/[^/]+\/(.+)$/i);
  if (geoTenantLeak) {
    s = geoTenantLeak[1];
  }

  const tenantLeak = s.match(/^(?:data\/)?saas\/tenants\/[^/]+\/(.+)$/i);
  if (tenantLeak) {
    s = tenantLeak[1];
  }

  const tenantIdx = s.toLowerCase().indexOf('saas/tenants/');
  if (tenantIdx > 0) {
    const afterTenant = s.slice(tenantIdx + 'saas/tenants/'.length);
    const slash = afterTenant.indexOf('/');
    if (slash >= 0 && slash < afterTenant.length - 1) {
      s = afterTenant.slice(slash + 1);
    }
  }

  return s;
}

function maybeDecodePercentEncodedPath(value) {
  const s = String(value || '');
  if (!/%[0-9A-Fa-f]{2}/.test(s)) {
    return s;
  }
  try {
    const decoded = decodeURIComponent(s);
    return decoded !== s ? decoded : s;
  } catch {
    return s;
  }
}

/** Strip markdown table/list prefixes like `[6] file.md` → `file.md`. */
export function sanitizeDeliverableLookupPath(raw) {
  let s = maybeDecodePercentEncodedPath(normalizeRelativeDeliverablePath(raw));
  s = s.replace(/^\[\d+\]\s*/, '');
  // Markdown link labels leak `[` when `[artifacts/foo.md](artifacts/foo.md)` is regex-captured as label text.
  if (s.startsWith('[') && s.includes('/')) {
    const closed = /^\[(.+)\]$/.exec(s);
    s = closed ? closed[1] : s.slice(1);
  }
  s = s.replace(/^\(\d+\)\s*/, '');
  s = s.replace(/^\d+\s+/, '');
  // PD-SAAS-FORK: strip leading emoji / icon prefixes (e.g. 📄 报告文件路径：file.md)
  s = s.replace(/^[\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F]+\s*/u, '');
  // PD-SAAS-FORK: strip leaked markdown path labels (`路径：**`file.md`, `报告文件路径：file.md`)
  s = s.replace(/^(?:报告)?文件路径[:：]\s*/i, '');
  s = s.replace(/^路径[:：]\s*/i, '');
  s = s.replace(/^\*+/, '').replace(/\*+$/g, '');
  s = s.replace(/^`+/, '').replace(/`+$/g, '');
  // PD-SAAS-FORK: prose punctuation after a real file extension is not part of the path.
  s = s.replace(/(\.[a-z0-9]{1,10})[\s),.;:!?，。；：！？、）】》〉"'’”]+$/iu, '$1');
  s = s.replace(/\/\.\//g, '/').replace(/\/+/g, '/');
  s = stripLeakedStoragePath(s);
  return s.trim();
}

/** Compare disk filename to user-facing name (handles `06-foo.md` vs `foo.md`). */
export function deliverableBasenamesMatch(diskName, wantedName) {
  const disk = String(diskName || '').toLowerCase();
  const wanted = String(wantedName || '').toLowerCase();
  if (!disk || !wanted) return false;
  if (disk === wanted) return true;
  const stripNumberPrefix = (name) => name.replace(/^\d+[a-z]?-/i, '');
  if (stripNumberPrefix(disk) === stripNumberPrefix(wanted)) return true;
  if (disk.endsWith(wanted) && wanted.length >= 8) return true;
  return false;
}

/** True when project-relative path ends with the lookup suffix (e.g. drafts/03a-….md). */
export function deliverableRelativePathMatches(relativePath, lookupPath) {
  const rel = sanitizeDeliverableLookupPath(relativePath).toLowerCase();
  const lookup = sanitizeDeliverableLookupPath(lookupPath).toLowerCase();
  if (!rel || !lookup) return false;
  if (rel === lookup) return true;
  if (rel.endsWith(`/${lookup}`)) return true;

  const lookupDir = lookup.includes('/') ? lookup.slice(0, lookup.lastIndexOf('/')) : '';
  const relDir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
  const relBase = rel.split('/').pop() || '';
  const lookupBase = lookup.split('/').pop() || '';

  if (lookupDir) {
    if (relDir === lookupDir || relDir.endsWith(`/${lookupDir}`) || lookupDir.endsWith(`/${relDir}`)) {
      return deliverableBasenamesMatch(relBase, lookupBase);
    }
    return false;
  }

  return deliverableBasenamesMatch(relBase, lookupBase);
}

/** True for paths like `keywords.md` (no directory segment). */
export function isBareDeliverableFilename(normalized) {
  const s = sanitizeDeliverableLookupPath(normalized);
  return /^[^/]+\.[a-z0-9]+$/i.test(s);
}

/** Generic entry filenames that collide across tasks when cited without a folder. */
const GENERIC_CLASH_PRONE_BASENAMES = new Set([
  'index.html',
  'slides.html',
  'page.html',
  'home.html',
  'main.html',
  'deck.html',
  'deck.bento.html',
  'presentation.html',
  'slide-manifest.json',
  'outline.json',
  'skill.md',
  'claude.md',
  'agents.md',
]);

/** Extract normalized `artifacts/slides-{deck_id}` from a deliverable path, if any. */
export function extractSlideDeckDirectory(raw) {
  const normalized = sanitizeDeliverableLookupPath(raw).replace(/\\/g, '/');
  const match = normalized.match(SLIDE_DECK_DIR_RE);
  if (!match) {
    return null;
  }
  const segment = match[0].replace(/^\//, '');
  return segment.startsWith('artifacts/') ? segment : `artifacts/${segment}`;
}

/** True when the lookup path names a specific slide-deck folder (not a bare filename). */
export function hasExplicitSlideDeckPath(raw) {
  return extractSlideDeckDirectory(raw) != null;
}

/** Filenames that must never bind across Nova slide decks via basename search. */
export function isSlideDeckClashProneBasename(raw) {
  const base = sanitizeDeliverableLookupPath(raw).split('/').pop()?.toLowerCase() ?? '';
  if (base === 'slide-manifest.json' || base === 'outline.json') {
    return true;
  }
  return /^slide-\d+\.(png|jpe?g|webp|gif)$/i.test(base);
}

export function isGenericClashProneBasename(raw) {
  const base = sanitizeDeliverableLookupPath(raw).split('/').pop()?.toLowerCase() ?? '';
  return GENERIC_CLASH_PRONE_BASENAMES.has(base);
}

/** Relative paths like `assets/raw/foo.jpg` collide across task-* dirs when cited without turn scope. */
export function isPartialScopedAssetPath(raw) {
  const normalized = sanitizeDeliverableLookupPath(raw);
  if (!normalized.includes('/')) return false;
  if (/^artifacts\//i.test(normalized)) return false;
  return /^(assets|pages|static)(\/|$)/i.test(normalized);
}

const NON_USER_DELIVERABLE_BASENAMES = new Set([
  'skill.md',
  'claude.md',
  'agents.md',
  'llms.txt',
  'outline.json',
  'bento-spec.md',
  'acceptance.json',
  'execution-standard.md',
  'troubleshooting-guide.md',
  'api-guide.md',
  // PD-SAAS-FORK a51fa91d: 智能获客过程文件 — 不进成果清单
  'query-expansion.json',
  'phase-ab-result.json',
  'raw-pages-index.json',
]);
const PROCESS_ONLY_DELIVERABLE_EXTENSIONS = new Set([
  '.bat',
  '.cmd',
  '.js',
  '.mjs',
  '.ps1',
  '.py',
  '.sh',
  '.ts',
  '.tsx',
]);

function deliverableBasenameLower(raw) {
  return sanitizeDeliverableLookupPath(raw).split('/').pop()?.toLowerCase() ?? '';
}

function isUnderUserArtifactsPath(normalized) {
  const lower = String(normalized || '').toLowerCase();
  return (
    lower.includes('/artifacts/')
    || lower.startsWith('artifacts/')
    || lower.includes('.pilotdeck/artifacts/')
    || lower.startsWith('.pilotdeck/artifacts/')
  );
}

const PLATFORM_TOP_LEVEL_DIRS = new Set([
  'config',
  'dist',
  'node_modules',
  'scripts',
  'skills',
  'src',
  'test',
  'tests',
  'ui',
]);

function isUserCodeProjectDeliverablePath(normalized) {
  const lower = String(normalized || '').toLowerCase();
  if (!lower) return false;
  if (isUnderUserArtifactsPath(lower)) return true;
  if (/(^|\/)(node_modules|skills|\.pilotdeck)(\/|$)/.test(lower)) return false;
  const top = lower.split('/')[0] ?? '';
  if (!top || PLATFORM_TOP_LEVEL_DIRS.has(top)) return false;
  return lower.includes('/');
}

function isProcessSupportScriptPath(normalized) {
  const base = deliverableBasenameLower(normalized);
  if (/^\d+\.(?:py|mjs|js|ts|tsx|sh|bat|cmd|ps1)$/i.test(base)) return true;
  return /^(?:create|render|generate|build|export|convert|compose|tmp|temp)(?:[._-].*)?\.(?:py|mjs|js|ts|tsx|sh|bat|cmd|ps1)$/i.test(base);
}

/** Ephemeral chart PNGs from analysis turns — process artifacts, not user deliverables. */
export function isProcessChartImagePath(raw) {
  const base = deliverableBasenameLower(sanitizeDeliverableLookupPath(raw));
  return /^chart-\d+\.png$/i.test(base);
}

/**
 * PD-SAAS-FORK Razer batch: orphan intermediate HTML (preview/numbered) without SDM slot.
 * @param {string} raw
 * @param {string[] | undefined} slotHtmlBasenames lower-case basenames from frozen SDM
 */
export function isOrphanIntermediateHtmlPath(raw, slotHtmlBasenames) {
  const base = deliverableBasenameLower(sanitizeDeliverableLookupPath(raw));
  if (!/\.html?$/i.test(base)) return false;
  if (/-preview\.html$|_preview\.html$|^preview\.html$/i.test(base)) return true;
  if (/^\d+\.html$/i.test(base)) return true;
  const hints = Array.isArray(slotHtmlBasenames) ? slotHtmlBasenames : [];
  if (hints.length === 0) return false;
  const hintSet = new Set(hints.map((h) => String(h).toLowerCase()));
  if (hintSet.has(base)) return false;
  if (/关键词|keyword|挖词|geo/i.test(base)) return false;
  return !hintSet.has(base);
}

/** PD-SAAS-FORK VAP: prepared/raw/capture assets — process bookkeeping, not turn deliverables. */
export function isVisualAssetProcessPath(raw) {
  const normalized = sanitizeDeliverableLookupPath(raw).replace(/\\/g, '/').toLowerCase();
  if (!normalized) return false;
  const base = deliverableBasenameLower(normalized);
  if (base === 'visual-asset-manifest.json') return true;
  if (base === 'index-preview.png') return true;
  if (/-report_inline\.png$/i.test(base)) return true;
  if (/\/assets\/(?:prepared|_capture|raw)(?:\/|$)/i.test(normalized)) return true;
  // Session download cache (Discover→Bind ladder) — bound into HTML, never a checklist row.
  if (/artifacts\/sessions\/[^/]+\/downloads(?:\/|$)/i.test(normalized)) return true;
  return false;
}

/** File-tree folders/files to hide (VAP internal dirs + manifest). */
export function isVisualAssetInternalTreePath(raw) {
  return isVisualAssetProcessPath(raw);
}

/** Agent/sandbox hallucination paths — never user deliverables (e.g. skill template file:// URLs). */
export function isPhantomDeliverablePath(raw) {
  const original = String(raw || '').trim();
  if (!original) return true;
  if (/^file:\/\//i.test(original)) return true;
  const normalized = sanitizeDeliverableLookupPath(raw).replace(/\\/g, '/').toLowerCase();
  if (!normalized) return true;
  if (normalized.startsWith('file://')) return true;
  if (/^(?:\/)?home\/user(?:\/|$)/.test(normalized)) return true;
  if (/^(?:\/)?mnt\/(?:data|user|workspace)(?:\/|$)/.test(normalized)) return true;
  return false;
}

/** Skill/platform paths — never user turn deliverables (four-line + T2 panel). */
export function isNonUserDeliverablePath(raw) {
  if (isPhantomDeliverablePath(raw)) return true;
  if (isRepairPlaceholderDeliverablePath(raw)) return true;
  if (isProcessChartImagePath(raw)) return true;
  if (isVisualAssetProcessPath(raw)) return true;
  const normalizedEarly = sanitizeDeliverableLookupPath(raw).replace(/\\/g, '/').toLowerCase();
  if (/^(?:tmp_workspace|tmp\/|temp\/)/.test(normalizedEarly)) return true;
  // Public markdown share export outputs — never user deliverables
  if (/(^|\/)artifacts\/_share-export(?:\/|$)/i.test(normalizedEarly)) return true;
  const normalized = sanitizeDeliverableLookupPath(raw).replace(/\\/g, '/');
  if (!normalized) return true;

  const lower = normalized.toLowerCase();
  if (/(^|\/)skills(?:\/|$)/.test(lower)) return true;
  if (/(^|\/)vendor\/[^/]+\/skills(?:\/|$)/.test(lower)) return true;
  if (/^artifacts\/geo\/docs\//i.test(lower)) return true;
  if (/\/docs\/(?:execution-standard|troubleshooting-guide|api-guide)\.md$/i.test(lower)) return true;
  if (lower.includes('.pilotdeck/') && !lower.includes('.pilotdeck/artifacts/')) return true;
  if (/(^|\/)\.failed\./.test(lower) || /\.failed\./.test(lower)) return true;

  const base = deliverableBasenameLower(normalized);
  if (base === 'outline.json') return true;
  // Acquisition pipeline intermediates (cached HTML pages, phase dumps).
  if (/\/acquisition-[^/]+\/(?:raw-pages|pages|cache|_tmp)(?:\/|$)/i.test(lower)) return true;
  if (/^(?:phase-[a-z0-9-]+|raw-pages(?:-index)?)\.(?:json|html?)$/i.test(base)) return true;
  const dot = base.lastIndexOf('.');
  const ext = dot >= 0 ? base.slice(dot) : '';
  if (
    PROCESS_ONLY_DELIVERABLE_EXTENSIONS.has(ext)
    && (isProcessSupportScriptPath(lower) || !isUserCodeProjectDeliverablePath(lower))
  ) return true;
  if (NON_USER_DELIVERABLE_BASENAMES.has(base)) {
    if (base === 'skill.md' && isUnderUserArtifactsPath(lower)) {
      return false;
    }
    return true;
  }
  if (base === 'readme.md' && !isUnderUserArtifactsPath(lower)) {
    return true;
  }
  return false;
}

export function isNonDeliverableBasename(raw) {
  return NON_USER_DELIVERABLE_BASENAMES.has(deliverableBasenameLower(raw));
}

/** PD-SAAS-FORK: turn-scoped resolve; set PILOTDECK_DELIVERABLE_HINT_DIR=0 to restore legacy mtime guessing. */
export function isDeliverableHintDirEnabled() {
  if (typeof process !== 'undefined' && process.env?.PILOTDECK_DELIVERABLE_HINT_DIR === '0') {
    return false;
  }
  return true;
}

/** Normalize turn artifact directory hint (relative, forward slashes, no trailing slash). */
export function normalizeHintDir(raw) {
  const s = sanitizeDeliverableLookupPath(raw);
  return s.replace(/\/+$/, '');
}

/** True when `relativePath` is inside or equal to `hintDir`. */
export function pathUnderHintDir(relativePath, hintDir) {
  const rel = normalizeRelativeDeliverablePath(relativePath);
  const hint = normalizeHintDir(hintDir);
  if (!hint) return true;
  const lowerRel = rel.toLowerCase();
  const lowerHint = hint.toLowerCase();
  return lowerRel === lowerHint || lowerRel.startsWith(`${lowerHint}/`);
}

const SLIDE_DECK_DIR_RE = /(?:^|\/)(artifacts\/)?slides-[^/]+/i;
const TASK_ARTIFACT_DIR_RE = /(?:^|\/)artifacts\/task-\d{8}-[a-f0-9]{8}(?:\/|$)/i;

/** Extract normalized `artifacts/task-YYYYMMDD-xxxxxxxx` from a deliverable path, if any. */
export function extractTaskArtifactDirectory(raw) {
  const normalized = sanitizeDeliverableLookupPath(raw).replace(/\\/g, '/');
  const match = normalized.match(TASK_ARTIFACT_DIR_RE);
  if (!match) {
    return null;
  }
  const idx = normalized.toLowerCase().indexOf('artifacts/task-');
  if (idx < 0) {
    return null;
  }
  const rest = normalized.slice(idx);
  const taskMatch = rest.match(/^artifacts\/task-\d{8}-[a-f0-9]{8}/i);
  return taskMatch ? taskMatch[0] : null;
}

/**
 * After server resolve, ensure slide-deck deliverables did not hop to another deck folder.
 * @returns {boolean} true when resolved path is faithful to the requested path
 */
export function deliverableResolveMatchesRequest(requestedPath, resolvedRelativePath) {
  const requested = sanitizeDeliverableLookupPath(requestedPath).replace(/\\/g, '/');
  const resolved = String(resolvedRelativePath || '').replace(/\\/g, '/');
  if (!requested || !resolved) {
    return false;
  }
  if (requested === resolved) {
    return true;
  }

  const requestedDeck = extractSlideDeckDirectory(requested);
  if (requestedDeck) {
    const resolvedDeck = extractSlideDeckDirectory(resolved);
    if (!resolvedDeck) {
      return false;
    }
    return requestedDeck.toLowerCase() === resolvedDeck.toLowerCase();
  }

  const requestedTask = extractTaskArtifactDirectory(requested);
  if (requestedTask) {
    const resolvedTask = extractTaskArtifactDirectory(resolved);
    if (!resolvedTask) {
      return false;
    }
    return requestedTask.toLowerCase() === resolvedTask.toLowerCase();
  }

  if (requested.includes('/')) {
    const reqDir = requested.includes('/') ? requested.slice(0, requested.lastIndexOf('/')) : '';
    const resDir = resolved.includes('/') ? resolved.slice(0, resolved.lastIndexOf('/')) : '';
    const reqBase = requested.split('/').pop()?.toLowerCase() ?? '';
    const resBase = resolved.split('/').pop()?.toLowerCase() ?? '';
    if (reqDir && resDir && reqDir.toLowerCase() === resDir.toLowerCase() && reqBase === resBase) {
      return true;
    }
    return resolved.endsWith(`/${requested}`) || requested.endsWith(`/${resolved}`);
  }

  const reqBase = requested.split('/').pop()?.toLowerCase() ?? '';
  const resBase = resolved.split('/').pop()?.toLowerCase() ?? '';
  return deliverableBasenamesMatch(resBase, reqBase);
}

const NON_ARTIFACT_TOP_DIRS = new Set([
  'assets',
  'cloud-storage',
  'components',
  'config',
  'dashboard',
  'data',
  'docs',
  'html',
  'images',
  'layouts',
  'lib',
  'local-bindings',
  'media',
  'output',
  'pages',
  'products',
  'public',
  'saas',
  'scripts',
  'skills',
  'src',
  'static',
  'styles',
  'templates',
  'tenants',
  'test',
  'tests',
  'ui',
  'views',
]);

/** Slug paths that must not be auto-prefixed with artifacts/geo/ (FAQ, STDA task dirs, slides, etc.). */
export function shouldSkipGeoExpansion(normalized) {
  const s = sanitizeDeliverableLookupPath(normalized);
  if (!s || s.includes('artifacts/geo/')) {
    return false;
  }
  const top = s.split('/')[0]?.toLowerCase() ?? '';
  if (!top) return false;
  if (/^task-\d{8}-[a-f0-9]{8}/i.test(top)) return true;
  if (/^(faq-|slides-|campaign-|research-|acquisition-|spain-|design-|content-|social-|matrix-|canvas-|last30days-)/i.test(top)) {
    return true;
  }
  return false;
}

/**
 * Compile SDM pathHint + turn/task directory into a project-relative deliverable path.
 */
export function compileDeliverableSlotPath(pathHint, turnArtifactDir) {
  const hint = sanitizeDeliverableLookupPath(pathHint);
  if (!hint) return '';
  const dir = turnArtifactDir
    ? normalizeRelativeDeliverablePath(turnArtifactDir).replace(/\/+$/, '')
    : '';
  if (hint.includes('artifacts/')) {
    const normalized = normalizeRelativeDeliverablePath(hint);
    // PD-SAAS-FORK: corrupted SDM pathHints from another task-* dir re-scope to turnArtifactDir.
    if (dir) {
      const hintTaskDir = extractTaskArtifactDirectory(normalized);
      const scopeTaskDir = extractTaskArtifactDirectory(dir) ?? (dir.startsWith('artifacts/task-') ? dir : null);
      if (hintTaskDir && scopeTaskDir && hintTaskDir.toLowerCase() !== scopeTaskDir.toLowerCase()) {
        const base = normalized.split('/').pop() ?? normalized;
        return `${scopeTaskDir}/${base}`.replace(/\/+/g, '/');
      }
    }
    return normalized;
  }
  if (!dir) return hint;
  const base = hint.includes('/') ? hint.split('/').pop() : hint;
  if (!base) return `${dir}/${hint}`.replace(/\/+/g, '/');
  return `${dir}/${base}`.replace(/\/+/g, '/');
}

/** SaaS cross-hub deliverable search (orphan workspace). Off by default; set PILOTDECK_DELIVERABLE_CROSS_HUB=1 to restore. */
export function isDeliverableCrossHubEnabled() {
  return process.env.PILOTDECK_DELIVERABLE_CROSS_HUB === '1';
}

/** True for `campaign/file.md` or `drafts/03a-….md` without an `artifacts/` prefix. */
export function isSlugDeliverablePath(normalized) {
  const s = sanitizeDeliverableLookupPath(normalized);
  if (!s || s.includes('artifacts/')) {
    return false;
  }
  if (!/^[^\s/]+(?:\/[^/\s]+)+\.[\w.]+$/i.test(s)) {
    return false;
  }
  const top = s.split('/')[0]?.toLowerCase() ?? '';
  if (top.startsWith('last30days-')) {
    return false;
  }
  return !NON_ARTIFACT_TOP_DIRS.has(top);
}

/**
 * Candidate relative paths to try (first existing wins on server).
 */
export function deliverablePathCandidates(targetPath) {
  const normalized = sanitizeDeliverableLookupPath(targetPath);
  if (!normalized) {
    return [''];
  }
  if (/^[A-Za-z]:\//.test(normalized) || normalized.includes('artifacts/')) {
    const stripped = stripLeakedStoragePath(normalized);
    if (stripped && stripped !== normalized) {
      return deliverablePathCandidates(stripped);
    }
    return [normalized];
  }

  const candidates = new Set();
  const slugDeliverable = isSlugDeliverablePath(normalized);
  const bareDeliverable = isBareDeliverableFilename(normalized);

  if (/^ai-[\w-]+\/.+/i.test(normalized)) {
    candidates.add(`artifacts/social-matrix/${normalized}`);
  }

  if (slugDeliverable) {
    if (shouldSkipGeoExpansion(normalized)) {
      candidates.add(`artifacts/${normalized}`);
      candidates.add(`artifacts/social-matrix/${normalized}`);
    } else {
      candidates.add(`artifacts/geo/${normalized}`);
      candidates.add(`artifacts/social-matrix/${normalized}`);
      candidates.add(`artifacts/${normalized}`);
    }
  }

  const genericBare =
    bareDeliverable && isGenericClashProneBasename(normalized);

  if (bareDeliverable) {
    for (const prefix of ARTIFACT_DELIVERABLE_PREFIXES) {
      if (!prefix && genericBare) {
        continue;
      }
      candidates.add(`${prefix}${normalized}`.replace(/\/+/g, '/'));
    }
  } else {
    candidates.add(normalized);
  }

  const list = [...candidates];
  if (!genericBare) {
    return list;
  }

  const artifactPaths = list.filter((candidate) => candidate.includes('artifacts/'));
  const rest = list.filter((candidate) => !candidate.includes('artifacts/'));
  return [...artifactPaths, ...rest, normalized];
}
