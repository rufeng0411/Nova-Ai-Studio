/**
 * PD-SAAS-FORK: mirror SaaS cloud-storage files to Alibaba OSS + signed URL delivery.
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import OSS from 'ali-oss';
import {
  isCloudStorageUserFile,
  isSaasOssActive,
  isSaasOssConfigured,
  localPathToOssObjectKey,
  readSaasOssConfig,
} from './ossConfig.js';

/** @type {import('ali-oss').default | null} */
let cachedClient = null;
/** @type {string | null} */
let cachedClientKey = null;

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {import('ali-oss').default | null}
 */
export function getOssClient(env = process.env) {
  if (!isSaasOssConfigured(env)) return null;
  const cfg = readSaasOssConfig(env);
  const fingerprint = `${cfg.bucket}|${cfg.endpoint}|${cfg.accessKeyId}`;
  if (cachedClient && cachedClientKey === fingerprint) {
    return cachedClient;
  }
  cachedClient = new OSS({
    region: cfg.region,
    accessKeyId: cfg.accessKeyId,
    accessKeySecret: cfg.accessKeySecret,
    bucket: cfg.bucket,
    endpoint: cfg.endpoint,
    secure: true,
  });
  cachedClientKey = fingerprint;
  return cachedClient;
}

/**
 * @param {string} objectKey
 * @param {Record<string, string | undefined>} [env]
 */
export async function ossObjectExists(objectKey, env = process.env) {
  const client = getOssClient(env);
  if (!client) return false;
  try {
    await client.head(objectKey);
    return true;
  } catch (error) {
    if (error?.code === 'NoSuchKey' || error?.status === 404) return false;
    throw error;
  }
}

/**
 * @param {string} absPath
 * @param {Record<string, string | undefined>} [env]
 */
export async function uploadLocalFileToOss(absPath, env = process.env) {
  const client = getOssClient(env);
  const objectKey = localPathToOssObjectKey(absPath, env);
  if (!client || !objectKey) {
    return { ok: false, reason: 'not_configured' };
  }
  const fileStat = await stat(absPath);
  if (!fileStat.isFile()) {
    return { ok: false, reason: 'not_file' };
  }
  await client.put(objectKey, createReadStream(absPath), {
    headers: {
      'Content-Type': mimeForPath(absPath),
    },
  });
  return { ok: true, objectKey, uploaded: true, bytes: fileStat.size };
}

/**
 * @param {string} absPath
 * @param {{ download?: boolean; basename?: string }} [options]
 * @param {Record<string, string | undefined>} [env]
 */
export async function ensureMirroredAndGetSignedUrl(absPath, options = {}, env = process.env) {
  if (!isSaasOssActive(env) || !isCloudStorageUserFile(absPath, env)) {
    return null;
  }
  const cfg = readSaasOssConfig(env);
  const objectKey = localPathToOssObjectKey(absPath, env);
  if (!objectKey) return null;

  const client = getOssClient(env);
  if (!client) return null;

  const fileStat = await stat(absPath);
  if (!fileStat.isFile()) return null;
  if (cfg.minBytes > 0 && fileStat.size < cfg.minBytes) {
    return null;
  }

  const exists = await ossObjectExists(objectKey, env);
  if (!exists) {
    await uploadLocalFileToOss(absPath, env);
  }

  /** @type {Record<string, string>} */
  const response = {};
  if (options.download) {
    const name = options.basename || path.basename(absPath);
    response['content-disposition'] = `attachment; filename="${encodeRFC5987Filename(name)}"`;
  }

  return client.signatureUrl(objectKey, {
    expires: cfg.signedUrlTtlSec,
    method: 'GET',
    response: Object.keys(response).length > 0 ? response : undefined,
  });
}

/**
 * @param {string} filePath
 */
function mimeForPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.md': 'text/markdown; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
  };
  return map[ext] ?? 'application/octet-stream';
}

/**
 * @param {string} name
 */
function encodeRFC5987Filename(name) {
  const asciiFallback = String(name).replace(/[^\x20-\x7E]/g, '_');
  return `${asciiFallback}; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * @param {string} rootDir
 * @param {Record<string, string | undefined>} [env]
 */
export async function mirrorDirectoryToOss(rootDir, env = process.env) {
  if (!isSaasOssConfigured(env)) {
    return { ok: false, reason: 'not_configured', uploaded: 0, skipped: 0, errors: [] };
  }
  const { readdir } = await import('node:fs/promises');
  let uploaded = 0;
  let skipped = 0;
  /** @type {Array<{ path: string; error: string }>} */
  const errors = [];

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.isFile() || !isCloudStorageUserFile(full, env)) {
        skipped += 1;
        continue;
      }
      const key = localPathToOssObjectKey(full, env);
      if (!key) {
        skipped += 1;
        continue;
      }
      try {
        const exists = await ossObjectExists(key, env);
        if (exists) {
          skipped += 1;
          continue;
        }
        await uploadLocalFileToOss(full, env);
        uploaded += 1;
      } catch (error) {
        errors.push({
          path: full,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  await walk(rootDir);
  return { ok: errors.length === 0, uploaded, skipped, errors };
}
