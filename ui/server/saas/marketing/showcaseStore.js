// PD-SAAS-FORK: Showcase admin CRUD (sections + items)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getControlDriver } from '../db/control.js';
import { getDataRoot } from '../tenant/paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {Array<{ id: string, title_zh: string, title_en: string, lead_zh: string, lead_en: string, sort_order: number, star: number }>} */
export const SHOWCASE_SECTION_SEEDS = [
  {
    id: 'design',
    title_zh: '设计',
    title_en: 'Design',
    lead_zh: '官网、海报与主视觉——看得见的品牌物料',
    lead_en: 'Websites, posters, and key visuals — tangible brand deliverables',
    sort_order: 10,
    star: 0,
  },
  {
    id: 'video',
    title_zh: '视频',
    title_en: 'Video',
    lead_zh: '广告短片与官网宣传片——会动的成果',
    lead_en: 'Ad spots and promo reels — motion deliverables',
    sort_order: 20,
    star: 0,
  },
  {
    id: 'copy',
    title_zh: '文案',
    title_en: 'Copy',
    lead_zh: '长文与社媒切片——可直接发布的文字成果',
    lead_en: 'Long-form and social copy — ready-to-publish text',
    sort_order: 30,
    star: 0,
  },
  {
    id: 'marketing',
    title_zh: '营销',
    title_en: 'Marketing',
    lead_zh: '策划方案与 HTML 落地页——策略到页面',
    lead_en: 'Plans and HTML landing pages — strategy to page',
    sort_order: 40,
    star: 0,
  },
  {
    id: 'office',
    title_zh: '公关',
    title_en: 'PR & Comms',
    lead_zh: '危机、媒体日、Pitch 与公关战略——专业传播交付',
    lead_en: 'Crisis, media day, pitch, and PR strategy — professional comms',
    sort_order: 50,
    star: 0,
  },
  {
    id: 'research',
    title_zh: '研究分析',
    title_en: 'Research',
    lead_zh: '调研报告与用户研究——数据到结论',
    lead_en: 'Research reports and user studies — data to insight',
    sort_order: 60,
    star: 0,
  },
  {
    id: 'geo',
    title_zh: 'GEO',
    title_en: 'GEO',
    lead_zh: 'AI 搜索优化报告——可引用与可监测',
    lead_en: 'AI search optimization reports — citable and measurable',
    sort_order: 70,
    star: 0,
  },
  {
    id: 'fullcase',
    title_zh: '全案项目',
    title_en: 'Full Projects',
    lead_zh: '流程模板一次出整项目——独家全案能力',
    lead_en: 'End-to-end projects from process templates',
    sort_order: 80,
    star: 1,
  },
  {
    id: 'compliance',
    title_zh: '企业合规',
    title_en: 'Enterprise Compliance',
    lead_zh: '制度、审计与合规交付——企业落地必备',
    lead_en: 'Policies, audits, and compliance packs — built for enterprise rollout',
    sort_order: 90,
    star: 1,
  },
];

/**
 * @param {Record<string, unknown>} row
 */
function mapSectionRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title_zh: row.title_zh,
    title_en: row.title_en,
    lead_zh: row.lead_zh ?? '',
    lead_en: row.lead_en ?? '',
    sort_order: Number(row.sort_order ?? 0),
    star: Number(row.star ?? 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * @param {Record<string, unknown>} row
 */
function mapItemRow(row) {
  if (!row) return null;
  let sourceArtifactPaths = [];
  if (typeof row.source_artifact_paths === 'string' && row.source_artifact_paths.trim()) {
    try {
      const parsed = JSON.parse(row.source_artifact_paths);
      if (Array.isArray(parsed)) sourceArtifactPaths = parsed;
    } catch {
      sourceArtifactPaths = [];
    }
  }
  return {
    id: row.id,
    section_id: row.section_id,
    status: row.status ?? 'draft',
    name_zh: row.name_zh,
    name_en: row.name_en,
    annotation_zh: row.annotation_zh ?? '',
    annotation_en: row.annotation_en ?? '',
    badge_zh: row.badge_zh ?? '',
    badge_en: row.badge_en ?? '',
    prompt_zh: row.prompt_zh ?? '',
    prompt_en: row.prompt_en ?? '',
    thumb: row.thumb ?? '',
    href: row.href ?? '',
    star: Number(row.star ?? 0),
    sort_order: Number(row.sort_order ?? 0),
    source_session_id: row.source_session_id ?? null,
    source_artifact_paths: sourceArtifactPaths,
    published_at: row.published_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function ensureShowcaseTables() {
  const db = await getControlDriver();
  await db.queryOne('SELECT 1 AS ok FROM showcase_sections LIMIT 1').catch(() => null);
}

export async function ensureSeedSections() {
  const db = await getControlDriver();
  for (const seed of SHOWCASE_SECTION_SEEDS) {
    // Insert-only: do not overwrite admin/upsert titles on every list/publish.
    await db.execute(
      `INSERT INTO showcase_sections (id, title_zh, title_en, lead_zh, lead_en, sort_order, star)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
      [
        seed.id,
        seed.title_zh,
        seed.title_en,
        seed.lead_zh,
        seed.lead_en,
        seed.sort_order,
        seed.star,
      ],
    );
  }
}

/**
 * @param {{ status?: string, sectionId?: string }} [query]
 */
export async function listSections(query = {}) {
  await ensureSeedSections();
  const db = await getControlDriver();
  const rows = await db.queryAll(
    `SELECT * FROM showcase_sections ORDER BY sort_order ASC, id ASC`,
  );
  return rows.map(mapSectionRow);
}

/**
 * @param {Record<string, unknown>} input
 */
export async function upsertSection(input) {
  const id = String(input.id ?? '').trim();
  if (!id) throw new Error('section_id_required');
  const db = await getControlDriver();
  await db.execute(
    `INSERT INTO showcase_sections (id, title_zh, title_en, lead_zh, lead_en, sort_order, star)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title_zh = excluded.title_zh,
       title_en = excluded.title_en,
       lead_zh = excluded.lead_zh,
       lead_en = excluded.lead_en,
       sort_order = excluded.sort_order,
       star = excluded.star,
       updated_at = CURRENT_TIMESTAMP`,
    [
      id,
      String(input.title_zh ?? input.title ?? id),
      String(input.title_en ?? input.title_zh ?? input.title ?? id),
      String(input.lead_zh ?? input.lead ?? ''),
      String(input.lead_en ?? input.lead_zh ?? input.lead ?? ''),
      Number(input.sort_order ?? 0),
      Number(input.star ?? 0),
    ],
  );
  const row = await db.queryOne('SELECT * FROM showcase_sections WHERE id = ?', [id]);
  return mapSectionRow(row);
}

/**
 * @param {{ status?: string, sectionId?: string, limit?: number, offset?: number }} [query]
 */
export async function listItems(query = {}) {
  await ensureSeedSections();
  const db = await getControlDriver();
  const lim = Math.min(Math.max(Number(query.limit) || 500, 1), 1000);
  const off = Math.max(Number(query.offset) || 0, 0);
  const params = [];
  let sql = 'SELECT * FROM showcase_items WHERE 1=1';
  if (query.status) {
    sql += ' AND status = ?';
    params.push(query.status);
  }
  if (query.sectionId) {
    sql += ' AND section_id = ?';
    params.push(query.sectionId);
  }
  sql += ' ORDER BY section_id ASC, sort_order ASC, id ASC LIMIT ? OFFSET ?';
  params.push(lim, off);
  const rows = await db.queryAll(sql, params);
  return rows.map(mapItemRow);
}

/**
 * @param {string} id
 */
export async function getItem(id) {
  const db = await getControlDriver();
  const row = await db.queryOne('SELECT * FROM showcase_items WHERE id = ?', [id]);
  return mapItemRow(row);
}

/**
 * @param {Record<string, unknown>} input
 */
export async function upsertItem(input) {
  const id = String(input.id ?? '').trim();
  const sectionId = String(input.section_id ?? input.sectionId ?? '').trim();
  if (!id || !sectionId) throw new Error('item_id_and_section_required');

  const sourcePaths =
    input.source_artifact_paths ?? input.sourceArtifactPaths ?? [];
  const sourceJson = JSON.stringify(Array.isArray(sourcePaths) ? sourcePaths : []);

  const db = await getControlDriver();
  await db.execute(
    `INSERT INTO showcase_items (
       id, section_id, status, name_zh, name_en,
       annotation_zh, annotation_en, badge_zh, badge_en,
       prompt_zh, prompt_en, thumb, href, star, sort_order,
       source_session_id, source_artifact_paths
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       section_id = excluded.section_id,
       status = excluded.status,
       name_zh = excluded.name_zh,
       name_en = excluded.name_en,
       annotation_zh = excluded.annotation_zh,
       annotation_en = excluded.annotation_en,
       badge_zh = excluded.badge_zh,
       badge_en = excluded.badge_en,
       prompt_zh = excluded.prompt_zh,
       prompt_en = excluded.prompt_en,
       thumb = excluded.thumb,
       href = excluded.href,
       star = excluded.star,
       sort_order = excluded.sort_order,
       source_session_id = excluded.source_session_id,
       source_artifact_paths = excluded.source_artifact_paths,
       updated_at = CURRENT_TIMESTAMP`,
    [
      id,
      sectionId,
      String(input.status ?? 'draft'),
      String(input.name_zh ?? input.name ?? id),
      String(input.name_en ?? input.name_zh ?? input.name ?? id),
      String(input.annotation_zh ?? input.annotation ?? ''),
      String(input.annotation_en ?? input.annotation_zh ?? input.annotation ?? ''),
      String(input.badge_zh ?? input.badge ?? ''),
      String(input.badge_en ?? input.badge_zh ?? input.badge ?? ''),
      String(input.prompt_zh ?? input.prompt ?? ''),
      String(input.prompt_en ?? input.prompt_zh ?? input.prompt ?? ''),
      String(input.thumb ?? ''),
      String(input.href ?? ''),
      Number(input.star ?? 0),
      Number(input.sort_order ?? 0),
      input.source_session_id ?? input.sourceSessionId ?? null,
      sourceJson,
    ],
  );
  return getItem(id);
}

/**
 * @param {string} id
 * @param {'draft'|'published'|'archived'} status
 */
export async function setItemStatus(id, status) {
  const allowed = ['draft', 'published', 'archived'];
  if (!allowed.includes(status)) throw new Error('invalid_status');
  const db = await getControlDriver();
  const publishedAt =
    status === 'published' ? new Date().toISOString() : null;
  await db.execute(
    `UPDATE showcase_items
     SET status = ?, published_at = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, publishedAt, id],
  );
  return getItem(id);
}

function resolveSeedCatalogCandidates() {
  const cwd = process.cwd();
  return [
    path.join(getDataRoot(), 'marketing', 'showcase', 'seed-catalog.json'),
    path.resolve(cwd, 'deploy/marketing/showcase/seed-catalog.json'),
    path.resolve(__dirname, '../../../../deploy/marketing/showcase/seed-catalog.json'),
  ];
}

/**
 * Seed draft items from deploy/marketing/showcase/seed-catalog.json when table is empty.
 */
export async function ensureSeedItemsFromCatalog() {
  const db = await getControlDriver();
  const countRow = await db.queryOne('SELECT COUNT(*) AS cnt FROM showcase_items');
  if (Number(countRow?.cnt ?? 0) > 0) return { seeded: 0 };

  let seedPath = null;
  for (const candidate of resolveSeedCatalogCandidates()) {
    if (fs.existsSync(candidate)) {
      seedPath = candidate;
      break;
    }
  }
  if (!seedPath) return { seeded: 0, note: 'seed_catalog_missing' };

  const raw = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const sections = Array.isArray(raw?.sections) ? raw.sections : [];
  let seeded = 0;
  for (const sec of sections) {
    const sectionId = String(sec.id ?? '').trim();
    if (!sectionId) continue;
    const items = Array.isArray(sec.items) ? sec.items : [];
    for (const [index, item] of items.entries()) {
      const itemId = String(item.id ?? `${sectionId}-${index}`).trim();
      await upsertItem({
        id: itemId,
        section_id: sectionId,
        status: 'draft',
        name_zh: item.name ?? item.name_zh ?? itemId,
        name_en: item.name_en ?? item.name ?? itemId,
        annotation_zh: item.annotation ?? item.annotation_zh ?? '',
        annotation_en: item.annotation_en ?? item.annotation ?? '',
        badge_zh: item.badge ?? item.badge_zh ?? '',
        badge_en: item.badge_en ?? item.badge ?? '',
        prompt_zh: item.prompt ?? item.prompt_zh ?? '',
        prompt_en: item.prompt_en ?? item.prompt ?? '',
        thumb: item.thumb ?? '',
        href: item.href ?? '',
        star: item.star ? 1 : 0,
        sort_order: (index + 1) * 10,
      });
      seeded += 1;
    }
  }
  return { seeded, seedPath };
}

/**
 * @param {{ tenantId: string, userId: number, limit?: number }} query
 */
export async function listRecentCatalogSessions(query) {
  const db = await getControlDriver();
  const lim = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
  const rows = await db.queryAll(
    `SELECT session_id, legacy_project_id, title, ai_title, custom_title, summary,
            first_prompt, last_activity_at, transcript_rel_path
     FROM conversation_catalog
     WHERE tenant_id = ? AND user_id = ? AND deleted_at IS NULL
     ORDER BY last_activity_at DESC
     LIMIT ?`,
    [query.tenantId, query.userId, lim],
  );
  return rows.map((row) => ({
    sessionId: row.session_id,
    legacyProjectId: row.legacy_project_id,
    title:
      row.custom_title ||
      row.summary ||
      row.ai_title ||
      row.title ||
      row.first_prompt ||
      '对话',
    lastActivityAt: row.last_activity_at,
    transcriptRelPath: row.transcript_rel_path,
  }));
}
