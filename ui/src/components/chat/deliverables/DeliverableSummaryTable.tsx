// PD-SAAS-FORK: mandatory deliverable summary table for every completed turn
import React, { useMemo, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Project } from '../../../types/app';
import type { DeliverableItem } from '../../../shared/collectDeliverables';
import { sortDeliverables } from '../../../shared/collectDeliverables';
import type {
  DeliverableValidationStatus,
  ValidatedDeliverable,
} from '../../../shared/validateDeliverables';
import {
  formatDeliverableFileTypeLabel,
  formatSummaryTableLinkLabel,
  resolveSummaryTableLinkDisplay,
  supportsSummaryInlineMediaPreview,
} from '../../../shared/deliverableFileTypeLabel';
import {
  getArtifactFileName,
  normalizeArtifactPath,
} from '../../../shared/artifactPaths';
import {
  parseDeliverableLabelsFromAssistantText,
  resolveDeliverableDisplayName,
} from '../../../shared/deliverableSummaryLabels';
import {
  buildDeliverableSummaryRows,
  buildDeliverableSummaryRowsFromTextPaths,
  shouldFallbackFromManifestSummaryRows,
  type DeliverableSummaryRow,
  type ExpectedManifestEntry,
  type SlideManifestPage,
} from '../../../shared/buildDeliverableSummaryRows';
import {
  mergeFolderItemsIntoDockRows,
  type DeliverableDockRow,
} from '../../../shared/buildDeliverableDockRows';
import {
  isConversationDeliverableSyncEnabled,
  isTerminalDeliverablePresentationEnabled,
} from '../../../shared/conversationDeliverableFeatureFlags';
import type { DeliverableContextMode } from '../../../shared/deliverableContextInvariants';
import { presentConversationDeliverableRows } from '../../../shared/presentConversationDeliverableRows';
import { deliverableStatusLabel } from '../../../shared/deliverableStatusUi';
import { MarkdownInteractionContext } from '../view/subcomponents/MarkdownInteractionContext';
import { buildBentoFileOpenOptions } from '../../../shared/bentoStudioDock';
import { scopeDeliverablePathToTurnDir } from '../../../shared/artifactPaths';
import DeliverablePathLink from './DeliverablePathLink';
import DeliverablePreviewOverlay from './DeliverablePreviewOverlay';
import DeliverableSummaryInlinePreview from './DeliverableSummaryInlinePreview';
import DeliverableQualityStatus from './DeliverableQualityStatus';
import type { DeliverableQualityStatusUi } from '../../../shared/turnAcceptanceMeta';
import { DELIVERABLE_SURFACE } from '../../chat-v2/processVisualTokens';
import { cn } from '../../../lib/utils';

export type DeliverableAcceptanceRow = {
  id: string;
  label: string;
  path?: string;
  resolvedPath?: string;
  kind?: DeliverableItem['kind'];
  status: 'delivered' | 'missing' | 'broken' | 'hidden' | 'checking' | 'needContinue';
};

function validationStatusForItem(
  item: DeliverableItem | undefined,
): DeliverableValidationStatus | undefined {
  if (!item) return undefined;
  const value = (item as DeliverableItem & { validationStatus?: unknown }).validationStatus;
  switch (value) {
    case 'verified':
    case 'softVerified':
    case 'pending':
    case 'broken':
    case 'phantom':
      return value;
    default:
      return undefined;
  }
}

function asValidatedDeliverables(items: DeliverableItem[]): ValidatedDeliverable[] {
  return items.map((item) => ({
    ...item,
    validationStatus: validationStatusForItem(item)
      ?? (item.resolvedPath ? 'verified' : 'pending'),
  }));
}

