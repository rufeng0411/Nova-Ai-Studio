import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import {
  ALL_PROJECTS_MEMORY_EXPORT_FORMAT_VERSION,
  EdgeClawMemoryService,
  MemoryBundleValidationError,
  hashText,
} from '../../../src/context/memory/edgeclaw-memory-core/lib/index.js';
import { extractProjectDirectory } from '../projects.js';
import {
  buildMemoryDefaults,
  readPilotDeckConfigFile,
} from './pilotdeckConfig.js';
// PD-SAAS-FORK: resolve the memory root per tenant so the `global` user-profile
// scope is isolated. Single-host falls back to the legacy global path, keeping
// behavior identical when not in SaaS mode / outside a tenant request.
import { getSaasRequestContext } from '../saas/context.js';
import { isSaasMode } from '../saas/mode.js';
import { resolveMemoryRootForScope } from '../saas/tenant/memoryRoot.js';
import { getDataRoot } from '../saas/tenant/paths.js';

const LEGACY_MEMORY_ROOT_DIR = path.join(process.env.PILOT_HOME || path.join(os.homedir(), '.pilotdeck'), 'memory');

// PD-SAAS-FORK: effective memory root aligned with gateway resolveMemoryRootForScope.
function memoryRootDir() {
  const ctx = getSaasRequestContext();
  return resolveMemoryRootForScope({
    fallbackRoot: LEGACY_MEMORY_ROOT_DIR,
    tenantPilotHome: ctx?.tenantPilotHome,
    tenantId: ctx?.tenantId,
  }) ?? LEGACY_MEMORY_ROOT_DIR;
}
function memoryWorkspacesRoot() {
  return path.join(memoryRootDir(), 'workspaces');
}
function memoryGlobalRoot() {
  return path.join(memoryRootDir(), 'global');
}
const MEMORY_SCHEDULER_INTERVAL_MS = 60_000;
const GLOBAL_MAINTENANCE_TASK_KEY = '__edgeclaw_memory_global_maintenance__';
const MEMORY_SCHEDULER_SUPPRESS_AFTER = 3;
const MEMORY_SCHEDULER_SUPPRESS_MS = 30 * 60_000;
/** @type {Map<string, { count: number; suppressUntilMs: number }>} */
const memorySchedulerFailureStreak = new Map();

/** PD-SAAS-FORK: dev 默认跳过后台 dream，避免代理/VPN 每 60s 打栈；设 PILOTDECK_SKIP_MEMORY_DREAM=0 可恢复 */
function shouldSkipScheduledMemoryDream() {
  if (process.env.PILOTDECK_SKIP_MEMORY_DREAM === '1') return true;
  if (process.env.PILOTDECK_SKIP_MEMORY_DREAM === '0') return false;
  if (process.env.PILOTDECK_DEV_SKIP_MEMORY_DREAM === '0') return false;
  if (process.env.NODE_ENV === 'development') return true;
  return false;
}

function shouldSuppressMemoryScheduler(dataDir) {
  const entry = memorySchedulerFailureStreak.get(dataDir);
  return Boolean(entry && entry.suppressUntilMs > Date.now());
}

function recordMemorySchedulerTransientFailure(dataDir) {
  const entry = memorySchedulerFailureStreak.get(dataDir) ?? { count: 0, suppressUntilMs: 0 };
  entry.count += 1;
  if (entry.count >= MEMORY_SCHEDULER_SUPPRESS_AFTER) {
    entry.suppressUntilMs = Date.now() + MEMORY_SCHEDULER_SUPPRESS_MS;
    entry.count = 0;
  }
  memorySchedulerFailureStreak.set(dataDir, entry);
}

/** PD-SAAS-FORK: proxy/TLS drops (e.g. Clash 198.18.x) — shorten scheduler noise */
function formatMemorySchedulerFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error && error.cause && typeof error.cause === 'object'
    ? error.cause
    : null;
  const causeCode = cause && typeof cause.code === 'string' ? cause.code : '';
  if (
    message.includes('fetch failed')
    || causeCode === 'UND_ERR_SOCKET'
    || message.includes('other side closed')
  ) {
    return 'memory LLM API 不可达（多为代理/VPN 中断 TLS，已跳过本轮 dream/index）';
  }
  if (/Arrearage|overdue-payment|account is in good standing/i.test(message)) {
    return 'memory dream 已跳过（模型账户欠费/不可用，dev 可设 PILOTDECK_SKIP_MEMORY_DREAM=1）';
  }
  return error;
}

const servicesByDataDir = new Map();
const workspaceTaskChains = new Map();

