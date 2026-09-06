// PD-SAAS-FORK P0′-5: reject .docx.md / placeholder SVG masquerading as done slots.
import { isOfficeExtensionStrictEnabled, officeExtensionStrictMode } from "../resilience/stabilityFlags.js";
import type { SdmSlotLike } from "./sdmSlotMatching.js";
import {
  isFakeDocxPath,
  isPlaceholderVisualPath,
  officeExtensionPathSatisfiesSlotCore,
} from "./officeExtensionStrictCore.js";
import { recordP0PrimeGateEvent } from "./p0primeGateTelemetry.js";

export { isFakeDocxPath, isPlaceholderVisualPath } from "./officeExtensionStrictCore.js";

export function officeExtensionPathSatisfiesSlot(
  verifiedPath: string,
  slot: SdmSlotLike,
  caseId?: string,
): boolean {
  const result = officeExtensionPathSatisfiesSlotCore(verifiedPath, slot);
  if (result.ok) return true;
  recordP0PrimeGateEvent({
    flag: "PILOTDECK_OFFICE_EXTENSION_STRICT",
    caseId,
    path: String(verifiedPath ?? ""),
    reason: result.reason,
  });
  if (!isOfficeExtensionStrictEnabled()) return true;
  return officeExtensionStrictMode() !== "enforce";
}
