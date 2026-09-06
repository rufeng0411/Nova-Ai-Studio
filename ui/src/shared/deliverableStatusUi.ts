/**
 * PD-SAAS-FORK: shared deliverable status labels for summary table + session dock.
 */

import type { TFunction } from 'i18next';
import type { SummaryRowStatus } from './buildDeliverableSummaryRows';

export function deliverableStatusLabel(
  status: SummaryRowStatus,
  t: TFunction<'chat'>,
  isDeliverableRepairActive = false,
): string {
  if ((status === 'missing' || status === 'needContinue') && isDeliverableRepairActive) {
    return t('deliverables.statusRepairing', { defaultValue: '补齐中…' });
  }
  switch (status) {
    case 'delivered':
      return t('deliverables.statusDelivered', { defaultValue: '已交付' });
    case 'missing':
      return t('deliverables.statusMissing', { defaultValue: '未完成' });
    case 'needContinue':
      return t('deliverables.statusNeedContinue', { defaultValue: '需继续' });
    case 'checking':
      return t('deliverables.statusChecking', { defaultValue: '校验中…' });
    case 'broken':
      return t('deliverables.statusBroken', { defaultValue: '需修复' });
    case 'hidden':
      return t('deliverables.statusHidden', { defaultValue: '已隐藏' });
    default: {
      const _exhaustive: never = status;
      return String(_exhaustive);
    }
  }
}