let schedulerTimer = null;
let schedulerCyclePromise = null;

function normalizePath(projectPath) {
  return typeof projectPath === 'string' && projectPath.trim()
    ? path.resolve(projectPath.trim())
    : '';
}

function resolveWorkspaceDataDir(projectPath) {
  return path.join(memoryWorkspacesRoot(), hashText(path.resolve(projectPath)));
}

function buildServiceForDataDir(dataDir, workspaceDir = dataDir) {
  let memoryDefaults = {};
  try {
    memoryDefaults = buildMemoryDefaults(readPilotDeckConfigFile().config);
  } catch {
    memoryDefaults = {};
  }
  const service = new EdgeClawMemoryService({
    workspaceDir,
    rootDir: memoryRootDir(),
    dbPath: path.join(dataDir, 'control.sqlite'),
    memoryDir: path.join(dataDir, 'memory'),
    source: 'pilotdeck',
    ...memoryDefaults,
  });
  if (memoryDefaults.defaultIndexingSettings) {
    service.saveSettings(memoryDefaults.defaultIndexingSettings);
  }
  return service;
}

function readWorkspaceDirFromDataDir(dataDir) {
  const dbPath = path.join(dataDir, 'control.sqlite');
  try {
    const db = new DatabaseSync(dbPath);
    try {
      const row = db.prepare(
        'SELECT state_json FROM pipeline_state WHERE state_key = ?',
      ).get('workspaceDir');
      if (!row || typeof row.state_json !== 'string') {
        return null;
      }
      const parsed = JSON.parse(row.state_json);
      return typeof parsed === 'string' && parsed.trim()
        ? path.resolve(parsed.trim())
        : null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

function getOrCreateServiceForDataDir(dataDir, workspaceDir = dataDir) {
  const normalizedDataDir = path.resolve(dataDir);
  let service = servicesByDataDir.get(normalizedDataDir);
  if (!service) {
    const restoredWorkspaceDir = readWorkspaceDirFromDataDir(normalizedDataDir);
    service = buildServiceForDataDir(normalizedDataDir, restoredWorkspaceDir ?? workspaceDir);
    servicesByDataDir.set(normalizedDataDir, service);
  }
  return {
    dataDir: normalizedDataDir,
    service,
  };
}

function getOrCreateServiceForProjectPath(projectPath) {
  const normalizedProjectPath = normalizePath(projectPath);
  if (!normalizedProjectPath) {
    throw new Error('projectPath is required');
  }
  const dataDir = resolveWorkspaceDataDir(normalizedProjectPath);
  const existing = servicesByDataDir.get(path.resolve(dataDir));
  if (existing && existing.workspaceDir !== normalizedProjectPath) {
    try {
      existing.close();
    } catch {
      // ignore close failures when refreshing workspace context
    }
    servicesByDataDir.delete(path.resolve(dataDir));
  }
  return {
    projectPath: normalizedProjectPath,
    ...getOrCreateServiceForDataDir(dataDir, normalizedProjectPath),
  };
}

function enqueueTaskWithKeys(keys, task) {
  const normalizedKeys = Array.from(new Set(
    keys
      .map((key) => String(key || '').trim())
      .filter(Boolean),
  ));
  const previous = Promise.all(
    normalizedKeys.map((key) => (workspaceTaskChains.get(key) ?? Promise.resolve()).catch(() => undefined)),
  );
  const next = previous.then(task);
  const sentinel = next.then(() => undefined, () => undefined);
  normalizedKeys.forEach((key) => workspaceTaskChains.set(key, sentinel));
  sentinel.finally(() => {
    normalizedKeys.forEach((key) => {
      if (workspaceTaskChains.get(key) === sentinel) {
        workspaceTaskChains.delete(key);
      }
    });
  });
  return next;
}

function enqueueWorkspaceTask(dataDir, task) {
  return enqueueTaskWithKeys([path.resolve(dataDir)], task);
}

function enqueueMaintenanceTask(dataDir, task) {
  return enqueueTaskWithKeys([path.resolve(dataDir), GLOBAL_MAINTENANCE_TASK_KEY], task);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function normalizeSnapshotRelativePath(relativePath, label) {
  if (typeof relativePath !== 'string' || !relativePath.trim()) {
    throw new MemoryBundleValidationError(`Invalid ${label}.relativePath`);
  }

  const segments = relativePath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..')) {
    throw new MemoryBundleValidationError(`Invalid ${label}.relativePath`);
  }

  return segments.join('/');
}

function normalizeSnapshotFileRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MemoryBundleValidationError(`Invalid ${label}`);
  }
  if (typeof value.content !== 'string') {
    throw new MemoryBundleValidationError(`Invalid ${label}.content`);
  }
  return {
    relativePath: normalizeSnapshotRelativePath(value.relativePath, label),
    content: value.content,
  };
}

async function listSnapshotFiles(rootDir) {
  if (!(await pathExists(rootDir))) {
    return [];
  }

  const files = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const relativePath = path.relative(rootDir, absolutePath).replace(/\\/g, '/');
      files.push({
        relativePath,
        content: await fs.readFile(absolutePath, 'utf8'),
      });
    }
  }

  await walk(rootDir);
  return files;
}

