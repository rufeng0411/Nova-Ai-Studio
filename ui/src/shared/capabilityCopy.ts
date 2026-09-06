/** PD-SAAS-FORK: 能力卡片占位文案 — 与 catalog 生成脚本保持一致 */

export const CAPABILITY_COPY_PLACEHOLDER = '未提供描述';

export function isCapabilityCopyPlaceholder(value?: string | null): boolean {
  if (!value) return true;
  return value.trim() === CAPABILITY_COPY_PLACEHOLDER;
}

export function resolveCapabilityDescription(item: {
  description?: string;
  task_summary?: string;
}): string {
  const desc = item.description?.trim() || '';
  const summary = item.task_summary?.trim() || '';
  if (!isCapabilityCopyPlaceholder(desc)) return desc;
  if (!isCapabilityCopyPlaceholder(summary)) return summary;
  return '';
}

export function resolveCapabilityTaskSummary(item: {
  task_summary?: string;
  description?: string;
  display_name?: string;
  name?: string;
}): string {
  const summary = item.task_summary?.trim() || '';
  if (!isCapabilityCopyPlaceholder(summary)) return summary;
  const desc = item.description?.trim() || '';
  if (!isCapabilityCopyPlaceholder(desc)) return desc;
  return item.display_name?.trim() || item.name?.trim() || '';
}
