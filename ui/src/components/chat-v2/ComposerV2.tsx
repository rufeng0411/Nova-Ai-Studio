import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import type {
 ChangeEvent,
 ClipboardEvent,
 FormEvent,
 KeyboardEvent,
 MouseEvent,
 RefObject,
} from 'react';
import {
 ArrowUp,
 AtSign,
 Bot,
 Check,
 ChevronDown,
 CircleGauge,
 ListChecks,
 Loader2,
 Paperclip,
 Sparkles,
 Play,
 Square,
 type LucideIcon,
} from 'lucide-react';
import type { ChatRunMode, PendingPermissionRequest } from '../chat/types/types';
import PermissionRequestsBanner from '../chat/view/subcomponents/PermissionRequestsBanner';
import ImageAttachment from '../chat/view/subcomponents/ImageAttachment';
import ReferenceMaterialCards from '../chat/view/subcomponents/ReferenceMaterialCards';
import CommandMenu from '../chat/view/subcomponents/CommandMenu';
import { pathsToReferenceAttachments } from '../../shared/referenceMaterials';
import { cn } from '../../lib/utils.js';
import { CONTENT_WIDTH, SURFACE_COMPOSER } from './conversationSurfaceTokens';
import { useMobileShell } from '../../hooks/useMobileShell';
import {
  handleComposerTextareaClick,
  handleComposerTextareaPointerDown,
} from '../../shared/composerInputCompat';
import { shouldSilenceToolPermissionPrompt } from '../chat/utils/chatPermissions';
import { useWorkbenchBetaSurface } from '../../saas/workbench-beta/surface/WorkbenchBetaSurface';

interface MentionableFile {
 name: string;
 path: string;
}

interface SlashCommand {
 name: string;
 description?: string;
 namespace?: string;
 path?: string;
 type?: string;
 metadata?: Record<string, unknown>;
 [key: string]: unknown;
}

export type ComposerV2Props = {
 input: string;
 placeholder: string;
 textareaRef: RefObject<HTMLTextAreaElement>;
 fileReferencePaths?: string[];
 onRemoveFileReference?: (path: string) => void;
 onInputChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
 onTextareaClick: (event: MouseEvent<HTMLTextAreaElement>) => void;
 onTextareaKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
 onTextareaPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
 onTextareaInput: (event: FormEvent<HTMLTextAreaElement>) => void;
 onInputFocusChange?: (focused: boolean) => void;
 onSubmit: (event: FormEvent<HTMLFormElement>) => void;
 onAbortSession: () => void;
 openImagePicker: () => void;
 attachedImages: File[];
 onRemoveImage: (index: number) => void;
 uploadingImages: Map<string, number>;
 imageErrors: Map<string, string>;

 showFileDropdown: boolean;
 filteredFiles: MentionableFile[];
 selectedFileIndex: number;
 onSelectFile: (file: MentionableFile) => void;

 filteredCommands: SlashCommand[];
 selectedCommandIndex: number;
 onCommandSelect: (command: SlashCommand, index: number, isHover: boolean) => void;
 onCloseCommandMenu: () => void;
 isCommandMenuOpen: boolean;
 frequentCommands: SlashCommand[];

 onToggleCommandMenu: () => void;
 onInsertMention: () => void;
 onInsertSlash: () => void;
 onOpenTemplatesHub?: () => void;
 getRootProps: (...args: unknown[]) => Record<string, unknown>;
 getInputProps: (...args: unknown[]) => Record<string, unknown>;
 isDragActive: boolean;

 isLoading: boolean;
 canAbortSession: boolean;
 /** When set, overrides legacy `isLoading && canAbortSession` for the primary action button. */
 showStopButton?: boolean;
 /** PD-SAAS-FORK: manual task resume (auto-continue off). */
 showContinueButton?: boolean;
 onManualContinue?: () => void;
 isManualContinuePending?: boolean;
 manualContinueHint?: string;
 isConnected?: boolean;
 isAbortPending?: boolean;
 isSubmitPending?: boolean;
 tokenBudget?: Record<string, unknown> | null;

 pendingPermissionRequests: PendingPermissionRequest[];
 handlePermissionDecision: (
 requestIds: string | string[],
 decision: {
 allow?: boolean;
 message?: string;
 rememberEntry?: string | null;
 updatedInput?: unknown;
 },
 ) => void;
 handleGrantToolPermission: (suggestion: {
 entry: string;
 toolName: string;
 }) => { success: boolean };
 runMode: ChatRunMode;
 onRunModeChange: (mode: ChatRunMode) => void;
 planModeAvailable?: boolean;
 onPlanExecutionApproved?: () => void;

 sendByCtrlEnter?: boolean;

 chromeless?: boolean;
};

