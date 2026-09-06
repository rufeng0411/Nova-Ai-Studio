/**
 * PD-SAAS-FORK: 与 pack.mjs 共用的 OSS 发布配置（deploy/env.local）
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(__dirname, '../..');
export const ENV_LOCAL = join(REPO_ROOT, 'deploy', 'env.local');
export const OUT_ROOT = join(REPO_ROOT, 'dist-release');

/**
 * @param {string} text
 */
export function parseEnvFile(text) {
  /** @type {Record<string, string>} */
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

/**
 * @param {boolean} [required]
 */
export function loadEnvLocal(required = true) {
  if (!existsSync(ENV_LOCAL)) {
    if (required) {
      console.error(`[oss] 缺少 ${ENV_LOCAL}（请复制 deploy/env.example）`);
      process.exit(1);
    }
    return {};
  }
  return parseEnvFile(readFileSync(ENV_LOCAL, 'utf8'));
}

/**
 * @param {Record<string, string>} envLocal
 */
export function ossBucketPublicBase(envLocal) {
  const bucket = envLocal.OSS_BUCKET || process.env.OSS_BUCKET;
  const endpoint = envLocal.OSS_ENDPOINT || process.env.OSS_ENDPOINT || 'oss-cn-hangzhou.aliyuncs.com';
  if (!bucket) return '';
  return `https://${bucket}.${endpoint}`;
}

/**
 * @param {Record<string, string>} envLocal
 * @param {string} [objectKey]
 */
export function cloudDiagTarPublicUrl(envLocal, objectKey = 'cloud-diag-upload.tar.gz') {
  const base = ossBucketPublicBase(envLocal);
  if (!base) return '';
  const key = (envLocal.CLOUD_DIAG_OSS_TAR_KEY || process.env.CLOUD_DIAG_OSS_TAR_KEY || objectKey).replace(/^\//, '');
  return `${base}/${key}`;
}

/**
 * @param {Record<string, string>} envLocal
 */
export function ossPublicBase(envLocal) {
  const bucket = envLocal.OSS_BUCKET || process.env.OSS_BUCKET;
  const endpoint = envLocal.OSS_ENDPOINT || process.env.OSS_ENDPOINT || 'oss-cn-hangzhou.aliyuncs.com';
  const prefix = (envLocal.OSS_PREFIX || process.env.OSS_PREFIX || 'nova-ai-studio').replace(/\/$/, '');
  if (!bucket) return '';
  return `https://${bucket}.${endpoint}/${prefix}`;
}

/**
 * @param {string} dest
 * @param {string} srcPath
 */
export function writeShellScript(dest, srcPath) {
  const text = readFileSync(srcPath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  writeFileSync(dest, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
}

/**
 * @param {string} ossDest oss://bucket/prefix/file
 * @param {string} localPath
 */
export function uploadFileToOss(ossDest, localPath) {
  const r = spawnSync('ossutil', ['cp', '-f', localPath, ossDest], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return r.status === 0;
}

/**
 * @param {Record<string, string>} envLocal
 * @param {Array<{ local: string, name: string }>} files
 */
export function uploadReleaseScripts(envLocal, files) {
  const bucket = envLocal.OSS_BUCKET || process.env.OSS_BUCKET;
  const prefix = (envLocal.OSS_PREFIX || 'nova-ai-studio').replace(/\/$/, '');
  if (!bucket) {
    console.error('[oss] 上传需 deploy/env.local 中 OSS_BUCKET');
    process.exit(1);
  }
  const ossBase = `oss://${bucket}/${prefix}`;
  let ok = 0;
  for (const file of files) {
    const dest = `${ossBase}/${file.name}`;
    if (uploadFileToOss(dest, file.local)) {
      console.log(`[oss] 已上传 ${file.name}`);
      ok += 1;
    } else {
      console.warn(`[oss] 上传失败 ${file.name}`);
    }
  }
  return ok === files.length;
}
