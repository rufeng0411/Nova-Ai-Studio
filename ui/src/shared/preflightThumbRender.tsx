// PD-SAAS-FORK: Preflight card preview thumbs + color swatches (OD / PPT)
import type { PreflightCatalogEntry } from './preflightSelection';

export function normalizePreflightHex(raw?: string | null): string | null {
  if (raw == null || raw === '') return null;
  let h = String(raw).trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split('').map((c) => c + c).join('');
  if (/^[0-9a-fA-F]{6}$/.test(h)) return `#${h.toLowerCase()}`;
  if (/^[0-9a-fA-F]{8}$/.test(h)) return `#${h.slice(0, 6).toLowerCase()}`;
  return null;
}

export function resolvePreviewColors(item: PreflightCatalogEntry): string[] {
  const fromList = (item.colors ?? [])
    .map((c) => normalizePreflightHex(c))
    .filter((c): c is string => Boolean(c));
  if (fromList.length >= 3) return fromList.slice(0, 5);
  const accent = normalizePreflightHex(item.accent) ?? '#6366f1';
  return [accent, '#0f1115', '#f7f8f8', '#8a8f98', '#d0d4dc'];
}

function escapeXml(text: string): string {
  return text.replace(/[<>&"]/g, (ch) => {
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    if (ch === '&') return '&amp;';
    return '&quot;';
  });
}

export function buildOdThumbSvg(colors: string[], label: string): string {
  const [c0, c1, c2, c3, c4] = resolvePreviewColors({ id: '', label, colors });
  const safe = escapeXml(label.slice(0, 18));
  return `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<rect width="160" height="100" fill="${c2}"/>
<rect x="0" y="0" width="160" height="18" fill="${c1}" opacity="0.92"/>
<circle cx="12" cy="9" r="3" fill="${c0}"/>
<rect x="22" y="7" width="36" height="4" rx="1" fill="${c2}" opacity="0.5"/>
<rect x="10" y="28" width="70" height="8" rx="2" fill="${c1}"/>
<rect x="10" y="42" width="54" height="4" rx="1" fill="${c3}" opacity="0.45"/>
<rect x="10" y="50" width="48" height="4" rx="1" fill="${c3}" opacity="0.3"/>
<rect x="10" y="66" width="40" height="14" rx="3" fill="${c0}"/>
<rect x="90" y="28" width="60" height="52" rx="4" fill="${c4}"/>
<text x="10" y="94" fill="${c3}" font-size="7" font-family="Segoe UI,sans-serif">${safe}</text>
</svg>`;
}

export function buildPptStyleThumbSvg(colors: string[], label: string): string {
  const [c0, c1, c2, c3] = resolvePreviewColors({ id: '', label, colors });
  return `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<rect width="160" height="100" fill="${c1}"/>
<rect x="8" y="8" width="4" height="84" fill="${c2}"/>
<text x="18" y="28" fill="${c0}" font-size="11" font-weight="700" font-family="Segoe UI,sans-serif">${escapeXml(label.slice(0, 10))}</text>
<rect x="18" y="38" width="52" height="32" rx="4" fill="${c3}"/>
<rect x="76" y="38" width="52" height="32" rx="4" fill="${c3}"/>
<rect x="134" y="38" width="18" height="32" rx="4" fill="${c2}" opacity="0.85"/>
</svg>`;
}

export function buildPptCanvasThumbSvg(colors: string[], ratio?: string): string {
  const [c0, c1, c2] = resolvePreviewColors({ id: '', label: '', colors });
  const parts = (ratio ?? '16/9').split(/[/×x:]/).map((p) => Number(p.trim())).filter((n) => Number.isFinite(n) && n > 0);
  const rw = parts[0] ?? 16;
  const rh = parts[1] ?? 9;
  const maxW = 120;
  const maxH = 72;
  const scale = Math.min(maxW / rw, maxH / rh);
  const w = Math.round(rw * scale);
  const h = Math.round(rh * scale);
  const x = Math.round((160 - w) / 2);
  const y = Math.round((100 - h) / 2);
  return `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<rect width="160" height="100" fill="${c2}"/>
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${c1}" stroke="${c0}" stroke-width="2"/>
<text x="80" y="${y + h + 12}" text-anchor="middle" fill="${c0}" font-size="8" font-family="Segoe UI,sans-serif">${escapeXml(`${rw}:${rh}`)}</text>
</svg>`;
}

