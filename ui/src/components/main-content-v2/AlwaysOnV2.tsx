import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, ListChecks } from 'lucide-react';
import type { AlwaysOnSubTab, Project } from '../../types/app';
import { cn } from '../../lib/utils.js';
import AlwaysOnDashboard from './AlwaysOnDashboard';
import PlansAndCronJobs from './PlansAndCronJobs';
import RunDetail from './RunDetail';

type PlanDetailTarget = {
 planId: string;
 projectName: string;
 projectDisplayName: string;
 sourceRunId: string;
 projectKey: string;
};

const SUB_TABS: { id: AlwaysOnSubTab; labelKey: string; defaultLabel: string; icon: typeof BarChart3 }[] = [
 { id: 'dashboard', labelKey: 'tabs.dashboard', defaultLabel: 'Dashboard', icon: BarChart3 },
 { id: 'plans-cron', labelKey: 'tabs.plansCron', defaultLabel: 'Plans & Cron Jobs', icon: ListChecks },
];

type AlwaysOnV2Props = {
 selectedProject: Project | null;
 subTab: AlwaysOnSubTab;
 onSubTabChange: (tab: AlwaysOnSubTab) => void;
 onApplyWorkCycle?: (projectName: string, cycleId: string) => Promise<void>;
 onOpenExecutionSession?: (projectKey: string, runId: string, projectName?: string) => void;
};

export default function AlwaysOnV2({
 selectedProject,
 subTab,
 onSubTabChange,
 onApplyWorkCycle,
 onOpenExecutionSession,
}: AlwaysOnV2Props) {
 const { t } = useTranslation('alwaysOn');
 const [planDetail, setPlanDetail] = useState<PlanDetailTarget | null>(null);

 const handleOpenPlanDetail = useCallback(
 (planId: string, projectName: string, projectDisplayName: string, sourceRunId: string, projectKey: string) => {
 setPlanDetail({ planId, projectName, projectDisplayName, sourceRunId, projectKey });
 },
 [],
 );

 if (!selectedProject) {
 return (
 <div className="flex h-full items-center justify-center bg-card text-[13px] text-muted-foreground">
 {t('emptyProject', { defaultValue: 'Pick a project to view Always-On.' })}
 </div>
 );
 }

 return (
 <div className="flex h-full flex-col bg-background">
 {/* Sub-tab bar */}
 <div className="flex shrink-0 gap-1 border-b border-border px-8 pt-4">
 {SUB_TABS.map((tab) => {
 const Icon = tab.icon;
 const isActive = subTab === tab.id;
 return (
 <button
 key={tab.id}
 type="button"
 onClick={() => onSubTabChange(tab.id)}
 className={cn(
 'inline-flex items-center gap-1.5 border-b-2 px-3 pb-2 text-[13px] font-medium transition-colors',
 isActive
 ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
 : 'border-transparent text-muted-foreground hover:text-foreground',
 )}
 >
 <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
 {t(tab.labelKey, { defaultValue: tab.defaultLabel })}
 </button>
 );
 })}
 </div>

 {/* Sub-tab content */}
 <div className="min-h-0 flex-1 overflow-y-auto">
 {planDetail ? (
 <RunDetail
 planId={planDetail.planId}
 projectName={planDetail.projectName}
 projectDisplayName={planDetail.projectDisplayName}
 runId={planDetail.sourceRunId}
 projectKey={planDetail.projectKey}
 backLabel={t('dashboard.runDetail.backToPlans', { defaultValue: 'Back to Plans & Cron Jobs' })}
 onBack={() => setPlanDetail(null)}
 onOpenExecutionSession={onOpenExecutionSession}
 />
 ) : subTab === 'dashboard' ? (
 <AlwaysOnDashboard onOpenExecutionSession={onOpenExecutionSession} />
 ) : (
 <PlansAndCronJobs onApplyWorkCycle={onApplyWorkCycle} onOpenPlanDetail={handleOpenPlanDetail} />
 )}
 </div>
 </div>
 );
}
