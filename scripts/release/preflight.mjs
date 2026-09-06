#!/usr/bin/env node
/**
 * 打包前检查：数据、配置、工具链是否就绪
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import {
  assertDockerfileProd,
  assertNginxMediaCache,
  assertPackedServerModules,
  assertPackedDistRuntimeScripts,
  assertUiPackageJson,
  RUNTIME_DEPS_ROWS,
} from './cloudRuntimeDeps.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const ENV_LOCAL = join(REPO_ROOT, 'deploy', 'env.local');

function parseEnv(text) {
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

function ok(msg) { console.log(`  ✓ ${msg}`); }
function warn(msg) { console.log(`  ⚠ ${msg}`); }
function fail(msg) { console.log(`  ✗ ${msg}`); errors.push(msg); }

const errors = [];
const warnings = [];

console.log('[preflight] Nova 发布包检查\n');

if (!existsSync(ENV_LOCAL)) {
  fail(`缺少 deploy/env.local（请复制 deploy/env.example）`);
} else {
  ok('deploy/env.local 存在');
  const env = parseEnv(readFileSync(ENV_LOCAL, 'utf8'));
  const dbUrl = env.SAAS_DATABASE_URL?.trim() || '';
  const isPg = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');
  console.log(`  数据库模式: ${isPg ? 'PostgreSQL' : 'SQLite'}`);

  if (!env.JWT_SECRET || env.JWT_SECRET.includes('请改为')) {
    fail('JWT_SECRET 仍是占位符，请生成随机串');
  } else {
    ok('JWT_SECRET 已设置');
  }

  if (!env.DEPLOY_DOMAIN?.trim()) {
    warnings.push('DEPLOY_DOMAIN 为空，上传 OSS 前请填写；安装时可用 --domain 指定');
  } else if (env.DEPLOY_DOMAIN.includes('example.com')) {
    warnings.push('DEPLOY_DOMAIN 仍是示例域名');
  }

  if (!env.OSS_BUCKET?.trim()) {
    warnings.push('OSS_BUCKET 为空，仅打包可继续；上传请填写或用手动上传 dist-release/');
  }

  const dataRoot = resolve(env.DATA_ROOT || join(REPO_ROOT, '.saas-dev-data'));
  const pilotHome = resolve(env.PILOT_HOME || join(homedir(), '.pilotdeck'));

  if (!isPg) {
    const controlDb = join(dataRoot, 'control.db');
    if (!existsSync(controlDb)) fail(`SQLite 需要 ${controlDb}`);
    else ok(`control.db (${Math.round(statSync(controlDb).size / 1024)} KB)`);
  } else {
    if (dbUrl.includes('YOUR_PASSWORD')) fail('SAAS_DATABASE_URL 仍是占位密码');
    else ok('SAAS_DATABASE_URL 已配置');
    const pgDump = process.env.PG_DUMP
      || (process.platform === 'win32' ? 'D:\\pgsql\\bin\\pg_dump.exe' : 'pg_dump');
    if (!existsSync(pgDump)) {
      const which = spawnSync('pg_dump', ['--version'], { shell: true });
      if (which.status !== 0) fail(`找不到 pg_dump（${pgDump}）`);
      else ok('pg_dump 在 PATH 中');
    } else ok(`pg_dump: ${pgDump}`);
  }

  const tenants = join(dataRoot, 'tenants');
  if (!existsSync(tenants)) warnings.push(`无租户目录 ${tenants}`);
  else ok(`租户目录存在: ${tenants}`);

  const yaml = join(pilotHome, 'pilotdeck.yaml');
  if (!existsSync(yaml)) fail(`缺少 ${yaml}`);
  else {
    ok(`pilotdeck.yaml (${Math.round(statSync(yaml).size / 1024)} KB)`);
    const yamlText = readFileSync(yaml, 'utf8');
    if (/databasePath:\s*[A-Za-z]:\\/m.test(yamlText)) {
      warnings.push('pilotdeck.yaml 含 Windows databasePath，pack 将自动剔除；请确认本机路径不会进云端');
    }
  }

  const authDb = join(pilotHome, 'auth.db');
  if (!existsSync(authDb)) warnings.push('无 auth.db（首次 SaaS 可能仍可用）');
  else ok('auth.db 存在');

  const projectsSrc = join(pilotHome, 'projects');
  if (existsSync(projectsSrc)) {
    try {
      let bytes = 0;
      const walk = (d) => {
        for (const name of readdirSync(d, { withFileTypes: true })) {
          const p = join(d, name.name);
          if (name.isDirectory()) walk(p);
          else bytes += statSync(p).size;
        }
      };
      walk(projectsSrc);
      if (bytes > 50 * 1024 * 1024) {
        warnings.push(`~/.pilotdeck/projects 约 ${Math.round(bytes / 1024 / 1024)}MB，pack 已默认跳过`);
      }
    } catch { /* ignore */ }
  }

  const skills = join(pilotHome, 'skills');
  if (!existsSync(skills)) warnings.push('~/.pilotdeck/skills 不存在（镜像内 skills 仍会带上）');
  else ok('~/.pilotdeck/skills 存在');
}

