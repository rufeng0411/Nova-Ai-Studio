// PD-SAAS-FORK: public /s/:shareId SSR + asset routes (no user JWT)
import path from 'node:path';
import { promises as fsPromises } from 'node:fs';
import { saasRequestStore } from '../context.js';
import { getTenantPilotHome } from '../tenant/paths.js';
import {
  MAX_SHARE_MD_BYTES,
  renderMarkdownBodyHtml,
  rewriteMarkdownShareAssetUrls,
  wrapMarkdownShareHtmlDocument,
  wrapShareErrorHtml,
  extractMarkdownSummary,
  extractMarkdownTitle,
  inferMarkdownLang,
  countMarkdownWords,
} from '../markdownShareHtml.js';
import { getShareLinkById } from './markdownShareLinks.js';
import { getPublicMdShareMode, isPublicMdShareEnforce } from './publicMdShareFlag.js';
import { resolveShareAssetPath } from './markdownSharePathSandbox.js';
import { recordMarkdownShareTelemetry } from './markdownShareTelemetry.js';
import { registerMarkdownShareExportRoutes } from './markdownShareExport.js';

/**
 * @param {import('express').Request} req
 */
function requestOrigin(req) {
  const configured = String(process.env.PUBLIC_SHARE_ORIGIN || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  const proto = String(req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
  const host = String(req.get('x-forwarded-host') || req.get('host') || 'localhost').split(',')[0].trim();
  return `${proto}://${host}`;
}

/**
 * @param {import('express').Application} app
 * @param {{
 *   extractProjectDirectory: (name: string) => Promise<string | null>,
 *   getDeliverableSearchRootsForProject: (name: string) => Promise<string[]>,
 *   warmProjectDirectoryForDeliverables: (name: string) => Promise<void>,
 *   resolveExistingProjectFilePath: (...args: unknown[]) => { valid: boolean, resolved?: string, error?: string },
 *   guardSaasStoragePath: (abs: string) => Promise<void>,
 * }} deps
 */
export function registerMarkdownSharePublicRoutes(app, deps) {
  async function withShareContext(shareRow, fn) {
    const tenantId = shareRow.tenantId;
    const tenantPilotHome = getTenantPilotHome(tenantId);
    return saasRequestStore.run(
      {
        tenantId,
        tenantPilotHome,
        userId: shareRow.userId,
      },
      fn,
    );
  }

  async function resolveMarkdownFile(shareRow) {
    const projectName = shareRow.projectKey;
    const projectRoot = await deps.extractProjectDirectory(projectName).catch(() => null);
    if (!projectRoot) return { error: 'missing_project' };

    let knownRoots = await deps.getDeliverableSearchRootsForProject(projectName);
    if (knownRoots.length === 0) {
      await deps.warmProjectDirectoryForDeliverables(projectName);
      knownRoots = await deps.getDeliverableSearchRootsForProject(projectName);
    }

    const resolvedResult = deps.resolveExistingProjectFilePath(
      projectRoot,
      shareRow.relativePath,
      knownRoots,
      shareRow.hintDir ? { hintDir: shareRow.hintDir } : {},
    );
    if (!resolvedResult.valid) return { error: 'forbidden' };

    try {
      await deps.guardSaasStoragePath(resolvedResult.resolved);
    } catch {
      return { error: 'forbidden' };
    }

    const stats = await fsPromises.stat(resolvedResult.resolved).catch(() => null);
    if (!stats?.isFile()) return { error: 'missing_file' };
    if (stats.size > MAX_SHARE_MD_BYTES) return { error: 'too_large' };

    return {
      projectRoot,
      absolutePath: resolvedResult.resolved,
      mdRelativePath: path.relative(projectRoot, resolvedResult.resolved).split(path.sep).join('/'),
    };
  }

  app.get('/s/:shareId', async (req, res) => {
    const mode = getPublicMdShareMode();
    if (!isPublicMdShareEnforce()) {
      return res.status(404).type('text/html; charset=utf-8').send(
        wrapShareErrorHtml('公开分享未开启或仍在灰度中。', { title: '暂不可用' }),
      );
    }

    const shareId = String(req.params.shareId || '').trim();
    try {
      const shareRow = await getShareLinkById(shareId);
      if (!shareRow || shareRow.revokedAt) {
        return res.status(410).type('text/html; charset=utf-8').send(
          wrapShareErrorHtml('分享链接已失效或已取消。', { title: '链接失效' }),
        );
      }

      return withShareContext(shareRow, async () => {
        const resolved = await resolveMarkdownFile(shareRow);
        if (resolved.error === 'missing_file' || resolved.error === 'missing_project') {
          return res.status(410).type('text/html; charset=utf-8').send(
            wrapShareErrorHtml('原文已移动或删除，请重新分享。', { title: '文件未找到' }),
          );
        }
        if (resolved.error) {
          return res.status(403).type('text/html; charset=utf-8').send(
            wrapShareErrorHtml('无权打开该分享。', { title: '无法打开' }),
          );
        }

        const mdText = await fsPromises.readFile(resolved.absolutePath, 'utf8');
        const origin = requestOrigin(req);
        const lang = inferMarkdownLang(mdText);
        const fileBase = path.basename(resolved.absolutePath, path.extname(resolved.absolutePath));
        const title = extractMarkdownTitle(mdText, shareRow.title || fileBase);
        const summary = extractMarkdownSummary(mdText, 280);
        let bodyHtml = renderMarkdownBodyHtml(mdText);
        bodyHtml = rewriteMarkdownShareAssetUrls(bodyHtml, {
          shareId,
          mdRelativePath: resolved.mdRelativePath,
          origin,
        });

        const canonicalUrl = `${origin}/s/${encodeURIComponent(shareId)}`;
        const html = wrapMarkdownShareHtmlDocument({
          title,
          bodyHtml,
          description: summary.slice(0, 160),
          summary,
          wordCount: countMarkdownWords(mdText),
          fileName: path.basename(resolved.absolutePath),
          shareId,
          seoIndexable: shareRow.seoIndexable,
          lang,
          datePublished: shareRow.createdAt || undefined,
          dateModified: shareRow.updatedAt || shareRow.createdAt || undefined,
          ogImageUrl: `${origin}/logo-256.png`,
          canonicalUrl,
          origin,
        });

        recordMarkdownShareTelemetry({
          type: 'share_view',
          shareId,
          tenantId: shareRow.tenantId,
          mode,
        });

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader(
          'Cache-Control',
          shareRow.seoIndexable ? 'public, max-age=300' : 'private, max-age=60',
        );
        return res.send(html);
      });
    } catch (error) {
      console.error('Error serving public markdown share:', error);
      return res.status(500).type('text/html; charset=utf-8').send(
        wrapShareErrorHtml('服务器暂时无法打开分享页，请稍后重试。', { title: '打开失败' }),
      );
    }
  });

  app.get('/s/:shareId/asset/*', async (req, res) => {
    if (!isPublicMdShareEnforce()) {
      return res.status(404).type('text/plain').send('Not found');
    }
    const shareId = String(req.params.shareId || '').trim();
    const assetRel = String(req.params[0] || '').trim();
    try {
      const shareRow = await getShareLinkById(shareId);
      if (!shareRow || shareRow.revokedAt) {
        return res.status(410).type('text/plain').send('Gone');
      }
      return withShareContext(shareRow, async () => {
        const resolved = await resolveMarkdownFile(shareRow);
        if (resolved.error) {
          return res.status(404).type('text/plain').send('Not found');
        }
        const sandboxed = resolveShareAssetPath(resolved.absolutePath, assetRel);
        if (!sandboxed.ok) {
          return res.status(403).type('text/plain').send('Forbidden');
        }
        try {
          await deps.guardSaasStoragePath(sandboxed.absolutePath);
        } catch {
          return res.status(403).type('text/plain').send('Forbidden');
        }
        const stats = await fsPromises.stat(sandboxed.absolutePath).catch(() => null);
        if (!stats?.isFile()) {
          return res.status(404).type('text/plain').send('Not found');
        }
        res.setHeader('Cache-Control', 'private, max-age=120');
        return res.sendFile(sandboxed.absolutePath);
      });
    } catch (error) {
      console.error('Error serving share asset:', error);
      return res.status(500).type('text/plain').send('Error');
    }
  });

  registerMarkdownShareExportRoutes(app, {
    ...deps,
    withShareContext,
    resolveMarkdownFile,
    getShareLinkById,
  });
}

/**
 * Legacy JWT share routes → friendly HTML asking to re-share.
 * @param {import('express').Application} app
 * @param {(req: any, res: any, next: any) => void} authenticateToken
 */
export function registerLegacyMarkdownShareDeprecation(app, authenticateToken) {
  const handler = (_req, res) => {
    res.status(410).type('text/html; charset=utf-8').send(
      wrapShareErrorHtml('旧分享链接已停用，请返回 Nova 重新分享获取公开链接。', {
        title: '请重新分享',
      }),
    );
  };
  app.get('/share/doc/:projectName/*', authenticateToken, handler);
  app.get('/api/projects/:projectName/share/markdown/*', authenticateToken, handler);
}
