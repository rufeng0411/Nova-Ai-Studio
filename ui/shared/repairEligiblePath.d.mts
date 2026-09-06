// PD-SAAS-FORK: TypeScript declarations for dual-runtime repair path eligibility.

export type RepairPathAllowSlot = {
  pathHint?: string;
  label?: string;
};

export function normalizeRepairPath(raw: unknown): string;
export function basenameLower(p: string): string;
export function isRepairEligiblePath(
  raw: unknown,
  opts?: {
    allowBasenames?: string[];
    allowPathHints?: string[];
    slots?: RepairPathAllowSlot[];
  },
): boolean;
export function filterRepairEligiblePaths(
  paths: string[],
  opts?: Parameters<typeof isRepairEligiblePath>[1],
): string[];
export function isRepairPlaceholderDeliverablePath(raw: unknown): boolean;
