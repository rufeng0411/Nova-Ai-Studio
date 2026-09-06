/** PD-SAAS-FORK: Curated preview palettes for Preflight catalog generation */

/** @type {Record<string, string[]>} accent, bg, surface, muted, border */
export const PPT_STYLE_PALETTES = {
  'swiss-minimal': ['#111111', '#f5f5f5', '#2563eb', '#e5e5e5', '#737373'],
  'soft-rounded': ['#1e293b', '#f8fafc', '#6366f1', '#e2e8f0', '#94a3b8'],
  glassmorphism: ['#0f172a', '#e0e7ff', '#818cf8', '#334155', '#64748b'],
  'dark-tech': ['#0b1220', '#e2e8f0', '#22d3ee', '#1e293b', '#475569'],
  blueprint: ['#0a1628', '#e8f4ff', '#38bdf8', '#1e3a5f', '#7dd3fc'],
  editorial: ['#1a1510', '#f7f2ea', '#b45309', '#e7ddd0', '#78716c'],
  'photo-editorial': ['#111111', '#fafafa', '#dc2626', '#d4d4d4', '#525252'],
  'data-journalism': ['#0f172a', '#f1f5f9', '#0ea5e9', '#cbd5e1', '#64748b'],
  brutalist: ['#000000', '#ffffff', '#facc15', '#525252', '#d4d4d4'],
  memphis: ['#111827', '#fef3c7', '#ec4899', '#38bdf8', '#fbbf24'],
  zine: ['#1c1917', '#fef08a', '#ef4444', '#d6d3d1', '#78716c'],
  'vintage-poster': ['#3b2f2f', '#f5e6c8', '#c2410c', '#78716c', '#d6d3d1'],
  'paper-cut': ['#422006', '#fff7ed', '#ea580c', '#fed7aa', '#fb923c'],
  'sketch-notes': ['#2b2118', '#f6efe4', '#ea580c', '#d6c7b0', '#a8a29e'],
  'ink-notes': ['#1c1917', '#fafaf9', '#44403c', '#d6d3d1', '#78716c'],
  chalkboard: ['#14532d', '#ecfccb', '#fde047', '#365314', '#84cc16'],
  'ink-wash': ['#1c1917', '#f5f5f4', '#44403c', '#d6d3d1', '#a8a29e'],
  'pixel-art': ['#1e1b4b', '#c4b5fd', '#22c55e', '#312e81', '#a78bfa'],
};

/** @type {Record<string, string[]>} */
export const PPT_CANVAS_PALETTES = {
  ppt169: ['#2563eb', '#0f172a', '#f8fafc', '#64748b', '#e2e8f0'],
  ppt43: ['#6366f1', '#1e293b', '#f1f5f9', '#94a3b8', '#e2e8f0'],
  wechat: ['#07c160', '#111827', '#f9fafb', '#6b7280', '#e5e7eb'],
  xiaohongshu: ['#ff2442', '#831843', '#fdf2f8', '#9d174d', '#fbcfe8'],
  moments: ['#f97316', '#292524', '#fafaf9', '#78716c', '#e7e5e4'],
  story: ['#8b5cf6', '#0f172a', '#f5f3ff', '#6d28d9', '#ddd6fe'],
  banner: ['#0ea5e9', '#082f49', '#f0f9ff', '#0369a1', '#bae6fd'],
  a4: ['#374151', '#ffffff', '#f3f4f6', '#9ca3af', '#e5e7eb'],
};

/** @type {Record<string, string[]>} */
export const PPT_MODE_PALETTES = {
  pyramid: ['#2563eb', '#0f172a', '#f8fafc', '#64748b', '#dbeafe'],
  narrative: ['#db2777', '#1f2937', '#fdf2f8', '#9d174d', '#fbcfe8'],
  instructional: ['#059669', '#064e3b', '#ecfdf5', '#047857', '#a7f3d0'],
  showcase: ['#ea580c', '#431407', '#fff7ed', '#c2410c', '#fed7aa'],
  briefing: ['#475569', '#0f172a', '#f8fafc', '#64748b', '#e2e8f0'],
};

export function normalizeHexColor(raw) {
  if (raw == null || raw === '') return null;
  let h = String(raw).trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(h)) {
    h = h.split('').map((c) => c + c).join('');
  }
  if (/^[0-9a-fA-F]{6}$/.test(h)) return `#${h.toLowerCase()}`;
  if (/^[0-9a-fA-F]{8}$/.test(h)) return `#${h.slice(0, 6).toLowerCase()}`;
  return null;
}

function luminance(hex) {
  const n = normalizeHexColor(hex);
  if (!n) return 0.5;
  const r = parseInt(n.slice(1, 3), 16) / 255;
  const g = parseInt(n.slice(3, 5), 16) / 255;
  const b = parseInt(n.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function extractHexColorsFromMarkdown(md, limit = 12) {
  const found = [];
  const re = /#([0-9a-fA-F]{3,8})\b/g;
  let match;
  while ((match = re.exec(md)) !== null) {
    const n = normalizeHexColor(match[1]);
    if (n && !found.includes(n)) found.push(n);
  }
  return found.slice(0, limit);
}

/** Build 5-color preview palette from design-system markdown. */
export function buildOdPreviewPalette(md, fallbackAccent) {
  const hexes = extractHexColorsFromMarkdown(md);
  const accent = normalizeHexColor(fallbackAccent) || hexes[0] || '#6366f1';
  const dark = hexes.find((h) => luminance(h) < 0.2) || '#0f1115';
  const light = hexes.find((h) => luminance(h) > 0.85) || '#f7f8f8';
  const muted = hexes.find((h) => h !== accent && h !== dark && h !== light && luminance(h) > 0.35 && luminance(h) < 0.7)
    || hexes[3]
    || '#8a8f98';
  const border = hexes.find((h) => h !== accent && h !== dark && h !== light && h !== muted)
    || hexes[4]
    || muted;
  return [accent, dark, light, muted, border];
}

export function resolvePptStylePalette(styleId) {
  return PPT_STYLE_PALETTES[styleId] ?? ['#111827', '#f9fafb', '#2563eb', '#e5e7eb', '#9ca3af'];
}

export function resolvePptCanvasPalette(canvasId) {
  return PPT_CANVAS_PALETTES[canvasId] ?? ['#2563eb', '#0f172a', '#f8fafc', '#64748b', '#e2e8f0'];
}

export function resolvePptModePalette(modeId) {
  return PPT_MODE_PALETTES[modeId] ?? ['#475569', '#0f172a', '#f8fafc', '#64748b', '#e2e8f0'];
}
