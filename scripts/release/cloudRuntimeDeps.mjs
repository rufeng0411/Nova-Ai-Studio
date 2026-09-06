/**
 * PD-SAAS-FORK: 云端运行时依赖清单（preflight / pack MANIFEST / DEPLOY 共用）
 */
export const DOCKERFILE_APT_PACKAGES = [
  'python3', 'python3-pip', 'make', 'g++', 'ripgrep', 'git', 'curl', 'procps',
];

export const DOCKERFILE_PIP_PACKAGES = ['python-pptx', 'Pillow', 'requests'];

export const DOCKERFILE_NPM_GLOBAL = ['pnpm@10.32.1', 'tsx', 'concurrently'];

export const DOCKERFILE_NEEDLES = [
  'python-pptx',
  'Pillow',
  'requests',
  'playwright install-deps chromium',
  'playwright install chromium',
  'pnpm install --prod',
  'ui/scripts/fix-node-pty.js',
  'ui/src/shared',
];

/** pnpm install 后容器内须可 import 的 Node 原生/重依赖 */
export const NODE_RUNTIME_PACKAGES = [
  { name: 'sharp', workspace: 'ui', purpose: '缩略图 / 头像裁剪' },
  { name: 'playwright', workspace: 'ui', purpose: 'HTML→PDF' },
];

export const PACKED_SERVER_MODULES = [
  'ui/server/utils/projectFileCacheHeaders.js',
  'ui/server/utils/projectThumbnail.js',
];

/** Gateway dist 运行时须存在的脚本（dist/src/cli 相对 ../../scripts 解析到 dist/scripts） */
export const PACKED_DIST_RUNTIME_SCRIPTS = [
  'dist/scripts/lib/patchHiddenConsole.mjs',
  'dist/scripts/lib/mcpFeatureFlags.mjs',
  'dist/ui/shared/htmlDeliverableRules.mjs',
  'dist/ui/shared/deliverableBinaryRules.mjs',
  'dist/ui/shared/deliverableSessionGoal.mjs',
  'dist/ui/shared/repairEligiblePath.mjs',
];

export const NGINX_MEDIA_CACHE_MARKERS = [
  '/api/projects/[^/]+/files/content',
  '/api/projects/[^/]+/files/thumbnail',
  'proxy_cache nova_static',
  'nginx-cache-http.conf',
];

export const RUNTIME_DEPS_ROWS = [
  ['Node 生产依赖', 'pnpm install --prod（Dockerfile）', '容器 /app/node_modules'],
  ['PDF 导出', 'npx playwright install-deps chromium + install chromium', 'verify-export-runtime.sh'],
  ['PPTX 导出', 'pip3: python-pptx Pillow requests', 'python3 -c import pptx/requests/PIL'],
  ['图片缩略图', 'pnpm: sharp（ui workspace）', 'node -e import sharp'],
  ['注册验证码', 'compose: redis:7-alpine', 'redis-cli PONG'],
  ['项目图缓存', 'Nginx proxy_cache + Cache-Control', 'nginx-nova-locations.conf + verify-cloud-runtime'],
  ['HTTPS', 'install-ssl-https.sh / https-aliyun.env', 'ss :443'],
];

export function assertDockerfileProd(dockerText, fail) {
  for (const needle of DOCKERFILE_NEEDLES) {
    if (!dockerText.includes(needle)) {
      fail(`deploy/Dockerfile.prod 缺少: ${needle}`);
    }
  }
}

export function assertPackedServerModules(repoRoot, existsSync, join, fail) {
  for (const rel of PACKED_SERVER_MODULES) {
    if (!existsSync(join(repoRoot, rel))) {
      fail(`缺少云端模块 ${rel}`);
    }
  }
}

export function assertPackedDistRuntimeScripts(repoRoot, existsSync, join, fail) {
  for (const rel of PACKED_DIST_RUNTIME_SCRIPTS) {
    if (!existsSync(join(repoRoot, rel))) {
      fail(`缺少 Gateway 运行时 ${rel}（npm run build 应执行 copy-dist-runtime.mjs）`);
    }
  }
}

export function assertNginxMediaCache(nginxText, fail) {
  if (!nginxText.includes('/files/content')) {
    fail('deploy/nginx-nova-locations.conf 缺少 /files/content 边缘缓存');
  }
  if (!nginxText.includes('/files/thumbnail')) {
    fail('deploy/nginx-nova-locations.conf 缺少 /files/thumbnail 边缘缓存');
  }
  if (!nginxText.includes('proxy_cache nova_static')) {
    fail('deploy/nginx-nova-locations.conf 缺少 proxy_cache nova_static');
  }
}

export function assertUiPackageJson(uiPkgText, fail) {
  if (!/"sharp"\s*:/.test(uiPkgText)) {
    fail('ui/package.json 缺少 sharp（缩略图 API 依赖）');
  }
}