async function replaceSnapshotFiles(rootDir, files) {
  await fs.rm(rootDir, { recursive: true, force: true });
  await fs.mkdir(rootDir, { recursive: true });

  for (let index = 0; index < files.length; index += 1) {
    const record = normalizeSnapshotFileRecord(files[index], `files[${index}]`);
    const absolutePath = path.resolve(rootDir, record.relativePath);
    const relativeCheck = path.relative(rootDir, absolutePath);
    if (
      !relativeCheck
      || relativeCheck.startsWith('..')
      || path.isAbsolute(relativeCheck)
    ) {
      throw new MemoryBundleValidationError(`Invalid files[${index}].relativePath`);
    }
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, record.content, 'utf8');
  }
}

function createEmptyTransferCounts() {
  return {
    managedFiles: 0,
    memoryFiles: 0,
    project: 0,
    feedback: 0,
    user: 0,
    tmp: 0,
    projectMetas: 0,
  };
}

function addTransferCounts(total, partial) {
  total.managedFiles += Number(partial?.managedFiles ?? 0);
  total.memoryFiles += Number(partial?.memoryFiles ?? 0);
  total.project += Number(partial?.project ?? 0);
  total.feedback += Number(partial?.feedback ?? 0);
  total.user += Number(partial?.user ?? 0);
  total.tmp += Number(partial?.tmp ?? 0);
  total.projectMetas += Number(partial?.projectMetas ?? 0);
}

function normalizeAllProjectsBundle(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MemoryBundleValidationError('Invalid all-projects memory bundle');
  }
  if (value.formatVersion !== ALL_PROJECTS_MEMORY_EXPORT_FORMAT_VERSION) {
    throw new MemoryBundleValidationError(
      `Unsupported all-projects memory bundle formatVersion. Expected ${ALL_PROJECTS_MEMORY_EXPORT_FORMAT_VERSION}.`,
    );
  }
  if (value.scope !== 'all_projects') {
    throw new MemoryBundleValidationError('Unsupported all-projects memory bundle scope.');
  }
  if (!Array.isArray(value.projects)) {
    throw new MemoryBundleValidationError('Invalid all-projects memory bundle projects.');
  }

  const globalFiles = Array.isArray(value.globalFiles)
    ? value.globalFiles.map((item, index) => normalizeSnapshotFileRecord(item, `globalFiles[${index}]`))
    : [];
  const seenGlobalPaths = new Set();
  for (const record of globalFiles) {
    if (seenGlobalPaths.has(record.relativePath)) {
      throw new MemoryBundleValidationError(`Duplicate globalFiles path: ${record.relativePath}`);
    }
    seenGlobalPaths.add(record.relativePath);
  }

  const seenProjectPaths = new Set();
  const projects = value.projects.map((project, index) => {
    if (!project || typeof project !== 'object' || Array.isArray(project)) {
      throw new MemoryBundleValidationError(`Invalid projects[${index}]`);
    }

    const projectPath = normalizePath(project.projectPath);
    if (!projectPath) {
      throw new MemoryBundleValidationError(`Invalid projects[${index}].projectPath`);
    }
    if (seenProjectPaths.has(projectPath)) {
      throw new MemoryBundleValidationError(`Duplicate projectPath in projects[${index}]`);
    }
    seenProjectPaths.add(projectPath);

    if (!project.bundle || typeof project.bundle !== 'object' || Array.isArray(project.bundle)) {
      throw new MemoryBundleValidationError(`Invalid projects[${index}].bundle`);
    }

    return {
      projectPath,
      projectName: typeof project.projectName === 'string' && project.projectName.trim()
        ? project.projectName.trim()
        : path.basename(projectPath),
      bundle: project.bundle,
    };
  });

  return {
    formatVersion: ALL_PROJECTS_MEMORY_EXPORT_FORMAT_VERSION,
    scope: 'all_projects',
    exportedAt: typeof value.exportedAt === 'string' && value.exportedAt.trim()
      ? value.exportedAt.trim()
      : new Date().toISOString(),
    projects,
    globalFiles,
  };
}

