// PD-SAAS-FORK: shared PPTX slide dimensions (Node compose export)
/** @type {Record<string, [number, number]>} width/height in inches */
export const ASPECT_SIZES_INCHES = {
  '16:9': [13.333, 7.5],
  '4:3': [10, 7.5],
  '1:1': [10, 10],
  '9:16': [7.5, 13.333],
  '3:4': [7.5, 10],
};

export function normalizeAspectRatio(value, defaultRatio = '16:9') {
  const raw = String(value || '').trim();
  if (raw in ASPECT_SIZES_INCHES) return raw;
  return defaultRatio in ASPECT_SIZES_INCHES ? defaultRatio : '16:9';
}

export function slideSizeInches(aspectRatio) {
  const key = normalizeAspectRatio(aspectRatio);
  return ASPECT_SIZES_INCHES[key];
}
