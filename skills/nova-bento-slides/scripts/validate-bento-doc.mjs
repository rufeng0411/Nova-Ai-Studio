#!/usr/bin/env node
/**
 * PD-SAAS-FORK: validate bento/slides document (file or JSON)
 * Usage: validate-bento-doc.mjs <path> [--strict]
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const BENTO_DOC_RE = /<script\s+type=["']application\/bento\+json["']\s+id=["']bento-doc["'][^>]*>([\s\S]*?)<\/script>/i;
const MAX_BYTES = Number(process.env.BENTO_DECK_MAX_BYTES || 8 * 1024 * 1024);
const strict = process.argv.includes('--strict');

function fail(errors, code = 1) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(code);
}

function warn(warnings) {
  if (warnings.length > 0) {
    console.warn(JSON.stringify({ warnings }, null, 2));
  }
}

function countMorphGroups(slides) {
  let groups = 0;
  for (let i = 1; i < slides.length; i += 1) {
    const prev = slides[i - 1];
    const curr = slides[i];
    if (curr.transition !== 'morph') continue;
    const prevIds = new Set((prev.elements ?? []).map((el) => el.id).filter(Boolean));
    const shared = (curr.elements ?? []).some((el) => el.id && prevIds.has(el.id));
    if (shared) groups += 1;
  }
  return groups;
}

function hasChart(slides) {
  return slides.some((slide) => (slide.elements ?? []).some((el) => el.type === 'chart'));
}

function hasTable(slides) {
  return slides.some((slide) => (slide.elements ?? []).some((el) => el.type === 'table'));
}

function hasAmbientMotion(slides) {
  return slides.some((slide) => (slide.elements ?? []).some((el) => {
    const fx = el.fx ?? {};
    return fx.ambient === 'kenburns' || fx.loop || fx.countUp === true;
  }));
}

function collectFontFamilies(doc, slides) {
  const fonts = new Set();
  if (doc.theme?.fontFamily) fonts.add(String(doc.theme.fontFamily));
  for (const slide of slides) {
    for (const el of slide.elements ?? []) {
      if (el.fontFamily) fonts.add(String(el.fontFamily));
    }
  }
  return fonts;
}

function hasRichVisual(slides) {
  return slides.some((slide) => (slide.elements ?? []).some((el) => {
    const type = el.type;
    return type === 'image' || type === 'chart' || type === 'table';
  }));
}

function isBareTextSlide(slide) {
  const elements = slide.elements ?? [];
  if (elements.length === 0) return true;
  const textCount = elements.filter((el) => el.type === 'text').length;
  const shapeCount = elements.filter((el) => el.type === 'shape').length;
  const richCount = elements.filter((el) => el.type === 'image' || el.type === 'chart' || el.type === 'table').length;
  if (richCount > 0) return false;
  return textCount <= 2 && shapeCount <= 1;
}

function validateDoc(doc, sourceBytes) {
  const errors = [];
  const warnings = [];

  if (!doc || typeof doc !== 'object') errors.push('Document must be an object');
  if (doc.format !== 'bento/slides') errors.push('format must be "bento/slides"');
  if (!doc.size?.width || !doc.size?.height) errors.push('size.width and size.height required');
  if (!doc.theme?.background || !doc.theme?.color || !doc.theme?.accent || !doc.theme?.fontFamily) {
    errors.push('theme.background, theme.color, theme.accent, theme.fontFamily required');
  }
  if (!Array.isArray(doc.slides) || doc.slides.length === 0) errors.push('slides[] required');

  const slides = Array.isArray(doc.slides) ? doc.slides : [];
  const slideIds = new Set();
  for (const slide of slides) {
    if (!slide.id) errors.push('each slide needs id');
    if (slide.id && slideIds.has(slide.id)) errors.push(`duplicate slide id: ${slide.id}`);
    if (slide.id) slideIds.add(slide.id);
    const elementIds = new Set();
    for (const el of slide.elements ?? []) {
      if (!el.id) errors.push(`slide ${slide.id}: element missing id`);
      if (el.id && elementIds.has(el.id)) errors.push(`slide ${slide.id}: duplicate element id ${el.id}`);
      if (el.id) elementIds.add(el.id);
      const right = (el.x ?? 0) + (el.w ?? 0);
      if (right > 1184) warnings.push(`slide ${slide.id}: element ${el.id} exceeds 1184px right margin (${right})`);
    }
    if (!slide.notes || String(slide.notes).trim().length < (strict ? 20 : 1)) {
      errors.push(`slide ${slide.id}: notes required${strict ? ' (≥20 chars)' : ''}`);
    }
  }

  if (sourceBytes > MAX_BYTES) errors.push(`file exceeds ${MAX_BYTES} bytes`);

  const morphGroups = countMorphGroups(slides);
  if (strict && morphGroups < 2) errors.push('strict: require ≥2 morph groups');
  if (strict && !hasAmbientMotion(slides)) errors.push('strict: require ambient motion on at least one element');
  if (strict && collectFontFamilies(doc, slides).size > 2) errors.push('strict: at most 2 font families');
  if (strict && doc.meta?.repairedFrom === 'static-html') {
    errors.push('strict: static-html repair decks are not deliverable — regenerate native bento/slides');
  }
  if (strict && slides.length >= 8 && !hasRichVisual(slides)) {
    errors.push('strict: decks with ≥8 slides require at least one image/chart/table element');
  }
  if (strict && slides.length > 0) {
    const bareCount = slides.filter(isBareTextSlide).length;
    if (bareCount > Math.max(1, Math.floor(slides.length * 0.5))) {
      errors.push('strict: too many bare text-only slides — use layouts.md shapes/images/charts');
    }
  }

  if (errors.length > 0) fail(errors);
  warn(warnings);

  console.log(JSON.stringify({
    ok: true,
    slideCount: slides.length,
    morphGroups,
    hasChart: hasChart(slides),
    hasTable: hasTable(slides),
    hasAmbientMotion: hasAmbientMotion(slides),
    bytes: sourceBytes,
    strict,
  }, null, 2));
}

async function main() {
  const input = process.argv.find((arg) => !arg.startsWith('-') && arg !== process.argv[0] && arg !== process.argv[1]);
  if (!input) {
    console.error('Usage: validate-bento-doc.mjs <doc.json|deck.bento.html> [--strict]');
    process.exit(2);
  }

  const raw = await readFile(path.resolve(input), 'utf8');
  const bytes = Buffer.byteLength(raw, 'utf8');

  let doc;
  if (/\.bento\.html$/i.test(input)) {
    const match = BENTO_DOC_RE.exec(raw);
    if (!match) fail(['Missing #bento-doc block']);
    if (/<(?![/!])/.test(match[1]) && !match[1].includes('\\u003c')) {
      fail(['JSON block contains unescaped <']);
    }
    try {
      doc = JSON.parse(match[1].trim());
    } catch (err) {
      fail([`Invalid JSON: ${err.message}`]);
    }
  } else {
    try {
      doc = JSON.parse(raw);
    } catch (err) {
      fail([`Invalid JSON: ${err.message}`]);
    }
  }

  validateDoc(doc, bytes);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