async function listWorkspaceDataDirsUnder(workspacesRoot) {
  try {
    const entries = await fs.readdir(workspacesRoot, { withFileTypes: true });
    const dirs = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dataDir = path.join(workspacesRoot, entry.name);
      const hasDb = await pathExists(path.join(dataDir, 'control.sqlite'));
      const hasMemoryDir = await pathExists(path.join(dataDir, 'memory'));
      if (hasDb && hasMemoryDir) {
        dirs.push(dataDir);
      }
    }
    return dirs;
  } catch {
    return [];
  }
}

// PD-SAAS-FORK: the scheduler runs without a request context. In SaaS, sweep
// every tenant's memory workspaces (DATA_ROOT/tenants/*/memory/workspaces) so
// scheduled maintenance covers all tenants, not just the legacy global root.
async function listWorkspaceDataDirs() {
  const roots = new Set([memoryWorkspacesRoot()]);
  if (isSaasMode()) {
    try {
      const tenantsRoot = path.join(getDataRoot(), 'tenants');
      const tenants = await fs.readdir(tenantsRoot, { withFileTypes: true });
      for (const tenant of tenants) {
        if (!tenant.isDirectory()) continue;
        roots.add(path.join(tenantsRoot, tenant.name, 'memory', 'workspaces'));
      }
    } catch {
      // tenants dir may not exist yet — fall back to the legacy root only.
    }
  }
  const all = [];
  for (const root of roots) {
    all.push(...await listWorkspaceDataDirsUnder(root));
  }
  return [...new Set(all)].sort((left, right) => left.localeCompare(right));
}

async function executeScheduledMaintenanceForDataDir(dataDir) {
  const { service } = getOrCreateServiceForDataDir(dataDir);
  return enqueueMaintenanceTask(dataDir, async () => {
    // PD-SAAS-FORK: dev/Launcher (NODE_ENV=production) must not restore dream interval
    // after each cycle — restoring re-enabled LLM dream and spammed Arrearage errors.
    if (shouldSkipScheduledMemoryDream()) {
      const settings = service.getSettings();
      if (settings.autoDreamIntervalMinutes !== 0) {
        service.saveSettings({ ...settings, autoDreamIntervalMinutes: 0 });
      }
      return service.runDueScheduledMaintenance('scheduled:server_scheduler');
    }
    return service.runDueScheduledMaintenance('scheduled:server_scheduler');
  });
}

export async function resolveProjectPathFromRequest(req) {
  const queryProjectPath = normalizePath(req.query?.projectPath);
  if (queryProjectPath) {
    return queryProjectPath;
  }

  const bodyProjectPath = normalizePath(req.body?.projectPath);
  if (bodyProjectPath) {
    return bodyProjectPath;
  }

  const projectName = typeof req.query?.projectName === 'string'
    ? req.query.projectName.trim()
    : typeof req.params?.projectName === 'string'
      ? req.params.projectName.trim()
      : '';

  if (!projectName) {
    throw new Error('projectPath or projectName is required');
  }

  return path.resolve(await extractProjectDirectory(projectName));
}

export async function getMemoryServiceForRequest(req) {
  const projectPath = await resolveProjectPathFromRequest(req);
  return getOrCreateServiceForProjectPath(projectPath);
}

export async function runManualMemoryFlush(service, dataDir, options = {}) {
  return enqueueMaintenanceTask(dataDir, async () => service.flush({
    reason: options.reason ?? 'manual',
    ...(typeof options.batchSize === 'number' ? { batchSize: options.batchSize } : {}),
    ...(Array.isArray(options.sessionKeys) ? { sessionKeys: options.sessionKeys } : {}),
  }));
}

export async function runManualMemoryDream(service, dataDir) {
  return enqueueMaintenanceTask(dataDir, async () => service.dream('manual'));
}

export async function rollbackLastMemoryDream(service, dataDir) {
  return enqueueMaintenanceTask(dataDir, async () => service.rollbackLastDream());
}