ok('本机轻量打包无需 Docker（依赖在服务器 build 时安装）');

for (const f of [
  'deploy/Dockerfile.prod', 'docker-entrypoint.sh',
  'deploy/docker-compose.prod.yml', 'deploy/docker-compose.prod.pg.yml',
  'deploy/nginx.conf', 'scripts/release/pack.mjs',
  'scripts/release/remote-install.sh', 'scripts/release/remote-upgrade.sh',
  'scripts/release/install-ssl-https.sh', 'scripts/release/recover-https-aliyun.sh',
  'scripts/release/verify-cloud-runtime.sh',
]) {
  if (!existsSync(join(REPO_ROOT, f))) fail(`缺少 ${f}`);
}
ok('发布脚本与 Dockerfile.prod 齐全');

const dockerProd = readFileSync(join(REPO_ROOT, 'deploy/Dockerfile.prod'), 'utf8');
assertDockerfileProd(dockerProd, fail);
ok('Dockerfile.prod 含 pnpm / Playwright / python-pptx / requests / ui/src/shared');

assertPackedServerModules(REPO_ROOT, existsSync, join, fail);
ok('云端图片缓存与缩略图模块已打包');

if (existsSync(join(REPO_ROOT, 'dist', 'src', 'cli', 'pilotdeck.js'))) {
  assertPackedDistRuntimeScripts(REPO_ROOT, existsSync, join, fail);
  ok('Gateway dist 运行时脚本与 ui/shared 镜像齐全');
} else {
  warnings.push('尚未 npm run build，pack 时会自动编译并校验 dist/ 运行时');
}

const nginxLoc = readFileSync(join(REPO_ROOT, 'deploy/nginx-nova-locations.conf'), 'utf8');
assertNginxMediaCache(nginxLoc, fail);
ok('nginx-nova-locations.conf 含项目图/缩略图边缘缓存');

const uiPkg = readFileSync(join(REPO_ROOT, 'ui/package.json'), 'utf8');
assertUiPackageJson(uiPkg, fail);
ok('ui/package.json 含 sharp（缩略图）');

console.log('  云端依赖安装（upgrade 时 docker build --no-cache 自动执行）：');
for (const [cap, install] of RUNTIME_DEPS_ROWS) {
  console.log(`    · ${cap}: ${install}`);
}

const configCatalog = join(REPO_ROOT, 'config', 'capabilities.catalog.json');
if (!existsSync(configCatalog)) warnings.push('capabilities.catalog.json 不存在，pack 会自动生成');
else ok('capabilities.catalog.json 存在');

// PD-SAAS-FORK: product marketing site must ship with pack
const marketingIndex = join(REPO_ROOT, 'deploy', 'marketing', 'index.html');
const marketingDocs = join(REPO_ROOT, 'deploy', 'marketing', 'docs', 'index.html');
if (!existsSync(marketingIndex) || !existsSync(marketingDocs)) {
  fail('缺少 deploy/marketing 主站（index.html / docs/index.html）');
} else {
  ok('deploy/marketing 产品主站齐全');
}

console.log('');
if (warnings.length) {
  console.log(`[preflight] 警告 ${warnings.length} 项：`);
  for (const w of warnings) console.log(`  - ${w}`);
}
if (errors.length) {
  console.log(`[preflight] 失败 ${errors.length} 项，请先修复再打包：`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
console.log('[preflight] 通过，可执行 npm run pack:deploy');
