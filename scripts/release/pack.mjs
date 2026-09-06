#!/usr/bin/env node
/**
 * 轻量一键打包：编译产物 + 数据 + 脚本（不含 node_modules、不含 image.tar）
 * 服务器 install/upgrade 时 docker compose build 再装依赖（Playwright、python-pptx 等）。
 *
 *   npm run pack:deploy
 *   npm run pack:deploy -- --upload          # 本机有 ossutil 时上传 OSS
 *   npm run pack:deploy -- --upgrade-only    # 更新包：不含 data.tar.gz（首装仍用完整包）
 *   npm run pack:deploy -- --upgrade-only --with-ssl  # 更新包内附带 ssl/（阿里云 pem/key）
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import { RUNTIME_DEPS_ROWS } from './cloudRuntimeDeps.mjs';
import { syncShowcaseIntoPack } from './sync-showcase-into-pack.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const DEPLOY_DIR = join(REPO_ROOT, 'deploy');
const ENV_LOCAL = join(DEPLOY_DIR, 'env.local');
const OUT_ROOT = join(REPO_ROOT, 'dist-release');
const STAGING = join(OUT_ROOT, 'staging');

const VERSION = process.env.NOVA_RELEASE_VERSION
  || new Date().toISOString().slice(0, 10).replace(/-/g, '')
  + '.' + String(Date.now()).slice(-4);

const APP_COPY = [
  ['dist', 'dist'],
  ['src', 'src'],
  ['scripts', 'scripts'],
  ['config', 'config'],
  ['skills', 'skills'],
  // PD-SAAS-FORK: outbound IM notify MCP server
  ['mcp-servers', 'mcp-servers'],
  ['ui/dist', 'ui/dist'],
  ['ui/server', 'ui/server'],
  ['ui/scripts', 'ui/scripts'],
  ['ui/shared', 'ui/shared'],
  ['ui/src/shared', 'ui/src/shared'],
  ['ui/vite.config.js', 'ui/vite.config.js'],
  // PD-SAAS-FORK: SEO/GEO product marketing site (Bridge-served)
  ['deploy/marketing', 'deploy/marketing'],
  ['package.json', 'package.json'],
  ['pnpm-lock.yaml', 'pnpm-lock.yaml'],
  ['pnpm-workspace.yaml', 'pnpm-workspace.yaml'],
  ['tsconfig.json', 'tsconfig.json'],
  ['ui/package.json', 'ui/package.json'],
  ['docker-entrypoint.sh', 'docker-entrypoint.sh'],
];

const NODE_MODULES = `${sep}node_modules${sep}`;

/** 仅本地资料，禁止进入 app/ 与 tar.gz（含 about/ 品牌与市场文档） */
const PACK_EXCLUDE_TOP_LEVEL = ['about', 'docs', 'artifacts', '.git'];

function cpNoDeps(src, dest) {
  cpSync(src, dest, {
    recursive: true,
    filter: (p) => !p.includes(NODE_MODULES) && !p.endsWith(`${sep}node_modules`),
  });
}

function copyEdgeclawCore(appDir) {
  const base = 'src/context/memory/edgeclaw-memory-core';
  const dest = join(appDir, base);
  mkdirSync(dest, { recursive: true });
  for (const name of ['package.json', 'lib']) {
    const src = join(REPO_ROOT, base, name);
    if (!existsSync(src)) throw new Error(`[pack] 缺少 ${src}`);
    const d = join(dest, name);
    const st = statSync(src);
    if (st.isDirectory()) cpNoDeps(src, d);
    else copyFileSync(src, d);
  }
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed (${r.status})`);
  }
}

/**
 * PD-SAAS-FORK: Windows bsdtar walking `-C staging .` may skip `app/deploy/marketing`
 * (directory present on disk, absent in archive). Build uncompressed tar, force-append
 * marketing, then gzip — so Docker image always gets the product showcase site.
 */
async function createTarGzFromStaging(bundlePath, stagingDir) {
  const tarPath = `${bundlePath}.tmp.tar`;
  rmSync(tarPath, { force: true });
  rmSync(bundlePath, { force: true });
  const marketingRel = join('app', 'deploy', 'marketing');
  const marketingAbs = join(stagingDir, marketingRel);
  const excludeMarketing = existsSync(marketingAbs);
  const createArgs = ['-cf', tarPath, '-C', stagingDir];
  if (excludeMarketing) {
    // bsdtar --exclude matches the member path; cover both with/without ./
    createArgs.push('--exclude', 'app/deploy/marketing', '--exclude', './app/deploy/marketing');
  }
  createArgs.push('.');
  run('tar', createArgs);
  if (excludeMarketing) {
    console.log('[pack] 强制并入 app/deploy/marketing（规避 Windows tar 漏目录）...');
    run('tar', ['-rf', tarPath, '-C', stagingDir, 'app/deploy/marketing']);
  }
  await pipeline(createReadStream(tarPath), createGzip({ level: 9 }), createWriteStream(bundlePath));
  rmSync(tarPath, { force: true });
  // Gate: refuse empty-shell marketing packages
  const list = spawnSync('tar', ['-tzf', bundlePath], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32',
  });
  if (list.status !== 0) {
    throw new Error('[pack] 无法列出刚打的 tar.gz');
  }
  const text = String(list.stdout || '').replace(/\r/g, '');
  const marketingHits = text.split('\n').filter((l) => l.includes('app/deploy/marketing/')).length;
  if (excludeMarketing && marketingHits < 50) {
    throw new Error(`[pack] tar.gz 内 marketing 条目过少 (${marketingHits})，拒绝发布`);
  }
  console.log(`[pack] marketing 条目 ${marketingHits}`);
}

/** Windows 打包时 shell 脚本须强制 LF，否则 Linux 上 set -euo pipefail 报错 */
function writeShellScript(dest, srcPath) {
  const text = readFileSync(srcPath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  writeFileSync(dest, text.endsWith('\n') ? text : text + '\n', 'utf8');
}

function parseEnvFile(text) {
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

function parsePgUrl(url) {
  const u = new URL(url);
  return {
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    host: u.hostname,
    port: u.port || '5432',
  };
}

function rewritePgHostForDocker(url) {
  const u = new URL(url);
  u.hostname = 'postgres';
  return u.toString();
}

function ossPublicBase(envLocal) {
  const bucket = envLocal.OSS_BUCKET || process.env.OSS_BUCKET;
  const endpoint = envLocal.OSS_ENDPOINT || 'oss-cn-hangzhou.aliyuncs.com';
  const prefix = (envLocal.OSS_PREFIX || 'nova-ai-studio').replace(/\/$/, '');
  if (!bucket) return '';
  return `https://${bucket}.${endpoint}/${prefix}`;
}

function loadEnvLocal() {
  if (!existsSync(ENV_LOCAL)) {
    console.error(`[pack] 缺少 ${ENV_LOCAL}`);
    process.exit(1);
  }
  return parseEnvFile(readFileSync(ENV_LOCAL, 'utf8'));
}

function copyAppTree(appDir) {
  mkdirSync(appDir, { recursive: true });
  for (const [fromRel, toRel] of APP_COPY) {
    const src = join(REPO_ROOT, fromRel);
    const dest = join(appDir, toRel);
    if (!existsSync(src)) {
      throw new Error(`[pack] 缺少 ${src}，请先完成构建`);
    }
    mkdirSync(dirname(dest), { recursive: true });
    cpNoDeps(src, dest);
  }
  copyEdgeclawCore(appDir);
  ensureDistGatewayRuntime(appDir);
  assertPackExcludes(appDir);
  // PD-SAAS-FORK: marketing site must ship in image (showcase HTML/JS + media)
  const marketingIndex = join(appDir, 'deploy', 'marketing', 'index.html');
  const showcaseIndex = join(appDir, 'deploy', 'marketing', 'showcase', 'index.html');
  if (!existsSync(marketingIndex) || !existsSync(showcaseIndex)) {
    throw new Error(
      '[pack] app/deploy/marketing 未完整复制（缺 index.html / showcase/index.html），拒绝打出空壳包',
    );
  }
  copyFileSync(join(DEPLOY_DIR, 'Dockerfile.prod'), join(appDir, 'Dockerfile'));
}

