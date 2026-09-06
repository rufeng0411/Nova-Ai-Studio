// PD-SAAS-FORK: browser-safe office-extension slot checks (no fs telemetry).
import { officeExtensionStrictMode, isOfficeExtensionStrictEnabled } from "../resilience/stabilityFlags.js";

export type OfficeExtensionSlotLike = {
  kind?: string;
  pathHint?: string;
  pathHints?: string[];
};

const PLACEHOLDER_VISUAL_BASENAMES =
  /(?:placeholder|img-placeholder|nova-kv-placeholder)/i;

function basename(filePath: string): string {
  return String(filePath ?? "").replace(/\\/g, "/").split("/").pop() ?? "";
}

export function isFakeDocxPath(filePath: string): boolean {
  const base = basename(filePath).toLowerCase();
  return /\.docx\.md$/i.test(base);
}

export function isPlaceholderVisualPath(filePath: string, slotHint?: string): boolean {
  const base = basename(filePath);
  const hint = basename(slotHint ?? filePath);
  if (/key-visual|poster|主视觉|kv/i.test(hint) && /\.svg$/i.test(base)) {
    return PLACEHOLDER_VISUAL_BASENAMES.test(base);
  }
  if (/\.svg$/i.test(base) && PLACEHOLDER_VISUAL_BASENAMES.test(base)) {
    return /key-visual|poster|主视觉|kv/i.test(hint);
  }
  return false;
}

export type OfficeExtensionRejectReason =
  | "docx_slot_matched_md"
  | "placeholder_visual_bound_to_png_slot";

export function officeExtensionPathSatisfiesSlotCore(
  verifiedPath: string,
  slot: OfficeExtensionSlotLike,
): { ok: true } | { ok: false; reason: OfficeExtensionRejectReason } {
  if (!isOfficeExtensionStrictEnabled()) return { ok: true };

  const p = String(verifiedPath ?? "");
  const kind = String(slot.kind ?? "").toLowerCase();
  const hints = [slot.pathHint, ...(slot.pathHints ?? [])].filter(Boolean).join(" ");

  if (kind === "docx" || /\.docx$/i.test(hints)) {
    if (/\.docx\.md$/i.test(p) || !/\.docx$/i.test(p)) {
      return { ok: false, reason: "docx_slot_matched_md" };
    }
  }

  if (/key-visual|poster|主视觉|kv/i.test(hints) && isPlaceholderVisualPath(p, hints)) {
    return { ok: false, reason: "placeholder_visual_bound_to_png_slot" };
  }

  return { ok: true };
}

export function officeExtensionPathSatisfiesSlot(
  verifiedPath: string,
  slot: OfficeExtensionSlotLike,
): boolean {
  const result = officeExtensionPathSatisfiesSlotCore(verifiedPath, slot);
  if (result.ok) return true;
  return officeExtensionStrictMode() !== "enforce";
}
