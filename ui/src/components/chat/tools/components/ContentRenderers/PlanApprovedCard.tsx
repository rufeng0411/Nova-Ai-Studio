import React from 'react';
import { ClipboardList, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { localizeToolUiString } from '../../../../../shared/localizeToolDisplayText';

interface PlanApprovedCardProps {
 planTitle: string;
 planSummary: string;
 planFilePath: string;
 onViewPlan: () => void;
}

/** PD-SAAS-FORK: hide shell when exit_plan_mode has no summary and no plan file. */
export function planApprovedCardHasContent(planSummary: string, planFilePath: string): boolean {
 return Boolean(planFilePath?.trim()) || Boolean(planSummary?.trim());
}

export const PlanApprovedCard: React.FC<PlanApprovedCardProps> = ({
 planTitle,
 planSummary,
 planFilePath,
 onViewPlan,
}) => {
 const { t } = useTranslation('chat');
 if (!planApprovedCardHasContent(planSummary, planFilePath)) {
 return null;
 }
 const hasFilePath = Boolean(planFilePath);
 const displayTitle = localizeToolUiString(planTitle, t);

 return (
 <div className="overflow-hidden rounded-xl border border-indigo-200 bg-card dark:border-indigo-900/60">
 <div className="flex items-center gap-2.5 border-b border-indigo-100 bg-indigo-50/50 px-4 py-2.5 dark:border-indigo-900/50 dark:bg-indigo-950/20">
 <ClipboardList className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" strokeWidth={2} />
 <span className="truncate text-sm font-semibold text-foreground">
 {displayTitle}
 </span>
 </div>

 {planSummary && (
 <div className="px-4 py-2.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
 {planSummary}
 </div>
 )}

 <div className="flex items-center justify-end border-t border-indigo-100 px-4 py-2 dark:border-indigo-900/50">
 <button
 type="button"
 onClick={onViewPlan}
 disabled={!hasFilePath}
 className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-card px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/30"
 >
 <FileText className="h-3.5 w-3.5" strokeWidth={2} />
 {t('plan.approvedCard.viewPlan', { defaultValue: 'View Plan' })}
 </button>
 </div>
 </div>
 );
};
