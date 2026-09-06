// PD-SAAS-FORK: Hub hover hints for deliverable capabilities (10a)

const PPT_SLUGS = new Set([
  'anth-pptx',
  'html-ppt-skill',
  'nova-ppt-aesthetic-slides',
  'slide-deck-html',
]);

const DOC_SLUGS = new Set([
  'anth-docx',
  'pd-docx',
  'research-report',
]);

const ZH_HINT =
  '使用前请准备主题说明或上传源文件（docx/pdf）；若需 OCR/导出 Key，请在「设置 → 能力接入」配置。也可在对话里写「直接开始做」。';

const EN_HINT =
  'Prepare a topic or upload a source file (docx/pdf). Configure OCR/export keys under Settings → Providers if needed, or say "just start" in chat.';

export function capabilityNeedsPrerequisiteHint(slug: string | undefined): boolean {
  if (!slug?.trim()) return false;
  return PPT_SLUGS.has(slug) || DOC_SLUGS.has(slug);
}

export function capabilityPrerequisiteHint(
  slug: string | undefined,
  locale: string,
): string | null {
  if (!capabilityNeedsPrerequisiteHint(slug)) return null;
  return locale.startsWith('zh') ? ZH_HINT : EN_HINT;
}

export function appendCapabilityPrerequisiteHint(
  description: string,
  slug: string | undefined,
  locale: string,
): string {
  const hint = capabilityPrerequisiteHint(slug, locale);
  if (!hint) return description;
  const base = description?.trim() || '';
  if (base.includes(hint.slice(0, 12))) return base;
  return base ? `${base}\n\n${hint}` : hint;
}
