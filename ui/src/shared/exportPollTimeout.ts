// PD-SAAS-FORK: UI export job poll limits (OCR decks need several minutes)
import type { ExportEngine } from './documentExportMatrix';

const DEFAULT_POLL_MS = 1200;
const DEFAULT_MAX_MS = 180_000;

/** Max poll attempts for async export jobs (OCR 8-slide decks ≈ 2.5–6 min). */
export function computeExportPollMaxAttempts(
  pageCount: number | undefined,
  engine: ExportEngine | string | undefined,
  pollMs = DEFAULT_POLL_MS,
): number {
  const isOcr = engine === 'ocr_editable_pptx';
  let timeoutMs = DEFAULT_MAX_MS;

  if (pageCount && pageCount > 1) {
    const perPageMs = isOcr ? 55_000 : 20_000;
    const estimated = 150_000 + pageCount * perPageMs;
    const floorMs = isOcr ? 420_000 : 180_000;
    timeoutMs = Math.min(1_200_000, Math.max(floorMs, estimated));
  } else if (isOcr) {
    // HTML→截图→OCR 开始时页数未知，先给足 8 分钟；获知页数后 UI 会动态续等。
    timeoutMs = 480_000;
  }

  return Math.max(1, Math.ceil(timeoutMs / pollMs));
}

export function exportPollTimeoutMs(
  pageCount: number | undefined,
  engine: ExportEngine | string | undefined,
  pollMs = DEFAULT_POLL_MS,
): number {
  return computeExportPollMaxAttempts(pageCount, engine, pollMs) * pollMs;
}
