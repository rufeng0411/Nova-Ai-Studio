#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 云端诊断脚本上传包（轻量，不含 app/tar 整包）
 *
 *   npm run diag:cloud:pack
 *   npm run diag:cloud:pack:upload
 *
 * tar 默认上传 Bucket 根：…/cloud-diag-upload.tar.gz
 * 单脚本可选同步 nova-ai-studio/ 前缀
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OUT_ROOT,
  cloudDiagTarPublicUrl,
  loadEnvLocal,
  ossPublicBase,
  uploadFileToOss,
  uploadReleaseScripts,
  writeShellScript,
} from '../lib/ossReleaseConfig.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');

const UPLOAD = process.argv.includes('--upload');
const STAMP = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  + '.' + String(Date.now()).slice(-4);
const STAGING = join(OUT_ROOT, 'cloud-diag-staging');
const FLAT_DIR = join(OUT_ROOT, 'cloud-diag');
const TAR_NAME = `cloud-diag-upload-${STAMP}.tar.gz`;
const TAR_PATH = join(OUT_ROOT, TAR_NAME);
const LATEST_TAR = join(OUT_ROOT, 'cloud-diag-upload.tar.gz');

/** @type {Array<{ src: string, name: string }>} */
const SCRIPT_FILES = [
  { src: join(__dirname, 'run-cloud-diag.sh'), name: 'run-cloud-diag.sh' },
  { src: join(__dirname, 'verify-cloud-perf.sh'), name: 'verify-cloud-perf.sh' },
  { src: join(__dirname, 'apply-cloud-perf-env.sh'), name: 'apply-cloud-perf-env.sh' },
  { src: join(__dirname, 'fetch-run-cloud-diag.sh'), name: 'fetch-run-cloud-diag.sh' },
];

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed (${r.status})`);
  }
}

/**
 * @param {string} tarUrl
 * @param {string} ossUrl
 * @param {Record<string, string>} envLocal
 */
function buildUploadMd(tarUrl, ossUrl, envLocal) {
  const bucket = envLocal.OSS_BUCKET || process.env.OSS_BUCKET || 'webui-media';
  const prefix = (envLocal.OSS_PREFIX || 'nova-ai-studio').replace(/\/$/, '');
  const ecsTar = [
    `curl -fsSL "${tarUrl}" -o /tmp/cloud-diag-upload.tar.gz`,
    'sudo rm -rf /tmp/nova-cloud-diag && sudo mkdir -p /tmp/nova-cloud-diag',
    'sudo tar -xzf /tmp/cloud-diag-upload.tar.gz -C /tmp/nova-cloud-diag',
    `sudo NOVA_OSS_BASE="${ossUrl}" bash /tmp/nova-cloud-diag/run-cloud-diag.sh`,
  ].join(' && ');
  return [
    '# Nova 云端诊断 — OSS 上传包',
    '',
    `构建时间: ${new Date().toISOString()}`,
    '',
    '## 推荐：整包 tar（Bucket 根目录）',
    '',
    `**公网地址:** \`${tarUrl}\``,
    '',
    '```bash',
    ecsTar,
    '```',
    '',
    '或一行（fetch 脚本在 tar 内，也可单独 curl nova-ai-studio 前缀）：',
    '',
    '```bash',
    `curl -fsSL "${ossUrl}/fetch-run-cloud-diag.sh" | sudo CLOUD_DIAG_TAR_URL="${tarUrl}" bash -s --`,
    '```',
    '',
    '## 包内文件',
    '',
    '| 文件 | 用途 |',
    '|------|------|',
    '| `run-cloud-diag.sh` | 主诊断 |',
    '| `verify-cloud-perf.sh` | perf/catalog |',
    '| `apply-cloud-perf-env.sh` | 可选修复 env |',
    '| `fetch-run-cloud-diag.sh` | 下载 tar 并执行 |',
    '',
    '## 上传到 OSS',
    '',
    `1. **整包** → Bucket 根 \`oss://${bucket}/cloud-diag-upload.tar.gz\`（控制台或 ossutil）`,
    `2. **可选** 单脚本 → \`oss://${bucket}/${prefix}/\``,
    '',
    '```bash',
    `ossutil cp -f dist-release/cloud-diag-upload.tar.gz oss://${bucket}/cloud-diag-upload.tar.gz`,
    'npm run diag:cloud:pack:upload',
    '```',
    '',
    '默认 **admin / SAAS_ADMIN_PASSWORD**。',
    '',
  ].join('\n');
}

