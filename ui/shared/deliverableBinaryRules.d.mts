// PD-SAAS-FORK: type declarations for the shared binary/video deliverable sanity
// rules consumed by the engine final-acceptance gate (src/saas) via tsc. Keep in
// sync with deliverableBinaryRules.mjs so engine and UI judge files identically.
export const VIDEO_MIN_BYTES: number;
export const PDF_MIN_BYTES: number;
export function isValidBinaryDeliverableHeader(relPath: string, header: string | undefined): boolean;
export function isUndersizedBinaryDeliverable(relPath: string, sizeBytes: number): boolean;
