// PD-SAAS-FORK: REST API for UI document export (capabilities + async jobs)
import crypto from 'node:crypto';
import path from 'node:path';
import { promises as fsPromises, readdirSync } from 'node:fs';
import { Router } from 'express';
import { extractProjectDirectory, getDeliverableSearchRootsForProject, warmProjectDirectoryForDeliverables } from '../../projects.js';
import { resolveProjectDeliverableFile } from '../../utils/pathInProject.js';
import {
  buildExportOutputRelativePath,
  isExportOutputAllowed,
} from './exportOutputPath.mjs';
import { enrichSlideDeckScopeFromManifest } from './slideDeckManifest.mjs';
import { assertStoragePathAllowed } from '../storage/fileStorageService.js';
import { isSaasMode } from '../mode.js';
import { getSaasRequestContext } from '../context.js';
import { readPilotDeckConfigFile, applyDocumentToolsRuntimeEnv } from '../../services/pilotdeckConfig.js';
import {
  enqueueExportJob,
  exportJobKey,
  loadExportJob,
  saveExportJob,
} from './exportJobStore.js';

const OUTPUT_EXT = {
  pdf: '.pdf',
  docx: '.docx',
  pptx: '.pptx',
  xlsx: '.xlsx',
};

const router = Router();

async function guardStorage(absPath) {
  if (!isSaasMode()) return absPath;
  return assertStoragePathAllowed(absPath);
}

async function resolveProjectFile(projectName, filePath) {
  const projectRoot = await extractProjectDirectory(projectName).catch(() => null);
  if (!projectRoot) {
    return { error: 'Project not found', status: 404 };
  }
  let knownRoots = await getDeliverableSearchRootsForProject(projectName);
  if (knownRoots.length === 0) {
    await warmProjectDirectoryForDeliverables(projectName);
    knownRoots = await getDeliverableSearchRootsForProject(projectName);
  }
  const delivered = resolveProjectDeliverableFile(projectRoot, filePath, knownRoots);
  if (!delivered.ok) {
    const status = delivered.error === 'File not found' ? 404 : 403;
    return { error: delivered.error || 'Invalid path', status };
  }
  try {
    await guardStorage(delivered.absolutePath);
  } catch (error) {
    return { error: error?.message || 'Access denied', status: 403 };
  }
  try {
    await fsPromises.access(delivered.absolutePath);
  } catch {
    return { error: 'File not found', status: 404 };
  }
  return {
    projectRoot: delivered.projectRoot,
    absolutePath: delivered.absolutePath,
    relativePath: delivered.relativePath,
  };
}

function listSiblingFiles(projectRoot, absolutePath, limit = 50) {
  const dir = path.dirname(absolutePath);
  try {
    const names = readdirSync(dir);
    const relDir = path.relative(projectRoot, dir).split(path.sep).join('/');
    return names.slice(0, limit).map((name) => {
      const rel = relDir ? `${relDir}/${name}` : name;
      return rel.split(path.sep).join('/');
    });
  } catch {
    return [];
  }
}

