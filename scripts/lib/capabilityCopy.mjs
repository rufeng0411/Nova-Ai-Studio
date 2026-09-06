/** PD-SAAS-FORK: 能力目录占位文案 — catalog/i18n/UI 共用 */
export const CAPABILITY_COPY_PLACEHOLDER = '未提供描述';

export function isCapabilityCopyPlaceholder(value) {
  if (value == null || typeof value !== 'string') return true;
  return value.trim() === CAPABILITY_COPY_PLACEHOLDER || value.trim().length === 0;
}

export function coalesceCapabilityCopy({ description, taskSummary, displayName, slug, name }) {
  const summary = isCapabilityCopyPlaceholder(taskSummary) ? '' : String(taskSummary).trim();
  const desc = isCapabilityCopyPlaceholder(description) ? '' : String(description).trim();
  const label = String(displayName || name || slug || '').trim();
  const finalSummary = summary || desc || (label && label !== slug ? label : CAPABILITY_COPY_PLACEHOLDER);
  const finalDescription = desc || (summary ? `${summary}。按技能指引产出可交付文件。` : finalSummary);
  return {
    task_summary: finalSummary,
    description: isCapabilityCopyPlaceholder(finalDescription) ? finalSummary : finalDescription,
  };
}