export function buildPptModeThumbSvg(colors: string[], modeId: string): string {
  const [c0, c1, c2, c3] = resolvePreviewColors({ id: modeId, label: '', colors });
  if (modeId === 'pyramid') {
    return `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="${c2}"/><polygon points="80,12 130,78 30,78" fill="${c0}" opacity="0.9"/><rect x="40" y="82" width="80" height="6" rx="2" fill="${c3}"/></svg>`;
  }
  if (modeId === 'narrative') {
    return `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="${c2}"/><path d="M20,70 Q50,20 80,45 T140,30" fill="none" stroke="${c0}" stroke-width="3"/><circle cx="20" cy="70" r="4" fill="${c1}"/><circle cx="140" cy="30" r="4" fill="${c0}"/></svg>`;
  }
  if (modeId === 'instructional') {
    return `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="${c2}"/><rect x="24" y="18" width="112" height="14" rx="3" fill="${c3}"/><rect x="24" y="40" width="112" height="14" rx="3" fill="${c3}"/><rect x="24" y="62" width="112" height="14" rx="3" fill="${c3}"/><circle cx="32" cy="25" r="4" fill="${c0}"/><circle cx="32" cy="47" r="4" fill="${c0}"/><circle cx="32" cy="69" r="4" fill="${c0}"/></svg>`;
  }
  if (modeId === 'showcase') {
    return `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="${c1}"/><rect x="16" y="20" width="128" height="48" rx="4" fill="${c0}" opacity="0.85"/><rect x="16" y="74" width="60" height="8" rx="2" fill="${c3}"/></svg>`;
  }
  return `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg"><rect width="160" height="100" fill="${c2}"/><rect x="20" y="22" width="120" height="10" rx="2" fill="${c3}"/><rect x="20" y="40" width="120" height="10" rx="2" fill="${c3}"/><rect x="20" y="58" width="120" height="10" rx="2" fill="${c3}"/></svg>`;
}

export type PreflightThumbKind = 'od' | 'ppt-style' | 'ppt-canvas' | 'ppt-mode';

export function buildPreflightThumbSvg(
  kind: PreflightThumbKind,
  item: PreflightCatalogEntry,
): string {
  const colors = resolvePreviewColors(item);
  if (kind === 'ppt-style') return buildPptStyleThumbSvg(colors, item.label);
  if (kind === 'ppt-canvas') return buildPptCanvasThumbSvg(colors, item.ratio ?? item.dim);
  if (kind === 'ppt-mode') return buildPptModeThumbSvg(colors, item.id);
  return buildOdThumbSvg(colors, item.label);
}

type ColorSwatchesProps = {
  colors: string[];
  className?: string;
};

export function ColorSwatches({ colors, className }: ColorSwatchesProps) {
  const row = resolvePreviewColors({ id: '', label: '', colors }).slice(0, 5);
  return (
    <div className={className ?? 'flex gap-0.5'} data-testid="preflight-color-swatches">
      {row.map((c) => (
        <span
          key={c}
          className="h-2 flex-1 rounded-sm border border-black/10 dark:border-white/10"
          style={{ backgroundColor: c }}
          title={c}
        />
      ))}
    </div>
  );
}

type PreflightCardThumbProps = {
  item: PreflightCatalogEntry;
  kind: PreflightThumbKind;
  eager?: boolean;
};

export { PreflightCardThumb } from './preflightCardThumb';
export type { PreflightCardThumbProps };
