/**
 * PD-SAAS-FORK: Shared dev launcher core — port probing, SaaS env, infra orchestration.
 * Used by scripts/dev-saas.mjs and tools/nova-launcher Electron supervisor.
 */
import './patchHiddenConsole.mjs';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { formatLanUrls } from './lanHosts.mjs';
import { DEV_PG_URL, DEV_REDIS_URL, ensureDevInfra, resolveDevPgUrl } from './devInfra.mjs';
import { withHiddenConsoleEnv } from './hiddenConsoleEnv.mjs';


function loadCommunityDotEnv(repoRoot) {
  const envPath = join(repoRoot, '.env');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!String(process.env[key] || '').trim()) {
      process.env[key] = value;
    }
  }
}

export const MAX_PORT_TRIES = 20;
export const DEFAULT_PORTS = {
  server: 3001,
  gateway: 18789,
  vite: 5173,
};

/** Walk up from startDir to find repo root (package.json + ui/). */
export function findRepoRoot(startDir) {
  let dir = resolve(startDir);
  for (let i = 0; i < 8; i += 1) {
    try {
      const pkg = readFileSync(join(dir, 'package.json'), 'utf8');
      if (pkg.includes('"pilotdeck"') && existsSync(join(dir, 'ui'))) {
        return dir;
      }
    } catch {
      // continue
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('[devLauncherCore] Could not find Nova/PilotDeck repo root');
}

export function getSaasDataRoot(repoRoot) {
  return resolve(repoRoot, '.saas-dev-data');
}

export function readYamlPortConfig() {
  const home = process.env.PILOT_HOME || join(homedir(), '.pilotdeck');
  const configPath = process.env.PILOTDECK_CONFIG_PATH || join(home, 'pilotdeck.yaml');
  try {
    const raw = readFileSync(configPath, 'utf8');
    const config = parseYaml(raw);
    return config?.webui?.runtime ?? {};
  } catch {
    return {};
  }
}

export function parsePort(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function isPortFree(port, host = '0.0.0.0') {
  return new Promise((resolveCheck) => {
    const probe = createServer();
    probe.once('error', () => resolveCheck(false));
    probe.once('listening', () => {
      probe.close(() => resolveCheck(true));
    });
    probe.listen(port, host);
  });
}

export async function findFreePort(label, base, hardOverride, tag = 'dev-saas') {
  if (hardOverride !== undefined) {
    return { port: hardOverride, source: 'env-pinned' };
  }
  for (let offset = 0; offset < MAX_PORT_TRIES; offset += 1) {
    const candidate = base + offset;
    // eslint-disable-next-line no-await-in-loop
    const free = await isPortFree(candidate);
    if (free) {
      return {
        port: candidate,
        source: offset === 0 ? 'default' : `fallback (+${offset})`,
      };
    }
  }
  throw new Error(
    `[${tag}] Could not find a free ${label} port within ${MAX_PORT_TRIES} of ${base}.`,
  );
}

export function envPortOverride(name) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

/**
 * Candidate port triplets for probing already-running dev stacks (offset-aligned).
 * @param {{ maxOffsets?: number }} [options]
 * @returns {Array<{ server: number, gateway: number, vite: number, source: string }>}
 */
export function buildDevPortTriplets(options = {}) {
  const maxOffsets = Math.min(
    MAX_PORT_TRIES,
    Math.max(1, options.maxOffsets ?? MAX_PORT_TRIES),
  );
  const yamlRuntime = readYamlPortConfig();
  const bases = {
    server: parsePort(process.env.SERVER_PORT_BASE, yamlRuntime.serverPort ?? DEFAULT_PORTS.server),
    gateway: parsePort(process.env.PILOTDECK_GATEWAY_PORT_BASE, DEFAULT_PORTS.gateway),
    vite: parsePort(process.env.VITE_PORT_BASE, yamlRuntime.vitePort ?? DEFAULT_PORTS.vite),
  };
  const pinned = {
    server: envPortOverride('SERVER_PORT'),
    gateway: envPortOverride('PILOTDECK_GATEWAY_PORT'),
    vite: envPortOverride('VITE_PORT'),
  };

  const triplets = [];
  const seen = new Set();

  const add = (server, gateway, vite, source) => {
    const key = `${server}:${gateway}:${vite}`;
    if (seen.has(key)) return;
    seen.add(key);
    triplets.push({ server, gateway, vite, source });
  };

  if (pinned.server && pinned.gateway && pinned.vite) {
    add(pinned.server, pinned.gateway, pinned.vite, 'env-pinned');
  }

  for (let offset = 0; offset < maxOffsets; offset += 1) {
    add(
      bases.server + offset,
      bases.gateway + offset,
      bases.vite + offset,
      offset === 0 ? 'default' : `+${offset}`,
    );
  }

  return triplets;
}

/**
 * All dev port numbers from candidate triplets (for kill-on-restart sweeps).
 * @param {{ maxOffsets?: number }} [options]
 * @returns {number[]}
 */
export function collectAllDevPorts(options = {}) {
  const triplets = buildDevPortTriplets(options);
  const ports = new Set();
  for (const triplet of triplets) {
    ports.add(triplet.server);
    ports.add(triplet.gateway);
    ports.add(triplet.vite);
  }
  return [...ports];
}

/**
 * Resolve ports and build SaaS dev runtime context.
 * @param {string} repoRoot
 * @param {{ skipInfra?: boolean }} [options]
 */
export async function prepareSaasDevRuntime(repoRoot, options = {}) {
  // N2-COMMUNITY-OVERLAY: personal SaaS defaults (login-only, SQLite, no marketing site)
  loadCommunityDotEnv(repoRoot);
  if (!String(process.env.PILOTDECK_COMMUNITY_PERSONAL || '').trim()) {
    process.env.PILOTDECK_COMMUNITY_PERSONAL = '1';
  }
  if (!String(process.env.DEV_SAAS_SQLITE || '').trim()) {
    process.env.DEV_SAAS_SQLITE = '1';
  }
  if (!String(process.env.PILOTDECK_MARKETING_SITE || '').trim()) {
    process.env.PILOTDECK_MARKETING_SITE = '0';
  }
  if (!String(process.env.VITE_PILOTDECK_MARKETING_SITE || '').trim()) {
    process.env.VITE_PILOTDECK_MARKETING_SITE = '0';
  }
  if (!String(process.env.PILOTDECK_REGISTER_INVITE_CODE || '').trim()) {
    process.env.PILOTDECK_REGISTER_INVITE_CODE = '0';
  }
  const dataRoot = getSaasDataRoot(repoRoot);
  mkdirSync(dataRoot, { recursive: true });

  const useSqliteOnly = process.env.DEV_SAAS_SQLITE === '1';
  const infra = options.skipInfra || useSqliteOnly
    ? { redis: false, postgres: false, started: false, pgUrl: null }
    : await ensureDevInfra();
  const yamlRuntime = readYamlPortConfig();

  const server = await findFreePort(
    'server',
    parsePort(process.env.SERVER_PORT_BASE, yamlRuntime.serverPort ?? DEFAULT_PORTS.server),
    envPortOverride('SERVER_PORT'),
  );
  const gateway = await findFreePort(
    'gateway',
    parsePort(process.env.PILOTDECK_GATEWAY_PORT_BASE, DEFAULT_PORTS.gateway),
    envPortOverride('PILOTDECK_GATEWAY_PORT'),
  );
  const vite = await findFreePort(
    'vite',
    parsePort(process.env.VITE_PORT_BASE, yamlRuntime.vitePort ?? DEFAULT_PORTS.vite),
    envPortOverride('VITE_PORT'),
  );

  const gatewayUrl =
    process.env.PILOTDECK_GATEWAY_URL?.trim() || `ws://127.0.0.1:${gateway.port}/ws`;

  const validatedPgUrl =
    !useSqliteOnly && infra.pgUrl?.trim() ? infra.pgUrl.trim() : null;

  const env = withHiddenConsoleEnv(
    {
      ...process.env,
      PILOTDECK_SAAS_MODE: '1',
      PILOTDECK_DISABLE_LOCAL_AUTH: '0',
      DATA_ROOT: dataRoot,
      SERVER_PORT: String(server.port),
      PROXY_HOST: process.env.PROXY_HOST?.trim() || '127.0.0.1',
      PILOTDECK_GATEWAY_PORT: String(gateway.port),
      PILOTDECK_GATEWAY_URL: gatewayUrl,
      VITE_PORT: String(vite.port),
      PILOTDECK_SKIP_DEFAULT_PROJECT: '1',
      ...(infra.redis && !process.env.REDIS_URL?.trim()
        ? { REDIS_URL: DEV_REDIS_URL, REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX || 'nova:dev:' }
        : {}),
      ...(validatedPgUrl ? { SAAS_DATABASE_URL: validatedPgUrl } : {}),
      ...(process.env.SAAS_DATABASE_CONNECT_MS?.trim()
        ? {}
        : { SAAS_DATABASE_CONNECT_MS: '10000' }),
      ...(process.env.SAAS_DATABASE_POOL_MAX?.trim()
        ? {}
        : { SAAS_DATABASE_POOL_MAX: '25' }),
      // PD-SAAS-FORK: dev login fires mount + WS reconnect + shell refresh in parallel; limit=1 → 503 wedging.
      ...(process.env.PILOTDECK_BACKPRESSURE_PROJECTS?.trim()
        ? {}
        : { PILOTDECK_BACKPRESSURE_PROJECTS: '3' }),
      ...(process.env.VITE_TAIL_MESSAGE_PAGINATION === '0' || process.env.VITE_TAIL_MESSAGE_PAGINATION === 'false'
        ? {}
        : { VITE_TAIL_MESSAGE_PAGINATION: 'true' }),
      VITE_SESSION_PIPELINE_BUNDLE: process.env.VITE_SESSION_PIPELINE_BUNDLE ?? '1',
      VITE_SESSION_STORE_LRU_SLOTS: process.env.VITE_SESSION_STORE_LRU_SLOTS ?? '10',
      VITE_TAIL_PAGE_FAST_SWITCH: process.env.VITE_TAIL_PAGE_FAST_SWITCH ?? '80',
      ...(process.env.VITE_RECOVERY_SURFACE_V2?.trim()
        ? {}
        : { VITE_RECOVERY_SURFACE_V2: '1' }),
      ...(process.env.PILOTDECK_RECOVERY_SURFACE_V2?.trim()
        ? {}
        : { PILOTDECK_RECOVERY_SURFACE_V2: '1' }),
      ...(process.env.VITE_PROCESS_STEP_DETAIL_V2?.trim()
        ? {}
        : { VITE_PROCESS_STEP_DETAIL_V2: '1' }),
      ...(process.env.PILOTDECK_HISTORY_TAIL_READ?.trim()
        ? {}
        : { PILOTDECK_HISTORY_TAIL_READ: '1' }),
      ...(process.env.PILOTDECK_HISTORY_SANITIZE?.trim()
        ? {}
        : { PILOTDECK_HISTORY_SANITIZE: '1' }),
      ...(process.env.PILOTDECK_DELIVERABLE_ASYNC_RESOLVE?.trim()
        ? {}
        : { PILOTDECK_DELIVERABLE_ASYNC_RESOLVE: '1' }),
      ...(process.env.PILOTDECK_VALIDATE_PARALLEL?.trim()
        ? {}
        : { PILOTDECK_VALIDATE_PARALLEL: '3' }),
      ...(process.env.PILOTDECK_HISTORY_MESSAGE_CACHE?.trim()
        ? {}
        : { PILOTDECK_HISTORY_MESSAGE_CACHE: '1' }),
      ...(process.env.VITE_DEFER_DELIVERABLES_WHILE_STREAMING?.trim()
        ? {}
        : { VITE_DEFER_DELIVERABLES_WHILE_STREAMING: '1' }),
      ...(process.env.VITE_PILOTDECK_TASK_LIFECYCLE_UI?.trim()
        ? {}
        : { VITE_PILOTDECK_TASK_LIFECYCLE_UI: '1' }),
      // PD-SAAS-FORK: workbench beta 1.1 — local on + UX shadow; pack defaults off
      ...(process.env.VITE_WORKBENCH_BETA_11?.trim()
        ? {}
        : { VITE_WORKBENCH_BETA_11: 'on' }),
      ...(process.env.VITE_WORKBENCH_TOUR?.trim()
        ? {}
        : { VITE_WORKBENCH_TOUR: 'shadow' }),
      ...(process.env.VITE_TURN_USAGE_FOOTER?.trim()
        ? {}
        : { VITE_TURN_USAGE_FOOTER: 'shadow' }),
      ...(process.env.VITE_POST_DELIVERABLE_NEXT?.trim()
        ? {}
        : { VITE_POST_DELIVERABLE_NEXT: 'shadow' }),
      ...(process.env.SAAS_CONVERSATION_CATALOG_SHADOW?.trim()
        ? {}
        : { SAAS_CONVERSATION_CATALOG_SHADOW: '1' }),
      // PD-SAAS-FORK: dev SaaS enables Gateway canvas_* tools (UI still uses settings toggle).
      ...(process.env.PILOTDECK_DESIGN_CANVAS?.trim()
        ? {}
        : { PILOTDECK_DESIGN_CANVAS: '1' }),
      ...(process.env.PILOTDECK_HF_STUDIO?.trim()
        ? {}
        : { PILOTDECK_HF_STUDIO: '1' }),
      ...(process.env.VITE_PILOTDECK_HF_STUDIO?.trim()
        ? {}
        : { VITE_PILOTDECK_HF_STUDIO: '1' }),
      // PD-SAAS-FORK: Preflight / Bento 默认关闭；后台 config/platform-features.json 或显式 env 开启
      // Optional: PILOTDECK_PREFLIGHT_STUDIO=shadow|enforce, PILOTDECK_BENTO_DECK_EDITOR=1, VITE_BENTO_DECK_PREVIEW=1
      // OD template shadow registry (Hub invisible): PILOTDECK_OD_TEMPLATE_REGISTRY=off|shadow|1
      // PD-SAAS-FORK: Markdown 浏览器（Hub 插件）默认开；PILOTDECK_MD_BROWSER_TOOL=0 关闭
      ...(process.env.PILOTDECK_MD_BROWSER_TOOL?.trim()
        ? {}
        : { PILOTDECK_MD_BROWSER_TOOL: '1' }),
      ...(process.env.VITE_MD_BROWSER_TOOL?.trim()
        ? {}
        : { VITE_MD_BROWSER_TOOL: process.env.PILOTDECK_MD_BROWSER_TOOL?.trim() || '1' }),
      PILOTDECK_OD_TEMPLATE_REGISTRY: process.env.PILOTDECK_OD_TEMPLATE_REGISTRY ?? 'shadow',
      // PD-SAAS-FORK: 企业合规 Hub Tab（shadow）+ binding 免责直开
      ...(process.env.VITE_HUB_ENTERPRISE_COMPLIANCE_TAB?.trim()
        ? {}
        : { VITE_HUB_ENTERPRISE_COMPLIANCE_TAB: 'shadow' }),
      ...(process.env.PILOTDECK_CN_COMPLIANCE_BINDING?.trim()
        ? {}
        : { PILOTDECK_CN_COMPLIANCE_BINDING: '1' }),
      // PD-SAAS-FORK: 企业 MCP 首批六键默认 off（显式 env 可覆盖）
      ...(process.env.PILOTDECK_MCP_CN_ERP?.trim() ? {} : { PILOTDECK_MCP_CN_ERP: 'off' }),
      ...(process.env.PILOTDECK_MCP_KINGDEE?.trim() ? {} : { PILOTDECK_MCP_KINGDEE: 'off' }),
      ...(process.env.PILOTDECK_MCP_YONYOU_FIN?.trim() ? {} : { PILOTDECK_MCP_YONYOU_FIN: 'off' }),
      ...(process.env.PILOTDECK_MCP_TAX_INVOICE?.trim() ? {} : { PILOTDECK_MCP_TAX_INVOICE: 'off' }),
      ...(process.env.PILOTDECK_MCP_NOTION?.trim() ? {} : { PILOTDECK_MCP_NOTION: 'off' }),
      ...(process.env.PILOTDECK_MCP_POSTGRES?.trim() ? {} : { PILOTDECK_MCP_POSTGRES: 'off' }),
      // PD-SAAS-FORK: marketing site is the product entry (`/`); set PILOTDECK_MARKETING_SITE=0 to roll back to SPA
      ...(process.env.PILOTDECK_MARKETING_SITE?.trim()
        ? {}
        : { PILOTDECK_MARKETING_SITE: '1' }),
      ...(process.env.VITE_PILOTDECK_MARKETING_SITE?.trim()
        ? {}
        : {
            VITE_PILOTDECK_MARKETING_SITE:
              process.env.PILOTDECK_MARKETING_SITE?.trim() || '1',
          }),
      // PD-SAAS-FORK: marketing contact / invite / analytics — default on in dev
      ...(process.env.PILOTDECK_MARKETING_CONTACT?.trim()
        ? {}
        : { PILOTDECK_MARKETING_CONTACT: '1' }),
      // PD-SAAS-FORK: showcase + marketing i18n defaults
      ...(process.env.PILOTDECK_SHOWCASE_SITE?.trim()
        ? {}
        : { PILOTDECK_SHOWCASE_SITE: 'on' }),
      ...(process.env.PILOTDECK_SHOWCASE_ADMIN?.trim()
        ? {}
        : { PILOTDECK_SHOWCASE_ADMIN: 'shadow' }),
      ...(process.env.PILOTDECK_MARKETING_I18N?.trim()
        ? {}
        : { PILOTDECK_MARKETING_I18N: '1' }),
      ...(process.env.PILOTDECK_MARKETING_PAGES_CMS?.trim()
        ? {}
        : { PILOTDECK_MARKETING_PAGES_CMS: '1' }),
      ...(process.env.PILOTDECK_REGISTER_INVITE_CODE?.trim()
        ? {}
        : { PILOTDECK_REGISTER_INVITE_CODE: '1' }),
      // PD-SAAS-FORK: public markdown share — dev default enforce
      ...(process.env.PILOTDECK_PUBLIC_MD_SHARE?.trim()
        ? {}
        : { PILOTDECK_PUBLIC_MD_SHARE: 'enforce' }),
      ...(process.env.PILOTDECK_MARKETING_ANALYTICS?.trim()
        ? {}
        : { PILOTDECK_MARKETING_ANALYTICS: '1' }),
      ...(process.env.PILOTDECK_PPT_SUPPRESS_FLASK_CONFIRM?.trim()
        ? {}
        : { PILOTDECK_PPT_SUPPRESS_FLASK_CONFIRM: '1' }),
      ...(process.env.PILOTDECK_CLARIFICATION_GATE?.trim()
        ? {}
        : { PILOTDECK_CLARIFICATION_GATE: '1' }),
      // PD-SAAS-FORK: dev SaaS exercises the Codex-grade stability P0 kill-switches so local runs
      // always hit the new paths. Production leaves these unset (default OFF, zero behavior change on
      // deploy); see src/saas/resilience/stabilityFlags.ts. Set any to 0 locally to opt out.
      ...(process.env.PILOTDECK_TRANSIENT_INVISIBLE?.trim() ? {} : { PILOTDECK_TRANSIENT_INVISIBLE: '1' }),
      ...(process.env.PILOTDECK_COLD_RESUME?.trim() ? {} : { PILOTDECK_COLD_RESUME: '1' }),
      // PD-SAAS-FORK: Launcher runs NODE_ENV=production; skip background memory dream in dev SaaS.
      ...(process.env.PILOTDECK_SKIP_MEMORY_DREAM?.trim()
        ? {}
        : { PILOTDECK_SKIP_MEMORY_DREAM: '1' }),
      ...(process.env.PILOTDECK_STALE_TURN_IDLE_MS?.trim()
        ? {}
        : { PILOTDECK_STALE_TURN_IDLE_MS: '600000' }),
      ...(process.env.PILOTDECK_SESSION_SYNTHETIC_BUDGET?.trim()
        ? {}
        : { PILOTDECK_SESSION_SYNTHETIC_BUDGET: '1' }),
      ...(process.env.PILOTDECK_DEGENERATION_GUARD?.trim() ? {} : { PILOTDECK_DEGENERATION_GUARD: '1' }),
      ...(process.env.PILOTDECK_PROGRESS_BUDGET?.trim() ? {} : { PILOTDECK_PROGRESS_BUDGET: '1' }),
      ...(process.env.PILOTDECK_COMPLETION_GATE?.trim() ? {} : { PILOTDECK_COMPLETION_GATE: '1' }),
      // P1/P2 hardening gates (default OFF in production; dev opts in to exercise them).
      ...(process.env.PILOTDECK_PLAN_LEDGER?.trim() ? {} : { PILOTDECK_PLAN_LEDGER: '1' }),
      ...(process.env.PILOTDECK_QUALITY_ACCEPT?.trim() ? {} : { PILOTDECK_QUALITY_ACCEPT: '1' }),
      ...(process.env.PILOTDECK_TOOL_WATCHDOG?.trim() ? {} : { PILOTDECK_TOOL_WATCHDOG: '1' }),
      ...(process.env.PILOTDECK_TOOL_RESULT_COMPACTION?.trim() ? {} : { PILOTDECK_TOOL_RESULT_COMPACTION: '1' }),
      // /goal Feature 2: deterministic NL turn-budget clamp is zero-cost, so dev auto-enables it.
      ...(process.env.PILOTDECK_GOAL_STOP_CONDITIONS?.trim() ? {} : { PILOTDECK_GOAL_STOP_CONDITIONS: '1' }),
      ...(process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST?.trim()
        ? {}
        : { PILOTDECK_SESSION_DELIVERABLE_MANIFEST: '1' }),
      ...(process.env.PILOTDECK_DELIVERABLE_CN_FILENAME_DEFAULT?.trim()
        ? {}
        : { PILOTDECK_DELIVERABLE_CN_FILENAME_DEFAULT: '1' }),
      // PD-SAAS-FORK: P0-1 exercises exact capability scoping locally.
      PILOTDECK_CAPABILITY_SCOPE_V2: process.env.PILOTDECK_CAPABILITY_SCOPE_V2 ?? 'enforce',
      PILOTDECK_QUALITY_CANARY_SLUGS:
        process.env.PILOTDECK_QUALITY_CANARY_SLUGS ?? 'mkt-last30days,ala-strategy-advisor',
      // PD-SAAS-FORK P0-2: shadow-ready but exact canaries default to nobody.
      PILOTDECK_GOAL_QUALITY_CONTRACT:
        process.env.PILOTDECK_GOAL_QUALITY_CONTRACT ?? 'enforce',
      PILOTDECK_GOAL_QUALITY_CANARY_SLUGS:
        process.env.PILOTDECK_GOAL_QUALITY_CANARY_SLUGS ?? '',
      PILOTDECK_GOAL_QUALITY_CANARY_TENANTS:
        process.env.PILOTDECK_GOAL_QUALITY_CANARY_TENANTS ?? '',
      ...(process.env.PILOTDECK_WEB_PERMISSION_MODE?.trim()
        ? {}
        : { PILOTDECK_WEB_PERMISSION_MODE: 'bypassPermissions' }),
      // PD-SAAS-FORK P0-6: observe the official-media FSM locally before enforcement.
      PILOTDECK_OFFICIAL_MEDIA_V2:
        process.env.PILOTDECK_OFFICIAL_MEDIA_V2 ?? 'enforce',
      // PD-SAAS-FORK VAP: Visual Asset Platform (shadow locally; off = instant rollback).
      PILOTDECK_VISUAL_ASSET_PLATFORM:
        process.env.PILOTDECK_VISUAL_ASSET_PLATFORM ?? 'shadow',
      PILOTDECK_DISCOVER_VISUAL_ASSETS:
        process.env.PILOTDECK_DISCOVER_VISUAL_ASSETS ?? '1',
      PILOTDECK_VISUAL_ASSET_PREP:
        process.env.PILOTDECK_VISUAL_ASSET_PREP ?? '1',
      PILOTDECK_AUTO_RESOLVE_VISUAL_ASSETS:
        process.env.PILOTDECK_AUTO_RESOLVE_VISUAL_ASSETS ?? '1',
      PILOTDECK_VISUAL_BINDING_AUDIT:
        process.env.PILOTDECK_VISUAL_BINDING_AUDIT ?? 'enforce',
      PILOTDECK_PREVIEW_REFERER_AUTH:
        process.env.PILOTDECK_PREVIEW_REFERER_AUTH ?? '1',
      PILOTDECK_VAP_BIND_BEFORE_WRITE:
        process.env.PILOTDECK_VAP_BIND_BEFORE_WRITE ?? '1',
      ...(process.env.PILOTDECK_SEQUENTIAL_DELIVERABLES?.trim()
        ? {}
        : { PILOTDECK_SEQUENTIAL_DELIVERABLES: '1' }),
      // PD-SAAS-FORK workbench yield: brief contract enforce locally; infer stays shadow until L3
      PILOTDECK_DELIVERABLE_BRIEF_CONTRACT:
        process.env.PILOTDECK_DELIVERABLE_BRIEF_CONTRACT ?? 'enforce',
      PILOTDECK_INFER_CAPABILITY_CONTEXT:
        process.env.PILOTDECK_INFER_CAPABILITY_CONTEXT ?? 'shadow',
      PILOTDECK_TRY_PROMPT_CONTRACT_V2:
        process.env.PILOTDECK_TRY_PROMPT_CONTRACT_V2 ?? '1',
      ...(process.env.PILOTDECK_HYPERFRAMES_ENGINE?.trim()
        ? {}
        : { PILOTDECK_HYPERFRAMES_ENGINE: 'enforce' }),
      ...(process.env.PILOTDECK_HYPERFRAMES_HUB_V2?.trim()
        ? {}
        : { PILOTDECK_HYPERFRAMES_HUB_V2: '1' }),
      ...(process.env.PILOTDECK_HYPERFRAMES_MAX_CONCURRENT?.trim()
        ? {}
        : { PILOTDECK_HYPERFRAMES_MAX_CONCURRENT: '1' }),
      ...(process.env.PILOTDECK_CHECKLIST_AUTHORITY_TEMPLATES?.trim()
        ? {}
        : { PILOTDECK_CHECKLIST_AUTHORITY_TEMPLATES: '1' }),
      ...(process.env.PILOTDECK_SDM_HTML_REPORT_ALIAS?.trim()
        ? {}
        : { PILOTDECK_SDM_HTML_REPORT_ALIAS: '1' }),
      ...(process.env.PILOTDECK_SDM_GEO_KEYWORD_ALIAS?.trim()
        ? {}
        : { PILOTDECK_SDM_GEO_KEYWORD_ALIAS: '1' }),
      ...(process.env.PILOTDECK_SDM_GEO_FAST_CHECK_ALIAS?.trim()
        ? {}
        : { PILOTDECK_SDM_GEO_FAST_CHECK_ALIAS: '1' }),
      ...(process.env.PILOTDECK_REPAIR_ALIAS_SHORT_CIRCUIT?.trim()
        ? {}
        : { PILOTDECK_REPAIR_ALIAS_SHORT_CIRCUIT: '1' }),
      ...(process.env.PILOTDECK_FOLDER_SDM_FILTER?.trim()
        ? {}
        : { PILOTDECK_FOLDER_SDM_FILTER: '1' }),
      ...(process.env.PILOTDECK_HF_TRY_PROMPT_STRICT?.trim()
        ? {}
        : { PILOTDECK_HF_TRY_PROMPT_STRICT: '1' }),
      ...(process.env.PILOTDECK_RESEARCH_PASSED_GT_STRICT_HTML?.trim()
        ? {}
        : { PILOTDECK_RESEARCH_PASSED_GT_STRICT_HTML: '1' }),
      ...(process.env.PILOTDECK_ASSISTANT_COMPLETION_GATE?.trim()
        ? {}
        : { PILOTDECK_ASSISTANT_COMPLETION_GATE: 'shadow' }),
      ...(process.env.PILOTDECK_RESEARCH_DOCX_BASENAME_FUZZY?.trim()
        ? {}
        : { PILOTDECK_RESEARCH_DOCX_BASENAME_FUZZY: 'shadow' }),
      ...(process.env.PILOTDECK_SDM_HEAL_RESEARCH_LITE?.trim()
        ? {}
        : { PILOTDECK_SDM_HEAL_RESEARCH_LITE: 'shadow' }),
      ...(process.env.PILOTDECK_DISTILL_SDM?.trim()
        ? {}
        : { PILOTDECK_DISTILL_SDM: 'shadow' }),
      ...(process.env.PILOTDECK_BLOCK_SILENT_RESEARCH_ADD?.trim()
        ? {}
        : { PILOTDECK_BLOCK_SILENT_RESEARCH_ADD: 'shadow' }),
      ...(process.env.PILOTDECK_OPEN_HTML_MIN_SDM?.trim()
        ? {}
        : { PILOTDECK_OPEN_HTML_MIN_SDM: 'off' }),
      ...(process.env.PILOTDECK_PPT_EXPORT_DEFAULT_POLICY?.trim()
        ? {}
        : { PILOTDECK_PPT_EXPORT_DEFAULT_POLICY: '1' }),
      ...(process.env.PILOTDECK_ORCH_BYPASS_MATRIX_GEO?.trim()
        ? {}
        : { PILOTDECK_ORCH_BYPASS_MATRIX_GEO: '1' }),
      ...(process.env.PILOTDECK_MATRIX_CORE_GT_PASS?.trim()
        ? {}
        : { PILOTDECK_MATRIX_CORE_GT_PASS: '1' }),
      ...(process.env.PILOTDECK_PARALLEL_GEO_STAGES?.trim()
        ? {}
        : { PILOTDECK_PARALLEL_GEO_STAGES: 'shadow' }),
      ...(process.env.PILOTDECK_PARALLEL_OFFICE_EXPORT?.trim()
        ? {}
        : { PILOTDECK_PARALLEL_OFFICE_EXPORT: 'shadow' }),
      ...(process.env.PILOTDECK_PARALLEL_WRITE_FILE?.trim()
        ? {}
        : { PILOTDECK_PARALLEL_WRITE_FILE: 'enforce' }),
      ...(process.env.PILOTDECK_HTML_FORMAL_ACCEPTANCE?.trim()
        ? {}
        : { PILOTDECK_HTML_FORMAL_ACCEPTANCE: 'shadow' }),
      ...(process.env.PILOTDECK_TASK_STAGE_BUDGET?.trim()
        ? {}
        : { PILOTDECK_TASK_STAGE_BUDGET: 'shadow' }),
      ...(process.env.PILOTDECK_EXPENSIVE_INTENT_CLARIFY?.trim()
        ? {}
        : { PILOTDECK_EXPENSIVE_INTENT_CLARIFY: 'shadow' }),
      ...(process.env.PILOTDECK_KIND_MENTION_SANITIZE?.trim()
        ? {}
        : { PILOTDECK_KIND_MENTION_SANITIZE: 'enforce' }),
      ...(process.env.PILOTDECK_BLOCK_DELIVERABLE_SUBAGENT?.trim()
        ? {}
        : { PILOTDECK_BLOCK_DELIVERABLE_SUBAGENT: '1' }),
      ...(process.env.PILOTDECK_OFFICE_EXTENSION_STRICT?.trim()
        ? {}
        : { PILOTDECK_OFFICE_EXTENSION_STRICT: 'shadow' }),
      ...(process.env.PILOTDECK_AUTOORCH_PRESERVE_DELIVERABLE_TOOLS?.trim()
        ? {}
        : { PILOTDECK_AUTOORCH_PRESERVE_DELIVERABLE_TOOLS: '1' }),
      ...(process.env.PILOTDECK_NOVA_SLIDE_IMAGE_PARALLEL?.trim()
        ? {}
        : { PILOTDECK_NOVA_SLIDE_IMAGE_PARALLEL: '4' }),
      ...(process.env.PILOTDECK_VAP_ACQUISITION_CAP?.trim()
        ? {}
        : { PILOTDECK_VAP_ACQUISITION_CAP: '16' }),
      PILOTDECK_VAP_ORCHESTRATOR_BUDGET_MS:
        process.env.PILOTDECK_VAP_ORCHESTRATOR_BUDGET_MS ?? '28000',
      // PD-SAAS-FORK VAP hardening 20260802
      PILOTDECK_VAP_OFFICIAL_FIRST:
        process.env.PILOTDECK_VAP_OFFICIAL_FIRST ?? '1',
      PILOTDECK_VAP_DISCOVER_PARALLEL:
        process.env.PILOTDECK_VAP_DISCOVER_PARALLEL ?? '1',
      PILOTDECK_VAP_DIRECT_IMAGE_URL:
        process.env.PILOTDECK_VAP_DIRECT_IMAGE_URL ?? '1',
      PILOTDECK_VAP_FORCE_LADDER:
        process.env.PILOTDECK_VAP_FORCE_LADDER ?? '1',
      PILOTDECK_VAP_OUTBOUND_MAX:
        process.env.PILOTDECK_VAP_OUTBOUND_MAX ?? '4',
      PILOTDECK_VAP_QUERY_PACK:
        process.env.PILOTDECK_VAP_QUERY_PACK ?? 'generic',
      PILOTDECK_VAP_CRAWLER_SIDECAR:
        process.env.PILOTDECK_VAP_CRAWLER_SIDECAR ?? 'off',
      PILOTDECK_VAP_CRAWLER_URL:
        process.env.PILOTDECK_VAP_CRAWLER_URL ?? 'http://127.0.0.1:8080',
      PILOTDECK_VAP_STEALTH_SIDECAR:
        process.env.PILOTDECK_VAP_STEALTH_SIDECAR ?? '0',
      PILOTDECK_VAP_VISION_LOCATE:
        process.env.PILOTDECK_VAP_VISION_LOCATE ?? 'shadow',
      PILOTDECK_VAP_LIVE_CAPTURE:
        process.env.PILOTDECK_VAP_LIVE_CAPTURE ?? '1',
      // PD-SAAS-FORK VAP: default empty registry (config/official-source-roots.json).
      // G700 canary roots only via explicit PILOTDECK_OFFICIAL_SOURCE_ROOTS_PATH in G700/VAP gates.
      // PD-SAAS-FORK P0-7: observe unified content quality locally.
      PILOTDECK_CONTENT_QUALITY_V2:
        process.env.PILOTDECK_CONTENT_QUALITY_V2 ?? 'shadow',
      // PD-SAAS-FORK: IM notify MCP shadow in dev; App chat channels default off
      ...(process.env.PILOTDECK_IM_NOTIFY_MCP?.trim()
        ? {}
        : { PILOTDECK_IM_NOTIFY_MCP: 'shadow' }),
      ...(process.env.PILOTDECK_IM_CHANNELS?.trim()
        ? {}
        : { PILOTDECK_IM_CHANNELS: 'off' }),
      ...(process.env.PILOTDECK_TURN_QUEUE?.trim() ? {} : { PILOTDECK_TURN_QUEUE: '1' }),
      // PD-SAAS-FORK: N2 Bot 默认关；显式 PILOTDECK_N2_BOT=shadow|enforce 或后台 platform-features.json n2Bot 开启
      ...(process.env.PILOTDECK_N2_BOT?.trim() ? {} : { PILOTDECK_N2_BOT: 'off' }),
      ...(process.env.PILOTDECK_USER_MAX_ACTIVE_TURNS?.trim()
        ? {}
        : { PILOTDECK_USER_MAX_ACTIVE_TURNS: '7' }),
      ...(process.env.PILOTDECK_USER_MAX_ACTIVE_TURNS_ADMIN?.trim()
        ? {}
        : { PILOTDECK_USER_MAX_ACTIVE_TURNS_ADMIN: '7' }),
      // PD-SAAS-FORK: local dev — disable login IP throttle (429) during repeated auth/debug.
      ...(process.env.SAAS_LOGIN_RATE_IP_PER_MIN?.trim()
        ? {}
        : { SAAS_LOGIN_RATE_IP_PER_MIN: '0' }),
      ...(process.env.PILOTDECK_GROUND_TRUTH_RECONCILE?.trim()
        ? {}
        : { PILOTDECK_GROUND_TRUTH_RECONCILE: '1' }),
      ...(process.env.PILOTDECK_MEDIA_STRATEGY_RESOLVER?.trim()
        ? {}
        : { PILOTDECK_MEDIA_STRATEGY_RESOLVER: '1' }),
      ...(process.env.PILOTDECK_PREFER_GENERATE_IMAGE?.trim()
        ? {}
        : { PILOTDECK_PREFER_GENERATE_IMAGE: 'shadow' }),
      ...(process.env.PILOTDECK_SDM_PIVOT_GUARD?.trim()
        ? {}
        : { PILOTDECK_SDM_PIVOT_GUARD: '1' }),
      ...(process.env.PILOTDECK_CAMPAIGN_PNG_DEGRADE?.trim()
        ? {}
        : { PILOTDECK_CAMPAIGN_PNG_DEGRADE: '1' }),
      ...(process.env.PILOTDECK_VERIFICATION_PASS?.trim() ? {} : { PILOTDECK_VERIFICATION_PASS: '1' }),
      // Verification LLM stays OFF in dev by default (real model cost). weak fast models (e.g. qwen3.6-flash) demonstrably run away into
      // verbatim line/phrase/block repetition loops on long structured generation, burning tokens and
      // rendering garbage. The high-precision detector only ever trips on extreme unambiguous loops,
      // so dev auto-enables it to stop the bleeding. Set PILOTDECK_STREAM_DEGENERATION=0 to opt out.
      ...(process.env.PILOTDECK_STREAM_DEGENERATION?.trim() ? {} : { PILOTDECK_STREAM_DEGENERATION: '1' }),
      // PD-SAAS-FORK: 四线终验 — dev 默认 shadow 证书 + 合同权威 + 导出快照
      ...(process.env.PILOTDECK_DELIVERABLE_CERTIFICATE_V2?.trim()
        ? {}
        : { PILOTDECK_DELIVERABLE_CERTIFICATE_V2: 'shadow' }),
      ...(process.env.PILOTDECK_CONTRACT_AUTHORITY_V2?.trim()
        ? {}
        : { PILOTDECK_CONTRACT_AUTHORITY_V2: '1' }),
      ...(process.env.PILOTDECK_EXPORT_SNAPSHOT_V2?.trim()
        ? {}
        : { PILOTDECK_EXPORT_SNAPSHOT_V2: '1' }),
      ...(process.env.VITE_PILOTDECK_DELIVERABLE_CERTIFICATE_UI?.trim()
        ? {}
        : { VITE_PILOTDECK_DELIVERABLE_CERTIFICATE_UI: '1' }),
      ...(process.env.VITE_DELIVERABLE_SETTLED_ACCEPTANCE_AUTHORITY?.trim()
        ? {}
        : { VITE_DELIVERABLE_SETTLED_ACCEPTANCE_AUTHORITY: '1' }),
      ...(process.env.VITE_DELIVERABLE_SLOT_PROCESS_UX?.trim()
        ? {}
        : { VITE_DELIVERABLE_SLOT_PROCESS_UX: '1' }),
      ...(process.env.VITE_DELIVERABLE_TRUST_COPY_V2?.trim()
        ? {}
        : { VITE_DELIVERABLE_TRUST_COPY_V2: '1' }),
      ...(process.env.VITE_PILOTDECK_UI_STRICT_COMPLETION_GATE?.trim()
        ? {}
        : { VITE_PILOTDECK_UI_STRICT_COMPLETION_GATE: '1' }),
      ...(process.env.PILOTDECK_UI_DELIVERABLE_TRUST_COPY_V2?.trim()
        ? {}
        : { PILOTDECK_UI_DELIVERABLE_TRUST_COPY_V2: '1' }),
      ...(process.env.PILOTDECK_UI_STRICT_COMPLETION_GATE?.trim()
        ? {}
        : { PILOTDECK_UI_STRICT_COMPLETION_GATE: '1' }),
      ...(process.env.PILOTDECK_UI_DELIVERABLE_SETTLED_ACCEPTANCE_AUTHORITY?.trim()
        ? {}
        : { PILOTDECK_UI_DELIVERABLE_SETTLED_ACCEPTANCE_AUTHORITY: '1' }),
      ...(process.env.VITE_EXPORT_SNAPSHOT_V2?.trim()
        ? {}
        : { VITE_EXPORT_SNAPSHOT_V2: '1' }),
      ...(process.env.VITE_PILOTDECK_CONVERSATION_DELIVERABLE_SYNC?.trim()
        ? {}
        : { VITE_PILOTDECK_CONVERSATION_DELIVERABLE_SYNC: '1' }),
      ...(process.env.VITE_PILOTDECK_TURN_SNAPSHOT_KERNEL?.trim()
        ? {}
        : { VITE_PILOTDECK_TURN_SNAPSHOT_KERNEL: '1' }),
      ...(process.env.VITE_PILOTDECK_TERMINAL_DELIVERABLE_PRESENTATION?.trim()
        ? {}
        : { VITE_PILOTDECK_TERMINAL_DELIVERABLE_PRESENTATION: '1' }),
      ...(process.env.VITE_PILOTDECK_STICKY_DELIVERABLE_SUMMARY?.trim()
        ? {}
        : { VITE_PILOTDECK_STICKY_DELIVERABLE_SUMMARY: '1' }),
      ...(process.env.VITE_STICKY_DELIVERABLE_BAR_PERSIST?.trim()
        ? {}
        : { VITE_STICKY_DELIVERABLE_BAR_PERSIST: '1' }),
      ...(process.env.VITE_PILOTDECK_DELIVERABLE_STATUS_LOCK?.trim()
        ? {}
        : { VITE_PILOTDECK_DELIVERABLE_STATUS_LOCK: '1' }),
      ...(process.env.VITE_SESSION_TERMINAL_GATE?.trim()
        ? {}
        : { VITE_SESSION_TERMINAL_GATE: '1' }),
      ...(process.env.VITE_AUTO_SIDEBAR_COMPLETE_ON_PASS?.trim()
        ? {}
        : { VITE_AUTO_SIDEBAR_COMPLETE_ON_PASS: '1' }),
      // The verification pass and verification LLM (real model cost) stay OFF even in dev for now.
    },
    repoRoot,
  );

  if (!validatedPgUrl) {
    delete env.SAAS_DATABASE_URL;
  }

  const dbBackend = useSqliteOnly ? 'sqlite' : validatedPgUrl ? 'postgres' : 'sqlite';

  return {
    repoRoot,
    dataRoot,
    infra,
    useSqliteOnly,
    ports: {
      server: server.port,
      gateway: gateway.port,
      vite: vite.port,
    },
    portMeta: { server, gateway, vite },
    env,
    gatewayUrl,
    dbBackend,
    lanUrls: formatLanUrls({ vitePort: vite.port, serverPort: server.port }),
    viteUrl: `http://127.0.0.1:${vite.port}`,
  };
}

/** @param {import('./devLauncherCore.mjs').prepareSaasDevRuntime extends (...args: any) => Promise<infer R> ? R : never} runtime */
export function printSaasDevBanner(runtime) {
  const { dataRoot, infra, useSqliteOnly, ports, lanUrls } = runtime;
  console.log('[dev-saas] Community personal SaaS — login as admin (password from SAAS_ADMIN_PASSWORD)');
  console.log(`[dev-saas] DATA_ROOT: ${dataRoot}`);
  if (infra.redis) {
    console.log(`[dev-saas] Redis: ${process.env.REDIS_URL || DEV_REDIS_URL}`);
  } else if (!process.env.REDIS_URL?.trim()) {
    console.log('[dev-saas] Redis: 未连接（内存缓存兜底）');
  }
  if (useSqliteOnly) {
    console.log('[dev-saas] Control DB: SQLite（DEV_SAAS_SQLITE=1）');
  } else if (infra.postgres && infra.pgUrl) {
    console.log('[dev-saas] Control DB: PostgreSQL');
  } else {
    console.log('[dev-saas] Control DB: SQLite（PostgreSQL 未就绪）');
  }
  console.log('');
  console.log('[dev-saas] resolved dev ports:');
  console.log(`  server (express/ws)  →  ${ports.server}`);
  console.log(`  gateway (pilotdeck)  →  ${ports.gateway}`);
  console.log(`  vite client          →  ${ports.vite}`);
  console.log('');
  console.log('[dev-saas] browser URLs (use LAN IP on other devices):');
  for (const entry of lanUrls) {
    console.log(`  ${entry.label.padEnd(14)}  Vite ${entry.vite}   Server ${entry.server}`);
  }
  console.log('');
  console.log('[dev-saas] 产品入口 → Vite `/login`，登录后 `/app`（无营销站）');
  console.log('');
}

/** True when PILOTDECK_DEV_MODE requests OSS / single-user stack (no SaaS login). */
export function isStandaloneDevMode(env = process.env) {
  const mode = String(env.PILOTDECK_DEV_MODE || 'saas').toLowerCase();
  return mode === 'standalone' || mode === 'oss' || mode === 'local';
}

/** npm script for local dev: default SaaS (`dev`); use dev:standalone for OSS. */
export function resolveDevNpmScript(env = process.env) {
  return isStandaloneDevMode(env) ? 'dev:standalone' : 'dev';
}

export { DEV_PG_URL, DEV_REDIS_URL, ensureDevInfra, formatLanUrls, resolveDevPgUrl };
