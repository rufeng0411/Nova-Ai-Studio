// PD-SAAS-FORK: control-plane CRUD for public markdown share links
import crypto from 'node:crypto';
import { getControlDriver } from '../db/control.js';

/**
 * @returns {string}
 */
export function generateShareId() {
  return crypto.randomBytes(16).toString('base64url');
}

/**
 * @param {Record<string, unknown>} row
 */
export function mapShareLinkRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    userId: Number(row.user_id),
    projectKey: String(row.project_key),
    relativePath: String(row.relative_path),
    hintDir: row.hint_dir == null || row.hint_dir === '' ? null : String(row.hint_dir),
    title: row.title == null ? null : String(row.title),
    wordCount: Number(row.word_count ?? 0),
    seoIndexable: Boolean(Number(row.seo_indexable ?? 0)),
    revokedAt: row.revoked_at == null ? null : String(row.revoked_at),
    createdAt: row.created_at == null ? null : String(row.created_at),
    updatedAt: row.updated_at == null ? null : String(row.updated_at),
  };
}

/**
 * @param {{ tenantId: string, userId: number, projectKey: string, relativePath: string }} input
 */
export async function findActiveShareLink(input) {
  const db = await getControlDriver();
  const row = await db.queryOne(
    `SELECT * FROM markdown_share_links
     WHERE tenant_id = $1 AND user_id = $2 AND project_key = $3 AND relative_path = $4
       AND revoked_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [input.tenantId, input.userId, input.projectKey, input.relativePath],
  );
  return mapShareLinkRow(row);
}

/**
 * @param {string} shareId
 */
export async function getShareLinkById(shareId) {
  const db = await getControlDriver();
  const row = await db.queryOne('SELECT * FROM markdown_share_links WHERE id = $1', [shareId]);
  return mapShareLinkRow(row);
}

/**
 * @param {{
 *   tenantId: string,
 *   userId: number,
 *   projectKey: string,
 *   relativePath: string,
 *   hintDir?: string | null,
 *   title?: string | null,
 *   wordCount?: number,
 *   seoIndexable?: boolean,
 * }} input
 */
export async function createOrReuseShareLink(input) {
  const existing = await findActiveShareLink(input);
  if (existing) {
    const db = await getControlDriver();
    await db.execute(
      `UPDATE markdown_share_links
       SET hint_dir = $1, title = $2, word_count = $3, seo_indexable = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [
        input.hintDir ?? null,
        input.title ?? existing.title,
        Number(input.wordCount ?? existing.wordCount),
        input.seoIndexable ? 1 : 0,
        existing.id,
      ],
    );
    return getShareLinkById(existing.id);
  }

  const id = generateShareId();
  const db = await getControlDriver();
  await db.execute(
    `INSERT INTO markdown_share_links (
       id, tenant_id, user_id, project_key, relative_path, hint_dir, title, word_count, seo_indexable
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      input.tenantId,
      input.userId,
      input.projectKey,
      input.relativePath,
      input.hintDir ?? null,
      input.title ?? null,
      Number(input.wordCount ?? 0),
      input.seoIndexable ? 1 : 0,
    ],
  );
  return getShareLinkById(id);
}

/**
 * @param {{ shareId: string, tenantId: string, userId: number }} input
 */
export async function revokeShareLink(input) {
  const db = await getControlDriver();
  const result = await db.execute(
    `UPDATE markdown_share_links
     SET revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND revoked_at IS NULL`,
    [input.shareId, input.tenantId, input.userId],
  );
  return Number(result?.changes ?? 0) > 0;
}

/** @type {Map<string, number[]>} */
const createBuckets = new Map();

/**
 * Simple per-user create rate limit (default 10/min).
 * @param {string|number} userId
 * @param {{ limit?: number, windowMs?: number }} [opts]
 */
export function assertShareCreateRateLimit(userId, opts = {}) {
  const limit = opts.limit ?? 10;
  const windowMs = opts.windowMs ?? 60_000;
  const key = String(userId);
  const now = Date.now();
  const arr = (createBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    const err = new Error('Share create rate limit exceeded');
    err.code = 'RATE_LIMIT';
    throw err;
  }
  arr.push(now);
  createBuckets.set(key, arr);
}

export function resetShareCreateRateLimitForTests() {
  createBuckets.clear();
}

/**
 * Build absolute public share URL (no JWT).
 * @param {string} shareId
 * @param {{ req?: import('express').Request, env?: NodeJS.ProcessEnv }} [opts]
 */
export function buildAbsolutePublicShareUrl(shareId, opts = {}) {
  const env = opts.env || process.env;
  const configured = String(env.PUBLIC_SHARE_ORIGIN || '').trim().replace(/\/$/, '');
  if (configured) {
    return `${configured}/s/${encodeURIComponent(shareId)}`;
  }
  const req = opts.req;
  if (req) {
    const proto = String(req.get?.('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
    const host = String(req.get?.('x-forwarded-host') || req.get?.('host') || 'localhost').split(',')[0].trim();
    return `${proto}://${host}/s/${encodeURIComponent(shareId)}`;
  }
  return `/s/${encodeURIComponent(shareId)}`;
}
