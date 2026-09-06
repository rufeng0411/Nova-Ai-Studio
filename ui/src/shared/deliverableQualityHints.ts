/**
 * PD-SAAS-FORK: quality vs path separation — weak hints only, never trigger engine repair.
 */

import { classifyDeliverablePath } from './artifactPaths';

export type DeliverableQualityHint = {
  id: 'office_open' | 'download_fallback' | 'preview_limited';
  messageKey: string;
  defaultMessage: string;
};

const OFFICE_KINDS = new Set(['docx', 'document', 'pptx', 'presentation', 'xlsx', 'spreadsheet', 'pdf']);

export function resolveDeliverableQualityHint(
  filePath: string,
  options?: { previewFailed?: boolean; openFailed?: boolean },
): DeliverableQualityHint | null {
  const kind = classifyDeliverablePath(filePath);
  if (!OFFICE_KINDS.has(kind)) return null;

  if (options?.previewFailed || options?.openFailed) {
    return {
      id: 'office_open',
      messageKey: 'deliverables.qualityHintOfficeOpen',
      defaultMessage: '文件已生成，若预览异常可下载后用 Office 或 WPS 打开。',
    };
  }

  if (kind === 'pdf' && options?.previewFailed) {
    return {
      id: 'preview_limited',
      messageKey: 'deliverables.qualityHintPreviewLimited',
      defaultMessage: 'PDF 已就绪，可下载后在本地阅读器打开。',
    };
  }

  return null;
}

export function shouldSuppressDeliverableRepairForQualityHint(hint: DeliverableQualityHint | null): boolean {
  return hint?.id === 'office_open' || hint?.id === 'preview_limited';
}
