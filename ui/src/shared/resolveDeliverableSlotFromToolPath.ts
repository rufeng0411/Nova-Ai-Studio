// PD-SAAS-FORK ES9 P0-E: map write_file paths to frozen SDM slot labels for process UX.
import type { SessionDeliverableManifestUi } from './resolveSessionDeliverableManifest';

export type DeliverableSlotProcessHint = {
  slotIndex: number;
  slotTotal: number;
  label: string;
  basename: string;
};

function normalizePath(value: string): string {
  return String(value ?? '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
}

function basenameOf(value: string): string {
  const normalized = normalizePath(value);
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(index + 1) : normalized;
}

function slotHints(slot: SessionDeliverableManifestUi['slots'][number]): string[] {
  const hints = [...(slot.pathHints ?? [])];
  if (slot.pathHint) hints.push(slot.pathHint);
  return hints.map(normalizePath).filter(Boolean);
}

export function resolveDeliverableSlotFromToolPath(
  filePath: string,
  manifest: SessionDeliverableManifestUi | undefined,
): DeliverableSlotProcessHint | null {
  if (!manifest?.slots?.length || !filePath.trim()) return null;
  const active = manifest.slots.filter((slot) => slot.status !== 'removed');
  if (active.length === 0) return null;
  const normalized = normalizePath(filePath).toLowerCase();
  const basename = basenameOf(filePath).toLowerCase();

  for (let index = 0; index < active.length; index += 1) {
    const slot = active[index]!;
    const hints = slotHints(slot);
    const matched = hints.some((hint) => {
      const hintBase = basenameOf(hint).toLowerCase();
      const hintNorm = hint.toLowerCase();
      return normalized.includes(hintNorm)
        || basename === hintBase
        || normalized.endsWith(`/${hintBase}`);
    });
    if (!matched) continue;
    return {
      slotIndex: index + 1,
      slotTotal: active.length,
      label: slot.label?.trim() || basenameOf(filePath),
      basename: basenameOf(filePath),
    };
  }
  return null;
}
