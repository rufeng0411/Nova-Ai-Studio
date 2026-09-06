import { describe, expect, it } from 'vitest';
import { buildDeliverableSummaryRows, buildDeliverableSummaryRowsFromTextPaths } from './buildDeliverableSummaryRows';
import type { ValidatedDeliverable } from './validateDeliverables';

describe('buildDeliverableSummaryRows', () => {
  const turnDir = 'artifacts/slides-argentina';

  it('renders 6 rows for partial nova deck (3 delivered + 3 need continue)', () => {
    const validated: ValidatedDeliverable[] = [1, 2, 3].map((n) => ({
      id: String(n),
      path: `${turnDir}/slide-0${n}.png`,
      apiPath: `${turnDir}/slide-0${n}.png`,
      resolvedPath: `${turnDir}/slide-0${n}.png`,
      kind: 'image',
      source: 'tool',
      validationStatus: 'verified',
    }));

    const rows = buildDeliverableSummaryRows({
      expectedManifest: [{ id: 'required_png', kind: 'png', count: 6, required: true }],
      turnArtifactDir: turnDir,
      validatedItems: validated,
      acceptanceRows: [
        { id: 'm1', label: 'slide-04', path: `${turnDir}/slide-04.png`, status: 'missing' },
        { id: 'm2', label: 'slide-05', path: `${turnDir}/slide-05.png`, status: 'missing' },
        { id: 'm3', label: 'slide-06', path: `${turnDir}/slide-06.png`, status: 'missing' },
      ],
    });

    expect(rows).toHaveLength(6);
    expect(rows.filter((row) => row.status === 'delivered')).toHaveLength(3);
    expect(rows.filter((row) => row.status === 'needContinue' || row.status === 'missing')).toHaveLength(3);
    expect(rows[0].linkable).toBe(true);
    expect(rows[5].linkable).toBe(false);
  });

  it('promotes missing to delivered when resolvedPathMap exists', () => {
    const rows = buildDeliverableSummaryRows({
      slideManifestPages: [
        { page: 1, path: `${turnDir}/slide-01.png` },
        { page: 2, path: `${turnDir}/slide-02.png` },
      ],
      turnArtifactDir: turnDir,
      resolvedPathMap: {
        [`${turnDir}/slide-02.png`]: `${turnDir}/slide-02.png`,
      },
      acceptanceRows: [
        { id: 'm', label: 'slide-02', path: `${turnDir}/slide-02.png`, status: 'missing' },
      ],
      validatedItems: [{
        id: '1',
        path: `${turnDir}/slide-01.png`,
        apiPath: `${turnDir}/slide-01.png`,
        resolvedPath: `${turnDir}/slide-01.png`,
        kind: 'image',
        source: 'tool',
        validationStatus: 'verified',
      }],
    });

    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.status === 'delivered')).toHaveLength(2);
  });

  it('SDM done slots without verified show checking (no false delivered)', () => {
    const rows = buildDeliverableSummaryRows({
      expectedManifest: [
        { id: 'slot_1', label: '调研报告', status: 'done' },
        { id: 'slot_2', label: 'PPT 版', path: 'presentation.pptx', status: 'active' },
      ],
      validatedItems: [],
      acceptanceRows: [],
      validationSettled: true,
    });

    expect(rows[0]?.status).toBe('checking');
    expect(rows[0]?.linkable).toBe(false);
    expect(rows[1]?.status).toBe('missing');
  });

  it('matches acceptance rows by label when SDM slot has no pathHint', () => {
    const rows = buildDeliverableSummaryRows({
      expectedManifest: [{ id: 'slot_1', label: '调研报告', status: 'active' }],
      validatedItems: [{
        id: '1',
        path: 'artifacts/campaign/brief.md',
        apiPath: 'artifacts/campaign/brief.md',
        resolvedPath: 'artifacts/campaign/brief.md',
        kind: 'document',
        source: 'tool',
        validationStatus: 'verified',
      }],
      acceptanceRows: [
        {
          id: 'delivered:artifacts/campaign/brief.md',
          label: '调研报告',
          path: 'artifacts/campaign/brief.md',
          status: 'delivered',
        },
      ],
      validationSettled: true,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('delivered');
  });

  it('ignores pathless fallback acceptance rows instead of throwing', () => {
    expect(buildDeliverableSummaryRows({
      validatedItems: [],
      acceptanceRows: [{
        id: 'pathless',
        label: '待绑定报告',
        status: 'checking',
      }],
      validationSettled: false,
    })).toEqual([]);
  });

  it('matches kind-only SDM slots to validated items by extension', () => {
    const rows = buildDeliverableSummaryRows({
      expectedManifest: [
        { id: 'required_html_1', label: 'html', kind: 'html' },
        { id: 'required_markdown_1', label: 'markdown', kind: 'markdown' },
      ],
      validatedItems: [
        {
          id: '1',
          path: 'artifacts/modric/index.html',
          apiPath: 'artifacts/modric/index.html',
          resolvedPath: 'artifacts/modric/index.html',
          kind: 'html',
          source: 'tool',
          validationStatus: 'verified',
        },
        {
          id: '2',
          path: 'artifacts/modric/brand-brief.md',
          apiPath: 'artifacts/modric/brand-brief.md',
          resolvedPath: 'artifacts/modric/brand-brief.md',
          kind: 'document',
          source: 'tool',
          validationStatus: 'verified',
        },
      ],
      validationSettled: true,
    });

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.status === 'delivered')).toBe(true);
    expect(rows[0]?.label).toBe('index');
    expect(rows[1]?.label).toBe('brand brief');
  });

  it('promotes verifiedPaths to delivered for kind-only slots without validated items', () => {
    const rows = buildDeliverableSummaryRows({
      expectedManifest: [{ id: 'required_markdown_1', label: 'markdown', kind: 'markdown' }],
      validatedItems: [],
      verifiedPaths: ['artifacts/audience-profile/modric-fans-personas.md'],
      validationSettled: true,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('delivered');
    expect(rows[0]?.resolvedPath).toBe('artifacts/audience-profile/modric-fans-personas.md');
    expect(rows[0]?.label).toBe('modric fans personas');
  });

  it('MOD-07: renders 5 manifest rows with 1 delivered and 4 missing', () => {
    const rows = buildDeliverableSummaryRows({
      expectedManifest: [1, 2, 3, 4, 5].map((n) => ({
        id: `slot_${n}`,
        label: `成果 ${n}`,
        kind: 'markdown',
        path: `artifacts/campaign/item-${n}.md`,
      })),
      validatedItems: [{
        id: '1',
        path: 'artifacts/campaign/item-1.md',
        apiPath: 'artifacts/campaign/item-1.md',
        resolvedPath: 'artifacts/campaign/item-1.md',
        kind: 'document',
        source: 'tool',
        validationStatus: 'verified',
      }],
      verifiedPaths: ['artifacts/campaign/item-1.md'],
      validationSettled: true,
    });

    expect(rows).toHaveLength(5);
    expect(rows.filter((row) => row.status === 'delivered')).toHaveLength(1);
    expect(rows.filter((row) => row.status === 'missing')).toHaveLength(4);
  });

  it('builds fallback rows from assistant text paths when manifest empty', () => {
    const rows = buildDeliverableSummaryRowsFromTextPaths({
      assistantText: '主文件见 `artifacts/campaign/index.html` 与 `artifacts/campaign/brief.md`。',
      validationSettled: false,
    });

    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.every((row) => row.status === 'checking')).toBe(true);
    expect(rows.map((row) => row.path)).toContain('artifacts/campaign/index.html');
    expect(rows.map((row) => row.path)).toContain('artifacts/campaign/brief.md');
  });

  it('prefers GEO document manifest over stray slide pages in the same scope', () => {
    const taskDir = 'artifacts/task-20260710-geo12345';
    const expectedManifest = [
      { id: 'slot_1', label: 'citability-report.md', kind: 'markdown', path: 'citability-report.md' },
      { id: 'slot_2', label: 'geo-aeo-audit.md', kind: 'markdown', path: 'geo-aeo-audit.md' },
      { id: 'slot_3', label: 'schema.jsonld', kind: 'json', path: 'schema.jsonld' },
    ];
    const rows = buildDeliverableSummaryRows({
      expectedManifest,
      slideManifestPages: [1, 2, 3].map((page) => ({
        page,
        path: `${taskDir}/slide-0${page}.png`,
      })),
      turnArtifactDir: taskDir,
      validatedItems: expectedManifest.map((entry, index) => ({
        id: String(index),
        path: `${taskDir}/${entry.path}`,
        apiPath: `${taskDir}/${entry.path}`,
        resolvedPath: `${taskDir}/${entry.path}`,
        kind: 'document',
        source: 'tool',
        validationStatus: 'verified' as const,
      })),
      verifiedPaths: expectedManifest.map((entry) => `${taskDir}/${entry.path}`),
      validationSettled: true,
    });

    expect(rows).toHaveLength(3);
    expect(rows.some((row) => row.path?.includes('slide-'))).toBe(false);
    expect(rows.every((row) => row.status === 'delivered')).toBe(true);
  });

  it('renders platform markdown rows for geo count slot (not slide png)', () => {
    const taskDir = 'artifacts/task-20260711-geo';
    const rows = buildDeliverableSummaryRows({
      expectedManifest: [{
        id: 'profile_geo_platform',
        label: '平台成稿',
        kind: 'markdown',
        count: 3,
        required: true,
      }],
      turnArtifactDir: taskDir,
      validatedItems: [],
      validationSettled: true,
    });
    expect(rows).toHaveLength(3);
    expect(rows[0]?.path).toContain('zhihu-article.md');
    expect(rows[0]?.path).not.toContain('slide-01.png');
  });

  it('盛世天下 GEO: 10-slot SDM with count:3 stays 10 rows (not 3 slide png)', () => {
    const taskDir = 'artifacts/task-20260711-e80a6406';
    const expectedManifest = [
      { id: 'slot_1', label: 'geo-aeo-audit 审计清单。', path: 'geo-aeo-audit-checklist.md', status: 'done' as const },
      { id: 'slot_2', label: 'pd-geo：关键词 + 至少 3 个平台成稿 + optimized.md。', kind: 'markdown', count: 3, path: 'optimized.md', status: 'done' as const },
      { id: 'slot_3', label: 'geo-content-optimizer', kind: 'markdown', path: 'optimized.md', status: 'done' as const },
      { id: 'slot_4', label: 'schema.jsonld', path: 'schema.jsonld', status: 'done' as const },
      { id: 'slot_5', label: 'citability-report.md', kind: 'markdown', path: 'citability-report.md', status: 'done' as const },
      { id: 'slot_6', label: 'visibility-report.html', kind: 'html', path: 'visibility-report.html', status: 'done' as const },
      { id: 'slot_7', label: '可选草稿', required: false, path: 'draft.md', status: 'done' as const },
      { id: 'slot_8', label: 'geo 全套文件', path: 'geo-pack.md', status: 'done' as const },
      { id: 'slot_9', label: 'schema.jsonld', path: 'schema.jsonld', status: 'done' as const },
      { id: 'slot_10', label: '可选草稿编号', required: false, status: 'pending' as const },
    ];
    const rows = buildDeliverableSummaryRows({
      expectedManifest,
      turnArtifactDir: taskDir,
      validatedItems: [],
      verifiedPaths: [`${taskDir}/geo-aeo-audit.md`, `${taskDir}/schema.jsonld`],
      validationSettled: true,
    });

    expect(rows).toHaveLength(12);
    expect(rows.some((row) => row.path.includes('slide-0'))).toBe(false);
    expect(rows.filter((row) => row.status === 'delivered').length).toBeGreaterThanOrEqual(2);
    expect(rows.some((row) => row.status === 'checking')).toBe(true);
  });

  it('IP launch: 长文×2 expands to two longform rows and matches pillar paths', () => {
    const taskDir = 'artifacts/task-20260712-46dd7de7';
    const expectedManifest = [
      { id: 'slot_1_策略_md', label: '策略 .md', kind: 'markdown', path: '01-内容策略.md' },
      { id: 'slot_2_长文_2', label: '长文×2', count: 2 },
      { id: 'slot_3_社媒包', label: '社媒包', kind: 'markdown' },
      { id: 'slot_4_newsletter_md', label: 'newsletter .md', kind: 'markdown' },
      { id: 'slot_5_复盘_md', label: '复盘 .md', kind: 'markdown' },
    ];
    const rows = buildDeliverableSummaryRows({
      expectedManifest,
      turnArtifactDir: taskDir,
      validatedItems: [],
      verifiedPaths: [
        `${taskDir}/01-内容策略.md`,
        `${taskDir}/02-支柱长文A-互动影游的中国时刻.md`,
        `${taskDir}/02-支柱长文B-当我们在宫廷里做选择时我们在选择什么.md`,
      ],
      validationSettled: true,
    });

    expect(rows).toHaveLength(6);
    expect(rows.filter((row) => row.label.includes('支柱长文'))).toHaveLength(2);
    expect(rows.filter((row) => row.status === 'delivered').length).toBeGreaterThanOrEqual(3);
  });

  it('FAQ: compiles index.html slot under faq-dutch-goji without geo prefix', () => {
    const turnDir = 'artifacts/faq-dutch-goji';
    const verifiedPath = `${turnDir}/index.html`;
    const rows = buildDeliverableSummaryRows({
      expectedManifest: [{
        id: 'faq_index',
        label: 'index',
        kind: 'html',
        path: 'faq-dutch-goji/index.html',
        status: 'done',
      }],
      turnArtifactDir: turnDir,
      scopeDir: turnDir,
      verifiedPaths: [verifiedPath],
      validatedItems: [{
        id: '1',
        path: verifiedPath,
        apiPath: verifiedPath,
        resolvedPath: verifiedPath,
        kind: 'html',
        source: 'tool',
        validationStatus: 'verified',
      }],
      validationSettled: true,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].path).toBe(verifiedPath);
    expect(rows[0].resolvedPath).toBe(verifiedPath);
    expect(rows[0].path).not.toContain('artifacts/geo/');
    expect(rows[0].linkable).toBe(true);
  });
});
