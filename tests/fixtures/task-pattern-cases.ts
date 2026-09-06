// PD-SAAS-FORK: Generic task-pattern replay fixtures (M1–M4), sanitized — no brand names.

export type TaskPatternFailureLabel =
  | 'placeholder_delivery'
  | 'false_incomplete'
  | 'directory_slot_incomplete'
  | 'aligned'
  | 'baseline_pass';

export interface TaskPatternCaseFixture {
  id: string;
  pattern: 'slide-png-contract' | 'multi-stage-campaign' | 'geo-multi-md' | 'single-md-report';
  label: string;
  goalHint: string;
  deliverableRows: Array<{ label: string; status: 'done' | 'pending' | 'blocked'; basename: string | null }>;
  diskFiles: string[];
  manifestPlaceholder: boolean;
  expectedLabel: TaskPatternFailureLabel;
  enforceMode: boolean;
}

export const TASK_PATTERN_CASES: TaskPatternCaseFixture[] = [
  {
    id: 'pattern-slide-png-contract',
    pattern: 'slide-png-contract',
    label: 'M1 幻灯 PNG 契约 — placeholder manifest',
    goalHint: 'Brand-A 8页 PNG slides with manifest',
    deliverableRows: [
      { label: 'slide-deck', status: 'pending', basename: 'slide-manifest.json' },
    ],
    diskFiles: ['artifacts/slides-brand-a/slide-manifest.json', 'artifacts/slides-brand-a/slide-01.svg'],
    manifestPlaceholder: true,
    expectedLabel: 'placeholder_delivery',
    enforceMode: true,
  },
  {
    id: 'pattern-multi-stage-campaign',
    pattern: 'multi-stage-campaign',
    label: 'M2 七阶段 — 目录 slot 未完成',
    goalHint: 'campaign-full-7slot Brand-A',
    deliverableRows: [
      { label: 'social-slices', status: 'pending', basename: '03-social-slices.md' },
      { label: 'key-visual', status: 'done', basename: 'key-visual.svg' },
    ],
    diskFiles: ['artifacts/campaign-full/key-visual.svg'],
    manifestPlaceholder: false,
    expectedLabel: 'directory_slot_incomplete',
    enforceMode: true,
  },
  {
    id: 'pattern-geo-multi-md',
    pattern: 'geo-multi-md',
    label: 'M3 GEO — 多 md 对齐',
    goalHint: 'Brand-A GEO 7 files',
    deliverableRows: [
      { label: 'geo-report', status: 'done', basename: 'geo-report.md' },
      { label: 'geo-checklist', status: 'done', basename: 'geo-checklist.md' },
    ],
    diskFiles: ['artifacts/geo-brand-a/geo-report.md', 'artifacts/geo-brand-a/geo-checklist.md'],
    manifestPlaceholder: false,
    expectedLabel: 'aligned',
    enforceMode: false,
  },
  {
    id: 'pattern-single-md-report',
    pattern: 'single-md-report',
    label: 'M4 单文件研报基线',
    goalHint: 'industry report md',
    deliverableRows: [{ label: 'report', status: 'done', basename: 'industry-report.md' }],
    diskFiles: ['artifacts/reports/industry-report.md'],
    manifestPlaceholder: false,
    expectedLabel: 'baseline_pass',
    enforceMode: false,
  },
];

export function classifyTaskPatternCase(fixture: TaskPatternCaseFixture): TaskPatternFailureLabel {
  if (fixture.pattern === 'single-md-report') return 'baseline_pass';
  if (fixture.pattern === 'geo-multi-md') {
    const allDone = fixture.deliverableRows.every((r) => r.status === 'done');
    return allDone ? 'aligned' : 'false_incomplete';
  }
  if (fixture.pattern === 'slide-png-contract') {
    if (fixture.manifestPlaceholder) return 'placeholder_delivery';
    return 'baseline_pass';
  }
  if (fixture.pattern === 'multi-stage-campaign') {
    const dirPending = fixture.deliverableRows.some(
      (r) => r.basename?.endsWith('/') && r.status !== 'done',
    );
    if (dirPending) return 'directory_slot_incomplete';
    return 'aligned';
  }
  return 'false_incomplete';
}