type DeliverableSummaryTableProps = {
  items: DeliverableItem[];
  acceptanceRows?: DeliverableAcceptanceRow[];
  folderItems?: DeliverableItem[];
  assistantText?: string;
  selectedProject?: Project | null;
  projectRoot?: string;
  turnArtifactDir?: string;
  expectedManifest?: ExpectedManifestEntry[] | null;
  slideManifestPages?: SlideManifestPage[] | null;
  resolvedPathMap?: Record<string, string> | null;
  verifiedPaths?: string[] | null;
  onFileOpen?: (filePath: string, second?: unknown) => void;
  onOpenTaskFolder?: (items: DeliverableItem[]) => void;
  className?: string;
  /** When false, pending validation shows「校验中」instead of「未完成」. */
  validationSettled?: boolean;
  /** PD-SAAS-FORK: engine-owned repair — missing slots show「补齐中」not terminal copy. */
  isDeliverableRepairActive?: boolean;
  /** Show table shell even when row builder returns empty (expected slots only). */
  forceShow?: boolean;
  /** SDM mode: slot labels from manifest only; ignore assistant-text label map. */
  preferManifestLabels?: boolean;
  /** PD-SAAS-FORK (UDC): pre-built rows from buildUnifiedDeliverableView / buildTurnDeliverableView. */
  unifiedRowsOverride?: DeliverableDockRow[] | null;
  /** When true, override rows are Dock-authoritative — skip folder reconcile and validationSettled recolor. */
  unifiedRowsAuthoritative?: boolean;
  /** PD-SAAS-FORK: contractHash from UDC kernel (dev assert / telemetry). */
  contractHash?: string | null;
  /** PD-SAAS-FORK (STDA): scope dir for folder reconcile — blocks basename crosstalk. */
  scopeDir?: string | null;
  /** PD-SAAS-FORK P0-8: certificate-backed final quality badge. */
  qualityStatus?: DeliverableQualityStatusUi | null;
  /** PD-SAAS-FORK: conversation presentation mode for export rebuild / legacy paths. */
  conversationPresentationMode?: DeliverableContextMode;
  /** PD-SAAS-FORK: mobile bottom sheet — larger row hit targets for touch browsers */
  mobileSheetLayout?: boolean;
};

