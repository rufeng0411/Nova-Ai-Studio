// PD-SAAS-FORK: gated write/export concurrency — never bypass Sequential enforce.
import path from "node:path";
import {
  isSequentialDeliverablesEnabled,
  parallelOfficeExportMode,
  parallelWriteFileMode,
} from "../resilience/stabilityFlags.js";

const SHARED_SERIAL_BASENAMES = new Set([
  "data-sources.md",
]);

export function isSharedSerialWritePath(filePath?: string): boolean {
  const base = path.basename(String(filePath ?? "")).toLowerCase();
  return SHARED_SERIAL_BASENAMES.has(base);
}

/** Actual parallel write_file: enforce only; sequential enforce keeps serial. */
export function isParallelWriteFileAllowed(filePath?: string): boolean {
  if (parallelWriteFileMode() !== "enforce") return false;
  if (isSequentialDeliverablesEnabled()) return false;
  if (!String(filePath ?? "").trim()) return false;
  if (isSharedSerialWritePath(filePath)) return false;
  return true;
}

/** Same-IR multi-format export may run together when enforce and paths differ. */
export function isParallelOfficeExportAllowed(outputPath?: string): boolean {
  if (parallelOfficeExportMode() !== "enforce") return false;
  if (isSequentialDeliverablesEnabled()) return false;
  if (isSharedSerialWritePath(outputPath)) return false;
  return true;
}