type ContextStatus = {
 known: boolean;
 used: number;
 total: number;
 percent: number;
 usedLabel: string;
 totalLabel: string;
 tone: 'normal' | 'amber' | 'red' | 'unknown';
};

type RunModeOption = {
 mode: ChatRunMode;
 Icon: LucideIcon;
 labelKey: string;
 defaultLabel: string;
};

const RUN_MODE_OPTIONS: RunModeOption[] = [
 {
 mode: 'agent',
 Icon: Bot,
 labelKey: 'input.runModes.agent',
 defaultLabel: 'Agent',
 },
 {
 mode: 'plan',
 Icon: ListChecks,
 labelKey: 'input.runModes.plan',
 defaultLabel: 'Plan',
 },
];


const BLOCKING_PERMISSION_TOOLS = new Set([
 'AskUserQuestion',
 'ask_user_question',
 'ExitPlanMode',
 'ExitPlanModeV2',
 'exit_plan_mode',
]);



function readNumber(value: unknown): number | null {
 if (typeof value === 'number' && Number.isFinite(value)) return value;
 if (typeof value === 'string' && value.trim()) {
 const parsed = Number(value);
 return Number.isFinite(parsed) ? parsed : null;
 }
 return null;
}

function formatTokenCount(value: number): string {
 if (value >= 1_000_000) {
 return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
 }
 if (value >= 1_000) {
 return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}k`;
 }
 return value.toLocaleString();
}

function getContextStatus(tokenBudget?: Record<string, unknown> | null): ContextStatus {
 const used = readNumber(tokenBudget?.used) ?? 0;
 const total = readNumber(tokenBudget?.total) ?? 0;
 if (total <= 0) {
 return {
 known: false,
 used: 0,
 total: 0,
 percent: 0,
 usedLabel: '--',
 totalLabel: '--',
 tone: 'unknown',
 };
 }

 const percent = Math.max(0, Math.min(999, Math.round((used / total) * 100)));
 const snapshotState = typeof tokenBudget?.state === 'string' ? tokenBudget.state : null;
 const tone = snapshotState === 'blocking'
 ? 'red'
 : snapshotState === 'warning'
 ? 'amber'
 : percent >= 95
 ? 'red'
 : percent >= 80
 ? 'amber'
 : 'normal';
 return {
 known: true,
 used,
 total,
 percent,
 usedLabel: formatTokenCount(used),
 totalLabel: formatTokenCount(total),
 tone,
 };
}

export default function ComposerV2({
 input,
 placeholder,
 textareaRef,
 fileReferencePaths = [],
 onRemoveFileReference,
 onInputChange,
 onTextareaClick,
 onTextareaKeyDown,
 onTextareaPaste,
 onTextareaInput,
 onInputFocusChange,
 onSubmit,
 onAbortSession,
 openImagePicker,
 attachedImages,
 onRemoveImage,
 uploadingImages,
 imageErrors,
 showFileDropdown,
 filteredFiles,
 selectedFileIndex,
 onSelectFile,
 filteredCommands,
 selectedCommandIndex,
 onCommandSelect,
 onCloseCommandMenu,
 isCommandMenuOpen,
 frequentCommands,
 onToggleCommandMenu: _onToggleCommandMenu,
 onInsertMention,
 onOpenTemplatesHub,
 getRootProps,
 getInputProps,
 isDragActive,
 isLoading,
 canAbortSession,
 showStopButton,
 showContinueButton = false,
 onManualContinue,
 isManualContinuePending = false,
 manualContinueHint,
 isConnected = true,
 isAbortPending = false,
 isSubmitPending = false,
 tokenBudget,
 pendingPermissionRequests,
 handlePermissionDecision,
 handleGrantToolPermission,
 runMode,
 onRunModeChange,
 planModeAvailable = true,
 onPlanExecutionApproved,
 chromeless = false,
}: ComposerV2Props) {
 const { t } = useTranslation('chat');
 const { t: tHub } = useTranslation('templatesHub');
 const isMobileShell = useMobileShell();
 // PD-SAAS-FORK: Demo composer chrome only when parallel Beta surface is active.
 const betaSurface = useWorkbenchBetaSurface();
 const [isContextPopoverOpen, setIsContextPopoverOpen] = useState(false);
 const [isRunModeMenuOpen, setIsRunModeMenuOpen] = useState(false);

 const hasBlockingPermissionPanel = pendingPermissionRequests.some(
 (request) => BLOCKING_PERMISSION_TOOLS.has(request.toolName) || request.isElicitation,
 );
 const composerPermissionRequests = pendingPermissionRequests.filter(
 (request) => !request.isElicitation
   && !BLOCKING_PERMISSION_TOOLS.has(request.toolName)
   && !shouldSilenceToolPermissionPrompt(),
 );

 const referenceMaterialAttachments = pathsToReferenceAttachments(fileReferencePaths);
 const hasDraftContent =
 input.trim().length > 0 || attachedImages.length > 0 || referenceMaterialAttachments.length > 0;
 const hasUploadingImages = uploadingImages.size > 0;
 const disabled = !hasDraftContent || isLoading || isSubmitPending || hasUploadingImages;
 const stopVisible = showStopButton ?? (isLoading && canAbortSession);
 const contextStatus = getContextStatus(tokenBudget);
 const selectedRunModeOption =
 RUN_MODE_OPTIONS.find((option) => option.mode === runMode) ||
 RUN_MODE_OPTIONS[0];
 const SelectedRunModeIcon = selectedRunModeOption.Icon;
 const selectedRunModeLabel = t(selectedRunModeOption.labelKey, {
 defaultValue: selectedRunModeOption.defaultLabel,
 }) as string;
 const contextStatusTitle = contextStatus.known
 ? (t('input.contextStatus', {
 percent: contextStatus.percent,
 used: contextStatus.usedLabel,
 total: contextStatus.totalLabel,
 defaultValue:
 `${contextStatus.percent}% used. ${contextStatus.usedLabel} tokens used out of ${contextStatus.totalLabel}. Auto compact runs near the limit.`,
 }) as string)
 : (t('input.contextStatusUnknown', {
 defaultValue: 'Context usage unknown. It will appear after the next model response.',
 }) as string);

 return (
 <div
 className={cn(
 'shrink-0',
 // PD-SAAS-FORK: no full-width footer fill under composer — keep padding only.
 // Tighter inset on phones — the mobile shell already reserves bottom space for the tab bar.
 chromeless ? '' : 'px-6 pb-3.5 pt-2.5 max-md:px-3.5 max-md:pb-2.5 max-md:pt-2',
 )}
 >
 <div className={cn(chromeless ? '' : CONTENT_WIDTH)}>
 {composerPermissionRequests.length > 0 ? (
 <div className="mb-3">
 <PermissionRequestsBanner
 pendingPermissionRequests={composerPermissionRequests}
 handlePermissionDecision={handlePermissionDecision}
 handleGrantToolPermission={handleGrantToolPermission}
 onPlanExecutionApproved={onPlanExecutionApproved}
 />
 </div>
 ) : null}

 {!hasBlockingPermissionPanel ? (
 <form
 onSubmit={onSubmit as (event: FormEvent<HTMLFormElement>) => void}
 className="relative"
 >
 {(attachedImages.length > 0 || referenceMaterialAttachments.length > 0) ? (
 <div className="mb-2 rounded-lg border border-border bg-sidebar p-2">
 {referenceMaterialAttachments.length > 0 && onRemoveFileReference ? (
 <ReferenceMaterialCards
 attachments={referenceMaterialAttachments}
 onRemove={onRemoveFileReference}
 className={attachedImages.length > 0 ? 'mb-2' : undefined}
 />
 ) : null}
 {attachedImages.length > 0 ? (
 <div className="flex flex-wrap gap-2">
 {attachedImages.map((file, index) => (
 <ImageAttachment
 key={index}
 file={file}
 onRemove={() => onRemoveImage(index)}
 uploadProgress={uploadingImages.get(file.name)}
 error={imageErrors.get(file.name)}
 />
 ))}
 </div>
 ) : null}
 </div>
 ) : null}

 {showFileDropdown && filteredFiles.length > 0 ? (
 <div className="absolute bottom-full left-0 right-0 z-50 mb-2 max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
 {filteredFiles.map((file, index) => (
 <div
 key={file.path}
 className={cn(
 'cursor-pointer border-b border-border px-3 py-2 text-[13px] last:border-b-0',
 index === selectedFileIndex
 ? 'bg-muted'
 : 'hover:bg-sidebar /60',
 )}
 onMouseDown={(event) => {
 event.preventDefault();
 event.stopPropagation();
 }}
 onClick={(event) => {
 event.preventDefault();
 event.stopPropagation();
 onSelectFile(file);
 }}
 >
 <div className="font-medium">{file.name}</div>
 <div className="font-mono text-[11px] text-muted-foreground">
 {file.path}
 </div>
 </div>
 ))}
 </div>
 ) : null}


 <div
 {...getRootProps()}
 className={cn(
 'composer-input-shell group relative p-2 transition-[border-color,box-shadow] duration-150',
 betaSurface.active ? 'wb-beta-composer' : SURFACE_COMPOSER,
 !betaSurface.active && 'border-border focus-within:border-border',
 !betaSurface.active && 'dark:focus-within:border-border',
 isDragActive && 'border-dashed border-neutral-400 dark:border-neutral-500',
 )}
 data-wb-beta-composer={betaSurface.active ? '1' : undefined}
 >
 <input {...getInputProps()} />
 {isDragActive ? (
 <div
 className="pointer-events-none absolute inset-x-2 top-2 z-10 rounded-md bg-muted/90 px-2 py-1 text-center text-[11px] text-muted-foreground"
 role="status"
 >
 {tHub('mdBrowserDropHint', { defaultValue: '松开以在 Markdown 浏览器中打开 .md 文件' })}
 </div>
 ) : null}

 <CommandMenu
 commands={filteredCommands}
 selectedIndex={selectedCommandIndex}
 onSelect={onCommandSelect}
 onClose={onCloseCommandMenu}
 isOpen={isCommandMenuOpen}
 frequentCommands={frequentCommands}
 position={(() => {
 const ta = textareaRef?.current;
 if (!ta) return { top: 0, left: 0, bottom: 90 };
 const rect = ta.getBoundingClientRect();
 return { top: rect.top - 8, left: rect.left, bottom: window.innerHeight - rect.top + 8 };
 })()}
 />

 <div className="relative">
 <textarea
 ref={textareaRef}
 data-testid="chat-composer-textarea"
 value={input}
 onChange={onInputChange}
 onMouseDown={(event) => handleComposerTextareaPointerDown(event)}
 onPointerDown={(event) => handleComposerTextareaPointerDown(event)}
 onClick={(event) => handleComposerTextareaClick(event, onTextareaClick)}
 onKeyDown={onTextareaKeyDown}
 onPaste={onTextareaPaste}
 onFocus={() => onInputFocusChange?.(true)}
 onBlur={() => onInputFocusChange?.(false)}
 onInput={onTextareaInput}
 placeholder={placeholder}
 rows={2}
 className="composer-textarea relative z-10 block max-h-[40vh] min-h-[48px] w-full resize-none bg-transparent px-2 pt-1.5 text-[14px] leading-6 text-foreground placeholder-neutral-400 outline-none dark:placeholder-neutral-500"
 />
 </div>

 <div
 className={cn(
 'flex items-center justify-between px-1 pt-1 max-md:px-0.5 max-md:pt-2',
 betaSurface.active && 'wb-beta-composer-bar',
 )}
 >
 <div
 className={cn(
 'mobile-icon-row flex min-w-0 items-center gap-0.5 max-md:gap-3',
 betaSurface.active && 'wb-beta-chip-group',
 )}
 >
 <div
 className="relative mr-1"
 onBlur={(event) => {
 const nextTarget = event.relatedTarget as Node | null;
 if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
 setIsRunModeMenuOpen(false);
 }
 }}
 >
 <button
 type="button"
 onClick={() => setIsRunModeMenuOpen((open) => !open)}
 className={cn(
 'inline-flex h-7 max-w-[108px] items-center justify-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition max-md:mobile-touch-target max-md:max-w-[120px] max-md:px-2.5 sm:max-w-[140px]',
 runMode === 'plan'
 ? 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30'
 : 'text-muted-foreground hover:bg-muted',
 )}
 title={t('input.runModes.change', {
 defaultValue: 'Select run mode',
 }) as string}
 aria-haspopup="menu"
 aria-expanded={isRunModeMenuOpen}
 >
 <SelectedRunModeIcon className="h-4 w-4 shrink-0" strokeWidth={1.9} />
 <span className="truncate">{selectedRunModeLabel}</span>
 <ChevronDown
 className={cn(
 'h-3.5 w-3.5 shrink-0 transition-transform',
 isRunModeMenuOpen && 'rotate-180',
 )}
 strokeWidth={2}
 />
 </button>
 {isRunModeMenuOpen ? (
 <div
 role="menu"
 className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-xl border border-border bg-card p-1.5 text-left shadow-lg"
 >
 {RUN_MODE_OPTIONS.map((option) => {
 const Icon = option.Icon;
 const isSelected = runMode === option.mode;
 const isPlan = option.mode === 'plan';
 const optionDisabled = isPlan && !planModeAvailable;
 const label = t(option.labelKey, {
 defaultValue: option.defaultLabel,
 }) as string;
 const description = isPlan
 ? (t('input.runModes.planDescription', {
 defaultValue: 'Generate a plan first, then execute after confirmation',
 }) as string)
 : (t('input.runModes.agentDescription', {
 defaultValue: 'Directly process and execute the task',
 }) as string);

 return (
 <button
 key={option.mode}
 type="button"
 role="menuitemradio"
 aria-checked={isSelected}
 disabled={optionDisabled}
 onMouseDown={(event) => event.preventDefault()}
 onClick={() => {
 if (optionDisabled) return;
 onRunModeChange(option.mode);
 setIsRunModeMenuOpen(false);
 }}
 className={cn(
 'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition max-md:min-h-[44px] max-md:py-3',
 isSelected
 ? 'bg-muted'
 : 'hover:bg-sidebar /70',
 optionDisabled && 'cursor-not-allowed opacity-45',
 )}
 >
 <Icon
 className={cn(
 'h-4 w-4 shrink-0',
 isPlan
 ? 'text-blue-600'
 : 'text-muted-foreground',
 )}
 strokeWidth={1.9}
 />
 <span className="min-w-0 flex-1">
 <span
 className={cn(
 'block truncate text-[13px] font-medium',
 isPlan
 ? 'text-info'
 : 'text-foreground',
 )}
 >
 {label}
 </span>
 <span className="block truncate text-[11px] text-muted-foreground">
 {optionDisabled
 ? t('input.runModes.planUnavailable', {
 defaultValue: 'Plan mode is only available for Anthropic models.',
 })
 : description}
 </span>
 </span>
 {isSelected ? (
 <Check className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
 ) : null}
 </button>
 );
 })}
 </div>
 ) : null}
 </div>
 <button
 type="button"
 onClick={openImagePicker}
 className="mobile-touch-target inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground max-md:h-11 max-md:w-11"
 title={t('input.attachFiles', { defaultValue: 'Attach photos or files' }) as string}
 >
 <Paperclip className="h-4 w-4" strokeWidth={1.75} />
 </button>
 <button
 type="button"
 onClick={onInsertMention}
 className="mobile-touch-target inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground max-md:h-11 max-md:w-11"
 title={t('input.mentionFile', { defaultValue: 'Mention a file' }) as string}
 >
 <AtSign className="h-4 w-4" strokeWidth={1.75} />
 </button>
 {onOpenTemplatesHub ? (
 <button
 type="button"
 onClick={onOpenTemplatesHub}
 className="mobile-touch-target inline-flex h-7 min-w-[44px] items-center justify-center gap-1 rounded-md px-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground max-md:h-11 max-md:px-2.5"
 title={tHub('composerButton')}
 >
 <Sparkles className="h-4 w-4" strokeWidth={1.75} />
 <span className="hidden text-[11px] font-medium sm:inline">
 {tHub('composerButton')}
 </span>
 </button>
 ) : null}
 </div>

 <div className="ml-2 flex shrink-0 items-center gap-1 max-md:ml-1 max-md:gap-2.5">
 {!isMobileShell ? (
 <div
 className="relative"
 onBlur={(event) => {
 const nextTarget = event.relatedTarget as Node | null;
 if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
 setIsContextPopoverOpen(false);
 }
 }}
 >
 <button
 type="button"
 onClick={() => setIsContextPopoverOpen((open) => !open)}
 className={cn(
 'mobile-touch-target inline-flex h-7 min-w-[44px] items-center justify-center gap-1 rounded-md px-1.5 text-[11px] tabular-nums transition max-md:h-11 max-md:min-w-[48px] max-md:px-2',
 contextStatus.tone === 'red'
 ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30'
 : contextStatus.tone === 'amber'
 ? 'text-warning hover:bg-warning/10 dark:hover:bg-amber-950/30'
 : contextStatus.tone === 'normal'
 ? 'text-muted-foreground hover:bg-muted'
 : 'text-muted-foreground hover:bg-muted',
 )}
 title={contextStatusTitle}
 aria-label={contextStatusTitle}
 aria-expanded={isContextPopoverOpen}
 >
 <CircleGauge className="h-4 w-4" strokeWidth={1.75} />
 <span>{contextStatus.known ? `${contextStatus.percent}%` : '--'}</span>
 </button>
 {isContextPopoverOpen ? (
 <div
 role="status"
 className="absolute bottom-full right-0 z-50 mb-2 w-64 rounded-lg border border-border bg-card p-3 text-left text-[12px] leading-5 text-foreground shadow-lg"
 >
 <div className="mb-1 flex items-center justify-between gap-2">
 <span className="font-medium text-foreground">
 {t('input.contextStatusTitle', { defaultValue: 'Context window' })}
 </span>
 <span
 className={cn(
 'rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums',
 contextStatus.tone === 'red'
 ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
 : contextStatus.tone === 'amber'
 ? 'bg-warning/10 text-warning /30'
 : contextStatus.tone === 'normal'
 ? 'bg-success/10 text-success /30'
 : 'bg-muted text-muted-foreground',
 )}
 >
 {contextStatus.known ? `${contextStatus.percent}%` : '--'}
 </span>
 </div>
 {contextStatus.known ? (
 <>
 <div className="text-muted-foreground">
 {t('input.contextStatusUsed', {
 used: contextStatus.used.toLocaleString(),
 total: contextStatus.total.toLocaleString(),
 defaultValue:
 `${contextStatus.used.toLocaleString()} tokens used out of ${contextStatus.total.toLocaleString()}.`,
 })}
 </div>
 <div className="mt-2 text-muted-foreground">
 {t('input.contextStatusAutoCompact', {
 defaultValue:
 'Auto compact runs when the conversation approaches the configured limit.',
 })}
 </div>
 </>
 ) : (
 <div className="text-muted-foreground">
 {t('input.contextStatusUnknownBody', {
 defaultValue:
 'No token budget has been reported yet. It will appear after the next model response.',
 })}
 </div>
 )}
 </div>
 ) : null}
 </div>
 ) : null}

 {manualContinueHint ? (
 <p className="mb-1.5 px-0.5 text-[12px] leading-snug text-muted-foreground" data-testid="manual-continue-hint">
 {manualContinueHint}
 </p>
 ) : null}

 {stopVisible ? (
 <button
 type="button"
 onClick={onAbortSession}
 disabled={isAbortPending}
 className={cn(
 'mobile-touch-target inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-500 text-primary-foreground transition hover:bg-red-600 max-md:h-11 max-md:w-11',
 isAbortPending && 'cursor-wait opacity-70 hover:bg-red-500',
 )}
 title={
 isAbortPending
 ? (t('input.stopping', { defaultValue: 'Stopping...' }) as string)
 : (t('input.stop', { defaultValue: 'Stop' }) as string)
 }
 >
 {isAbortPending ? (
 <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
 ) : (
 <Square className="h-3.5 w-3.5" strokeWidth={2.5} fill="currentColor" />
 )}
 </button>
 ) : (
 <div className="flex items-center gap-1.5">
 {showContinueButton && onManualContinue ? (
 <button
 type="button"
 onClick={onManualContinue}
 disabled={isManualContinuePending || !isConnected}
 className={cn(
 'mobile-touch-target inline-flex h-8 w-8 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary transition hover:bg-primary/15 disabled:opacity-40 max-md:h-11 max-md:w-11',
 isManualContinuePending && 'cursor-wait',
 )}
 title={t('composer.continueTask', { defaultValue: '继续任务' }) as string}
 aria-label={t('composer.continueTask', { defaultValue: '继续任务' }) as string}
 data-testid="composer-manual-continue"
 >
 {isManualContinuePending ? (
 <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
 ) : (
 <Play className="h-3.5 w-3.5" strokeWidth={2.25} fill="currentColor" />
 )}
 </button>
 ) : null}
 <button
 type="submit"
 disabled={disabled}
 aria-busy={isSubmitPending || hasUploadingImages}
 className={cn(
 betaSurface.active
 ? 'wb-beta-send mobile-touch-target inline-flex h-[34px] items-center gap-2 rounded-full bg-primary px-3.5 text-[12.5px] font-medium text-primary-foreground transition hover:brightness-105 disabled:opacity-40 max-md:h-11'
 : 'mobile-touch-target inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40 max-md:h-11 max-md:w-11 dark:bg-sidebar dark:text-foreground',
 (isSubmitPending || hasUploadingImages) && 'cursor-wait',
 )}
 title={
 isSubmitPending || hasUploadingImages
 ? (t('input.sending', { defaultValue: 'Sending...' }) as string)
 : (t('input.send', { defaultValue: 'Send' }) as string)
 }
 >
 {isSubmitPending || hasUploadingImages ? (
 <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
 ) : betaSurface.active ? (
 <>
 <span className="hidden sm:inline">
 {t('input.send', { defaultValue: '发送' })}
 </span>
 <span className="wb-beta-send-arrow inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-primary-foreground/15">
 <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.25} />
 </span>
 </>
 ) : (
 <ArrowUp className="h-4 w-4" strokeWidth={2} />
 )}
 </button>
 </div>
 )}
 </div>
 </div>
 </div>
 </form>
 ) : null}
 </div>
 </div>
 );
}