export function DeliverableSummaryTable({
  items,
  acceptanceRows,
  folderItems,
  assistantText = '',
  selectedProject,
  projectRoot = '',
  turnArtifactDir,
  expectedManifest,
  slideManifestPages,
  resolvedPathMap,
  verifiedPaths,
  onFileOpen,
  onOpenTaskFolder,
  className = '',
  validationSettled = true,
  isDeliverableRepairActive = false,
  forceShow = false,
  preferManifestLabels = false,
  unifiedRowsOverride,
  unifiedRowsAuthoritative = false,
  contractHash: contractHashProp,
  scopeDir,
  qualityStatus,
  conversationPresentationMode = 'turn_snapshot',
  mobileSheetLayout = false,
}: DeliverableSummaryTableProps) {
  const { t } = useTranslation('chat');
  const [overlayIndex, setOverlayIndex] = useState<number | null>(null);
  const taskFolderItems = folderItems && folderItems.length > 0 ? folderItems : items;

  const tableItems = useMemo(() => sortDeliverables(items), [items]);
  const tableRows = useMemo(
    () => {
      if (unifiedRowsOverride) {
        const overrideRows = unifiedRowsAuthoritative
          || isConversationDeliverableSyncEnabled()
          ? unifiedRowsOverride
          : presentConversationDeliverableRows(
            unifiedRowsOverride,
            isTerminalDeliverablePresentationEnabled()
              ? conversationPresentationMode
              : 'turn_snapshot',
          );
        const built: SummaryRow[] = overrideRows.map((row) => ({
          id: row.id,
          label: row.label,
          path: row.resolvedPath || row.path,
          kind: classifyDeliverableKind(row.resolvedPath || row.path),
          status: row.status === 'delivered'
            ? 'delivered'
            : row.status === 'checking'
              ? 'checking'
              : row.status === 'broken'
                ? 'broken'
                : row.status === 'needContinue'
                  ? 'needContinue'
                  : 'missing',
          item: tableItems.find((item) => {
            const itemPath = item.resolvedPath || item.apiPath || item.path;
            const rowPath = row.resolvedPath || row.path;
            return itemPath.toLowerCase() === rowPath.toLowerCase();
          }),
        }));
        return built;
      }

      let built = buildSummaryRows(
        tableItems,
        acceptanceRows,
        validationSettled,
        {
          expectedManifest,
          slideManifestPages,
          resolvedPathMap,
          verifiedPaths,
          turnArtifactDir,
        },
        assistantText,
      );

      if (
        shouldFallbackFromManifestSummaryRows(
          built.map((row) => ({
            id: row.id,
            label: row.label,
            path: row.path,
            status: row.status,
            previewable: false,
            linkable: false,
          })),
          { itemCount: tableItems.length, acceptanceRows, assistantText },
        )
      ) {
        const legacy = buildLegacySummaryRows(tableItems, acceptanceRows, validationSettled);
        if (legacy.some((row) => row.status === 'delivered' || row.status === 'checking')) {
          built = legacy;
        } else {
        const textRows = buildDeliverableSummaryRowsFromTextPaths({
          assistantText,
          turnArtifactDir,
          validatedItems: asValidatedDeliverables(tableItems),
          validationSettled,
        });
        if (textRows.length > 0) {
          built = textRows.map((row) => ({
            id: row.id,
            label: row.label,
            path: row.resolvedPath || row.path,
            kind: classifyDeliverableKind(row.path),
            status: row.status === 'needContinue' ? 'needContinue' as const : row.status,
            item: tableItems.find((item) => {
              const itemPath = item.resolvedPath || item.apiPath || item.path;
              return itemPath.toLowerCase() === row.path.toLowerCase()
                || getArtifactFileName(itemPath).toLowerCase() === getArtifactFileName(row.path).toLowerCase();
            }),
          }));
        }
        }
      }

      if (built.length === 0 && forceShow && assistantText.trim()
        && (expectedManifest?.length || acceptanceRows?.length)) {
        const textRows = buildDeliverableSummaryRowsFromTextPaths({
          assistantText,
          turnArtifactDir,
          validatedItems: asValidatedDeliverables(tableItems),
          validationSettled,
        });

        built = textRows.map((row) => ({
          id: row.id,
          label: row.label,
          path: row.resolvedPath || row.path,
          kind: classifyDeliverableKind(row.path),
          status: row.status === 'needContinue' ? 'needContinue' as const : row.status,
          item: tableItems.find((item) => {
            const itemPath = item.resolvedPath || item.apiPath || item.path;
            return itemPath.toLowerCase() === row.path.toLowerCase()
              || getArtifactFileName(itemPath).toLowerCase() === getArtifactFileName(row.path).toLowerCase();
          }),
        }));
      }

      if (built.length === 0 && !forceShow) return built;

      const reconciled = reconcileSummaryTableWithFolder(built, taskFolderItems, {
        expectedManifest,
        validationSettled,
        scopeDir: scopeDir ?? turnArtifactDir ?? null,
        verifiedPaths,
      });
      if (
        isTerminalDeliverablePresentationEnabled()
        && conversationPresentationMode === 'terminal'
      ) {
        return presentSummaryRowsForConversation(reconciled, 'terminal');
      }
      return reconciled;
    },
    [
      acceptanceRows,
      assistantText,
      conversationPresentationMode,
      expectedManifest,
      forceShow,
      resolvedPathMap,
      scopeDir,
      taskFolderItems,
      unifiedRowsAuthoritative,
      unifiedRowsOverride,
      verifiedPaths,
      slideManifestPages,
      tableItems,
      turnArtifactDir,
      validationSettled,
    ],
  );
  const overlayItems = useMemo(
    () => tableItems.filter((item) => item.kind !== 'url'),
    [tableItems],
  );

  const labelMap = useMemo(
    () => parseDeliverableLabelsFromAssistantText(assistantText),
    [assistantText],
  );

  const interaction = useMemo(
    () => ({
      selectedProject,
      projectRoot,
      onFileOpen,
      turnArtifactDir,
    }),
    [onFileOpen, projectRoot, selectedProject, turnArtifactDir],
  );

  if (tableRows.length === 0 && !forceShow) return null;

  const hasLocalFiles = taskFolderItems.some((item) => item.kind !== 'url');
  const folderLabel = t('deliverables.openTaskFolder', { defaultValue: '前往任务所在文件夹' });
  const needProjectTitle = t('deliverables.needProject', {
    defaultValue: '请先选择项目后再打开文件夹',
  });

  const openOverlayAt = (itemId: string) => {
    const idx = overlayItems.findIndex((entry) => entry.id === itemId);
    if (idx >= 0) {
      setOverlayIndex(idx);
      return;
    }
    const item = tableItems.find((entry) => entry.id === itemId);
    if (item?.kind === 'url' && /^https?:\/\//i.test(item.path)) {
      window.open(item.path, '_blank', 'noopener');
    }
  };

  return (
    <MarkdownInteractionContext.Provider value={interaction}>
      <div
        className={cn('mt-0 flex min-w-0 flex-col gap-2 p-2.5', DELIVERABLE_SURFACE, className)}
        data-testid="deliverable-summary-table"
        data-contract-hash={contractHashProp ?? undefined}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-[13px] font-semibold text-foreground/90">
            {t('deliverables.summaryTitle', { defaultValue: '成果清单' })}
          </div>
          {qualityStatus ? (
            <DeliverableQualityStatus status={qualityStatus} />
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border/50 text-left text-[11px] text-muted-foreground">
                <th className="px-2 py-1.5 font-medium">
                  {t('deliverables.summaryColName', { defaultValue: '成果名称' })}
                </th>
                <th className="px-2 py-1.5 font-medium">
                  {t('deliverables.summaryColType', { defaultValue: '文件类型' })}
                </th>
                <th className="px-2 py-1.5 font-medium">
                  {t('deliverables.summaryColStatus', { defaultValue: '状态' })}
                </th>
                <th className="px-2 py-1.5 font-medium">
                  {t('deliverables.summaryColLink', { defaultValue: '文件链接' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => {
                const item = row.item;
                const path = row.path;
                const displayName = row.label
                  ? row.label
                  : (item
                    ? resolveDeliverableDisplayName(path, item.kind, labelMap, {
                      preferManifestLabel: preferManifestLabels,
                    })
                    : resolveDeliverableDisplayName(path, row.kind ?? 'document', labelMap, {
                      preferManifestLabel: preferManifestLabels,
                    }));
                const typeLabel = item
                  ? formatDeliverableFileTypeLabel(path, item.kind)
                  : formatDeliverableFileTypeLabel(path, row.kind ?? 'document');
                const linkDisplay = row.status === 'delivered' && path
                  ? resolveSummaryTableLinkDisplay(path, item?.kind ?? row.kind ?? 'file')
                  : { mode: 'none' as const, href: '' };
                const linkKind = item?.kind ?? row.kind ?? 'file';
                const linkLabel = formatSummaryTableLinkLabel(path, linkKind);
                const showInlinePreview = Boolean(item) && row.status === 'delivered' && supportsSummaryInlineMediaPreview(path, item!.kind);
                const previewLabel = t('deliverables.summaryPreviewExpand', {
                  defaultValue: '点击放大预览 {{name}}',
                  name: displayName,
                });

                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b border-border/30 last:border-b-0 hover:bg-muted/30',
                      mobileSheetLayout && 'active:bg-muted/40',
                    )}
                  >
                    <td className={cn('px-2 py-1.5 font-medium text-foreground', mobileSheetLayout && 'py-2.5')}>
                      <div className="flex min-w-0 items-center gap-2">
                        {showInlinePreview && item ? (
                          <DeliverableSummaryInlinePreview
                            item={item}
                            selectedProject={selectedProject}
                            onActivate={() => openOverlayAt(item.id)}
                            ariaLabel={previewLabel}
                          />
                        ) : null}
                        <button
                          type="button"
                          disabled={row.status !== 'delivered' || (!item && !path)}
                          className={cn(
                            'min-w-0 text-left underline-offset-2 enabled:hover:underline disabled:cursor-default',
                            mobileSheetLayout && 'mobile-touch-target min-h-[44px] py-1 enabled:active:opacity-80',
                          )}
                          onClick={() => {
                            if (item) {
                              openOverlayAt(item.id);
                              return;
                            }
                            if (row.status === 'delivered' && path && onFileOpen) {
                              const openPath = scopeDeliverablePathToTurnDir(path, turnArtifactDir);
                              const fileName = openPath.split('/').pop() || openPath;
                              const bentoOptions = buildBentoFileOpenOptions(fileName, openPath, {
                                hintDir: turnArtifactDir,
                                bentoStudioMode: 'edit',
                              });
                              onFileOpen(
                                openPath,
                                bentoOptions ?? (turnArtifactDir
                                  ? { hintDir: turnArtifactDir, initialPreview: true }
                                  : { initialPreview: true }),
                              );
                            }
                          }}
                        >
                          {displayName}
                        </button>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">
                      {typeLabel}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5">
                      <span className={statusClassName(row.status, isDeliverableRepairActive)}>
                        {deliverableStatusLabel(row.status, t, isDeliverableRepairActive)}
                      </span>
                    </td>
                    <td className="max-w-64 truncate px-2 py-1.5 text-muted-foreground">
                      {linkDisplay.mode === 'external' ? (
                        <a
                          href={linkDisplay.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-info underline-offset-2 hover:underline"
                          title={linkDisplay.href}
                        >
                          {linkLabel}
                        </a>
                      ) : linkDisplay.mode === 'project' ? (
                        <DeliverablePathLink path={path} title={linkDisplay.href || path}>
                          {linkLabel}
                        </DeliverablePathLink>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {hasLocalFiles && onOpenTaskFolder ? (
          <div className="flex justify-end border-t border-border/40 pt-2">
            <button
              type="button"
              onClick={() => onOpenTaskFolder(taskFolderItems)}
              disabled={!selectedProject?.name}
              title={!selectedProject?.name ? needProjectTitle : undefined}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/60 bg-card/90 px-2 py-1 text-[11px] font-medium text-foreground/85 transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="open-task-folder"
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {folderLabel}
            </button>
          </div>
        ) : null}

        {overlayIndex !== null && overlayItems.length > 0 ? (
          <DeliverablePreviewOverlay
            items={overlayItems}
            index={overlayIndex}
            onIndexChange={setOverlayIndex}
            selectedProject={selectedProject}
            onFileOpen={onFileOpen}
            onClose={() => setOverlayIndex(null)}
          />
        ) : null}
      </div>
    </MarkdownInteractionContext.Provider>
  );
}

export default DeliverableSummaryTable;

type SummaryRow = DeliverableAcceptanceRow & {
  item?: DeliverableItem;
  path: string;
};

function presentSummaryRowsForConversation(
  rows: SummaryRow[],
  mode: DeliverableContextMode,
): SummaryRow[] {
  const dockRows: DeliverableDockRow[] = rows.map((row) => ({
    id: row.id,
    label: row.label || getArtifactFileName(row.path),
    path: row.path,
    status: summaryStatusToRowStatus(row.status),
    resolvedPath: row.item?.resolvedPath || row.path,
    apiPath: row.item?.apiPath,
    previewable: row.status === 'delivered',
    linkable: row.status === 'delivered',
  }));
  const presented = presentConversationDeliverableRows(dockRows, mode);
  return presented.map((row) => {
    const prev = rows.find((entry) => entry.id === row.id);
    const path = row.resolvedPath || row.apiPath || row.path;
    const item = prev?.item;
    return {
      id: row.id,
      label: row.label || prev?.label || getArtifactFileName(path),
      path,
      kind: item?.kind ?? prev?.kind ?? classifyDeliverableKind(path),
      status: row.status === 'delivered'
        ? 'delivered'
        : row.status === 'checking'
          ? 'checking'
          : row.status === 'broken'
            ? 'broken'
            : row.status === 'needContinue'
              ? 'needContinue'
              : 'missing',
      item,
    };
  });
}

function reconcileSummaryTableWithFolder(
  rows: SummaryRow[],
  folderItems: DeliverableItem[],
  options: {
    expectedManifest?: ExpectedManifestEntry[] | null;
    validationSettled: boolean;
    scopeDir?: string | null;
    verifiedPaths?: string[] | null;
  },
): SummaryRow[] {
  if (rows.length === 0 || folderItems.length === 0) return rows;

  const scopeNorm = options.scopeDir?.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase() ?? null;
  const scopedFolderItems = scopeNorm
    ? folderItems.filter((item) => {
      const path = (item.resolvedPath || item.apiPath || item.path).replace(/\\/g, '/').toLowerCase();
      return path === scopeNorm || path.startsWith(`${scopeNorm}/`);
    })
    : folderItems;

  const itemByPath = new Map<string, DeliverableItem>();
  const itemByBasename = new Map<string, DeliverableItem>();
  for (const item of scopedFolderItems) {
    const path = item.resolvedPath || item.apiPath || item.path;
    itemByPath.set(path.toLowerCase(), item);
    const base = getArtifactFileName(path).toLowerCase();
    if (base && !itemByBasename.has(base)) itemByBasename.set(base, item);
  }

  const dockRows: DeliverableDockRow[] = rows.map((row) => ({
    id: row.id,
    label: row.label || getArtifactFileName(row.path),
    path: row.path,
    status: summaryStatusToRowStatus(row.status),
    resolvedPath: row.item?.resolvedPath || row.path,
    apiPath: row.item?.apiPath,
    previewable: row.status === 'delivered',
    linkable: row.status === 'delivered',
  }));

  const merged = mergeFolderItemsIntoDockRows(dockRows, scopedFolderItems, {
    allowExtraRows: !(options.expectedManifest?.length),
    expectedEntries: options.expectedManifest ?? undefined,
    scopeDir: options.scopeDir ?? null,
    validationSettled: options.validationSettled,
    verifiedPaths: options.verifiedPaths,
  });

  return merged.map((row) => {
    const prev = rows.find((r) => r.id === row.id);
    const path = row.resolvedPath || row.apiPath || row.path;
    const direct = itemByPath.get(path.toLowerCase());
    const item = direct
      ?? (scopeNorm ? undefined : itemByBasename.get(getArtifactFileName(path).toLowerCase()))
      ?? prev?.item;
    let status: DeliverableAcceptanceRow['status'] = row.status === 'delivered'
      ? 'delivered'
      : row.status === 'checking'
        ? 'checking'
        : row.status === 'broken'
          ? 'broken'
          : prev?.status === 'needContinue'
            ? 'needContinue'
            : 'missing';
    // PD-SAAS-FORK fd7c166c: resolvedPath already on disk — keep delivered, do not force「校验中」.
    if (row.status === 'delivered' || (row.resolvedPath && status !== 'broken')) {
      status = 'delivered';
    } else if (!options.validationSettled && status === 'missing') {
      status = 'checking';
    }
    return {
      id: row.id,
      label: row.label || prev?.label || getArtifactFileName(path),
      path,
      kind: item?.kind ?? prev?.kind ?? classifyDeliverableKind(path),
      status,
      item,
    };
  });
}

function summaryStatusToRowStatus(
  status: DeliverableAcceptanceRow['status'],
): DeliverableSummaryRow['status'] {
  if (status === 'delivered') return 'delivered';
  if (status === 'checking') return 'checking';
  if (status === 'broken') return 'broken';
  if (status === 'needContinue') return 'needContinue';
  return 'missing';
}

function buildSummaryRows(
  items: DeliverableItem[],
  acceptanceRows: DeliverableAcceptanceRow[] | undefined,
  validationSettled: boolean,
  manifestOptions?: {
    expectedManifest?: ExpectedManifestEntry[] | null;
    slideManifestPages?: SlideManifestPage[] | null;
    resolvedPathMap?: Record<string, string> | null;
    verifiedPaths?: string[] | null;
    turnArtifactDir?: string;
  },
  _assistantText = '',
): SummaryRow[] {
  const useManifestBuilder = Boolean(
    manifestOptions?.expectedManifest?.length
    || manifestOptions?.slideManifestPages?.length,
  );

  if (useManifestBuilder) {
    const validatedItems: ValidatedDeliverable[] = items.map((item) => ({
      ...item,
      validationStatus: validationStatusForItem(item) ?? 'pending',
    }));

    const built = buildDeliverableSummaryRows({
      expectedManifest: manifestOptions?.expectedManifest,
      slideManifestPages: manifestOptions?.slideManifestPages,
      acceptanceRows,
      validatedItems,
      resolvedPathMap: manifestOptions?.resolvedPathMap,
      verifiedPaths: manifestOptions?.verifiedPaths,
      turnArtifactDir: manifestOptions?.turnArtifactDir,
      scopeDir: manifestOptions?.turnArtifactDir,
      validationSettled,
    });

    const itemByPath = new Map<string, DeliverableItem>();
    const itemByBasename = new Map<string, DeliverableItem>();
    for (const item of items) {
      const path = item.resolvedPath || item.apiPath || item.path;
      itemByPath.set(path.toLowerCase(), item);
      const base = getArtifactFileName(path).toLowerCase();
      if (base) itemByBasename.set(base, item);
    }

    return built.map((row) => {
      let status: DeliverableAcceptanceRow['status'] = row.status === 'needContinue'
        ? 'needContinue'
        : row.status;
      const direct = itemByPath.get((row.resolvedPath || row.path).toLowerCase());
      const item = direct
        ?? itemByBasename.get(getArtifactFileName(row.resolvedPath || row.path).toLowerCase())
        ?? itemByBasename.get(getArtifactFileName(row.path).toLowerCase());
      const path = row.resolvedPath || item?.resolvedPath || item?.apiPath || row.path;
      const itemValidation = validationStatusForItem(item);
      const itemVerified = itemValidation === 'verified'
        || itemValidation === 'softVerified'
        || (!itemValidation && Boolean(item?.resolvedPath));
      // PD-SAAS-FORK fd7c166c: only unresolved missing rows enter checking while unsettled.
      if (!validationSettled && status === 'missing' && !row.resolvedPath && !item?.resolvedPath) {
        status = 'checking';
      }
      if (validationSettled && status === 'checking') {
        status = 'missing';
      }
      if (
        status === 'delivered'
        || (item && item.resolvedPath && (status === 'checking' || status === 'missing' || itemVerified))
        || (row.resolvedPath && status !== 'broken')
      ) {
        status = 'delivered';
      }
      return {
        id: row.id,
        label: row.label,
        path,
        kind: item?.kind ?? classifyDeliverableKind(path),
        status,
        item,
      };
    });
  }

  return buildLegacySummaryRows(items, acceptanceRows, validationSettled);
}

function classifyDeliverableKind(path: string): DeliverableItem['kind'] {
  const ext = getArtifactFileName(path).split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image';
  if (ext === 'mp4' || ext === 'webm') return 'video';
  if (ext === 'html' || ext === 'htm') return 'html';
  return 'document';
}

function buildLegacySummaryRows(
  items: DeliverableItem[],
  acceptanceRows: DeliverableAcceptanceRow[] | undefined,
  validationSettled: boolean,
): SummaryRow[] {
  const itemByPath = new Map<string, DeliverableItem>();
  const itemByBasename = new Map<string, DeliverableItem>();
  for (const item of items) {
    const path = item.resolvedPath || item.apiPath || item.path;
    itemByPath.set(path.toLowerCase(), item);
    const base = getArtifactFileName(path).toLowerCase();
    if (base) itemByBasename.set(base, item);
  }

  const resolveItemForPath = (rawPath: string): DeliverableItem | undefined => {
    const normalized = normalizeArtifactPath(rawPath) || rawPath;
    if (!normalized) return undefined;
    const direct = itemByPath.get(normalized.toLowerCase());
    if (direct) return direct;
    if (normalized.includes('*')) {
      const suffix = normalized.replace(/^\*\./, '').toLowerCase();
      return items.find((item) => getArtifactFileName(item.apiPath || item.path).toLowerCase().endsWith(`.${suffix}`));
    }
    return itemByBasename.get(getArtifactFileName(normalized).toLowerCase());
  };

  const statusFromItem = (
    item: DeliverableItem | undefined,
    fallback: DeliverableAcceptanceRow['status'],
  ): DeliverableAcceptanceRow['status'] => {
    if (!item) {
      return !validationSettled && fallback === 'missing' ? 'checking' : fallback;
    }
    const validationStatus = validationStatusForItem(item);
    if (validationStatus === 'verified' || validationStatus === 'softVerified') return 'delivered';
    if (validationStatus === 'broken') return 'broken';
    // PD-SAAS-FORK fd7c166c: disk path present → delivered even while Bridge unsettled.
    if (item.resolvedPath && (validationStatus === 'pending' || !validationStatus)) {
      return 'delivered';
    }
    if (!validationSettled) {
      if (validationStatus === 'pending' || !validationStatus) return 'checking';
    }
    if (!validationStatus && !item.resolvedPath) {
      return !validationSettled ? 'checking' : fallback;
    }
    return statusFromValidation(validationStatus, validationSettled);
  };

  if (acceptanceRows && acceptanceRows.length > 0) {
    const rows: SummaryRow[] = [];
    for (const row of acceptanceRows) {
      if (row.status === 'hidden') continue;
      const path = row.path ?? row.label;
      if (row.status === 'missing' && path.includes('*')) {
        const wildcardMatches = items.filter((item) => resolveItemForPath(path)?.id === item.id);
        if (wildcardMatches.some((item) => statusFromItem(item, 'missing') === 'delivered')) {
          continue;
        }
      }
      const item = resolveItemForPath(path);
      const resolvedPath = item?.resolvedPath || item?.apiPath || path;
      const status = item
        ? statusFromItem(item, row.status)
        : !validationSettled && row.status === 'missing'
          ? 'checking'
          : row.status;
      rows.push({
        ...row,
        path: resolvedPath,
        item,
        status,
      });
    }
    const seen = new Set(rows.map((row) => row.path.toLowerCase()));
    for (const item of items) {
      const path = item.resolvedPath || item.apiPath || item.path;
      if (!path || seen.has(path.toLowerCase())) continue;
      rows.push({
        id: `${statusFromItem(item, 'missing')}:${item.id}`,
        label: '',
        path,
        kind: item.kind,
        status: statusFromItem(item, 'missing'),
        item,
      });
    }
    return rows;
  }
  return items.map((item) => {
    const path = item.resolvedPath || item.apiPath || item.path;
    const validationStatus = validationStatusForItem(item);
    return {
      id: `${statusFromValidation(validationStatus, validationSettled)}:${item.id}`,
      label: '',
      path,
      kind: item.kind,
      status: statusFromValidation(validationStatus, validationSettled),
      item,
    };
  });
}

function statusFromValidation(
  validationStatus: string | undefined,
  validationSettled: boolean,
): DeliverableAcceptanceRow['status'] {
  switch (validationStatus) {
    case 'verified':
    case 'softVerified':
      return 'delivered';
    case 'broken':
      return 'broken';
    case 'pending':
      return validationSettled ? 'missing' : 'checking';
    case 'phantom':
      return 'missing';
    default:
      return validationSettled ? 'missing' : 'checking';
  }
}

function statusClassName(
  status: DeliverableAcceptanceRow['status'],
  isDeliverableRepairActive = false,
): string {
  if (isDeliverableRepairActive && (status === 'missing' || status === 'needContinue')) {
    return 'rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground animate-pulse';
  }
  switch (status) {
    case 'delivered':
      return 'rounded-full bg-success/10 px-1.5 py-0.5 text-[11px] font-medium text-success';
    case 'missing':
      return 'rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300';
    case 'needContinue':
      return 'rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-300';
    case 'checking':
      return 'rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground animate-pulse';
    case 'broken':
      return 'rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[11px] font-medium text-orange-700 dark:text-orange-300';
    case 'hidden':
      return 'rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground';
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}
