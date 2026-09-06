// PD-SAAS-FORK: single binary/video deliverable sanity rules shared by the
// engine final-acceptance gate and the UI server validate endpoint, so a video
// or office file is judged identically on both sides instead of diverging into
// engine "needs_repair" vs UI "pending/verified".
import path from 'node:path';

export const VIDEO_MIN_BYTES = 16 * 1024;
export const PDF_MIN_BYTES = 128;

/**
 * Validate a binary deliverable's magic-number header. An empty/undefined
 * header means the header was not sampled, which is treated as "do not fail".
 * @param {string} relPath
 * @param {string | undefined} header latin1-decoded first bytes of the file
 * @returns {boolean}
 */
export function isValidBinaryDeliverableHeader(relPath, header) {
  if (!header) return true;
  const ext = path.extname(String(relPath || '')).toLowerCase();
  switch (ext) {
    case '.pptx':
    case '.docx':
    case '.xlsx':
      return header.startsWith('PK\x03\x04')
        || header.startsWith('PK\x05\x06')
        || header.startsWith('PK\x07\x08');
    case '.pdf':
      return header.startsWith('%PDF-');
    case '.png':
      return header.startsWith('\x89PNG\r\n\x1a\n');
    case '.jpg':
    case '.jpeg':
      return header.startsWith('\xff\xd8\xff');
    case '.gif':
      return header.startsWith('GIF87a') || header.startsWith('GIF89a');
    case '.webp':
      return header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP';
    case '.mp4':
    case '.mov':
      return header.length >= 8 && header.slice(4, 8) === 'ftyp';
    case '.webm':
      return header.charCodeAt(0) === 0x1a
        && header.charCodeAt(1) === 0x45
        && header.charCodeAt(2) === 0xdf
        && header.charCodeAt(3) === 0xa3;
    default:
      return true;
  }
}

/**
 * Detect an obviously-undersized binary deliverable (empty-shell video / stub
 * pdf). Office/zip and image extensions are not size-gated here because valid
 * minimal files vary too much; their integrity is covered by header checks.
 * @param {string} relPath
 * @param {number} sizeBytes
 * @returns {boolean}
 */
export function isUndersizedBinaryDeliverable(relPath, sizeBytes) {
  const ext = path.extname(String(relPath || '')).toLowerCase();
  const size = Number(sizeBytes) || 0;
  if (ext === '.mp4' || ext === '.mov' || ext === '.webm') return size < VIDEO_MIN_BYTES;
  if (ext === '.pdf') return size < PDF_MIN_BYTES;
  return false;
}
