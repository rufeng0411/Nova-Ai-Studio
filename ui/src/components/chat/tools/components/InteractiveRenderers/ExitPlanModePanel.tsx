import React, { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, ClipboardList, MessageSquareText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PermissionPanelProps } from '../../configs/permissionPanelRegistry';
import { MarkdownContent } from '../ContentRenderers/MarkdownContent';

const EXIT_PLAN_MODE_QUESTION = 'What should happen next?';

function normalizePlanText(text: string): string {
 return text.replace(/\\n/g, '\n').trim();
}

function stringifyPlanCandidate(value: unknown): string | null {
 if (typeof value === 'string') {
 const normalized = normalizePlanText(value);
 return normalized || null;
 }

 if (Array.isArray(value)) {
 const parts = value
 .map((item) => stringifyPlanCandidate(item))
 .filter((item): item is string => Boolean(item));
 return parts.length > 0 ? parts.join('\n\n') : null;
 }

 if (!value || typeof value !== 'object') {
 return null;
 }

 const record = value as Record<string, unknown>;
 for (const key of ['plan', 'planContent', 'content', 'markdown', 'text', 'body']) {
 const candidate = stringifyPlanCandidate(record[key]);
 if (candidate) return candidate;
 }

 return null;
}

export function extractPlanMarkdown(input: unknown): string {
 const plan = stringifyPlanCandidate(input);
 if (plan) return plan;

 if (input === undefined || input === null) {
 return '';
 }

 if (typeof input === 'object' && !Array.isArray(input)) {
 const record = input as Record<string, unknown>;
 const keys = Object.keys(record);
 const onlyPermissionHints = keys.length === 0 || keys.every((key) => (
 key === 'allowedPrompts' ||
 key === 'planFilePath'
 ));
 if (onlyPermissionHints) {
 return '';
 }
 }

 try {
 return JSON.stringify(input, null, 2);
 } catch {
 return String(input);
 }
}

export const ExitPlanModePanel: React.FC<PermissionPanelProps> = ({
 request,
 onDecision,
 onPlanExecutionApproved,
}) => {
 const { t } = useTranslation('chat');
 const [feedback, setFeedback] = useState('');
 const [collapsed, setCollapsed] = useState(false);
 const plan = useMemo(() => {
 const extracted = extractPlanMarkdown(request.input);
 return extracted || t('plan.exitMode.syncingPlan');
 }, [request.input, t]);

 const handleExecute = () => {
 onPlanExecutionApproved?.();
 onDecision(request.requestId, {
 allow: true,
 updatedInput: {
 answers: {
 [EXIT_PLAN_MODE_QUESTION]: 'execute_plan',
 },
 },
 });
 };

 const handleContinuePlanning = () => {
 const trimmed = feedback.trim();
 onDecision(request.requestId, {
 allow: true,
 updatedInput: {
 answers: {
 [EXIT_PLAN_MODE_QUESTION]: 'continue_planning',
 },
 ...(trimmed
 ? {
 annotations: {
 [EXIT_PLAN_MODE_QUESTION]: {
 notes: trimmed,
 },
 },
 }
 : {}),
 },
 });
 };

 return (
 <div className="overflow-hidden rounded-2xl border border-blue-200 bg-card shadow-lg dark:border-blue-900/70">
 <div className="border-b border-blue-100 bg-blue-50/70 px-4 py-3 dark:border-blue-900/70 dark:bg-blue-950/25">
 <div className="flex items-start gap-3">
 <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-info dark:bg-blue-900/50">
 <ClipboardList className="h-4 w-4" strokeWidth={2} />
 </div>
 <div className="min-w-0 flex-1">
 <div className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
 {t('plan.exitMode.header')}
 </div>
 <div className="mt-0.5 text-xs text-muted-foreground">
 {t('plan.exitMode.subtitle')}
 </div>
 </div>
 <button
 type="button"
 onClick={() => setCollapsed((prev) => !prev)}
 className="ml-auto shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
 aria-label={collapsed ? 'Expand plan' : 'Collapse plan'}
 >
 {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
 </button>
 </div>
 </div>

 {!collapsed && (
 <div className="min-h-[200px] max-h-[50vh] overflow-y-auto px-4 py-3">
 <MarkdownContent
 content={plan}
 className="prose prose-sm max-w-none text-foreground dark:prose-invert"
 />
 </div>
 )}

 <div className="border-t border-border bg-sidebar/70 px-4 py-3 /40">
 <label className="mb-2 block text-xs font-medium text-muted-foreground">
 {t('plan.exitMode.feedbackLabel')}
 </label>
 <textarea
 value={feedback}
 onChange={(event) => setFeedback(event.target.value)}
 rows={3}
 placeholder={t('plan.exitMode.feedbackPlaceholder')}
 className="block w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:focus:border-blue-700 dark:focus:ring-blue-950"
 />
 <div className="mt-3 flex flex-wrap justify-end gap-2">
 <button
 type="button"
 onClick={handleContinuePlanning}
 className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
 >
 <MessageSquareText className="h-3.5 w-3.5" strokeWidth={2} />
 {t('plan.exitMode.continueButton')}
 </button>
 <button
 type="button"
 onClick={handleExecute}
 className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary"
 >
 <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
 {t('plan.exitMode.executeButton')}
 </button>
 </div>
 </div>
 </div>
 );
};
