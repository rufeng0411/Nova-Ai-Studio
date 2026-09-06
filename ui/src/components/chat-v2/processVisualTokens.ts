// PD-SAAS-FORK: informal process (T0) visual tokens — muted, left-rail, no success card
export const INFORMAL_PROCESS = {
  fontSize: 'text-[12px]',
  textMuted: 'text-muted-foreground/70',
  textMutedStrong: 'text-muted-foreground/85',
  /** Single left rail — no nested card borders on process steps. */
  rail: 'border-l border-border/45',
  railPadding: 'pl-3',
  /** Sticky 模式下历史回合成果脚注（弱于底栏，对齐过程区左轨）。 */
  deliverableHistoricalFootnote:
    'mt-3 border-l border-border/35 pl-2.5 text-[11px] leading-[1.55] text-muted-foreground/55',
  triggerGap: 'gap-1.5',
  stackGap: 'gap-1',
  /** Live dock: visible step rows before older ones scroll up (Cursor-like). */
  liveViewportMaxRows: 8,
  /** Approx single-line step height for viewport max-height calc. */
  liveViewportRowPx: 26,
  collapsedHeightPx: 28,
  spacerAfter: 'h-6',
  artifactStrip: 'mt-2 flex flex-wrap gap-1.5',
  artifactChip:
    'inline-flex max-w-full items-center gap-1 rounded-md border border-border/50 bg-muted/20 px-1.5 py-0.5 text-[11px] text-muted-foreground',
} as const;

export const DELIVERABLE_SURFACE =
  'mt-3 rounded-xl border border-border/60 bg-muted/15 p-3 border-l-[3px] border-l-success/40';
