// PD-SAAS-FORK: Showcase admin API routes
import express from 'express';
import path from 'node:path';
import { promises as fsp } from 'node:fs';
import crypto from 'node:crypto';
import { authenticateToken } from '../../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { getSaasRequestContext, saasRequestStore } from '../context.js';
import { getTenantPilotHome } from '../tenant/paths.js';
import { getDataRoot } from '../tenant/paths.js';
import { catalogStore } from '../conversation/CatalogStore.js';
import { resolveSessionTranscriptAbsPath } from '../conversation/resolveSessionTranscriptPath.js';
import { resolveFileRootForProjectName } from '../storage/fileStorageService.js';
import {
  getShowcaseAdminMode,
  resolveShowcaseDataRoot,
} from './showcaseFlags.js';
import { regenShowcaseCatalog } from './generateShowcaseCatalog.js';
import { recordShowcaseTelemetry } from './showcaseTelemetry.js';
import { suggestShowcaseFromArtifacts } from './showcaseSuggest.js';
import {
  isImagePath,
  normalizeShowcaseThumbBuffer,
} from './showcaseThumbNormalize.js';
import {
  ensureSeedItemsFromCatalog,
  ensureSeedSections,
  getItem,
  listItems,
  listRecentCatalogSessions,
  listSections,
  setItemStatus,
  upsertItem,
  upsertSection,
} from './showcaseStore.js';

export { suggestShowcaseFromArtifacts };

const router = express.Router();
router.use(authenticateToken, requireAdmin);

function requireSuperAdmin(req, res, next) {
  if (req.user?.role === 'super-admin') return next();
  return res.status(403).json({ error: '需要超级管理员权限' });
}

/**
 * @param {import('express').Request} req
 */
function resolveRequestCtx(req) {
  const store = getSaasRequestContext();
  if (store?.tenantId && store?.userId && store?.tenantPilotHome) return store;
  const tenantId = req.user?.tenant_id ?? req.user?.tenantId;
  const userId = req.user?.id ?? req.user?.userId;
  if (!tenantId || !userId) return null;
  return {
    tenantId: String(tenantId),
    userId: Number(userId),
    tenantPilotHome: getTenantPilotHome(String(tenantId)),
    role: typeof req.user?.role === 'string' ? req.user.role : null,
  };
}

/**
 * @param {import('express').Request} req
 * @param {(ctx: NonNullable<ReturnType<typeof resolveRequestCtx>>) => Promise<void>} handler
 */
async function withRequestCtx(req, res, handler) {
  const ctx = resolveRequestCtx(req);
  if (!ctx?.tenantId || !ctx.userId || !ctx.tenantPilotHome) {
    res.status(400).json({ ok: false, error: 'missing_tenant_context' });
    return;
  }
  await saasRequestStore.run(ctx, () => handler(ctx));
}

async function bootstrapShowcaseData() {
  await ensureSeedSections();
  return ensureSeedItemsFromCatalog();
}

/**
 * @param {string} transcriptPath
 * @returns {Promise<string | null>}
 */
