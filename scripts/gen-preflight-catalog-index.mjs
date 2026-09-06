#!/usr/bin/env node
// PD-SAAS-FORK: generate lightweight Preflight catalog indexes (OD + ppt-master)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildOdPreviewPalette,
  normalizeHexColor,
  resolvePptCanvasPalette,
  resolvePptModePalette,
  resolvePptStylePalette,
} from './lib/preflightCatalogPalettes.mjs';
import {
  buildOdPreviewHtml,
  buildPptCanvasPreviewHtml,
  odPreviewHtmlPath,
  odPreviewPageUrl,
  pptCanvasPreviewHtmlPath,
  pptCanvasPreviewPageUrl,
  resolvePptModePreviewPngAbs,
  resolvePptStylePreviewPngAbs,
} from './lib/preflightPreviewAssets.mjs';
import {
  buildOdHeroPreviewHtml,
  isOdHeroPreviewId,
  loadOdHeroContext,
  OD_HERO_PREVIEW_IDS,
} from './lib/preflightOdHeroPreview.mjs';
import {
  odDetailUrl,
  odThumbUrl,
  pptCanvasDetailUrl,
  pptCanvasThumbUrl,
  pptModeDetailUrl,
  pptModeThumbUrl,
  pptStyleDetailUrl,
  pptStyleThumbUrl,
  rasterizeOdHeroSet,
  rasterizePptCanvasSet,
  rasterizePptStyleModeSet,
} from './lib/preflightPreviewRaster.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OD_DS_DIR = path.join(REPO_ROOT, 'skills/open-design/references/design-systems');
const PPT_CATALOGS = path.join(REPO_ROOT, 'skills/vendor/ppt-master/scripts/confirm_ui/static/catalogs.json');
const OUT_OD = path.join(REPO_ROOT, 'config/preflight-catalog-od.json');
const OUT_PPT = path.join(REPO_ROOT, 'config/preflight-catalog-ppt.json');
const UI_GEN_OD = path.join(REPO_ROOT, 'ui/src/generated/preflight-catalog-od.json');
const UI_GEN_PPT = path.join(REPO_ROOT, 'ui/src/generated/preflight-catalog-ppt.json');
const OD_PREVIEW_OUT = path.join(REPO_ROOT, 'ui/public/vendor/preflight/od');
const PPT_CANVAS_PREVIEW_OUT = path.join(REPO_ROOT, 'ui/public/vendor/preflight/ppt/canvas');

const OD_RECOMMEND = ['linear-app', 'supabase', 'stripe', 'notion', 'vercel'];
const PPT_RECOMMEND = { canvas: 'ppt169', style: 'swiss-minimal', mode: 'pyramid' };
const SKIP_RASTER = process.argv.includes('--skip-raster');

