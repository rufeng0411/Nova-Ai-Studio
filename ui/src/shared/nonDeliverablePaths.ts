// PD-SAAS-FORK: re-export shared non-deliverable guards (client + tests)
export {
  isNonDeliverableBasename,
  isNonUserDeliverablePath,
  isPhantomDeliverablePath,
  isProcessChartImagePath,
  isOrphanIntermediateHtmlPath,
  isRepairEligiblePath,
  isRepairPlaceholderDeliverablePath,
  isVisualAssetInternalTreePath,
} from '../../shared/deliverablePathResolve.mjs';