async function readLatestAcceptanceStatus(transcriptPath) {
  try {
    const stat = await fsp.stat(transcriptPath);
    const readSize = Math.min(stat.size, 256 * 1024);
    if (readSize <= 0) return null;
    const handle = await fsp.open(transcriptPath, 'r');
    try {
      const buf = Buffer.alloc(readSize);
      await handle.read(buf, 0, readSize, stat.size - readSize);
      const tail = buf.toString('utf8');
      const lines = tail.split('\n').filter((line) => line.trim());
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        try {
          const entry = JSON.parse(lines[i]);
          if (entry?.type === 'turn_acceptance_meta') {
            return entry.acceptanceStatus ?? entry.payload?.acceptanceStatus ?? null;
          }
        } catch {
          // skip malformed tail fragment
        }
      }
    } finally {
      await handle.close();
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * @param {string} transcriptPath
 * @returns {Promise<Set<string>>}
 */
async function extractTaskDirsFromTranscript(transcriptPath) {
  const dirs = new Set();
  try {
    const stat = await fsp.stat(transcriptPath);
    const readSize = Math.min(stat.size, 512 * 1024);
    if (readSize <= 0) return dirs;
    const handle = await fsp.open(transcriptPath, 'r');
    try {
      const buf = Buffer.alloc(readSize);
      await handle.read(buf, 0, readSize, stat.size - readSize);
      const matches = buf.toString('utf8').matchAll(/artifacts\/task-[A-Za-z0-9-]+/g);
      for (const match of matches) {
        if (match[0]) dirs.add(match[0]);
      }
    } finally {
      await handle.close();
    }
  } catch {
    // ignore
  }
  return dirs;
}

/**
 * @param {string} rootDir
 * @param {string} relDir
 * @param {string[]} acc
 * @param {number} depth
 */
async function walkArtifactFiles(rootDir, relDir, acc, depth = 0) {
  if (depth > 6 || acc.length >= 400) return;
  const absDir = path.join(rootDir, relDir);
  const normalizedRoot = path.resolve(rootDir);
  if (!absDir.startsWith(normalizedRoot + path.sep) && absDir !== normalizedRoot) return;

  let entries;
  try {
    entries = await fsp.readdir(absDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (acc.length >= 400) break;
    const relPath = path.posix.join(relDir.replace(/\\/g, '/'), entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      await walkArtifactFiles(rootDir, relPath, acc, depth + 1);
      continue;
    }
    if (!entry.isFile()) continue;
    acc.push(relPath.replace(/\\/g, '/'));
  }
}

function showcaseDataRoot() {
  return resolveShowcaseDataRoot(process.env, getDataRoot());
}

/**
 * @param {string} srcAbs
 * @param {string} destAbs
 */
async function copyFileSafe(srcAbs, destAbs) {
  await fsp.mkdir(path.dirname(destAbs), { recursive: true });
  await fsp.copyFile(srcAbs, destAbs);
}

/**
 * @param {import('./showcaseStore.js').ReturnType<typeof getItem>} item
 * @param {{ tenantId: string, userId: number, tenantPilotHome: string }} ctx
 */
async function copyPublishedMedia(item, ctx) {
  const showcaseRoot = resolveShowcaseDataRoot(process.env, getDataRoot());
  if (!showcaseRoot) throw new Error('showcase_data_root_unresolved');

  const mediaDir = path.join(showcaseRoot, 'media', item.id);
  await fsp.mkdir(mediaDir, { recursive: true });

  const sourcePaths = item.source_artifact_paths ?? [];
  /** @type {Record<string, string>} */
  const copied = {};

  if (sourcePaths.length > 0 && ctx?.tenantPilotHome) {
    const catalogRow = item.source_session_id
      ? await catalogStore.getBySessionId({
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: item.source_session_id,
        })
      : null;
    const fileRoot = catalogRow?.legacyProjectId
      ? await resolveFileRootForProjectName(catalogRow.legacyProjectId)
      : null;
    const baseRoot = fileRoot || ctx.tenantPilotHome;

    for (const rel of sourcePaths) {
      const safeRel = String(rel).replace(/\\/g, '/').replace(/^\/+/, '');
      if (safeRel.includes('..')) continue;
      const srcAbs = path.join(baseRoot, ...safeRel.split('/'));
      const normalizedBase = path.resolve(baseRoot);
      if (!srcAbs.startsWith(normalizedBase + path.sep)) continue;
      try {
        await fsp.access(srcAbs);
      } catch {
        continue;
      }
      const baseName = path.basename(safeRel);
      const destAbs = path.join(mediaDir, baseName);
      await copyFileSafe(srcAbs, destAbs);
      copied[safeRel] = `/showcase/media/${item.id}/${baseName}`;
    }
  }

  let href = item.href;
  let thumb = item.thumb;
  const firstCopied = Object.values(copied)[0];
  if (firstCopied) {
    href = firstCopied;
    if (!thumb || thumb.startsWith('media/thumbs/')) {
      thumb = firstCopied;
    } else if (!thumb.startsWith('/showcase/')) {
      thumb = `/showcase/media/${item.id}/${path.basename(String(thumb))}`;
    }
  }

  // Always materialize a 3:4 cover JPEG as the public thumb when source is an image.
  if (thumb && isImagePath(thumb)) {
    const rel = String(thumb).replace(/^\/showcase\//, '').split('?')[0];
    const candidates = [
      path.join(mediaDir, path.basename(rel)),
      path.join(showcaseRoot, ...rel.split('/').filter(Boolean)),
    ];
    for (const thumbAbs of candidates) {
      try {
        const raw = await fsp.readFile(thumbAbs);
        const normalized = await normalizeShowcaseThumbBuffer(raw);
        const outName = `thumb-3x4-${Date.now().toString(36)}.jpg`;
        await fsp.writeFile(path.join(mediaDir, outName), normalized);
        thumb = `/showcase/media/${item.id}/${outName}`;
        break;
      } catch {
        // try next candidate
      }
    }
  }

  return { href, thumb, mediaDir, copiedCount: Object.keys(copied).length };
}

router.get('/flags', async (_req, res) => {
  res.json({
    ok: true,
    adminMode: getShowcaseAdminMode(),
    siteMode: process.env.PILOTDECK_SHOWCASE_SITE ?? 'on',
    dataRoot: resolveShowcaseDataRoot(process.env, getDataRoot()),
  });
});

router.get('/sections', async (_req, res) => {
  try {
    await bootstrapShowcaseData();
    const sections = await listSections();
    res.json({ ok: true, sections });
  } catch (error) {
    console.error('[showcase] list sections:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/items', async (req, res) => {
  try {
    await bootstrapShowcaseData();
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : '';
    const items = await listItems({
      status: status || undefined,
      sectionId: sectionId || undefined,
    });
    res.json({ ok: true, items, adminMode: getShowcaseAdminMode() });
  } catch (error) {
    console.error('[showcase] list items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/sections/:id', requireSuperAdmin, async (req, res) => {
  try {
    const section = await upsertSection({ ...req.body, id: req.params.id });
    res.json({ ok: true, section });
  } catch (error) {
    console.error('[showcase] upsert section:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/items/:id', requireSuperAdmin, async (req, res) => {
  try {
    const item = await upsertItem({ ...req.body, id: req.params.id });
    res.json({ ok: true, item });
  } catch (error) {
    console.error('[showcase] upsert item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/items/:id/status', requireSuperAdmin, async (req, res) => {
  try {
    const status = String(req.body?.status ?? '').trim();
    if (!['draft', 'published', 'archived'].includes(status)) {
      return res.status(400).json({ error: '无效状态' });
    }
    const item = await setItemStatus(req.params.id, status);
    res.json({ ok: true, item });
  } catch (error) {
    console.error('[showcase] set status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/session-candidates', async (req, res) => {
  const started = Date.now();
  try {
    await withRequestCtx(req, res, async (ctx) => {
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 50);
      const sessions = await listRecentCatalogSessions({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        limit,
      });

      /** @type {Array<Record<string, unknown>>} */
      const candidates = [];
      let scanned = 0;
      let truncated = false;

      for (const session of sessions) {
        if (Date.now() - started > 2800) {
          truncated = true;
          break;
        }
        scanned += 1;
        const transcriptPath = await resolveSessionTranscriptAbsPath({
          sessionId: session.sessionId,
          tenantPilotHome: ctx.tenantPilotHome,
          catalogTranscriptRel: session.transcriptRelPath,
        });
        if (!transcriptPath) continue;
        const acceptanceStatus = await readLatestAcceptanceStatus(transcriptPath);
        if (acceptanceStatus !== 'passed') continue;
        candidates.push({
          sessionId: session.sessionId,
          title: session.title,
          legacyProjectId: session.legacyProjectId,
          lastActivityAt: session.lastActivityAt,
          acceptanceStatus,
        });
      }

      res.json({
        ok: true,
        candidates,
        scanned,
        truncated,
        note: truncated ? '扫描时间预算内截断，可缩小 limit 或稍后重试' : undefined,
      });
    });
  } catch (error) {
    console.error('[showcase] session-candidates:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

router.get('/sessions/:sessionId/artifacts', async (req, res) => {
  try {
    await withRequestCtx(req, res, async (ctx) => {
      const catalogRow = await catalogStore.getBySessionId({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        sessionId: req.params.sessionId,
      });
      if (!catalogRow) {
        res.status(404).json({ ok: false, error: 'session_not_found' });
        return;
      }

      const transcriptPath = await resolveSessionTranscriptAbsPath({
        sessionId: catalogRow.sessionId,
        tenantPilotHome: ctx.tenantPilotHome,
        catalogTranscriptRel: catalogRow.transcriptRelPath,
      });
      const taskDirs = transcriptPath
        ? await extractTaskDirsFromTranscript(transcriptPath)
        : new Set();

      const fileRoot =
        (await resolveFileRootForProjectName(catalogRow.legacyProjectId)) ||
        ctx.tenantPilotHome;

      /** @type {string[]} */
      const files = [];
      for (const taskDir of taskDirs) {
        await walkArtifactFiles(fileRoot, taskDir, files);
      }

      const suggestions = suggestShowcaseFromArtifacts(files, catalogRow.title || '');
      res.json({
        ok: true,
        sessionId: catalogRow.sessionId,
        legacyProjectId: catalogRow.legacyProjectId,
        title: catalogRow.title || '',
        taskDirs: [...taskDirs],
        files,
        suggestions,
      });
    });
  } catch (error) {
    console.error('[showcase] session artifacts:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

router.post('/items/import', requireSuperAdmin, async (req, res) => {
  try {
    const sectionId = String(req.body?.sectionId ?? req.body?.section_id ?? '').trim();
    if (!sectionId) {
      return res.status(400).json({ error: '缺少 sectionId' });
    }
    const id =
      String(req.body?.id ?? '').trim() ||
      `showcase-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;

    let nameZh = req.body?.name_zh ?? req.body?.name ?? '未命名案例';
    let nameEn = req.body?.name_en ?? req.body?.name ?? 'Untitled showcase';
    let thumb = req.body?.thumb ?? '';
    let href = req.body?.href ?? '';
    let sourceArtifactPaths =
      req.body?.sourceArtifactPaths ?? req.body?.source_artifact_paths ?? [];
    const sourceSessionId =
      req.body?.sourceSessionId ?? req.body?.source_session_id ?? null;

    // Auto-parse session deliverables when caller only passes sessionId
    if (sourceSessionId && (!href || !Array.isArray(sourceArtifactPaths) || sourceArtifactPaths.length === 0)) {
      await withRequestCtx(req, res, async (ctx) => {
        const catalogRow = await catalogStore.getBySessionId({
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: String(sourceSessionId),
        });
        if (!catalogRow) return;
        const transcriptPath = await resolveSessionTranscriptAbsPath({
          sessionId: catalogRow.sessionId,
          tenantPilotHome: ctx.tenantPilotHome,
          catalogTranscriptRel: catalogRow.transcriptRelPath,
        });
        const taskDirs = transcriptPath
          ? await extractTaskDirsFromTranscript(transcriptPath)
          : new Set();
        const fileRoot =
          (await resolveFileRootForProjectName(catalogRow.legacyProjectId)) ||
          ctx.tenantPilotHome;
        /** @type {string[]} */
        const files = [];
        for (const taskDir of taskDirs) {
          await walkArtifactFiles(fileRoot, taskDir, files);
        }
        const suggestions = suggestShowcaseFromArtifacts(files, catalogRow.title || '');
        if (!href && suggestions.href) href = suggestions.href;
        if (!thumb && suggestions.thumb) thumb = suggestions.thumb;
        if (!Array.isArray(sourceArtifactPaths) || sourceArtifactPaths.length === 0) {
          sourceArtifactPaths = suggestions.sourceArtifactPaths;
        }
        if (!req.body?.name_zh && !req.body?.name && suggestions.name_zh) {
          nameZh = suggestions.name_zh;
          nameEn = suggestions.name_en || suggestions.name_zh;
        }
      });
      if (res.headersSent) return;
    }

    const item = await upsertItem({
      id,
      section_id: sectionId,
      status: 'draft',
      name_zh: nameZh,
      name_en: nameEn,
      annotation_zh: req.body?.annotation_zh ?? req.body?.annotation ?? '',
      annotation_en: req.body?.annotation_en ?? '',
      badge_zh: req.body?.badge_zh ?? req.body?.badge ?? '',
      badge_en: req.body?.badge_en ?? '',
      prompt_zh: req.body?.prompt_zh ?? req.body?.prompt ?? '',
      prompt_en: req.body?.prompt_en ?? '',
      thumb,
      href,
      source_session_id: sourceSessionId,
      source_artifact_paths: sourceArtifactPaths,
      sort_order: Number(req.body?.sort_order ?? 0),
      star: Number(req.body?.star ?? 0),
    });

    res.json({ ok: true, item });
  } catch (error) {
    console.error('[showcase] import item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/items/:id/thumb', requireSuperAdmin, async (req, res) => {
  try {
    const existing = await getItem(req.params.id);
    if (!existing) return res.status(404).json({ error: '条目不存在' });

    const dataUrl = String(req.body?.dataUrl ?? '').trim();
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
    if (!match) {
      return res.status(400).json({ error: '需要 dataUrl（image/*;base64）' });
    }
    const mime = match[1].toLowerCase();
    const extMap = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    const ext = extMap[mime];
    if (!ext) return res.status(400).json({ error: '仅支持 png/jpeg/webp/gif' });

    const raw = match[2].replace(/\s+/g, '');
    const buf = Buffer.from(raw, 'base64');
    if (buf.length < 32) return res.status(400).json({ error: '图片数据过小' });
    if (buf.length > 8 * 1024 * 1024) return res.status(400).json({ error: '图片不得超过 8MB' });

    const root = showcaseDataRoot();
    if (!root) return res.status(500).json({ error: 'showcase_data_root_unresolved' });

    let outBuf;
    try {
      outBuf = await normalizeShowcaseThumbBuffer(buf);
    } catch {
      return res.status(400).json({ error: '无法解析图片，请换一张预览图' });
    }

    const mediaDir = path.join(root, 'media', existing.id);
    await fsp.mkdir(mediaDir, { recursive: true });
    // Always store canonical 3:4 JPEG (ignore source ext)
    const filename = `thumb-3x4-${Date.now().toString(36)}.jpg`;
    await fsp.writeFile(path.join(mediaDir, filename), outBuf);

    const thumb = `/showcase/media/${existing.id}/${filename}`;
    const item = await upsertItem({ ...existing, thumb });
    recordShowcaseTelemetry({
      event: 'showcase_thumb_upload',
      itemId: existing.id,
      userId: req.user?.id ?? null,
      bytes: outBuf.length,
      aspect: '3:4',
    });
    res.json({ ok: true, item, thumb });
  } catch (error) {
    console.error('[showcase] thumb upload:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/items/:id/publish', requireSuperAdmin, async (req, res) => {
  try {
    const existing = await getItem(req.params.id);
    if (!existing) return res.status(404).json({ error: '条目不存在' });

    await withRequestCtx(req, res, async (ctx) => {
      const copied = await copyPublishedMedia(existing, ctx);
      await upsertItem({
        ...existing,
        href: copied.href,
        thumb: copied.thumb,
        status: 'published',
      });
      await setItemStatus(req.params.id, 'published');

      const sections = await listSections();
      const items = await listItems();
      const regen = regenShowcaseCatalog({
        dataRoot: showcaseDataRoot(),
        sections,
        items,
      });

      recordShowcaseTelemetry({
        event: 'showcase_publish',
        itemId: req.params.id,
        userId: req.user?.id ?? null,
        copiedCount: copied.copiedCount,
        catalogPath: regen.catalogPath,
      });
      recordShowcaseTelemetry({ event: 'catalog_regen', itemId: req.params.id, ...regen });

      const item = await getItem(req.params.id);
      res.json({ ok: true, item, regen, copiedCount: copied.copiedCount });
    });
  } catch (error) {
    console.error('[showcase] publish:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/items/:id/unpublish', requireSuperAdmin, async (req, res) => {
  try {
    const existing = await getItem(req.params.id);
    if (!existing) return res.status(404).json({ error: '条目不存在' });

    const nextStatus = String(req.body?.status ?? 'archived');
    const status = nextStatus === 'draft' ? 'draft' : 'archived';
    const item = await setItemStatus(req.params.id, status);

    const sections = await listSections();
    const items = await listItems();
    const regen = regenShowcaseCatalog({
      dataRoot: showcaseDataRoot(),
      sections,
      items,
    });

    recordShowcaseTelemetry({
      event: 'showcase_unpublish',
      itemId: req.params.id,
      userId: req.user?.id ?? null,
      status,
    });
    recordShowcaseTelemetry({ event: 'catalog_regen', itemId: req.params.id, ...regen });

    res.json({ ok: true, item, regen });
  } catch (error) {
    console.error('[showcase] unpublish:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @param {import('express').Express} app
 */
export function registerShowcaseRoutes(app) {
  app.use('/api/saas/admin/showcase', router);
}

export { router as showcaseAdminRouter };
