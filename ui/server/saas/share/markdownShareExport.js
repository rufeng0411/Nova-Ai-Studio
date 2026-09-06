// PD-SAAS-FORK: public share-scoped async PDF/DOCX export (no user JWT)
import crypto from 'node:crypto';
import path from 'node:path';
import { promises as fsPromises } from 'node:fs';
import { enqueueExportJob, loadExportJob, saveExportJob } from '../export/exportJobStore.js';
import { isExportOutputAllowed } from '../export/exportOutputPath.mjs';
import { readPilotDeckConfigFile, applyDocumentToolsRuntimeEnv } from '../../services/pilotdeckConfig.js';
import { getPublicMdShareMode, isPublicMdShareEnforce } from './publicMdShareFlag.js';
import { recordMarkdownShareTelemetry } from './markdownShareTelemetry.js';

const OUTPUT_EXT = { pdf: '.pdf', docx: '.docx' };

/** @type {Map<string, number>} */
const runningByShare = new Map();
/** @type {Map<string, number[]>} */
const hourlyBuckets = new Map();

function shareExportJobKey(shareId, jobId) {
  return `nova:share-export:${shareId}:${jobId}`;
}

function clientIp(req) {
  const xf = req.get?.('x-forwarded-for');
  if (xf) return String(xf).split(',')[0].trim();
  return String(req.ip || req.socket?.remoteAddress || 'unknown');
}

function assertExportRateLimit(shareId, ip) {
  const runKey = `${shareId}`;
  if ((runningByShare.get(runKey) || 0) >= 1) {
    const err = new Error('已有导出任务进行中，请稍候');
    err.code = 'RATE_LIMIT';
    throw err;
  }
  const bucketKey = `${ip}:${shareId}`;
  const now = Date.now();
  const arr = (hourlyBuckets.get(bucketKey) || []).filter((t) => now - t < 3_600_000);
  if (arr.length >= 20) {
    const err = new Error('导出次数过多，请稍后再试');
    err.code = 'RATE_LIMIT';
    throw err;
  }
  arr.push(now);
  hourlyBuckets.set(bucketKey, arr);
}