function assertPackExcludes(appDir) {
  for (const name of PACK_EXCLUDE_TOP_LEVEL) {
    if (existsSync(join(appDir, name))) {
      throw new Error(`[pack] 发布包不应含 ${name}/（仅本地，不上云）`);
    }
  }
}

/** Gateway dist 引用 ../../scripts 或 ../../../scripts → 必须同步到 app/dist/scripts */
function ensureDistGatewayRuntime(appDir) {
  const pairs = [
    ['scripts/lib/patchHiddenConsole.mjs', 'dist/scripts/lib/patchHiddenConsole.mjs'],
    ['scripts/lib/mcpFeatureFlags.mjs', 'dist/scripts/lib/mcpFeatureFlags.mjs'],
  ];
  for (const [fromRel, toRel] of pairs) {
    const src = join(appDir, fromRel);
    const dest = join(appDir, toRel);
    if (!existsSync(src)) {
      throw new Error(`[pack] 缺少 ${fromRel}`);
    }
    mkdirSync(dirname(dest), { recursive: true });
    if (!existsSync(dest)) {
      copyFileSync(src, dest);
      console.log(`[pack] 已补全 ${toRel}`);
    }
  }
}

function stageSslBundle(stagingDir) {
  const sslDir = join(REPO_ROOT, 'ssl');
  if (!existsSync(sslDir)) {
    throw new Error('[pack] --with-ssl 需要仓库 ssl/ 目录（含 *.pem 与 *.key）');
  }
  const dest = join(stagingDir, 'ssl');
  mkdirSync(dest, { recursive: true });
  let copied = 0;
  for (const name of readdirSync(sslDir)) {
    const src = join(sslDir, name);
    if (!statSync(src).isFile()) continue;
    if (!/\.(pem|key|crt)$/i.test(name)) continue;
    const targetName =
      name.endsWith('.key') ? 'privkey.key'
      : name.includes('fullchain') ? 'fullchain.pem'
      : name.endsWith('.pem') ? (existsSync(join(dest, 'fullchain.pem')) ? name : 'fullchain.pem')
      : name;
    copyFileSync(src, join(dest, targetName));
    copied += 1;
  }
  if (copied < 2) {
    throw new Error('[pack] ssl/ 至少需要 1 个 pem + 1 个 key');
  }
  console.log(`[pack] 已打包 ssl/ → staging/ssl（${copied} 个文件，私钥仅随包上传 OSS，勿提交 Git）`);
}

