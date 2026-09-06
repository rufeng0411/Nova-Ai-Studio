// PD-SAAS-FORK: shared repair-path eligibility (engine + Bridge + UI)
/** @typedef {{ pathHint?: string; label?: string }} RepairPathAllowSlot */

const DELIVERABLE_EXT =
  '(?:jsonld|pptx|docx|pdf|html?|markdown|md|xlsx|csv|png|jpe?g|webp|gif|svg|json|mp4|webm|mov)';

/** Bare basename that looks like a repair placeholder (timestamps, numeric ids). */
const REPAIR_PLACEHOLDER_BASENAME =
  /^(?:\d{2}-\d{2}(?:-\d{2})?(?:\.\d+)?|\d{10,}|[\d:.+-]+)\.(?:md|markdown|html?|txt)$/i;

/** Chinese prose prefix glued to a filename, e.g. 好，campaign-plan.md */
const CHINESE_PREFIXED_BARE_FILE =
  /^[\u4e00-\u9fff，、：:；;！!？?「」【】（）()\s]+[^/\\]+\.(?:md|markdown|html?|pdf|docx|pptx)$/i;

export function normalizeRepairPath(raw) {
  const original = String(raw ?? '').trim();
  if (!original) return '';

  // PD-SAAS-FORK (ROG Phase 5): markdown link pollution e.g. title.pptx](artifacts/...
  if (/\]\(artifacts\//i.test(original)) {
    const linkMatch = original.match(/\[([^\]]*)\]\((artifacts\/[^)]+)\)/i);
    if (linkMatch?.[2]) {
      return linkMatch[2].replace(/\\/g, '/');
    }
    // PD-SAAS-FORK (ROG Phase 6 F2): half-chain e.g. file.pptx](artifacts/...
    const halfMatch = original.match(/(?:^|[^\[])(\S+\.(?:pptx|docx|pdf|html?|md|markdown|png|jpe?g))]\((artifacts\/[^)]+)\)/i);
    if (halfMatch?.[2]) {
      return halfMatch[2].replace(/\\/g, '/');
    }
    return '';
  }
  if (/[^\]]+\]\([^)]+\)/.test(original) && !/(?:^|\/)artifacts\//i.test(original)) {
    return '';
  }

  let value = original
    .replace(/^['"`\[*_]+|['"`\]*_]+$/g, '')
    .replace(/\\/g, '/');
  value = value.replace(/^(?:报告)?文件路径[:：]\s*/i, '').replace(/^路径[:：]\s*/i, '');
  const artifactIndex = value.toLowerCase().indexOf('artifacts/');
  if (artifactIndex > 0) {
    value = value.slice(artifactIndex);
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return '';
  return value;
}

/** @param {string} p */
export function basenameLower(p) {
  const n = normalizeRepairPath(p);
  const idx = n.lastIndexOf('/');
  return (idx >= 0 ? n.slice(idx + 1) : n).toLowerCase();
}

function isTimestampOrNumericPlaceholder(base) {
  if (!base) return true;
  if (REPAIR_PLACEHOLDER_BASENAME.test(base)) return true;
  if (/^\d{10,}$/.test(base.replace(/\.[^.]+$/, ''))) return true;
  if (/^\d{4}-\d{2}-\d{2}/.test(base)) return true;
  return false;
}

function matchesAllowlist(normalized, allowBasenames, allowPathHints) {
  const base = basenameLower(normalized);
  if (!base) return false;
  for (const hint of allowPathHints) {
    const h = normalizeRepairPath(hint).toLowerCase();
    if (!h) continue;
    const hintBase = h.includes('/') ? h.slice(h.lastIndexOf('/') + 1) : h;
    if (base === hintBase) return true;
    if (normalized.toLowerCase().endsWith(`/${hintBase}`)) return true;
  }
  for (const allowed of allowBasenames) {
    const a = String(allowed ?? '').trim().toLowerCase();
    if (a && base === a) return true;
  }
  return false;
}

/**
 * Whether a path may enter deliverable repair prompts / missingPaths.
 * Fail-closed: bare prose filenames, timestamps, and numeric ids are rejected
 * unless explicitly allowlisted via SDM pathHint or profile basenames.
 *
 * @param {string} raw
 * @param {{ allowBasenames?: string[]; allowPathHints?: string[]; slots?: RepairPathAllowSlot[] }} [opts]
 */
export function isRepairEligiblePath(raw, opts = {}) {
  const original = String(raw ?? '').trim();
  if (!original) return false;

  const normalized = normalizeRepairPath(original);
  if (!normalized) return false;

  const lower = normalized.toLowerCase();
  if (/^file:\/\//i.test(original) || lower.startsWith('file://')) return false;
  if (/^(?:\/)?home\/user(?:\/|$)/.test(lower)) return false;
  if (/^(?:\/)?mnt\/(?:data|user|workspace)(?:\/|$)/.test(lower)) return false;

  const slots = opts.slots ?? [];
  const allowPathHints = [
    ...(opts.allowPathHints ?? []),
    ...slots.map((s) => s.pathHint).filter(Boolean),
  ];
  const allowBasenames = [...(opts.allowBasenames ?? [])];

  if (CHINESE_PREFIXED_BARE_FILE.test(original) && !/(?:^|\/)artifacts\//i.test(normalized)) {
    return false;
  }

  const base = basenameLower(normalized);
  if (isTimestampOrNumericPlaceholder(base)) {
    return matchesAllowlist(normalized, allowBasenames, allowPathHints);
  }

  if (/(?:^|\/)artifacts\//i.test(normalized)) {
    // PD-SAAS-FORK: campaign slot placeholders (artifacts/campaign/**/research_or_plan)
    if (/\/\*\*\/[^/]+$/i.test(normalized)) return true;
    return new RegExp(`\\.${DELIVERABLE_EXT}$`, 'i').test(base);
  }

  if (normalized.includes('/')) {
    return new RegExp(`\\.${DELIVERABLE_EXT}$`, 'i').test(base);
  }

  return matchesAllowlist(normalized, allowBasenames, allowPathHints);
}

/** @param {string[]} paths @param {Parameters<typeof isRepairEligiblePath>[1]} [opts] */
export function filterRepairEligiblePaths(paths, opts) {
  return paths.filter((p) => isRepairEligiblePath(p, opts));
}

/** Repair-loop placeholder md files — never user deliverables (M15). */
export function isRepairPlaceholderDeliverablePath(raw) {
  const base = basenameLower(raw);
  if (!base) return false;
  if (REPAIR_PLACEHOLDER_BASENAME.test(base)) return true;
  if (/^\d{4}-\d{2}-\d{2}/.test(base)) return true;
  return false;
}
