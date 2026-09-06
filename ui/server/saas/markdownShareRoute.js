// PD-SAAS-FORK: Markdown 分享 HTML 路由处理（/share/doc 与 /api/.../share/markdown）
import path from 'node:path';
import { promises as fsPromises } from 'node:fs';
import {
  MAX_SHARE_MD_BYTES,
  countMarkdownWords,
  extractMarkdownSummary,
  extractMarkdownTitle,
  inferMarkdownLang,
  renderMarkdownBodyHtml,
  rewriteMarkdownShareAssetUrls,
  wrapMarkdownShareHtmlDocument,
  wrapShareErrorHtml,
} from './markdownShareHtml.js';

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {{
 *   extractProjectDirectory: (name: string) => Promise<string | null>;
 *   getDeliverableSearchRootsForProject: (name: string) => Promise<string[]>;
 *   warmProjectDirectoryForDeliverables: (name: string) => Promise<void>;
 *   resolveExistingProjectFilePath: (...args: unknown[]) => { valid: boolean; resolved?: string; error?: string };
 *   guardSaasStoragePath: (abs: string) => Promise<void>;
 *   storagePathForbiddenResponse: (res: import('express').Response, error: unknown) => void;
 * }} deps
 */
export async function handleMarkdownShareHtmlRequest(req, res, deps) {
  try {
    const projectName = String(req.params.projectName || '').trim();
    const relativeFilePath = String(req.params[0] || req.params.path || '').trim();
    const hintDir = typeof req.query.hintDir === 'string' ? req.query.hintDir.trim() : '';

    if (!projectName || !relativeFilePath || !/\.(?:md|markdown)$/iu.test(relativeFilePath)) {
      return res.status(400).type('text/html; charset=utf-8').send(
        wrapShareErrorHtml('仅支持分享 Markdown 文件为网页阅读版。', { title: '分享链接无效' }),
      );
    }

    const projectRoot = await deps.extractProjectDirectory(projectName).catch(() => null);
    if (!projectRoot) {
      return res.status(404).type('text/html; charset=utf-8').send(
        wrapShareErrorHtml('找不到对应项目，请确认链接是否完整。', { title: '项目不存在' }),
      );
    }

    let knownRoots = await deps.getDeliverableSearchRootsForProject(projectName);
    if (knownRoots.length === 0) {
      await deps.warmProjectDirectoryForDeliverables(projectName);
      knownRoots = await deps.getDeliverableSearchRootsForProject(projectName);
    }

    const previewResolveOptions = hintDir ? { hintDir } : {};
    const resolvedResult = deps.resolveExistingProjectFilePath(
      projectRoot,
      relativeFilePath,
      knownRoots,
      previewResolveOptions,
    );
    if (!resolvedResult.valid) {
      return res.status(403).type('text/html; charset=utf-8').send(
        wrapShareErrorHtml('无权访问该文件或文件路径无效。', { title: '无法打开' }),
      );
    }

    const resolved = resolvedResult.resolved;
    const stats = await fsPromises.stat(resolved).catch(() => null);
    if (!stats?.isFile()) {
      return res.status(404).type('text/html; charset=utf-8').send(
        wrapShareErrorHtml('Markdown 文件不存在或已被移动。', { title: '文件未找到' }),
      );
    }

    try {
      await deps.guardSaasStoragePath(resolved);
    } catch (error) {
      return deps.storagePathForbiddenResponse(res, error);
    }

    if (stats.size > MAX_SHARE_MD_BYTES) {
      return res.status(413).type('text/html; charset=utf-8').send(
        wrapShareErrorHtml('文件过大，暂不支持网页分享。', { title: '文件过大' }),
      );
    }

    const mdText = await fsPromises.readFile(resolved, 'utf8');
    const origin = `${req.protocol}://${req.get('host')}`;
    const shareToken = typeof req.query.token === 'string' ? req.query.token : null;
    const mdRelativePath = path.relative(projectRoot, resolved).split(path.sep).join('/');
    const fileBase = path.basename(resolved, path.extname(resolved));
    const title = extractMarkdownTitle(mdText, fileBase);
    const summary = extractMarkdownSummary(mdText, 280);
    const description = summary.slice(0, 160);

    let bodyHtml = renderMarkdownBodyHtml(mdText);
    bodyHtml = rewriteMarkdownShareAssetUrls(bodyHtml, {
      projectName,
      mdRelativePath,
      hintDir: hintDir || undefined,
      token: shareToken,
      origin,
    });

    const canonicalPath = req.originalUrl.split('?')[0];
    const html = wrapMarkdownShareHtmlDocument({
      title,
      bodyHtml,
      description,
      summary,
      wordCount: countMarkdownWords(mdText),
      fileName: path.basename(resolved),
      lang: inferMarkdownLang(mdText),
      ogImageUrl: `${origin}/logo-256.png`,
      canonicalUrl: `${origin}${canonicalPath}`,
      origin,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=120');
    return res.send(html);
  } catch (error) {
    console.error('Error serving markdown share html:', error);
    return res.status(500).type('text/html; charset=utf-8').send(
      wrapShareErrorHtml('服务器暂时无法生成网页版，请稍后重试。', { title: '打开失败' }),
    );
  }
}
