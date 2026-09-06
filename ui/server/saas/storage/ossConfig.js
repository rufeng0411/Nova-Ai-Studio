/**
 * PD-SAAS-FORK: Alibaba Cloud OSS runtime config for SaaS user files.
 */
import path from 'node:path';
import { getDataRoot } from '../tenant/paths.js';
import { isSaasMode } from '../mode.js';

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

/**
 * @param {string | undefined} value
 */
function isTruthyEnv(value) {
  return TRUTHY.has(String(value ?? '').trim().toLowerCase());
}

/**
 * @param {Record<string, string | undefined>} [env]
 */
export function readSaasOssConfig(env = process.env) {
  const bucket = String(env.SAAS_OSS_BUCKET ?? '').trim();
  const endpoint = String(env.SAAS_OSS_ENDPOINT ?? 'oss-cn-beijing.aliyuncs.com').trim();
  const region = String(env.SAAS_OSS_REGION ?? 'oss-cn-beijing').trim();
  const prefix = String(env.SAAS_OSS_PREFIX ?? 'nova-user-files').trim().replace(/^\/+|\/+$/g, '');
  const accessKeyId = String(env.SAAS_OSS_ACCESS_KEY_ID ?? env.OSS_ACCESS_KEY_ID ?? '').trim();
  const accessKeySecret = String(env.SAAS_OSS_ACCESS_KEY_SECRET ?? env.OSS_ACCESS_KEY_SECRET ?? '').trim();
  const ttlRaw = Number.parseInt(String(env.SAAS_OSS_SIGNED_URL_TTL_SEC ?? '900'), 10);
  const signedUrlTtlSec = Number.isFinite(ttlRaw) && ttlRaw > 0 ? Math.min(ttlRaw, 86400) : 900;
  const minBytesRaw = Number.parseInt(String(env.SAAS_OSS_MIN_BYTES ?? '0'), 10);
  const minBytes = Number.isFinite(minBytesRaw) && minBytesRaw >= 0 ? minBytesRaw : 0;

  return {
    enabled: isTruthyEnv(env.SAAS_OSS_ENABLED),
    bucket,
    endpoint,
    region,
    prefix,
    accessKeyId,
    accessKeySecret,
    signedUrlTtlSec,
    minBytes,
  };
}

/**
 * @param {Record<string, string | undefined>} [env]
 */
export function isSaasOssConfigured(env = process.env) {
  const cfg = readSaasOssConfig(env);
  return Boolean(cfg.bucket && cfg.accessKeyId && cfg.accessKeySecret);
}

/**
 * @param {Record<string, string | undefined>} [env]
 */
export function isSaasOssActive(env = process.env) {
  return isSaasMode() && readSaasOssConfig(env).enabled && isSaasOssConfigured(env);
}

/**
 * Map on-disk SaaS file path → OSS object key under SAAS_OSS_PREFIX.
 * @param {string} absPath
 * @param {Record<string, string | undefined>} [env]
 * @returns {string | null}
 */
export function localPathToOssObjectKey(absPath, env = process.env) {
  if (!absPath || typeof absPath !== 'string') return null;
  const dataRoot = path.resolve(getDataRoot(env));
  const normalized = path.resolve(absPath);
  const relative = path.relative(dataRoot, normalized);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  const prefix = readSaasOssConfig(env).prefix || 'nova-user-files';
  return `${prefix}/${relative.split(path.sep).join('/')}`;
}

/**
 * Only user workspace blobs under cloud-storage are mirrored to OSS.
 * @param {string} absPath
 * @param {Record<string, string | undefined>} [env]
 */
export function isCloudStorageUserFile(absPath, env = process.env) {
  const key = localPathToOssObjectKey(absPath, env);
  if (!key) return false;
  return key.includes('/cloud-storage/');
}

/**
 * @param {Record<string, string | undefined>} [env]
 */
export function saasOssStatusSummary(env = process.env) {
  const cfg = readSaasOssConfig(env);
  return {
    enabled: cfg.enabled,
    configured: isSaasOssConfigured(env),
    active: isSaasOssActive(env),
    bucket: cfg.bucket || null,
    endpoint: cfg.endpoint || null,
    prefix: cfg.prefix || null,
    signedUrlTtlSec: cfg.signedUrlTtlSec,
    minBytes: cfg.minBytes,
  };
}