function humanizeId(id) {
  return String(id)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseOdTitle(md) {
  const m = md.match(/^#\s+Design System Inspired by\s+(.+)$/m);
  if (m) return m[1].trim();
  const m2 = md.match(/^#\s+(.+)$/m);
  return m2 ? m2[1].trim() : '';
}

function parseOdCategory(md) {
  const m = md.match(/^>\s*Category:\s*(.+)$/m);
  return m ? m[1].trim() : 'General';
}

function parseOdTagline(md) {
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (/^>\s*Category:/.test(lines[i]) && lines[i + 1]?.startsWith('>')) {
      return lines[i + 1].replace(/^>\s*/, '').trim();
    }
  }
  return '';
}

function parseOdAccent(md) {
  const m = md.match(/Brand.*?[`(](#([0-9a-fA-F]{3,8}))/i)
    || md.match(/accent.*?[`(](#([0-9a-fA-F]{3,8}))/i)
    || md.match(/Primary.*?[`(](#([0-9a-fA-F]{3,8}))/i)
    || md.match(/Indigo.*?[`(](#([0-9a-fA-F]{3,8}))/i)
    || md.match(/#[0-9a-fA-F]{3,8}/);
  const raw = m ? (m[2] ?? m[0]) : null;
  return normalizeHexColor(raw) ?? '#6366f1';
}

function writeOdPreviewPages(entries) {
  mkdirSync(OD_PREVIEW_OUT, { recursive: true });
  let written = 0;
  let heroes = 0;
  for (const entry of entries) {
    let html;
    if (isOdHeroPreviewId(entry.id)) {
      const ctx = loadOdHeroContext(entry.id);
      html = ctx ? buildOdHeroPreviewHtml(ctx) : null;
      if (html) heroes += 1;
    }
    if (!html) {
      html = buildOdPreviewHtml({
        id: entry.id,
        label: entry.label,
        colors: entry.colors,
        category: entry.category,
        tagline: entry.tagline,
      });
    }
    writeFileSync(odPreviewHtmlPath(entry.id), html, 'utf8');
    written += 1;
  }
  return { written, heroes };
}

function buildOdCatalog() {
  if (!existsSync(OD_DS_DIR)) {
    throw new Error(`OD design-systems dir missing: ${OD_DS_DIR}`);
  }
  const entries = readdirSync(OD_DS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const id = f.replace(/\.md$/, '');
      const md = readFileSync(path.join(OD_DS_DIR, f), 'utf8');
      const title = parseOdTitle(md) || humanizeId(id);
      const category = parseOdCategory(md);
      const tagline = parseOdTagline(md);
      const accent = parseOdAccent(md);
      const colors = buildOdPreviewPalette(md, accent);
      return {
        id,
        label: title,
        category,
        tagline,
        accent: colors[0],
        colors,
        previewUrl: odPreviewPageUrl(id),
        thumbHint: `od:${id}`,
        recommended: OD_RECOMMEND.includes(id),
        heroPreview: isOdHeroPreviewId(id),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    profileRef: 'open-design',
    recommend: OD_RECOMMEND.filter((id) => entries.some((e) => e.id === id)),
    heroPreviewIds: OD_HERO_PREVIEW_IDS.filter((id) => entries.some((e) => e.id === id)),
    count: entries.length,
    entries,
  };
}

function pickLabel(item, zh = true) {
  if (zh && item.label_zh) return item.label_zh;
  if (item.label) return item.label;
  return humanizeId(item.id);
}

function buildPptCatalog() {
  if (!existsSync(PPT_CATALOGS)) {
    throw new Error(`ppt catalogs.json missing: ${PPT_CATALOGS}`);
  }
  const raw = JSON.parse(readFileSync(PPT_CATALOGS, 'utf8'));
  const canvas = (raw.canvas ?? []).map((c) => ({
    id: c.id,
    label: pickLabel(c),
    dim: c.dim,
    ratio: c.ratio ?? c.dim?.replace('×', '/'),
    use: c.use_zh ?? c.use ?? '',
    colors: resolvePptCanvasPalette(c.id),
    previewUrl: pptCanvasPreviewPageUrl(c.id),
  }));
  const modes = (raw.modes ?? []).map((m) => ({
    id: m.id,
    label: pickLabel(m),
    desc: m.desc_zh ?? m.desc ?? '',
    colors: resolvePptModePalette(m.id),
  }));

  const styleGroups = raw.visual_styles ?? raw.styles ?? [];
  const styles = [];
  for (const group of styleGroups) {
    const groupLabel = group.group_zh ?? group.group ?? '';
    const items = group.items ?? (group.id ? [group] : []);
    for (const s of items) {
      styles.push({
        id: s.id,
        label: pickLabel(s),
        group: groupLabel,
        desc: s.desc_zh ?? s.desc ?? '',
        colors: resolvePptStylePalette(s.id),
        recommended: s.id === PPT_RECOMMEND.style,
      });
    }
  }
  styles.sort((a, b) => a.id.localeCompare(b.id));

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    profileRef: 'ppt-master',
    recommend: PPT_RECOMMEND,
    canvas,
    modes,
    styles,
    counts: {
      canvas: canvas.length,
      modes: modes.length,
      styles: styles.length,
    },
  };
}

function writePptCanvasPreviewPages(canvasEntries) {
  mkdirSync(PPT_CANVAS_PREVIEW_OUT, { recursive: true });
  let written = 0;
  for (const entry of canvasEntries) {
    const html = buildPptCanvasPreviewHtml({
      id: entry.id,
      label: entry.label,
      colors: entry.colors,
      use: entry.use,
    });
    writeFileSync(pptCanvasPreviewHtmlPath(entry.id), html, 'utf8');
    written += 1;
  }
  return written;
}

function attachOdRasterUrls(catalog) {
  for (const entry of catalog.entries) {
    if (!entry.heroPreview) continue;
    const thumbAbs = path.join(OD_PREVIEW_OUT, 'thumbs', `${entry.id}.webp`);
    const detailAbs = path.join(OD_PREVIEW_OUT, 'detail', `${entry.id}.webp`);
    if (existsSync(thumbAbs)) entry.previewThumbUrl = odThumbUrl(entry.id);
    if (existsSync(detailAbs)) entry.previewImageUrl = odDetailUrl(entry.id);
  }
}

function attachPptRasterUrls(ppt) {
  for (const row of ppt.styles) {
    const thumbAbs = path.join(REPO_ROOT, 'ui/public/vendor/preflight/ppt/thumbs/styles', `${row.id}.webp`);
    const detailAbs = path.join(REPO_ROOT, 'ui/public/vendor/preflight/ppt/detail/styles', `${row.id}.webp`);
    if (existsSync(thumbAbs)) row.previewThumbUrl = pptStyleThumbUrl(row.id);
    if (existsSync(detailAbs)) row.previewImageUrl = pptStyleDetailUrl(row.id);
  }
  for (const row of ppt.modes) {
    const thumbAbs = path.join(REPO_ROOT, 'ui/public/vendor/preflight/ppt/thumbs/modes', `${row.id}.webp`);
    const detailAbs = path.join(REPO_ROOT, 'ui/public/vendor/preflight/ppt/detail/modes', `${row.id}.webp`);
    if (existsSync(thumbAbs)) row.previewThumbUrl = pptModeThumbUrl(row.id);
    if (existsSync(detailAbs)) row.previewImageUrl = pptModeDetailUrl(row.id);
  }
  for (const row of ppt.canvas) {
    const thumbAbs = path.join(REPO_ROOT, 'ui/public/vendor/preflight/ppt/thumbs/canvas', `${row.id}.webp`);
    const detailAbs = path.join(REPO_ROOT, 'ui/public/vendor/preflight/ppt/detail/canvas', `${row.id}.webp`);
    if (existsSync(thumbAbs)) row.previewThumbUrl = pptCanvasThumbUrl(row.id);
    if (existsSync(detailAbs)) row.previewImageUrl = pptCanvasDetailUrl(row.id);
  }
}

async function rasterizeAll(od, ppt) {
  const heroIds = od.heroPreviewIds ?? [];
  await rasterizeOdHeroSet({
    repoRoot: REPO_ROOT,
    heroIds,
    htmlPathForId: (id) => odPreviewHtmlPath(id),
  });

  await rasterizePptStyleModeSet({
    repoRoot: REPO_ROOT,
    styleEntries: ppt.styles,
    modeEntries: ppt.modes,
    resolveStylePng: resolvePptStylePreviewPngAbs,
    resolveModePng: resolvePptModePreviewPngAbs,
  });

  await rasterizePptCanvasSet({
    repoRoot: REPO_ROOT,
    canvasIds: ppt.canvas.map((c) => c.id),
    htmlPathForId: (id) => pptCanvasPreviewHtmlPath(id),
  });
}

async function main() {
  const od = buildOdCatalog();
  const odPreviews = writeOdPreviewPages(od.entries);
  const ppt = buildPptCatalog();
  const pptCanvasPreviews = writePptCanvasPreviewPages(ppt.canvas);

  if (!SKIP_RASTER) {
    try {
      await rasterizeAll(od, ppt);
      attachOdRasterUrls(od);
      attachPptRasterUrls(ppt);
    } catch (err) {
      console.warn('[preflight:catalog:gen] raster skipped:', err?.message ?? err);
      console.warn('[preflight:catalog:gen] re-run without --skip-raster after installing Playwright browsers');
    }
  }

  writeFileSync(OUT_OD, `${JSON.stringify(od, null, 2)}\n`, 'utf8');
  writeFileSync(OUT_PPT, `${JSON.stringify(ppt, null, 2)}\n`, 'utf8');
  writeFileSync(UI_GEN_OD, `${JSON.stringify(od, null, 2)}\n`, 'utf8');
  writeFileSync(UI_GEN_PPT, `${JSON.stringify(ppt, null, 2)}\n`, 'utf8');
  console.log(`[preflight:catalog:gen] OD entries=${od.count} html=${odPreviews.written} heroes=${odPreviews.heroes} raster=${SKIP_RASTER ? 'skipped' : 'on'} -> ${path.relative(REPO_ROOT, OUT_OD)}`);
  console.log(`[preflight:catalog:gen] PPT canvas=${ppt.counts.canvas} canvasHtml=${pptCanvasPreviews} styles=${ppt.counts.styles} modes=${ppt.counts.modes} -> ${path.relative(REPO_ROOT, OUT_PPT)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