async function loadExportModules() {
  const { pathToFileURL } = await import('node:url');
  const { dirname, resolve } = await import('node:path');
  const { existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const here = dirname(fileURLToPath(import.meta.url));
  const uiRoot = resolve(here, '../../..');
  const repoRoot = resolve(here, '../../../..');
  const runnerPath = resolve(repoRoot, 'src/saas/document-export/uiExportRunner.ts');
  if (!existsSync(runnerPath)) {
    const err = new Error(`export_runtime_missing: ${runnerPath}`);
    err.code = 'export_runtime_missing';
    throw err;
  }
  const runner = await import(pathToFileURL(runnerPath).href);
  return {
    runUiExportJob: runner.runUiExportJob,
  };
}

/**
 * @param {import('express').Application} app
 * @param {Record<string, any>} deps
 */
export function registerMarkdownShareExportRoutes(app, deps) {
  app.post('/s/:shareId/export', async (req, res) => {
    if (!isPublicMdShareEnforce()) {
      return res.status(404).json({ error: 'Not found' });
    }
    const shareId = String(req.params.shareId || '').trim();
    const format = String(req.body?.format || '').trim().toLowerCase();
    if (!OUTPUT_EXT[format]) {
      return res.status(400).json({ error: 'format must be pdf or docx' });
    }

    try {
      const shareRow = await deps.getShareLinkById(shareId);
      if (!shareRow || shareRow.revokedAt) {
        return res.status(410).json({ error: 'Share link gone' });
      }

      try {
        assertExportRateLimit(shareId, clientIp(req));
      } catch (error) {
        if (error?.code === 'RATE_LIMIT') {
          return res.status(429).json({ error: error.message });
        }
        throw error;
      }

      const mode = getPublicMdShareMode();
      const jobId = crypto.randomUUID();
      const key = shareExportJobKey(shareId, jobId);
      const job = {
        id: jobId,
        shareId,
        status: 'queued',
        progress: 0,
        format,
        createdAt: Date.now(),
      };
      await saveExportJob(key, job);
      runningByShare.set(shareId, (runningByShare.get(shareId) || 0) + 1);

      recordMarkdownShareTelemetry({
        type: 'share_export_started',
        shareId,
        tenantId: shareRow.tenantId,
        format,
        mode,
      });

      void enqueueExportJob(async () => {
        await saveExportJob(key, { ...job, status: 'running', progress: 10 });
        try {
          await deps.withShareContext(shareRow, async () => {
            const resolved = await deps.resolveMarkdownFile(shareRow);
            if (resolved.error) {
              throw new Error('Source markdown unavailable');
            }
            const baseName = path
              .basename(resolved.absolutePath, path.extname(resolved.absolutePath))
              .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
              .slice(0, 48) || 'document';
            const outRel = `artifacts/_share-export/${shareId}/${baseName}${OUTPUT_EXT[format]}`;
            if (!isExportOutputAllowed(outRel)) {
              throw new Error('Export output path not allowed');
            }
            const outputAbsolutePath = path.join(
              resolved.projectRoot,
              outRel.split('/').join(path.sep),
            );
            await fsPromises.mkdir(path.dirname(outputAbsolutePath), { recursive: true });
            await deps.guardSaasStoragePath(outputAbsolutePath);

            const { config, rawYaml } = readPilotDeckConfigFile();
            const exportEnv = { ...process.env };
            applyDocumentToolsRuntimeEnv(exportEnv, config);
            exportEnv.PILOTDECK_EXPORT_CLOSE_POOL = '1';

            const { runUiExportJob } = await loadExportModules();
            const result = await runUiExportJob({
              workspaceRoot: resolved.projectRoot,
              sourcePath: resolved.mdRelativePath,
              sourceAbsolutePath: resolved.absolutePath,
              outputAbsolutePath,
              format,
              engine: 'export_document',
              env: exportEnv,
              yamlConfig: rawYaml,
              modelConfig: config,
              onProgress: async (percent) => {
                await saveExportJob(key, {
                  ...job,
                  status: 'running',
                  progress: Math.max(10, Math.min(99, percent)),
                });
              },
            });

            await saveExportJob(key, {
              ...job,
              status: 'done',
              progress: 100,
              relativePath: result.relativePath || outRel,
              absolutePath: outputAbsolutePath,
              finishedAt: Date.now(),
            });
            recordMarkdownShareTelemetry({
              type: 'share_export_done',
              shareId,
              tenantId: shareRow.tenantId,
              format,
              mode,
            });
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error('[share-export] failed:', message);
          await saveExportJob(key, {
            ...job,
            status: 'failed',
            error: message,
            finishedAt: Date.now(),
          });
          recordMarkdownShareTelemetry({
            type: 'share_export_failed',
            shareId,
            tenantId: shareRow.tenantId,
            format,
            mode,
            reason: message,
          });
        } finally {
          const n = (runningByShare.get(shareId) || 1) - 1;
          if (n <= 0) runningByShare.delete(shareId);
          else runningByShare.set(shareId, n);
        }
      });

      return res.status(202).json({ jobId });
    } catch (error) {
      console.error('Error starting share export:', error);
      return res.status(500).json({ error: error?.message || 'Failed to start export' });
    }
  });

  app.get('/s/:shareId/export/:jobId', async (req, res) => {
    if (!isPublicMdShareEnforce()) {
      return res.status(404).json({ error: 'Not found' });
    }
    const shareId = String(req.params.shareId || '').trim();
    const jobId = String(req.params.jobId || '').trim();
    const shareRow = await deps.getShareLinkById(shareId);
    if (!shareRow || shareRow.revokedAt) {
      return res.status(410).json({ error: 'Share link gone' });
    }
    const job = await loadExportJob(shareExportJobKey(shareId, jobId));
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    return res.json({
      status: job.status,
      progress: job.progress ?? 0,
      error: job.error || undefined,
      format: job.format,
    });
  });

  app.get('/s/:shareId/export/:jobId/file', async (req, res) => {
    if (!isPublicMdShareEnforce()) {
      return res.status(404).type('text/plain').send('Not found');
    }
    const shareId = String(req.params.shareId || '').trim();
    const jobId = String(req.params.jobId || '').trim();
    const shareRow = await deps.getShareLinkById(shareId);
    if (!shareRow || shareRow.revokedAt) {
      return res.status(410).type('text/plain').send('Gone');
    }
    const job = await loadExportJob(shareExportJobKey(shareId, jobId));
    if (!job || job.status !== 'done' || !job.absolutePath) {
      return res.status(404).type('text/plain').send('Not ready');
    }
    const abs = String(job.absolutePath);
    try {
      await deps.guardSaasStoragePath(abs);
    } catch {
      return res.status(403).type('text/plain').send('Forbidden');
    }
    const ext = OUTPUT_EXT[String(job.format)] || '';
    const filename = `${path.basename(abs, path.extname(abs))}${ext}`;
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return res.sendFile(abs);
  });
}

export function resetShareExportRateLimitForTests() {
  runningByShare.clear();
  hourlyBuckets.clear();
}
