// PD-SAAS-FORK: TS re-export of shared repair-path guards (engine)
export {
  filterRepairEligiblePaths,
  isRepairEligiblePath,
  isRepairPlaceholderDeliverablePath,
} from "../../../ui/shared/repairEligiblePath.mjs";

export type RepairPathAllowOptions = {
  allowBasenames?: string[];
  allowPathHints?: string[];
  slots?: Array<{ pathHint?: string; label?: string }>;
};