async function loadExportModules() {
  const { pathToFileURL } = await import('node:url');
  const { dirname, resolve } = await import('node:path');
  const { existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const here = dirname(fileURLToPath(import.meta.url));
  const uiRoot = resolve(here, '../../..');
  const repoRoot = resolve(here, '../../../..');
  const scopePath = resolve(uiRoot, 'src/shared/resolveExportScope.ts');
  const matrixPath = resolve(uiRoot, 'src/shared/documentExportMatrix.ts');
  const runnerPath = resolve(repoRoot, 'src/saas/document-export/uiExportRunner.ts');
  for (const p of [scopePath, matrixPath, runnerPath]) {
    if (!existsSync(p)) {
      const err = new Error(`export_runtime_missing: ${p}`);
      err.code = 'export_runtime_missing';
      throw err;
    }
  }
  const specifiers = [
    pathToFileURL(scopePath).href,
    pathToFileURL(matrixPath).href,
    pathToFileURL(runnerPath).href,
  ];
  const [scopeMod, matrixMod, runnerMod] = await Promise.all(specifiers.map((href) => import(href)));
  return {
    resolveExportScope: scopeMod.resolveExportScope,
    resolveSlideDeckImagePaths: scopeMod.resolveSlideDeckImagePaths,
    buildExportCapabilities: matrixMod.buildExportCapabilities,
    ...runnerMod,
  };
}

function tenantUserIds(req) {
  const ctx = getSaasRequestContext();
  return {
    tenantId: req.user?.tenant_id ?? req.user?.tenantId ?? ctx?.tenantId ?? 'default',
    userId: String(req.user?.id ?? ctx?.userId ?? '0'),
  };
}

router.get('/:projectName/files/export/capabilities', async (req, res) => {
  try {
    const { projectName } = req.params;
    const filePath = String(req.query.path || '').trim();
    if (!filePath) {
      return res.status(400).json({ error: 'path required' });
    }
    const resolved = await resolveProjectFile(projectName, filePath);
    if (resolved.error) {
      return res.status(resolved.status).json({ error: resolved.error });
    }
    const siblings = listSiblingFiles(resolved.projectRoot, resolved.absolutePath);
    const { resolveExportScope, buildExportCapabilities, isOcrExportReady } = await loadExportModules();
    let scope = resolveExportScope({ filePath: resolved.relativePath, siblings });
    scope = enrichSlideDeckScopeFromManifest(resolved.projectRoot, scope);
    const { config, rawYaml } = readPilotDeckConfigFile();
    const ocrReady = isOcrExportReady(process.env, rawYaml, config);
    const capabilities = buildExportCapabilities(scope, resolved.relativePath, { ocrReady });
    return res.json({
      scopeId: scope.scopeId,
      bundle: scope.bundle,
      pageCount: scope.pageCount,
      bundleHint: scope.bundle ? scope.pageCount : undefined,
      aspectRatio: scope.aspectRatio,
      deckTitle: scope.deckTitle,
      capabilities,
      sourcePath: resolved.relativePath,
    });
  } catch (error) {
    console.error('[export] capabilities error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'capabilities_failed' });
  }
});

/** PD-SAAS-FORK: shared async export job enqueue (path-based + content staging). */
async function enqueueResolvedExportJob(req, {
  projectName,
  projectRoot,
  absolutePath,
  relativePath,
  format,
  engine,
  bundle,
}) {
  const siblings = listSiblingFiles(projectRoot, absolutePath);
  const { resolveExportScope, resolveSlideDeckImagePaths, runUiExportJob } = await loadExportModules();
  let scope = resolveExportScope({ filePath: relativePath, siblings });
  scope = enrichSlideDeckScopeFromManifest(projectRoot, scope);
  const { config, rawYaml } = readPilotDeckConfigFile();

  // PD-SAAS-FORK: deck .pptx / compose / OCR use sibling slide PNGs; HTML OCR renders screenshots in-runner.
  let imagePaths;
  if (engine === 'compose_images' || engine === 'ocr_editable_pptx') {
    const isHtmlSource = /\.html?$/i.test(relativePath);
    if (!isHtmlSource) {
      imagePaths = resolveSlideDeckImagePaths(scope, relativePath, bundle);
      if (!imagePaths?.length) {
        imagePaths = [relativePath];
      }
    }
  }

  const ext = OUTPUT_EXT[format];
  if (!ext) {
    const err = new Error('unsupported format');
    err.status = 400;
    throw err;
  }

  const baseName = scope.deckTitle
    ? scope.deckTitle.replace(/[^\w\u4e00-\u9fff-]+/g, '-').slice(0, 48)
    : path.basename(relativePath, path.extname(relativePath));
  const outRel = buildExportOutputRelativePath(relativePath, scope.bundleDir, baseName, ext);
  const outputAbsolutePath = path.join(projectRoot, outRel.split('/').join(path.sep));

  if (!isExportOutputAllowed(outRel)) {
    const err = new Error('Output must be under artifacts/');
    err.status = 403;
    throw err;
  }
  await guardStorage(outputAbsolutePath);

  const jobId = crypto.randomUUID();
  const { tenantId, userId } = tenantUserIds(req);
  const key = exportJobKey(tenantId, userId, jobId);
  const deckPages = imagePaths?.length ?? scope.pageCount ?? 1;
  const job = {
    id: jobId,
    status: 'queued',
    progress: 0,
    sourcePath: relativePath,
    format,
    engine,
    bundle,
    pageCount: deckPages > 1 ? deckPages : undefined,
    createdAt: Date.now(),
  };
  await saveExportJob(key, job);

  void enqueueExportJob(async () => {
    await saveExportJob(key, { ...job, status: 'running', progress: 10 });
    try {
      const exportEnv = { ...process.env };
      applyDocumentToolsRuntimeEnv(exportEnv, config);
      exportEnv.PILOTDECK_EXPORT_CLOSE_POOL = '1';
      // PD-SAAS-FORK: 4+ slide OCR decks need modest parallelism; keep QPS-safe default for small decks.
      if (engine === 'ocr_editable_pptx' && deckPages >= 4) {
        exportEnv.PPT_EXPORT_MAX_WORKERS = exportEnv.PPT_EXPORT_MAX_WORKERS || '2';
      } else if (!exportEnv.PPT_EXPORT_MAX_WORKERS || exportEnv.PPT_EXPORT_MAX_WORKERS === '4') {
        exportEnv.PPT_EXPORT_MAX_WORKERS = '1';
      }
      const result = await runUiExportJob({
        workspaceRoot: projectRoot,
        sourcePath: relativePath,
        sourceAbsolutePath: absolutePath,
        outputAbsolutePath,
        format,
        engine,
        imagePaths,
        aspectRatio: scope.aspectRatio,
        env: exportEnv,
        yamlConfig: rawYaml,
        modelConfig: config,
        onProgress: async (percent, _stage, page, pageTotal) => {
          const patch = {
            ...job,
            status: 'running',
            progress: Math.max(10, Math.min(99, percent)),
          };
          if (typeof page === 'number' && page > 0) patch.progressPage = page;
          if (typeof pageTotal === 'number' && pageTotal > 0) {
            patch.progressTotal = pageTotal;
            patch.pageCount = pageTotal;
          }
          await saveExportJob(key, patch);
        },
      });
      await saveExportJob(key, {
        ...job,
        status: 'done',
        progress: 100,
        relativePath: result.relativePath,
        downloadUrl: `/api/projects/${encodeURIComponent(projectName)}/files/content?path=${encodeURIComponent(result.relativePath)}`,
        providerId: result.providerId,
        pageCount: result.pageCount,
        finishedAt: Date.now(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[export] job failed:', message);
      await saveExportJob(key, {
        ...job,
        status: 'failed',
        progress: 0,
        error: message,
        finishedAt: Date.now(),
      });
    }
  });

  return jobId;
}

router.post('/:projectName/files/export', async (req, res) => {
  try {
    const { projectName } = req.params;
    const sourcePath = String(req.body?.sourcePath || '').trim();
    const format = String(req.body?.format || '').trim();
    const engine = String(req.body?.engine || 'export_document').trim();
    const bundle = Boolean(req.body?.bundle);
    if (!sourcePath || !format) {
      return res.status(400).json({ error: 'sourcePath and format required' });
    }
    const resolved = await resolveProjectFile(projectName, sourcePath);
    if (resolved.error) {
      return res.status(resolved.status).json({ error: resolved.error });
    }

    const jobId = await enqueueResolvedExportJob(req, {
      projectName,
      projectRoot: resolved.projectRoot,
      absolutePath: resolved.absolutePath,
      relativePath: resolved.relativePath,
      format,
      engine,
      bundle,
    });

    return res.status(202).json({ jobId });
  } catch (error) {
    console.error('[export] start job error:', error);
    const status = Number(error?.status) || 500;
    return res.status(status).json({ error: error instanceof Error ? error.message : 'export_failed' });
  }
});

/**
 * PD-SAAS-FORK: Markdown 浏览器等场景 — 服务端落盘再导出。
 * SaaS 禁止租户 PUT 任意 artifacts/*.md，客户端 saveFile 会 403。
 */
const MD_BROWSER_EXPORT_MAX_CHARS = 2_000_000;

router.post('/:projectName/files/export-content', async (req, res) => {
  try {
    const { projectName } = req.params;
    const content = typeof req.body?.content === 'string' ? req.body.content : '';
    const fileName = String(req.body?.fileName || 'untitled.md').trim() || 'untitled.md';
    const format = String(req.body?.format || '').trim();
    const engine = String(req.body?.engine || 'export_document').trim();
    const bundle = Boolean(req.body?.bundle);
    if (!format) {
      return res.status(400).json({ error: 'format required' });
    }
    if (content.length > MD_BROWSER_EXPORT_MAX_CHARS) {
      return res.status(413).json({ error: 'content_too_large' });
    }

    const projectRoot = await extractProjectDirectory(projectName).catch(() => null);
    if (!projectRoot) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const baseRaw = path.basename(fileName).replace(/\.(md|markdown)$/i, '').trim() || 'untitled';
    const safeBase = baseRaw
      .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_')
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'untitled';
    const relativePath = `artifacts/.export-cache/md-browser/${Date.now()}-${safeBase}.md`;
    const absolutePath = path.join(projectRoot, relativePath.split('/').join(path.sep));

    await guardStorage(absolutePath);
    await fsPromises.mkdir(path.dirname(absolutePath), { recursive: true });
    await fsPromises.writeFile(absolutePath, content, 'utf8');

    const jobId = await enqueueResolvedExportJob(req, {
      projectName,
      projectRoot,
      absolutePath,
      relativePath,
      format,
      engine,
      bundle,
    });

    return res.status(202).json({ jobId, sourcePath: relativePath });
  } catch (error) {
    console.error('[export] export-content error:', error);
    const status = Number(error?.status) || 500;
    return res.status(status).json({
      error: error instanceof Error ? error.message : 'export_failed',
    });
  }
});

router.get('/:projectName/files/export/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { tenantId, userId } = tenantUserIds(req);
    const key = exportJobKey(tenantId, userId, jobId);
    const job = await loadExportJob(key);
    if (!job) {
      return res.status(404).json({ error: 'job not found' });
    }
    return res.json(job);
  } catch (error) {
    console.error('[export] poll error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'poll_failed' });
  }
});

export default router;
