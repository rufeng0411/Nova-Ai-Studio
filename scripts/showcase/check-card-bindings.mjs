#!/usr/bin/env node
/**
 * L0/L1 gate for showcase card recommendation JSON.
 * PD-SAAS-FORK
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_JSON = path.join(root, 'docs/showcase-card-recommendation-20260803.json');

const SECTIONS = [
  'design',
  'video',
  'copy',
  'marketing',
  'office',
  'research',
  'geo',
  'fullcase',
  'compliance',
];

const FORBIDDEN = [
  '直接开始做',
  '做完告诉我',
  '存 artifacts',
  '直接开写',
  '/tmp_workspace/',
];

const ID_RE = /^sc-[a-z0-9-]+$/;
const GEO_BLOCKED = new Set(['geo-brand-full']);

/**
 * @param {string} jsonPath
 * @returns {{ ok: boolean, errors: string[], warnings: string[], cardCount: number }}
 */
export function validateShowcaseCardRecommendation(jsonPath = DEFAULT_JSON) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (!fs.existsSync(jsonPath)) {
    return { ok: false, errors: [`missing_json:${jsonPath}`], warnings, cardCount: 0 };
  }

  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (err) {
    return {
      ok: false,
      errors: [`json_parse:${err instanceof Error ? err.message : String(err)}`],
      warnings,
      cardCount: 0,
    };
  }

  if (!doc?.meta?.version) errors.push('meta.version_required');
  const cards = Array.isArray(doc.cards) ? doc.cards : [];
  if (cards.length !== 54) errors.push(`card_count:${cards.length}!=54`);
  if (doc.meta?.cardCount != null && Number(doc.meta.cardCount) !== cards.length) {
    errors.push('meta.cardCount_mismatch');
  }

  const catalogPath = path.join(root, 'config/capabilities.catalog.json');
  const templatesPath = path.join(root, 'config/process-templates.json');
  const visibilityPath = path.join(root, 'config/hub-visibility.json');

  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  /** @type {Set<string>} */
  const skillSlugs = new Set();
  const skillList = Array.isArray(catalog)
    ? catalog
    : catalog.skills || catalog.capabilities || catalog.items || [];
  for (const c of skillList) {
    if (c?.slug) skillSlugs.add(String(c.slug));
  }

  const templatesDoc = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
  /** @type {Set<string>} */
  const templateIds = new Set();
  const tList = Array.isArray(templatesDoc)
    ? templatesDoc
    : templatesDoc.templates || templatesDoc.items || [];
  for (const t of tList) {
    if (t?.id) templateIds.add(String(t.id));
  }

  let hiddenCaps = {};
  if (fs.existsSync(visibilityPath)) {
    const vis = JSON.parse(fs.readFileSync(visibilityPath, 'utf8'));
    hiddenCaps = vis.capabilities || {};
  }

  /** @type {Map<string, number>} */
  const perSection = new Map();
  /** @type {Set<string>} */
  const ids = new Set();

  const requiredStrings = [
    'name_zh',
    'name_en',
    'annotation_zh',
    'annotation_en',
    'badge_zh',
    'badge_en',
    'prompt_zh',
    'prompt_en',
    'hub_binding',
    'binding_kind',
    'primary_deliverable',
  ];

  for (const card of cards) {
    const id = String(card.id || '');
    if (!ID_RE.test(id)) errors.push(`bad_id:${id || '(empty)'}`);
    if (ids.has(id)) errors.push(`dup_id:${id}`);
    ids.add(id);

    const section = String(card.section_id || '');
    if (!SECTIONS.includes(section)) errors.push(`${id}:bad_section:${section}`);
    perSection.set(section, (perSection.get(section) || 0) + 1);

    for (const key of requiredStrings) {
      if (!String(card[key] ?? '').trim()) errors.push(`${id}:missing_${key}`);
    }

    if (!Array.isArray(card.must_deliver) || card.must_deliver.length < 1) {
      errors.push(`${id}:must_deliver_empty`);
    }
    if (card.hub_bindings) errors.push(`${id}:forbidden_hub_bindings_array`);

    const kind = card.binding_kind;
    const binding = String(card.hub_binding || '');
    if (kind === 'skill') {
      if (!skillSlugs.has(binding)) errors.push(`${id}:unknown_skill:${binding}`);
      if (hiddenCaps[binding] === false) errors.push(`${id}:hidden_skill:${binding}`);
    } else if (kind === 'template') {
      if (!templateIds.has(binding)) errors.push(`${id}:unknown_template:${binding}`);
    } else {
      errors.push(`${id}:bad_binding_kind:${kind}`);
    }

    if (section === 'geo' && GEO_BLOCKED.has(binding)) {
      errors.push(`${id}:geo_blocked_fullcase_template:${binding}`);
    }

    if ((section === 'fullcase' || section === 'compliance') && card.star !== true) {
      errors.push(`${id}:star_required`);
    }

    if (section === 'compliance') {
      if (!String(card.prompt_zh).includes('不构成执业意见')) {
        errors.push(`${id}:compliance_disclaimer_missing`);
      }
    }

    for (const phrase of FORBIDDEN) {
      if (String(card.prompt_zh).includes(phrase) || String(card.prompt_en).includes(phrase)) {
        errors.push(`${id}:forbidden_phrase:${phrase}`);
      }
    }

    const lenZh = String(card.prompt_zh || '').length;
    // Professional showcase prompts are longer; hard fail only if truncated or absurd
    if (lenZh < 120) errors.push(`${id}:prompt_zh_too_short:${lenZh}`);
    if (lenZh > 800) errors.push(`${id}:prompt_zh_too_long:${lenZh}`);
    else if (lenZh > 520) warnings.push(`${id}:prompt_zh_len=${lenZh}`);
  }

  for (const sec of SECTIONS) {
    const n = perSection.get(sec) || 0;
    if (n !== 6) errors.push(`section_count:${sec}=${n}!=6`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    cardCount: cards.length,
  };
}

function main() {
  const gate = process.argv.includes('--gate');
  const jsonArg = process.argv.find((a) => a.startsWith('--json='));
  const jsonPath = jsonArg ? jsonArg.slice('--json='.length) : DEFAULT_JSON;
  const result = validateShowcaseCardRecommendation(jsonPath);
  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        cardCount: result.cardCount,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        errors: result.errors.slice(0, 50),
        warnings: result.warnings.slice(0, 20),
      },
      null,
      2,
    ),
  );
  if (gate && !result.ok) process.exit(1);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) main();
