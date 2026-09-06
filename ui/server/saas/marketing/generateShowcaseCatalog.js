// PD-SAAS-FORK: Regenerate window.NOVA_SHOWCASE_CATALOG for marketing showcase overlay
import fs from 'node:fs';
import path from 'node:path';
import { resolveShowcaseDataRoot } from './showcaseFlags.js';

const BRAND_NOTE_ZH =
  '均产出自 Nova Studio N2（Nova Ai-Studio 2.0）';
const BRAND_NOTE_EN =
  'All produced with Nova Studio N2 (Nova Ai-Studio 2.0)';
const AUTONOMY_NOTE_ZH =
  '以下案例均通过提示词由 AI 自主完成，所见即为可打开验收的成果。';
const AUTONOMY_NOTE_EN =
  'Every case below was completed autonomously by AI from a prompt — what you open is the deliverable.';
const EMPTY_HINT_ZH = '精彩案例正在整理中，即将更新';
const EMPTY_HINT_EN = 'Featured cases are being prepared — coming soon';

/**
 * @param {unknown} value
 */
function escJsString(value) {
  return JSON.stringify(String(value ?? ''));
}

/**
 * @param {{
 *   dataRoot?: string | null;
 *   sections: Array<Record<string, unknown>>;
 *   items: Array<Record<string, unknown>>;
 * }} input
 * @returns {{ ok: true, catalogPath: string, sectionCount: number, itemCount: number }}
 */
export function regenShowcaseCatalog(input) {
  // dataRoot here is SHOWCASE_DATA_ROOT (…/marketing-showcase), not parent DATA_ROOT
  const showcaseRoot =
    (input.dataRoot && String(input.dataRoot).trim()) ||
    resolveShowcaseDataRoot(process.env);
  if (!showcaseRoot) {
    throw new Error('showcase_data_root_unresolved');
  }

  const published = (input.items ?? []).filter((row) => row.status === 'published');
  const sectionRows = [...(input.sections ?? [])].sort(
    (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
  );

  /** @type {Array<Record<string, unknown>>} */
  const sections = [];
  let itemCount = 0;

  for (const sec of sectionRows) {
    const secItems = published
      .filter((item) => item.section_id === sec.id)
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

    /** @type {Array<Record<string, unknown>>} */
    const catalogItems = secItems.map((item) => {
      itemCount += 1;
      const nameZh = item.name_zh ?? item.name ?? '';
      const nameEn = item.name_en ?? nameZh;
      const annotationZh = item.annotation_zh ?? item.annotation ?? '';
      const annotationEn = item.annotation_en ?? annotationZh;
      const badgeZh = item.badge_zh ?? item.badge ?? '';
      const badgeEn = item.badge_en ?? badgeZh;
      const promptZh = item.prompt_zh ?? item.prompt ?? '';
      const promptEn = item.prompt_en ?? promptZh;
      return {
        id: item.id,
        name: nameZh,
        name_zh: nameZh,
        name_en: nameEn,
        annotation: annotationZh,
        annotation_zh: annotationZh,
        annotation_en: annotationEn,
        badge: badgeZh,
        badge_zh: badgeZh,
        badge_en: badgeEn,
        prompt: promptZh,
        prompt_zh: promptZh,
        prompt_en: promptEn,
        thumb: item.thumb ?? '',
        href: item.href ?? '',
        ...(Number(item.star) ? { star: true } : {}),
      };
    });

    const titleZh = sec.title_zh ?? sec.title ?? sec.id;
    const titleEn = sec.title_en ?? titleZh;
    const leadZh = sec.lead_zh ?? sec.lead ?? '';
    const leadEn = sec.lead_en ?? leadZh;

    // Keep empty sections so front TOC / museum wall stays stable
    sections.push({
      id: sec.id,
      title: titleZh,
      title_zh: titleZh,
      title_en: titleEn,
      lead: leadZh,
      lead_zh: leadZh,
      lead_en: leadEn,
      ...(Number(sec.star) ? { star: true } : {}),
      items: catalogItems,
    });
  }

  const catalog = {
    brandNote: BRAND_NOTE_ZH,
    brandNote_zh: BRAND_NOTE_ZH,
    brandNote_en: BRAND_NOTE_EN,
    autonomyNote: AUTONOMY_NOTE_ZH,
    autonomyNote_zh: AUTONOMY_NOTE_ZH,
    autonomyNote_en: AUTONOMY_NOTE_EN,
    emptyHint_zh: EMPTY_HINT_ZH,
    emptyHint_en: EMPTY_HINT_EN,
    sections,
  };

  const sharedDir = path.join(showcaseRoot, 'shared');
  fs.mkdirSync(sharedDir, { recursive: true });
  const catalogPath = path.join(sharedDir, 'catalog.js');
  const body = `/**
 * PD-SAAS-FORK: auto-generated showcase catalog (published items only)
 * Do not hand-edit — use Showcase admin or regenShowcaseCatalog.
 */
window.NOVA_SHOWCASE_CATALOG = ${JSON.stringify(catalog, null, 2)};
`;
  fs.writeFileSync(catalogPath, body, 'utf8');

  return {
    ok: true,
    catalogPath,
    sectionCount: sections.length,
    itemCount,
  };
}
