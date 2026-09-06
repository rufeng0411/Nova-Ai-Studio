/** 与 terminal.css 同步，供 xterm / SVG 等 JS 侧引用 */
export const TERMINAL_TOKENS = {
  bgVoid: '#050505',
  bgBase: '#090909',
  bgElevated: '#0e0e0e',
  bgInset: '#070707',
  textPrimary: '#e8e8e8',
  textSecondary: '#9a9a9a',
  textTertiary: '#5a5a5a',
  textGhost: '#383838',
  borderDefault: 'rgba(255,255,255,0.09)',
  logDefault: '#d8d8d8',
  logInfo: '#92b8d8',
  logSuccess: '#82d4a4',
  logMuted: '#606060',
  logError: '#d09090',
  chartLine: '#b8c4cc',
  chartGrid: 'rgba(255,255,255,0.035)',
} as const;
