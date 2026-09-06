// PD-SAAS-FORK: server-side design canvas gate (mirrors UI localStorage default-off)
export function isDesignCanvasToolsEnabled(): boolean {
  if (process.env.PILOTDECK_DESIGN_CANVAS === '0') return false;
  if (process.env.PILOTDECK_DESIGN_CANVAS === '1') return true;
  return process.env.VITE_PILOTDECK_DESIGN_CANVAS === '1';
}
