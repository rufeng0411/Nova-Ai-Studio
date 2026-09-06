// PD-SAAS-FORK: authenticated markdown share CRUD (create / status / revoke)
import path from 'node:path';
import { promises as fsPromises } from 'node:fs';
import { getPublicMdShareMode, isPublicMdShareWritable } from './publicMdShareFlag.js';
import {
  assertShareCreateRateLimit,
  buildAbsolutePublicShareUrl,
  createOrReuseShareLink,
  findActiveShareLink,
  revokeShareLink,
} from './markdownShareLinks.js';
import { countMarkdownWords } from './markdownShareWordCount.js';
import { recordMarkdownShareTelemetry } from './markdownShareTelemetry.js';
import { MAX_SHARE_MD_BYTES } from '../markdownShareHtml.js';

/**
 * @param {import('express').Application} app
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => void} authenticateToken
 * @param {{
 *   extractProjectDirectory: (name: string) => Promise<string | null>,
 *   getDeliverableSearchRootsForProject: (name: string) => Promise<string[]>,
 *   warmProjectDirectoryForDeliverables: (name: string) => Promise<void>,
 *   resolveExistingProjectFilePath: (...args: unknown[]) => { valid: boolean, resolved?: string, error?: string },
 *   guardSaasStoragePath: (abs: string) => Promise<void>,
 * }} deps
 */
export function registerMarkdownShareAuthRoutes(app, authenticateToken, deps) {
  app.post('/api/projects/:projectName/share/markdown', authenticateToken, async (req, res) => {
    try {
      const mode = getPublicMdShareMode();
      if (!isPublicMdShareWritable()) {
        return res.status(403).json({ error: 'Public markdown share is disabled', mode });
      }

      const projectName = String(req.params.projectName || '').trim();
      const relativePath = String(req.body?.path || req.body?.relativePath || '').trim().replace(/\\/g, '/');
      const hintDir = typeof req.body?.hintDir === 'string' ? req.body.hintDir.trim() : '';
      const seoIndexable = Boolean(req.body?.seoIndexable);

      if (!projectName || !relativePath || !/\.(?:md|markdown)$/iu.test(relativePath)) {
        return res.status(400).json({ error: 'path must be a markdown file' });
      }

      const tenantId = req.user?.tenant_id ?? req.user?.tenantId ?? 'default';
      const userId = Number(req.user?.id ?? req.user?.userId ?? 0);
      if (!userId) {
        return res.status(401).json({ error: 'User required' });
      }

      try {
        assertShareCreateRateLimit(userId);
      } catch (error) {
        if (error?.code === 'RATE_LIMIT') {
          return res.status(429).json({ error: 'Too many share creates, please retry later' });
        }
        throw error;
      }

      const projectRoot = await deps.extractProjectDirectory(projectName).catch(() => null);
      if (!projectRoot) {
        return res.status(404).json({ error: 'Project not found' });
      }

      let knownRoots = await deps.getDeliverableSearchRootsForProject(projectName);
      if (knownRoots.length === 0) {
        await deps.warmProjectDirectoryForDeliverables(projectName);
        knownRoots = await deps.getDeliverableSearchRootsForProject(projectName);
      }

      const resolvedResult = deps.resolveExistingProjectFilePath(
        projectRoot,
        relativePath,
        knownRoots,
        hintDir ? { hintDir } : {},
      );
      if (!resolvedResult.valid) {
        return res.status(403).json({ error: resolvedResult.error || 'Invalid path' });
      }

      await deps.guardSaasStoragePath(resolvedResult.resolved);
      const stats = await fsPromises.stat(resolvedResult.resolved).catch(() => null);
      if (!stats?.isFile()) {
        return res.status(404).json({ error: 'Markdown file not found' });
      }
      if (stats.size > MAX_SHARE_MD_BYTES) {
        return res.status(413).json({ error: 'Markdown file too large to share' });
      }

      const mdText = await fsPromises.readFile(resolvedResult.resolved, 'utf8');
      const mdRelativePath = path.relative(projectRoot, resolvedResult.resolved).split(path.sep).join('/');
      const title = path.basename(resolvedResult.resolved, path.extname(resolvedResult.resolved));
      const wordCount = countMarkdownWords(mdText);

      const link = await createOrReuseShareLink({
        tenantId: String(tenantId),
        userId,
        projectKey: projectName,
        relativePath: mdRelativePath,
        hintDir: hintDir || null,
        title,
        wordCount,
        seoIndexable,
      });

      const url = buildAbsolutePublicShareUrl(link.id, { req });
      recordMarkdownShareTelemetry({
        type: 'share_created',
        shareId: link.id,
        tenantId: String(tenantId),
        mode,
        projectKey: projectName,
      });

      return res.json({
        shareId: link.id,
        url,
        mode,
        seoIndexable: link.seoIndexable,
        wordCount: link.wordCount,
        title: link.title,
      });
    } catch (error) {
      console.error('Error creating markdown share:', error);
      return res.status(500).json({ error: error?.message || 'Failed to create share' });
    }
  });

  app.get('/api/projects/:projectName/share/markdown/status', authenticateToken, async (req, res) => {
    try {
      const mode = getPublicMdShareMode();
      const projectName = String(req.params.projectName || '').trim();
      const relativePath = String(req.query.path || '').trim().replace(/\\/g, '/');
      if (!projectName || !relativePath) {
        return res.status(400).json({ error: 'path required' });
      }
      const tenantId = req.user?.tenant_id ?? req.user?.tenantId ?? 'default';
      const userId = Number(req.user?.id ?? req.user?.userId ?? 0);
      if (!isPublicMdShareWritable()) {
        return res.json({ mode, active: false, shareId: null, url: null });
      }
      const link = await findActiveShareLink({
        tenantId: String(tenantId),
        userId,
        projectKey: projectName,
        relativePath,
      });
      return res.json({
        mode,
        active: Boolean(link),
        shareId: link?.id ?? null,
        url: link ? buildAbsolutePublicShareUrl(link.id, { req }) : null,
        seoIndexable: link?.seoIndexable ?? false,
      });
    } catch (error) {
      console.error('Error reading markdown share status:', error);
      return res.status(500).json({ error: error?.message || 'Failed to read share status' });
    }
  });

  app.delete('/api/projects/:projectName/share/markdown/:shareId', authenticateToken, async (req, res) => {
    try {
      const mode = getPublicMdShareMode();
      if (!isPublicMdShareWritable()) {
        return res.status(403).json({ error: 'Public markdown share is disabled', mode });
      }
      const shareId = String(req.params.shareId || '').trim();
      const tenantId = req.user?.tenant_id ?? req.user?.tenantId ?? 'default';
      const userId = Number(req.user?.id ?? req.user?.userId ?? 0);
      const ok = await revokeShareLink({
        shareId,
        tenantId: String(tenantId),
        userId,
      });
      if (ok) {
        recordMarkdownShareTelemetry({
          type: 'share_revoked',
          shareId,
          tenantId: String(tenantId),
          mode,
        });
      }
      return res.json({ ok, mode });
    } catch (error) {
      console.error('Error revoking markdown share:', error);
      return res.status(500).json({ error: error?.message || 'Failed to revoke share' });
    }
  });
}
