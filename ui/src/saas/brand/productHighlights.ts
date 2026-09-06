/**
 * PD-SAAS-FORK: Single source of truth for the nine platform highlights
 * (login hero carousel + logo product dialog). Copy lives in common.json i18n.
 */
export const PRODUCT_HIGHLIGHT_ORDER = [
  'agent-harness',
  'conversation',
  'token-savings',
  'flywheel',
  'research-growth',
  'capabilities',
  'models',
  'pipeline',
  'security',
] as const;

export type ProductHighlightId = (typeof PRODUCT_HIGHLIGHT_ORDER)[number];

/** Bottom stat strip index on login hero, or null when not linked. */
export const PRODUCT_HIGHLIGHT_STAT_INDEX: Partial<Record<ProductHighlightId, number>> = {
  capabilities: 0,
  flywheel: 1,
  'research-growth': 2,
  pipeline: 3,
  'token-savings': 4,
  security: 5,
};

export const SECURITY_ORBIT_NODES: ReadonlyArray<{ id: string }> = [
  { id: 'tenant' },
  { id: 'auth' },
  { id: 'tools' },
  { id: 'sandbox' },
  { id: 'audit' },
];

/** Header metric chips in logo product dialog. */
export const PRODUCT_INFO_STAT_KEYS = [
  'capabilities',
  'flywheel',
  'research',
  'pipeline',
  'token',
  'security',
] as const;

/** Grouped layout for product dialog (not a flat numbered list). */
export const PRODUCT_HIGHLIGHT_GROUPS = [
  { id: 'workflow', highlights: ['agent-harness', 'conversation', 'token-savings'] as const },
  {
    id: 'platform',
    highlights: ['flywheel', 'research-growth', 'capabilities', 'models', 'pipeline'] as const,
  },
  { id: 'trust', highlights: ['security'] as const },
] as const;

export type ProductHighlightGroupId = (typeof PRODUCT_HIGHLIGHT_GROUPS)[number]['id'];

export const PRODUCT_HIGHLIGHT_ACCENT: Record<ProductHighlightId, string> = {
  'agent-harness': 'amber',
  conversation: 'lavender',
  'token-savings': 'violet',
  flywheel: 'sky',
  'research-growth': 'emerald',
  capabilities: 'teal',
  models: 'indigo',
  pipeline: 'rose',
  security: 'slate',
};