export async function runMemorySchedulerCycle() {
  try {
    if (!readPilotDeckConfigFile().config.memory?.enabled) {
      return null;
    }
  } catch {
    // If config cannot be read, keep the scheduler's default enabled behavior.
  }

  if (schedulerCyclePromise) {
    return schedulerCyclePromise;
  }

  schedulerCyclePromise = (async () => {
    const workspaceDataDirs = await listWorkspaceDataDirs();
    for (const dataDir of workspaceDataDirs) {
      if (shouldSuppressMemoryScheduler(dataDir)) {
        continue;
      }
      try {
        await executeScheduledMaintenanceForDataDir(dataDir);
        memorySchedulerFailureStreak.delete(dataDir);
      } catch (error) {
        const formatted = formatMemorySchedulerFailure(error);
        if (typeof formatted === 'string') {
          recordMemorySchedulerTransientFailure(dataDir);
          console.warn(`[memory-scheduler] ${formatted} (${dataDir})`);
        } else {
          console.error(`[memory-scheduler] scheduled maintenance failed for ${dataDir}:`, formatted);
        }
      }
    }
  })().finally(() => {
    schedulerCyclePromise = null;
  });

  return schedulerCyclePromise;
}

export function startMemoryScheduler() {
  try {
    if (!readPilotDeckConfigFile().config.memory?.enabled) {
      return;
    }
  } catch {
    // If config cannot be read, keep the scheduler's default enabled behavior.
  }

  if (schedulerTimer) {
    return;
  }

  schedulerTimer = setInterval(() => {
    void runMemorySchedulerCycle();
  }, MEMORY_SCHEDULER_INTERVAL_MS);

  if (typeof schedulerTimer.unref === 'function') {
    schedulerTimer.unref();
  }

  void runMemorySchedulerCycle();
}

export function stopMemoryScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

export function getMemorySchedulerStatus() {
  let enabled = true;
  let configError = null;
  try {
    enabled = readPilotDeckConfigFile().config.memory?.enabled !== false;
  } catch (error) {
    configError = error instanceof Error ? error.message : String(error);
  }

  return {
    enabled,
    running: Boolean(schedulerTimer),
    intervalMs: MEMORY_SCHEDULER_INTERVAL_MS,
    ...(configError ? { configError } : {}),
  };
}

export function closeMemoryServices() {
  stopMemoryScheduler();
  for (const service of servicesByDataDir.values()) {
    try {
      service.close();
    } catch {
      // ignore close failures during shutdown
    }
  }
  servicesByDataDir.clear();
  workspaceTaskChains.clear();
}

export async function clearAllMemoryData() {
  for (const service of servicesByDataDir.values()) {
    try {
      service.close();
    } catch {
      // ignore close failures during clear
    }
  }
  servicesByDataDir.clear();
  workspaceTaskChains.clear();

  await fs.rm(memoryRootDir(), { recursive: true, force: true });
  await fs.mkdir(memoryWorkspacesRoot(), { recursive: true });
  await fs.mkdir(memoryGlobalRoot(), { recursive: true });

  return {
    scope: 'all_memory',
    clearedAt: new Date().toISOString(),
    cleared: {
      l0Sessions: 0,
      pipelineState: 0,
      memoryFiles: 0,
      projectMetas: 0,
    },
  };
}

export async function exportAllProjectsMemoryBundle() {
  const workspaceDataDirs = await listWorkspaceDataDirs();
  const projects = [];

  for (const dataDir of workspaceDataDirs) {
    const restoredWorkspaceDir = readWorkspaceDirFromDataDir(dataDir);
    const { service } = getOrCreateServiceForDataDir(dataDir, restoredWorkspaceDir ?? dataDir);
    const projectMeta = service.getProjectMeta();
    projects.push({
      projectPath: service.workspaceDir,
      projectName: projectMeta?.projectName || path.basename(service.workspaceDir),
      bundle: service.exportBundle(),
    });
  }

  return {
    formatVersion: ALL_PROJECTS_MEMORY_EXPORT_FORMAT_VERSION,
    scope: 'all_projects',
    exportedAt: new Date().toISOString(),
    globalFiles: await listSnapshotFiles(memoryGlobalRoot()),
    projects,
  };
}

export async function importAllProjectsMemoryBundle(bundle) {
  const normalized = normalizeAllProjectsBundle(bundle);
  await clearAllMemoryData();

  const imported = createEmptyTransferCounts();
  const warnings = [];

  for (const project of normalized.projects) {
    const { service } = getOrCreateServiceForProjectPath(project.projectPath);
    const result = service.importBundle(project.bundle);
    addTransferCounts(imported, result.imported);
    if (Array.isArray(result.warnings) && result.warnings.length > 0) {
      warnings.push(...result.warnings.map((warning) => `[${project.projectName}] ${warning}`));
    }
  }

  await replaceSnapshotFiles(memoryGlobalRoot(), normalized.globalFiles);

  return {
    formatVersion: ALL_PROJECTS_MEMORY_EXPORT_FORMAT_VERSION,
    scope: 'all_projects',
    importedAt: new Date().toISOString(),
    projectCount: normalized.projects.length,
    imported,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