function buildEcsOneLiner(tarUrl, ossUrl) {
  return [
    `curl -fsSL "${tarUrl}" -o /tmp/cloud-diag-upload.tar.gz`,
    'sudo rm -rf /tmp/nova-cloud-diag && sudo mkdir -p /tmp/nova-cloud-diag',
    'sudo tar -xzf /tmp/cloud-diag-upload.tar.gz -C /tmp/nova-cloud-diag',
    `sudo NOVA_OSS_BASE="${ossUrl}" bash /tmp/nova-cloud-diag/run-cloud-diag.sh`,
  ].join(' && ');
}

function main() {
  const envLocal = loadEnvLocal(true);
  const ossUrl = ossPublicBase(envLocal);
  const tarUrl = cloudDiagTarPublicUrl(envLocal);
  if (!ossUrl || !tarUrl) {
    console.error('[cloud-diag-pack] deploy/env.local 缺少 OSS_BUCKET');
    process.exit(1);
  }

  for (const file of SCRIPT_FILES) {
    if (!existsSync(file.src)) {
      console.error(`[cloud-diag-pack] 缺少 ${file.src}`);
      process.exit(1);
    }
  }

  rmSync(STAGING, { recursive: true, force: true });
  rmSync(FLAT_DIR, { recursive: true, force: true });
  mkdirSync(STAGING, { recursive: true });
  mkdirSync(FLAT_DIR, { recursive: true });

  /** @type {string[]} */
  const manifestFiles = [];

  for (const file of SCRIPT_FILES) {
    const staged = join(STAGING, file.name);
    const flat = join(FLAT_DIR, file.name);
    writeShellScript(staged, file.src);
    writeShellScript(flat, file.src);
    manifestFiles.push(file.name);
  }

  const ecsOneLiner = buildEcsOneLiner(tarUrl, ossUrl);
  const uploadMd = buildUploadMd(tarUrl, ossUrl, envLocal);
  writeFileSync(join(STAGING, 'UPLOAD.md'), uploadMd, 'utf8');
  writeFileSync(join(FLAT_DIR, 'UPLOAD.md'), uploadMd, 'utf8');
  manifestFiles.push('UPLOAD.md');

  const manifest = {
    kind: 'cloud-diag-upload',
    builtAt: new Date().toISOString(),
    tarPublicUrl: tarUrl,
    ossScriptBase: ossUrl,
    files: manifestFiles,
    ecsOneLiner,
  };
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  writeFileSync(join(STAGING, 'MANIFEST.json'), manifestJson, 'utf8');
  writeFileSync(join(FLAT_DIR, 'MANIFEST.json'), manifestJson, 'utf8');

  mkdirSync(OUT_ROOT, { recursive: true });
  console.log('[cloud-diag-pack] 打 tar.gz…');
  run('tar', ['-czf', TAR_PATH, '-C', STAGING, '.']);
  copyFileSync(TAR_PATH, LATEST_TAR);

  console.log('[cloud-diag-pack] 完成:');
  console.log(`  目录  ${FLAT_DIR}/`);
  console.log(`  包    ${LATEST_TAR}`);
  console.log(`  OSS   ${tarUrl}`);

  const bucket = envLocal.OSS_BUCKET || process.env.OSS_BUCKET;
  const prefix = (envLocal.OSS_PREFIX || 'nova-ai-studio').replace(/\/$/, '');
  const ossBucketRoot = `oss://${bucket}`;

  let tarUploaded = false;
  let scriptsUploaded = false;
  if (UPLOAD) {
    console.log('[cloud-diag-pack] 上传 tar 到 Bucket 根…');
    tarUploaded = uploadFileToOss(`${ossBucketRoot}/cloud-diag-upload.tar.gz`, LATEST_TAR);
    if (tarUploaded) {
      console.log(`[oss] ${tarUrl}`);
    }
    console.log('[cloud-diag-pack] 上传单脚本到 nova-ai-studio/ …');
    const uploadList = SCRIPT_FILES.map((f) => ({
      local: join(FLAT_DIR, f.name),
      name: f.name,
    }));
    scriptsUploaded = uploadReleaseScripts(envLocal, uploadList);
  }

  console.log('');
  console.log('=== ECS 粘贴执行（与你上传的 tar 地址一致）===');
  console.log('');
  console.log(ecsOneLiner);
  console.log('');

  if (UPLOAD && !tarUploaded) {
    console.warn('[cloud-diag-pack] ossutil 不可用 — OSS 控制台上传:');
    console.warn(`  ${LATEST_TAR}  →  Bucket 根 cloud-diag-upload.tar.gz`);
    console.warn(`  公网: ${tarUrl}`);
  } else if (!UPLOAD) {
    console.log('[cloud-diag-pack] 上传: npm run diag:cloud:pack:upload');
  }
}

main();