async function main() {
  const upload = process.argv.includes('--upload');
  const upgradeOnly = process.argv.includes('--upgrade-only');
  const withSsl = process.argv.includes('--with-ssl');
  const envLocal = loadEnvLocal();
  const ossUrl = ossPublicBase(envLocal);

  const saasDbUrl = envLocal.SAAS_DATABASE_URL?.trim() || '';
  const dbBackend = saasDbUrl.startsWith('postgresql://') || saasDbUrl.startsWith('postgres://')
    ? 'postgres'
    : 'sqlite';

  const dataRoot = resolve(envLocal.DATA_ROOT || join(REPO_ROOT, '.saas-dev-data'));
  const pilotHome = resolve(envLocal.PILOT_HOME || join(homedir(), '.pilotdeck'));

  console.log(`[pack] 轻量包 v${VERSION} | DB=${dbBackend} | 不含依赖与镜像${upgradeOnly ? ' | upgrade-only（无 data.tar.gz）' : ''}${withSsl ? ' | 含 ssl/' : ''}`);
  console.log(`[pack] DATA_ROOT ${dataRoot}`);

  // PD-SAAS-FORK: merge local showcase overlay media into deploy/marketing before app copy
  // (tenants / chats never included — upgrade-only stays free of data.tar.gz)
  console.log('[pack] 同步演示案例 overlay → deploy/marketing/showcase...');
  syncShowcaseIntoPack({
    overlayRoot: join(dataRoot, 'marketing-showcase'),
  });

  rmSync(STAGING, { recursive: true, force: true });
  mkdirSync(STAGING, { recursive: true });

  console.log('[pack] 生成目录与模板...');
  run('npm', ['run', 'capabilities:gen'], { cwd: REPO_ROOT });
  run('npm', ['run', 'templates:gen'], { cwd: REPO_ROOT });

  console.log('[pack] 编译 Gateway...');
  run('npm', ['run', 'build'], {
    cwd: REPO_ROOT,
    env: { ...process.env, PILOTDECK_SKIP_BOOTSTRAP: '1' },
  });
  for (const rel of [
    'dist/scripts/lib/patchHiddenConsole.mjs',
    'dist/scripts/lib/mcpFeatureFlags.mjs',
    'dist/ui/shared/deliverableSessionGoal.mjs',
    'dist/ui/shared/repairEligiblePath.mjs',
    'dist/ui/shared/deliverableBinaryRules.mjs',
  ]) {
    if (!existsSync(join(REPO_ROOT, rel))) {
      throw new Error(`[pack] build 后缺少 ${rel}（copy-dist-runtime.mjs）`);
    }
  }

  console.log('[pack] 写入 Nova build 版本戳...');
  run('node', ['scripts/stamp-nova-build.mjs'], { cwd: REPO_ROOT });

  console.log('[pack] 编译 UI (SaaS)...');
  run('npm', ['--workspace', 'ui', 'run', 'build'], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PILOTDECK_SAAS_MODE: '1',
      PILOTDECK_DISABLE_LOCAL_AUTH: '0',
      VITE_TAIL_MESSAGE_PAGINATION: 'true',
      VITE_SESSION_PIPELINE_BUNDLE: '1',
      VITE_SESSION_STORE_LRU_SLOTS: '10',
      VITE_SESSION_SWITCH_INLINE_LOADING: '1',
      VITE_SESSION_SWITCH_DEFER_MS: '300',
      VITE_SESSION_SCROLL_RESTORE: '1',
      VITE_TAIL_PAGE_FAST_SWITCH: '80',
      VITE_DEFER_DELIVERABLES_WHILE_STREAMING:
        process.env.VITE_DEFER_DELIVERABLES_WHILE_STREAMING ?? '1',
      VITE_PILOTDECK_TASK_LIFECYCLE_UI:
        process.env.VITE_PILOTDECK_TASK_LIFECYCLE_UI ?? '1',
      VITE_RECOVERY_SURFACE_V2: process.env.VITE_RECOVERY_SURFACE_V2 ?? '1',
      VITE_PROCESS_STEP_DETAIL_V2: process.env.VITE_PROCESS_STEP_DETAIL_V2 ?? '1',
      VITE_PILOTDECK_DELIVERABLE_CERTIFICATE_UI: process.env.VITE_PILOTDECK_DELIVERABLE_CERTIFICATE_UI ?? '0',
      VITE_DELIVERABLE_SETTLED_ACCEPTANCE_AUTHORITY:
        process.env.VITE_DELIVERABLE_SETTLED_ACCEPTANCE_AUTHORITY ?? '1',
      VITE_DELIVERABLE_SLOT_PROCESS_UX:
        process.env.VITE_DELIVERABLE_SLOT_PROCESS_UX ?? '0',
      VITE_DELIVERABLE_TRUST_COPY_V2:
        process.env.VITE_DELIVERABLE_TRUST_COPY_V2 ?? '1',
      VITE_PILOTDECK_UI_STRICT_COMPLETION_GATE:
        process.env.VITE_PILOTDECK_UI_STRICT_COMPLETION_GATE ?? '1',
      VITE_EXPORT_SNAPSHOT_V2: process.env.VITE_EXPORT_SNAPSHOT_V2 ?? '0',
      VITE_EXPORT_USER_AUDIT_MODES: process.env.VITE_EXPORT_USER_AUDIT_MODES ?? '0',
      VITE_PILOTDECK_CONVERSATION_DELIVERABLE_SYNC:
        process.env.VITE_PILOTDECK_CONVERSATION_DELIVERABLE_SYNC ?? '1',
      VITE_PILOTDECK_TURN_SNAPSHOT_KERNEL:
        process.env.VITE_PILOTDECK_TURN_SNAPSHOT_KERNEL ?? '1',
      VITE_PILOTDECK_TERMINAL_DELIVERABLE_PRESENTATION:
        process.env.VITE_PILOTDECK_TERMINAL_DELIVERABLE_PRESENTATION ?? '1',
      VITE_PILOTDECK_STICKY_DELIVERABLE_SUMMARY:
        process.env.VITE_PILOTDECK_STICKY_DELIVERABLE_SUMMARY ?? '1',
      VITE_STICKY_DELIVERABLE_BAR_PERSIST:
        process.env.VITE_STICKY_DELIVERABLE_BAR_PERSIST ?? '1',
      VITE_PILOTDECK_DELIVERABLE_STATUS_LOCK:
        process.env.VITE_PILOTDECK_DELIVERABLE_STATUS_LOCK ?? '1',
      VITE_PILOTDECK_HF_STUDIO: process.env.VITE_PILOTDECK_HF_STUDIO ?? '1',
      VITE_PILOTDECK_PREFLIGHT_STUDIO: process.env.VITE_PILOTDECK_PREFLIGHT_STUDIO ?? 'off',
      VITE_BENTO_DECK_PREVIEW: process.env.VITE_BENTO_DECK_PREVIEW ?? '0',
      VITE_MD_BROWSER_TOOL: process.env.VITE_MD_BROWSER_TOOL ?? '1',
      // PD-SAAS-FORK: 企业合规 Hub Tab 默认 shadow（visibility 另控）；enforce 后用户可见
      VITE_HUB_ENTERPRISE_COMPLIANCE_TAB:
        process.env.VITE_HUB_ENTERPRISE_COMPLIANCE_TAB ?? 'shadow',
      // PD-SAAS-FORK: production UI knows marketing site owns `/`
      VITE_PILOTDECK_MARKETING_SITE: process.env.VITE_PILOTDECK_MARKETING_SITE ?? '1',
      // PD-SAAS-FORK: production UI knows marketing site owns `/`
      VITE_PILOTDECK_MARKETING_SITE: process.env.VITE_PILOTDECK_MARKETING_SITE ?? '1',
      VITE_SESSION_TERMINAL_GATE: process.env.VITE_SESSION_TERMINAL_GATE ?? '1',
      VITE_AUTO_SIDEBAR_COMPLETE_ON_PASS: process.env.VITE_AUTO_SIDEBAR_COMPLETE_ON_PASS ?? '1',
      // PD-SAAS-FORK: workbench beta 1.1 — production default off (parallel route only when enabled)
      VITE_WORKBENCH_BETA_11: process.env.VITE_WORKBENCH_BETA_11 ?? 'off',
      VITE_WORKBENCH_TOUR: process.env.VITE_WORKBENCH_TOUR ?? 'off',
      VITE_TURN_USAGE_FOOTER: process.env.VITE_TURN_USAGE_FOOTER ?? 'off',
      VITE_POST_DELIVERABLE_NEXT: process.env.VITE_POST_DELIVERABLE_NEXT ?? 'off',
    },
  });

  console.log('[pack] 收集 app/（无 node_modules）...');
  copyAppTree(join(STAGING, 'app'));

  const dataStaging = join(STAGING, 'data-staging');
  mkdirSync(join(dataStaging, 'saas'), { recursive: true });
  mkdirSync(join(dataStaging, 'pilotdeck'), { recursive: true });

  if (dbBackend === 'sqlite') {
    const controlDb = join(dataRoot, 'control.db');
    if (!existsSync(controlDb)) {
      console.error(`[pack] 需要 ${controlDb}`);
      process.exit(1);
    }
    copyFileSync(controlDb, join(dataStaging, 'saas', 'control.db'));
    for (const suf of ['-wal', '-shm']) {
      const p = controlDb + suf;
      if (existsSync(p)) copyFileSync(p, join(dataStaging, 'saas', 'control.db' + suf));
    }
  }

  const tenants = join(dataRoot, 'tenants');
  if (existsSync(tenants)) {
    cpSync(tenants, join(dataStaging, 'saas', 'tenants'), { recursive: true });
  }

  const pilotYaml = join(pilotHome, 'pilotdeck.yaml');
  if (!existsSync(pilotYaml)) {
    console.error(`[pack] 缺少 ${pilotYaml}`);
    process.exit(1);
  }
  // PD-SAAS-FORK: strip Windows databasePath — Linux container must use PILOT_HOME default
  let pilotYamlText = readFileSync(pilotYaml, 'utf8');
  if (/databasePath:\s*[A-Za-z]:\\/m.test(pilotYamlText)) {
    pilotYamlText = pilotYamlText.replace(/^\s*databasePath:\s*.*\r?$/gm, '');
    console.log('[pack] 已移除 pilotdeck.yaml 内 Windows databasePath（避免云端 auth.db 路径错误）');
  }
  writeFileSync(join(dataStaging, 'pilotdeck', 'pilotdeck.yaml'), pilotYamlText.endsWith('\n') ? pilotYamlText : `${pilotYamlText}\n`);
  for (const name of ['auth.db']) {
    const src = join(pilotHome, name);
    if (existsSync(src)) copyFileSync(src, join(dataStaging, 'pilotdeck', name));
  }
  for (const suf of ['-wal', '-shm']) {
    const p = join(pilotHome, 'auth.db' + suf);
    if (existsSync(p)) copyFileSync(p, join(dataStaging, 'pilotdeck', 'auth.db' + suf));
  }
  for (const dir of ['skills', 'memory', 'router', 'plugins']) {
    const src = join(pilotHome, dir);
    if (existsSync(src)) cpSync(src, join(dataStaging, 'pilotdeck', dir), { recursive: true });
  }
  // 不打包 ~/.pilotdeck/projects：体积大且易带入本机路径垃圾；线上数据在 /var/lib/nova
  const projectsSrc = join(pilotHome, 'projects');
  if (existsSync(projectsSrc)) {
    const st = statSync(projectsSrc);
    const n = st.isDirectory()
      ? (() => { try { return readdirSync(projectsSrc).length; } catch { return 0; } })()
      : 0;
    console.log(`[pack] 跳过 pilotdeck/projects（${n} 项，SaaS 租户数据在 saas/tenants）`);
  }

  if (!upgradeOnly) {
    run('tar', ['-czf', join(STAGING, 'data.tar.gz'), '-C', dataStaging, '.']);
  } else {
    console.log('[pack] upgrade-only：跳过 data.tar.gz（线上用户数据不动）');
  }

  if (dbBackend === 'postgres') {
    const pg = parsePgUrl(saasDbUrl);
    const candidates = [
      process.env.PG_DUMP,
      process.platform === 'win32' ? 'D:\\pgsql\\bin\\pg_dump.exe' : null,
      'pg_dump',
    ].filter(Boolean);
    const pgDump = candidates.find((p) => existsSync(p)) || 'pg_dump';
    console.log(`[pack] pg_dump → ${pgDump}`);
    run(pgDump, [
      '-h', pg.host, '-p', pg.port, '-U', pg.user, '-d', pg.database,
      '-Fc', '-f', join(STAGING, 'postgres.dump'),
    ], { env: { ...process.env, PGPASSWORD: pg.password } });
    envLocal.POSTGRES_USER = pg.user;
    envLocal.POSTGRES_PASSWORD = pg.password;
    envLocal.POSTGRES_DB = pg.database;
    envLocal.SAAS_DATABASE_URL = rewritePgHostForDocker(saasDbUrl);
  }

  envLocal.DB_BACKEND = dbBackend;

  const deployEnvLines = [
    '# 由 pack.mjs 生成',
    `NOVA_VERSION=${VERSION}`,
    `DB_BACKEND=${dbBackend}`,
    '',
  ];
  for (const k of [
    'PILOTDECK_SAAS_MODE', 'PILOTDECK_DISABLE_LOCAL_AUTH', 'JWT_SECRET',
    'SAAS_DATABASE_URL', 'SAAS_DATABASE_SSL',
    'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB', 'DEPLOY_DOMAIN',
    'PILOTDECK_MODEL', 'PILOTDECK_API_KEY', 'PILOTDECK_API_URL',
    'REDIS_URL', 'REDIS_KEY_PREFIX',
    'CACHE_TTL_CAPABILITIES_SEC', 'CACHE_TTL_PROJECTS_SEC', 'CACHE_TTL_MESSAGES_SEC',
    'SAAS_CONVERSATION_CATALOG', 'SAAS_CONVERSATION_CATALOG_SHADOW',
    'SAAS_CONVERSATION_CATALOG_GRAY_PCT',
    'PILOTDECK_HISTORY_SANITIZE', 'PILOTDECK_HISTORY_TAIL_READ', 'PILOTDECK_HISTORY_MESSAGE_CACHE',
    'PILOTDECK_HISTORY_TAIL_BYTES', 'PILOTDECK_HISTORY_TOOL_TEXT_PREVIEW',
    'PILOTDECK_SESSION_DELIVERABLE_MANIFEST',
    'PILOTDECK_DELIVERABLE_CN_FILENAME_DEFAULT',
    'PILOTDECK_STDA_ADD_PRESERVE_ROOT',
    'PILOTDECK_SDM_HTML_SLOT_FUZZY',
    'PILOTDECK_COMPLETION_GATE',
    'PILOTDECK_VERIFICATION_PASS',
    'PILOTDECK_VERIFICATION_LLM',
    'PILOTDECK_GROUND_TRUTH_RECONCILE',
    'PILOTDECK_DELIVERABLE_SUMMARY_FORCE',
    'PILOTDECK_REPAIR_CIRCUIT_STRICT',
    'PILOTDECK_TOOL_RESULT_COMPACTION',
    'PILOTDECK_SESSION_SYNTHETIC_BUDGET',
    'PILOTDECK_SESSION_SYNTHETIC_BUDGET_LIMIT',
    'PILOTDECK_DELIVERABLE_CERTIFICATE_V2',
    'PILOTDECK_CONTRACT_AUTHORITY_V2',
    'PILOTDECK_EXPORT_SNAPSHOT_V2',
    'PILOTDECK_CAPABILITY_SCOPE_V2',
    'PILOTDECK_QUALITY_CANARY_SLUGS',
    'PILOTDECK_GOAL_QUALITY_CONTRACT',
    'PILOTDECK_GOAL_QUALITY_CANARY_SLUGS',
    'PILOTDECK_GOAL_QUALITY_CANARY_TENANTS',
    'PILOTDECK_OFFICIAL_MEDIA_V2',
    'PILOTDECK_VISUAL_ASSET_PLATFORM',
    'PILOTDECK_DISCOVER_VISUAL_ASSETS',
    'PILOTDECK_VISUAL_ASSET_PREP',
    'PILOTDECK_AUTO_RESOLVE_VISUAL_ASSETS',
    'PILOTDECK_VISUAL_BINDING_AUDIT',
    'PILOTDECK_VAP_BIND_BEFORE_WRITE',
    'PILOTDECK_VAP_OFFICIAL_FIRST',
    'PILOTDECK_VAP_DISCOVER_PARALLEL',
    'PILOTDECK_VAP_DIRECT_IMAGE_URL',
    'PILOTDECK_VAP_FORCE_LADDER',
    'PILOTDECK_VAP_OUTBOUND_MAX',
    'PILOTDECK_VAP_QUERY_PACK',
    'PILOTDECK_VAP_CRAWLER_SIDECAR',
    'PILOTDECK_VAP_LIVE_CAPTURE',
    'PILOTDECK_VAP_VISION_LOCATE',
    'PILOTDECK_CHECKLIST_AUTHORITY_TEMPLATES',
    'PILOTDECK_SDM_HTML_REPORT_ALIAS',
    'PILOTDECK_RESEARCH_PASSED_GT_STRICT_HTML',
    'PILOTDECK_ASSISTANT_COMPLETION_GATE',
    'PILOTDECK_RESEARCH_DOCX_BASENAME_FUZZY',
    'PILOTDECK_SDM_HEAL_RESEARCH_LITE',
    'PILOTDECK_DISTILL_SDM',
    'PILOTDECK_BLOCK_SILENT_RESEARCH_ADD',
    'PILOTDECK_OPEN_HTML_MIN_SDM',
    'PILOTDECK_VAP_ACQUISITION_CAP',
    'PILOTDECK_OFFICIAL_SOURCE_ROOTS_PATH',
    'PILOTDECK_CONTENT_QUALITY_V2',
    'PILOTDECK_UI_DELIVERABLE_CERTIFICATE',
    'PILOTDECK_UI_EXPORT_SNAPSHOT_V2',
    'PILOTDECK_UI_EXPORT_USER_AUDIT_MODES',
    'PILOTDECK_WEB_PERMISSION_MODE',
  ]) {
    if (envLocal[k]) deployEnvLines.push(`${k}=${envLocal[k]}`);
  }
  const perfDefaults = {
    SAAS_CONVERSATION_CATALOG_SHADOW: '1',
    SAAS_CONVERSATION_CATALOG: '1',
    CACHE_TTL_CAPABILITIES_SEC: '600',
    CACHE_TTL_PROJECTS_SEC: '60',
    CACHE_TTL_MESSAGES_SEC: '120',
    REDIS_KEY_PREFIX: 'nova:prod:',
    // 阶段 A：首装默认开 sanitize；存量 ECS upgrade 不覆盖 .env，须手工合并（见 DEPLOY.md）
    PILOTDECK_HISTORY_SANITIZE: '1',
    PILOTDECK_SESSION_DELIVERABLE_MANIFEST: '1',
    PILOTDECK_DELIVERABLE_CN_FILENAME_DEFAULT: '1',
    PILOTDECK_STDA_ADD_PRESERVE_ROOT: '1',
    PILOTDECK_SDM_HTML_SLOT_FUZZY: '1',
    PILOTDECK_COMPLETION_GATE: '1',
    PILOTDECK_VERIFICATION_PASS: '1',
    PILOTDECK_VERIFICATION_LLM: '0',
    PILOTDECK_GROUND_TRUTH_RECONCILE: '1',
    PILOTDECK_DELIVERABLE_SUMMARY_FORCE: '1',
    PILOTDECK_REPAIR_CIRCUIT_STRICT: '0',
    PILOTDECK_HF_STUDIO: '1',
    PILOTDECK_PREFLIGHT_STUDIO: 'off',
    // PD-SAAS-FORK: 企业 MCP 首批六键默认 off
    PILOTDECK_MCP_CN_ERP: 'off',
    PILOTDECK_MCP_KINGDEE: 'off',
    PILOTDECK_MCP_YONYOU_FIN: 'off',
    PILOTDECK_MCP_TAX_INVOICE: 'off',
    PILOTDECK_MCP_NOTION: 'off',
    PILOTDECK_MCP_POSTGRES: 'off',
    // PD-SAAS-FORK: IM notify MCP + App chat channels — pack default off
    PILOTDECK_IM_NOTIFY_MCP: 'off',
    PILOTDECK_IM_CHANNELS: 'off',
    // PD-SAAS-FORK: public markdown share — pack default shadow (observe then enforce)
    PILOTDECK_PUBLIC_MD_SHARE: 'shadow',
    // PD-SAAS-FORK: OD design-templates shadow registry (Hub never lists these as cards)
    PILOTDECK_OD_TEMPLATE_REGISTRY: 'shadow',
    // PD-SAAS-FORK: creative scenes prefer generate_image before CSS/SVG placeholders
    PILOTDECK_PREFER_GENERATE_IMAGE: 'shadow',
    PILOTDECK_BENTO_DECK_EDITOR: '0',
    PILOTDECK_MD_BROWSER_TOOL: '1',
    // PD-SAAS-FORK: N2 Bot 默认关；后台 config/platform-features.json n2Bot 或显式 env shadow|enforce 开启
    PILOTDECK_N2_BOT: 'off',
    PILOTDECK_PPT_SUPPRESS_FLASK_CONFIRM: '1',
    PILOTDECK_DELIVERABLE_CERTIFICATE_V2: 'shadow',
    PILOTDECK_CONTRACT_AUTHORITY_V2: '1',
    PILOTDECK_EXPORT_SNAPSHOT_V2: '0',
    // PD-SAAS-FORK: P0-1 ships shadow-first with exact capability canaries.
    PILOTDECK_CAPABILITY_SCOPE_V2: 'shadow',
    PILOTDECK_QUALITY_CANARY_SLUGS: 'mkt-last30days,ala-strategy-advisor',
    // PD-SAAS-FORK P0-2: no tenant/capability is selected by default.
    PILOTDECK_GOAL_QUALITY_CONTRACT: 'shadow',
    PILOTDECK_GOAL_QUALITY_CANARY_SLUGS: '',
    PILOTDECK_GOAL_QUALITY_CANARY_TENANTS: '',
    // PD-SAAS-FORK P0-6: production stays off until an explicit rollout.
    PILOTDECK_OFFICIAL_MEDIA_V2: 'off',
    // PD-SAAS-FORK VAP: R2 shadow (20260802 hardening) — not enforce.
    PILOTDECK_VISUAL_ASSET_PLATFORM: 'shadow',
    PILOTDECK_DISCOVER_VISUAL_ASSETS: '1',
    PILOTDECK_VISUAL_ASSET_PREP: '1',
    PILOTDECK_AUTO_RESOLVE_VISUAL_ASSETS: '1',
    PILOTDECK_VISUAL_BINDING_AUDIT: 'shadow',
    PILOTDECK_VAP_BIND_BEFORE_WRITE: '1',
    PILOTDECK_VAP_OFFICIAL_FIRST: '1',
    PILOTDECK_VAP_DISCOVER_PARALLEL: '1',
    PILOTDECK_VAP_DIRECT_IMAGE_URL: '1',
    PILOTDECK_VAP_FORCE_LADDER: '1',
    PILOTDECK_VAP_OUTBOUND_MAX: '4',
    PILOTDECK_VAP_QUERY_PACK: 'generic',
    PILOTDECK_VAP_CRAWLER_SIDECAR: 'off',
    PILOTDECK_VAP_LIVE_CAPTURE: '1',
    PILOTDECK_VAP_VISION_LOCATE: 'off',
    PILOTDECK_CHECKLIST_AUTHORITY_TEMPLATES: '1',
    PILOTDECK_SDM_HTML_REPORT_ALIAS: '1',
    PILOTDECK_RESEARCH_PASSED_GT_STRICT_HTML: '1',
    PILOTDECK_ASSISTANT_COMPLETION_GATE: 'shadow',
    PILOTDECK_RESEARCH_DOCX_BASENAME_FUZZY: 'shadow',
    PILOTDECK_SDM_HEAL_RESEARCH_LITE: 'shadow',
    PILOTDECK_DISTILL_SDM: 'shadow',
    PILOTDECK_BLOCK_SILENT_RESEARCH_ADD: 'shadow',
    PILOTDECK_OPEN_HTML_MIN_SDM: 'off',
    PILOTDECK_PPT_EXPORT_DEFAULT_POLICY: '1',
    PILOTDECK_CN_COMPLIANCE_BINDING: '1',
    VITE_HUB_ENTERPRISE_COMPLIANCE_TAB: 'shadow',
    PILOTDECK_ORCH_BYPASS_MATRIX_GEO: '1',
    PILOTDECK_MATRIX_CORE_GT_PASS: '1',
    PILOTDECK_PARALLEL_GEO_STAGES: 'off',
    // PD-SAAS-FORK workbench yield: sequential shadow-first (enforce only after brief contract stable)
    PILOTDECK_SEQUENTIAL_DELIVERABLES: 'shadow',
    PILOTDECK_DELIVERABLE_BRIEF_CONTRACT: 'shadow',
    PILOTDECK_INFER_CAPABILITY_CONTEXT: 'shadow',
    PILOTDECK_TRY_PROMPT_CONTRACT_V2: '1',
    PILOTDECK_PARALLEL_OFFICE_EXPORT: 'off',
    PILOTDECK_PARALLEL_WRITE_FILE: 'shadow',
    PILOTDECK_HTML_FORMAL_ACCEPTANCE: 'shadow',
    PILOTDECK_TASK_STAGE_BUDGET: 'shadow',
    PILOTDECK_EXPENSIVE_INTENT_CLARIFY: 'shadow',
    PILOTDECK_KIND_MENTION_SANITIZE: 'enforce',
    PILOTDECK_TOOL_WATCHDOG: '1',
    PILOTDECK_BLOCK_DELIVERABLE_SUBAGENT: '1',
    PILOTDECK_OFFICE_EXTENSION_STRICT: 'shadow',
    PILOTDECK_AUTOORCH_PRESERVE_DELIVERABLE_TOOLS: '1',
    PILOTDECK_NOVA_SLIDE_IMAGE_PARALLEL: '2',
    PILOTDECK_HF_KEY_OPTIONAL_DEGRADE: '0',
    // PD-SAAS-FORK P0-7: production stays off until shadow evidence is reviewed.
    PILOTDECK_CONTENT_QUALITY_V2: 'off',
    // PD-SAAS-FORK: product marketing site (SEO/GEO) — Bridge serves deploy/marketing
    PILOTDECK_MARKETING_SITE: '1',
    PILOTDECK_MARKETING_CONTACT: '1',
    PILOTDECK_REGISTER_INVITE_CODE: '1',
    PILOTDECK_MARKETING_ANALYTICS: '1',
    PILOTDECK_SHOWCASE_SITE: 'on',
    PILOTDECK_SHOWCASE_ADMIN: 'shadow',
    PILOTDECK_MARKETING_I18N: '1',
    PILOTDECK_MARKETING_PAGES_CMS: '1',
    PILOTDECK_UI_DELIVERABLE_CERTIFICATE: '0',
    PILOTDECK_UI_EXPORT_SNAPSHOT_V2: '0',
    PILOTDECK_UI_EXPORT_USER_AUDIT_MODES: '0',
    PILOTDECK_WEB_PERMISSION_MODE: 'bypassPermissions',
    PILOTDECK_HYPERFRAMES_ENGINE: 'shadow',
    PILOTDECK_HYPERFRAMES_HUB_V2: '1',
    PILOTDECK_HYPERFRAMES_MAX_CONCURRENT: '1',
  };
  for (const [key, val] of Object.entries(perfDefaults)) {
    if (!deployEnvLines.some((line) => line.startsWith(`${key}=`))) {
      deployEnvLines.push(`${key}=${val}`);
    }
  }
  if (ossUrl) {
    deployEnvLines.push(`NOVA_BUNDLE_URL=${ossUrl}/nova-latest.tar.gz`);
  }
  if (!deployEnvLines.some((l) => l.startsWith('PILOTDECK_SAAS_MODE='))) {
    deployEnvLines.push('PILOTDECK_SAAS_MODE=1', 'PILOTDECK_DISABLE_LOCAL_AUTH=0');
  }
  writeFileSync(join(STAGING, 'deploy.env'), deployEnvLines.join('\n') + '\n');

  const histRunbookSrc = join(REPO_ROOT, 'docs/history-messages-deploy-runbook.zh-CN.md');
  if (existsSync(histRunbookSrc)) {
    copyFileSync(histRunbookSrc, join(STAGING, 'HISTORY-MESSAGES-DEPLOY.md'));
  }

  const composeName = dbBackend === 'postgres' ? 'docker-compose.prod.pg.yml' : 'docker-compose.prod.yml';
  copyFileSync(join(DEPLOY_DIR, composeName), join(STAGING, composeName));
  copyFileSync(join(DEPLOY_DIR, 'nginx.conf'), join(STAGING, 'nginx.conf'));
  copyFileSync(join(DEPLOY_DIR, 'nginx.conf.cached'), join(STAGING, 'nginx.conf.cached'));
  copyFileSync(join(DEPLOY_DIR, 'nginx-https.conf'), join(STAGING, 'nginx-https.conf'));
  copyFileSync(join(DEPLOY_DIR, 'nginx-https.conf.cached'), join(STAGING, 'nginx-https.conf.cached'));
  copyFileSync(join(DEPLOY_DIR, 'nginx-https-aliyun.conf'), join(STAGING, 'nginx-https-aliyun.conf'));
  copyFileSync(join(DEPLOY_DIR, 'nginx-cache-http.conf'), join(STAGING, 'nginx-cache-http.conf'));
  copyFileSync(join(DEPLOY_DIR, 'nginx-cache-brotli.conf.optional'), join(STAGING, 'nginx-cache-brotli.conf.optional'));
  copyFileSync(join(DEPLOY_DIR, 'nginx-nova-locations.conf'), join(STAGING, 'nginx-nova-locations.conf'));
  writeShellScript(join(STAGING, 'setup-https.sh'), join(__dirname, 'setup-https.sh'));
  writeShellScript(join(STAGING, 'setup-https-aliyun.sh'), join(__dirname, 'setup-https-aliyun.sh'));
  writeShellScript(join(STAGING, 'recover-https-aliyun.sh'), join(__dirname, 'recover-https-aliyun.sh'));
  writeShellScript(join(STAGING, 'install-ssl-https.sh'), join(__dirname, 'install-ssl-https.sh'));
  writeShellScript(join(STAGING, 'nginx-site.sh'), join(__dirname, 'nginx-site.sh'));
  writeShellScript(join(STAGING, 'wipe-user-data.sh'), join(__dirname, 'wipe-user-data.sh'));
  writeShellScript(join(STAGING, 'wipe-admin-data.sh'), join(__dirname, 'wipe-admin-data.sh'));
  writeShellScript(join(STAGING, 'install.sh'), join(__dirname, 'remote-install.sh'));
  writeShellScript(join(STAGING, 'upgrade.sh'), join(__dirname, 'remote-upgrade.sh'));
  writeShellScript(join(STAGING, 'verify-export-runtime.sh'), join(__dirname, 'verify-export-runtime.sh'));
  writeShellScript(join(STAGING, 'verify-cloud-runtime.sh'), join(__dirname, 'verify-cloud-runtime.sh'));
  writeShellScript(join(STAGING, 'verify-cloud-perf.sh'), join(__dirname, 'verify-cloud-perf.sh'));
  writeShellScript(join(STAGING, 'apply-cloud-perf-env.sh'), join(__dirname, 'apply-cloud-perf-env.sh'));
  writeShellScript(join(STAGING, 'run-cloud-diag.sh'), join(__dirname, 'run-cloud-diag.sh'));
  writeShellScript(join(STAGING, 'sync-showcase-data.sh'), join(__dirname, 'sync-showcase-data.sh'));
  if (withSsl) {
    stageSslBundle(STAGING);
  }
  writeFileSync(join(STAGING, 'VERSION'), VERSION);
  const manifestFiles = ['app/', 'deploy.env', 'HISTORY-MESSAGES-DEPLOY.md', composeName, 'nginx.conf', 'install.sh', 'upgrade.sh', 'verify-export-runtime.sh', 'verify-cloud-runtime.sh', 'wipe-user-data.sh', 'wipe-admin-data.sh', 'setup-https.sh', 'setup-https-aliyun.sh', 'recover-https-aliyun.sh', 'install-ssl-https.sh', 'nginx-site.sh'];
  if (!upgradeOnly) manifestFiles.splice(1, 0, 'data.tar.gz');
  if (withSsl) manifestFiles.push('ssl/');
  writeFileSync(join(STAGING, 'MANIFEST.json'), JSON.stringify({
    version: VERSION,
    dbBackend,
    mode: upgradeOnly ? 'slim-upgrade' : 'slim',
    builtAt: new Date().toISOString(),
    note: withSsl
      ? '无 image.tar；含 ssl/；upgrade 自动配置 HTTPS；docker build 安装全部运行时依赖'
      : '无 image.tar；服务器 docker compose build --no-cache 安装全部运行时依赖',
    historyMessagesAccel: {
      doc: 'docs/history-messages-deploy-runbook.zh-CN.md',
      phaseA: { env: 'PILOTDECK_HISTORY_SANITIZE=1', verify: 'npm run test:cloud:chat-load' },
      phaseB: { env: 'PILOTDECK_HISTORY_TAIL_READ=1', target: 'messages tail120 P95 <1.5s, body P95 <500KB' },
      phaseC: { env: 'PILOTDECK_HISTORY_MESSAGE_CACHE=1', requires: 'REDIS_URL' },
      rollback: 'set flags=0 and docker compose up -d --no-deps --force-recreate nova',
    },
    runtimeDependencies: RUNTIME_DEPS_ROWS.map(([capability, install, verify]) => ({
      capability,
      installOnServer: install,
      verifyWith: verify,
    })),
    files: manifestFiles
      .concat(dbBackend === 'postgres' && !upgradeOnly ? ['postgres.dump'] : []),
  }, null, 2) + '\n');

  rmSync(dataStaging, { recursive: true, force: true });

  const bundlePath = join(OUT_ROOT, `nova-${VERSION}.tar.gz`);
  const latestPath = join(OUT_ROOT, 'nova-latest.tar.gz');
  const showcaseDataPath = join(OUT_ROOT, 'showcase-data.tar.gz');
  mkdirSync(OUT_ROOT, { recursive: true });

  console.log('[pack] 打 tar.gz...');
  await createTarGzFromStaging(bundlePath, STAGING);
  copyFileSync(bundlePath, latestPath);

  // Side-car: showcase media for DATA_ROOT/marketing-showcase (shadow overlay). Never tenants.
  const showcaseSrc = join(REPO_ROOT, 'deploy', 'marketing', 'showcase');
  const showcaseStage = join(OUT_ROOT, 'showcase-staging', 'marketing-showcase');
  rmSync(join(OUT_ROOT, 'showcase-staging'), { recursive: true, force: true });
  mkdirSync(showcaseStage, { recursive: true });
  for (const sub of ['media', 'assets']) {
    const src = join(showcaseSrc, sub);
    if (existsSync(src)) {
      cpNoDeps(src, join(showcaseStage, sub));
    }
  }
  console.log('[pack] 打 showcase-data.tar.gz（仅演示案例 media/assets，不含租户数据）...');
  run('tar', ['-czf', showcaseDataPath, '-C', join(OUT_ROOT, 'showcase-staging'), 'marketing-showcase']);
  rmSync(join(OUT_ROOT, 'showcase-staging'), { recursive: true, force: true });
  writeShellScript(join(OUT_ROOT, 'install.sh'), join(__dirname, 'remote-install.sh'));
  writeShellScript(join(OUT_ROOT, 'upgrade.sh'), join(__dirname, 'remote-upgrade.sh'));
  writeShellScript(join(OUT_ROOT, 'verify-export-runtime.sh'), join(__dirname, 'verify-export-runtime.sh'));
  writeShellScript(join(OUT_ROOT, 'wipe-user-data.sh'), join(__dirname, 'wipe-user-data.sh'));
  writeShellScript(join(OUT_ROOT, 'wipe-admin-data.sh'), join(__dirname, 'wipe-admin-data.sh'));
  writeShellScript(join(OUT_ROOT, 'setup-https.sh'), join(__dirname, 'setup-https.sh'));
  writeShellScript(join(OUT_ROOT, 'setup-https-aliyun.sh'), join(__dirname, 'setup-https-aliyun.sh'));
  writeShellScript(join(OUT_ROOT, 'nginx-site.sh'), join(__dirname, 'nginx-site.sh'));
  writeShellScript(join(OUT_ROOT, 'recover-https-aliyun.sh'), join(__dirname, 'recover-https-aliyun.sh'));
  writeShellScript(join(OUT_ROOT, 'install-ssl-https.sh'), join(__dirname, 'install-ssl-https.sh'));
  writeShellScript(join(OUT_ROOT, 'verify-cloud-runtime.sh'), join(__dirname, 'verify-cloud-runtime.sh'));
  writeShellScript(join(OUT_ROOT, 'verify-cloud-perf.sh'), join(__dirname, 'verify-cloud-perf.sh'));
  writeShellScript(join(OUT_ROOT, 'apply-cloud-perf-env.sh'), join(__dirname, 'apply-cloud-perf-env.sh'));
  writeShellScript(join(OUT_ROOT, 'run-cloud-diag.sh'), join(__dirname, 'run-cloud-diag.sh'));
  writeShellScript(join(OUT_ROOT, 'sync-showcase-data.sh'), join(__dirname, 'sync-showcase-data.sh'));
  copyFileSync(join(DEPLOY_DIR, 'nginx-https-aliyun.conf'), join(OUT_ROOT, 'nginx-https-aliyun.conf'));
  copyFileSync(join(DEPLOY_DIR, 'nginx-nova-locations.conf'), join(OUT_ROOT, 'nginx-nova-locations.conf'));
  copyFileSync(join(DEPLOY_DIR, 'nginx-cache-http.conf'), join(OUT_ROOT, 'nginx-cache-http.conf'));
  copyFileSync(join(DEPLOY_DIR, 'nginx-cache-brotli.conf.optional'), join(OUT_ROOT, 'nginx-cache-brotli.conf.optional'));

  console.log(`[pack] 完成: ${bundlePath}`);
  console.log(`[pack] 演示案例旁路包: ${showcaseDataPath}`);
  const bundleName = `nova-${VERSION}.tar.gz`;
  const serverBundleUrl = ossUrl ? `${ossUrl}/${bundleName}` : '';
  const latestUrl = ossUrl ? `${ossUrl}/nova-latest.tar.gz` : '';
  const showcaseUrl = ossUrl ? `${ossUrl}/showcase-data.tar.gz` : '';

  const instructions = [
    '# Nova 发布包 — 服务器更新说明',
    '',
    `版本: ${VERSION}`,
    `本地包: ${bundlePath}`,
    `演示案例包: ${showcaseDataPath}`,
    withSsl ? '**本包含 ssl/ 证书**：升级后自动配置 HTTPS（写入 https-aliyun.env，后续升级不覆盖）' : '',
    '',
    '## 演示案例同步（本包含 showcase；其它数据以线上为准）',
    '',
    '- 本包为 **upgrade-only**：不含 `data.tar.gz`，**不会**覆盖线上租户 / 对话 / 项目文件。',
    '- 镜像内已含 `deploy/marketing/showcase`（目录页 + 案例 media）。',
    '- 另附 `showcase-data.tar.gz`：仅同步到主机 `DATA_ROOT/marketing-showcase`（shadow 覆盖层），解决线上缺封面/缺媒体。',
    '',
    '```bash',
    '# 1) 升级应用（无租户数据）',
    ossUrl
      ? `sudo bash /opt/nova-ai-studio/upgrade.sh --bundle ${latestUrl}`
      : 'sudo bash /opt/nova-ai-studio/upgrade.sh --bundle <nova-latest.tar.gz URL>',
    '',
    '# 2) 仅同步演示案例 media（不动 tenants）',
    ossUrl
      ? [
          `curl -fsSL "${ossUrl}/sync-showcase-data.sh" -o /tmp/sync-showcase-data.sh`,
          `sudo bash /tmp/sync-showcase-data.sh --bundle ${showcaseUrl}`,
        ].join('\n')
      : 'sudo bash sync-showcase-data.sh --local /path/to/showcase-data.tar.gz',
    '',
    '# 3) 验收',
    'curl -fsS https://www.novapage.online/showcase/ | head',
    'sudo bash /opt/nova-ai-studio/verify-cloud-runtime.sh',
    '```',
    '',
    '## 本包已含修复',
    '- Skills 斜杠菜单 / Hub「试一下」预填',
    '- 文件树打开路径（侧栏点文件）',
    '- PDF/DOC/PPT 导出（Dockerfile 内 Playwright + python-pptx，build 时装）',
    '- 登录后 N2 加载页 + SW v4',
    '- upgrade 后保留 HTTPS（https-aliyun.env + nginx-site.sh）',
    '- 项目图渐进加载（sharp 缩略图 + Nginx proxy_cache + Cache-Control）',
    '- Gateway 运行时 patchHiddenConsole（dist/scripts/lib）',
    '- **对话历史加载加速**（sanitize / tail-read / 可选 Redis 尾页缓存，见下）',
    '- **不含** 仓库 `about/` 目录（品牌/市场文档仅本地）',
    '',
    '## 对话历史 messages 加速 — 生产 .env 分阶段配置',
    '',
    '> **upgrade 不覆盖** `/opt/nova-ai-studio/.env`；存量 ECS 发版后须**手工追加**下列变量并 recreate Nova 容器。',
    '> 权威运维：`docs/history-messages-deploy-runbook.zh-CN.md`',
    '',
    '| 阶段 | 写入 `.env` | 验收 |',
    '|------|-------------|------|',
    '| **A** sanitize | `PILOTDECK_HISTORY_SANITIZE=1` | `npm run test:cloud:chat-load`（或 `diag-cloud-all-sessions.mjs`）确认 tail120 **<500KB** |',
    '| **B** tail read | `PILOTDECK_HISTORY_TAIL_READ=1` | 同上 + API **P95 <1.5s** |',
    '| **C** 可选缓存 | `PILOTDECK_HISTORY_MESSAGE_CACHE=1` + `CACHE_TTL_MESSAGES_SEC=120` | 须已配 `REDIS_URL`；二访命中 Redis |',
    '',
    '```bash',
    '# 一键（推荐）：合并 A+B+C + catalog + Redis TTL，不覆盖密钥',
    'sudo bash /opt/nova-ai-studio/apply-cloud-perf-env.sh',
    '',
    '# 或分阶段手工（见 docs/history-messages-deploy-runbook.zh-CN.md）',
    'sudo bash /opt/nova-ai-studio/verify-cloud-perf.sh',
    'sudo bash /opt/nova-ai-studio/run-cloud-diag.sh',
    '```',
    '',
    '回滚：上述 flag 设为 `0`，再执行 `docker compose up -d --no-deps --force-recreate nova`；**无需**重建 UI 或改 JSONL 数据。',
    '',
    '## 云端依赖（upgrade 时 `docker compose build --no-cache` 自动安装，勿手工 apt/pnpm）',
    '',
    '| 能力 | 服务器安装命令（Dockerfile.prod） | 校验 |',
    '|------|--------------------------------|------|',
    ...RUNTIME_DEPS_ROWS.map(([cap, install, verify]) => `| ${cap} | ${install} | ${verify} |`),
    '',
    '升级后校验: `sudo bash /opt/nova-ai-studio/verify-cloud-runtime.sh`',
    '',
    '## 一键开启缓存/对话加速（不必整包升级）',
    '',
    ossUrl
      ? [
          '脚本与 `upgrade.sh` 同级：`dist-release/apply-cloud-perf-env.sh`（tar 包根目录亦有）。',
          'OSS：`' + ossUrl + '/apply-cloud-perf-env.sh`（**nova-ai-studio 前缀，不新建目录**）。',
          '',
          '```bash',
          `curl -fsSL "${ossUrl}/apply-cloud-perf-env.sh" -o /tmp/apply-cloud-perf-env.sh`,
          'sudo bash /tmp/apply-cloud-perf-env.sh',
          '```',
        ].join('\n')
      : '（配置 OSS 后打包，见 deploy/env.local）',
    '',
    '## HTTPS 恢复（未随包带证书时）',
    '',
    '```bash',
    '# 证书放到 /opt/nova-ai-studio/ssl/ 后：',
    'sudo bash /opt/nova-ai-studio/install-ssl-https.sh',
    '# 或一键恢复：',
    'curl -fsSL "' + (ossUrl || 'https://<OSS>/nova-ai-studio') + '/recover-https-aliyun.sh" | sudo bash -s --',
    '```',
    '',
    '阿里云安全组须放行 **TCP 443**。',
    '',
    '## 无需本机 ossutil（任选一种）',
    '',
    '### A) ECS 上 curl 下载（推荐：包先传到 OSS 控制台）',
    ossUrl
      ? [
          `1. 阿里云 OSS 控制台上传 ${bundleName} → ${ossUrl}/nova-latest.tar.gz`,
          '2. SSH 登录 ECS：',
          `   echo 'NOVA_BUNDLE_URL=${latestUrl}' | sudo tee -a /opt/nova-ai-studio/.env`,
          '   curl -fsSL "' + ossUrl + '/upgrade.sh" -o /tmp/upgrade.sh',
          '   sudo bash /tmp/upgrade.sh',
        ].join('\n')
      : '（deploy/env.local 未配置 OSS，请用方式 B）',
    '',
    '### B) scp 到 ECS 本地升级',
    '```bash',
    `scp dist-release/${bundleName} root@<ECS-IP>:/opt/nova-ai-studio/incoming/`,
    'ssh root@<ECS-IP>',
    `sudo bash /opt/nova-ai-studio/incoming/upgrade.sh --local /opt/nova-ai-studio/incoming/${bundleName}`,
    '```',
    '',
    '### C) 本机有 ossutil',
    upload ? '（已尝试上传）' : `npm run pack:deploy -- --upload`,
    '',
  ].join('\n');
  writeFileSync(join(OUT_ROOT, 'DEPLOY.md'), instructions);
  console.log('');
  console.log(instructions);

  if (upload) {
    const bucket = envLocal.OSS_BUCKET || process.env.OSS_BUCKET;
    const endpoint = envLocal.OSS_ENDPOINT || 'oss-cn-hangzhou.aliyuncs.com';
    const prefix = (envLocal.OSS_PREFIX || 'nova-ai-studio').replace(/\/$/, '');
    if (!bucket) {
      console.error('[pack] 上传需 OSS_BUCKET');
      process.exit(1);
    }
    const ossBase = `oss://${bucket}/${prefix}`;
    const uploadOk = (cmd, args) => {
      const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
      return r.status === 0;
    };
    if (!uploadOk('ossutil', ['cp', '-f', bundlePath, `${ossBase}/nova-latest.tar.gz`])) {
      console.warn('[pack] 本机 ossutil 不可用，请用 OSS 控制台上传或 ECS --local 升级（见 DEPLOY.md）');
    } else {
      uploadOk('ossutil', ['cp', '-f', bundlePath, `${ossBase}/${bundleName}`]);
      uploadOk('ossutil', ['cp', '-f', join(OUT_ROOT, 'install.sh'), `${ossBase}/install.sh`]);
      uploadOk('ossutil', ['cp', '-f', join(OUT_ROOT, 'upgrade.sh'), `${ossBase}/upgrade.sh`]);
      uploadOk('ossutil', ['cp', '-f', join(OUT_ROOT, 'verify-export-runtime.sh'), `${ossBase}/verify-export-runtime.sh`]);
      uploadOk('ossutil', ['cp', '-f', join(OUT_ROOT, 'setup-https-aliyun.sh'), `${ossBase}/setup-https-aliyun.sh`]);
      uploadOk('ossutil', ['cp', '-f', join(OUT_ROOT, 'nginx-site.sh'), `${ossBase}/nginx-site.sh`]);
      uploadOk('ossutil', ['cp', '-f', join(OUT_ROOT, 'recover-https-aliyun.sh'), `${ossBase}/recover-https-aliyun.sh`]);
      uploadOk('ossutil', ['cp', '-f', join(OUT_ROOT, 'install-ssl-https.sh'), `${ossBase}/install-ssl-https.sh`]);
      uploadOk('ossutil', ['cp', '-f', join(OUT_ROOT, 'verify-cloud-runtime.sh'), `${ossBase}/verify-cloud-runtime.sh`]);
      uploadOk('ossutil', ['cp', '-f', join(OUT_ROOT, 'verify-cloud-perf.sh'), `${ossBase}/verify-cloud-perf.sh`]);
      uploadOk('ossutil', ['cp', '-f', join(OUT_ROOT, 'apply-cloud-perf-env.sh'), `${ossBase}/apply-cloud-perf-env.sh`]);
      uploadOk('ossutil', ['cp', '-f', join(OUT_ROOT, 'run-cloud-diag.sh'), `${ossBase}/run-cloud-diag.sh`]);
      uploadOk('ossutil', ['cp', '-f', join(OUT_ROOT, 'sync-showcase-data.sh'), `${ossBase}/sync-showcase-data.sh`]);
      if (existsSync(showcaseDataPath)) {
        uploadOk('ossutil', ['cp', '-f', showcaseDataPath, `${ossBase}/showcase-data.tar.gz`]);
      }
      uploadOk('ossutil', ['cp', '-f', join(OUT_ROOT, 'nginx-https-aliyun.conf'), `${ossBase}/nginx-https-aliyun.conf`]);
      uploadOk('ossutil', ['cp', '-f', join(OUT_ROOT, 'nginx-nova-locations.conf'), `${ossBase}/nginx-nova-locations.conf`]);
      uploadOk('ossutil', ['cp', '-f', join(OUT_ROOT, 'nginx-cache-http.conf'), `${ossBase}/nginx-cache-http.conf`]);
      console.log(`curl -fsSL ${ossUrl}/upgrade.sh | sudo bash -s --`);
      if (showcaseUrl) {
        console.log(`[pack] 演示案例: sudo bash sync-showcase-data.sh --bundle ${showcaseUrl}`);
      }
    }
  }

  rmSync(STAGING, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
