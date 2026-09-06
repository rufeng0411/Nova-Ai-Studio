// PD-SAAS-FORK: scoped task-folder snapshot for UDC disk enrich (R11 PR-3 + 0717 P0-4)
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { extractProjectDirectory } from '../projects.js';
import { isNonUserDeliverablePath } from '../../shared/deliverablePathResolve.mjs';
import {
  bindContractUnitsStrict,
  expandSlotsToContractUnits,
} from '../../../src/saas/deliverables/deliverableContractBinding.js';
import { isOrphanIntermediateHtmlPath } from '../../shared/deliverablePathResolve.mjs';

function isFolderSdmFilterEnabled() {
  const raw = String(process.env.PILOTDECK_FOLDER_SDM_FILTER ?? '1').trim().toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'off';
}

function collectSlotHtmlBasenames(slots) {
  const basenames = [];
  for (const slot of slots ?? []) {
    for (const hint of [slot?.pathHint, ...(Array.isArray(slot?.pathHints) ? slot.pathHints : [])]) {
      if (hint && /\.html?$/i.test(String(hint))) {
        basenames.push(path.basename(String(hint)).toLowerCase());
      }
    }
  }
  return basenames;
}

const MAX_FILES = 500;
const MAX_DEPTH = 4;
const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'skills',
  '.pilotdeck',
  '.cache',
  '__pycache__',
]);

function snapshotInputError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function normalizeScopeDir(scopeDir) {
  const normalized = String(scopeDir ?? '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  if (normalized.split('/').some((segment) => segment === '..')) return '';
  return normalized;
}

function isScopeWithinProject(projectDir, absDir) {
  const resolvedProject = path.resolve(projectDir);
  const resolvedScope = path.resolve(absDir);
  return resolvedScope === resolvedProject
    || resolvedScope.startsWith(`${resolvedProject}${path.sep}`);
}

function shouldSkipDir(name) {
  return SKIP_DIR_NAMES.has(String(name ?? '').toLowerCase());
}

function isMissingFsError(error) {
  return error?.code === 'ENOENT';
}

function shouldExcludeEvidencePath(relPath) {
  const normalized = String(relPath ?? '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized) return true;
  const segments = normalized.split('/');
  if (segments.some((segment) => shouldSkipDir(segment))) return true;
  if (/SKILL\.md$/i.test(path.basename(normalized))) return true;
  return isNonUserDeliverablePath(normalized);
}

async function lstatPathWithoutLinks(projectDir, relativePath, fileSystem) {
  const segments = String(relativePath ?? '').replace(/\\/g, '/').split('/').filter(Boolean);
  let currentPath = path.resolve(projectDir);
  let finalStat;
  for (const segment of segments) {
    currentPath = path.join(currentPath, segment);
    finalStat = await fileSystem.lstat(currentPath);
    if (finalStat.isSymbolicLink()) {
      return { symbolicLink: true, stat: finalStat };
    }
  }
  return { symbolicLink: false, stat: finalStat };
}

/**
 * @param {string} relPath
 * @param {string} scopeDir
 */
function isUnderScope(relPath, scopeDir) {
  const normalized = String(relPath ?? '').replace(/\\/g, '/').replace(/^\/+/, '');
  const scope = String(scopeDir ?? '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!scope) return true;
  return normalized === scope || normalized.startsWith(`${scope}/`);
}

/**
 * @param {string} absDir
 * @param {string} relPrefix
 * @param {number} depth
 * @param {{
 *   files: Array<{path:string,basename:string}>,
 *   scannedCount: number,
 *   excludedCount: number,
 *   truncated: boolean,
 *   truncationReason?: string,
 *   stopped: boolean,
 *   seenPaths: Set<string>,
 *   budget: { remaining: number },
 * }} acc
 * @param {typeof fs} fileSystem
 */
async function listScopedFiles(absDir, relPrefix, depth, acc, fileSystem) {
  if (acc.stopped) return;
  if (depth > MAX_DEPTH) {
    acc.truncated = true;
    acc.truncationReason ??= 'max_depth_exceeded';
    return;
  }

  let entries;
  try {
    entries = await fileSystem.readdir(absDir, { withFileTypes: true });
  } catch (error) {
    if (!isMissingFsError(error)) {
      acc.truncated = true;
      acc.truncationReason ??= 'filesystem_error';
    }
    return;
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (acc.stopped) break;
    acc.scannedCount += 1;
    const relPath = `${relPrefix}/${entry.name}`.replace(/\/+/g, '/');

    if (entry.isSymbolicLink()) {
      acc.excludedCount += 1;
      continue;
    }

    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) {
        acc.excludedCount += 1;
        continue;
      }
      await listScopedFiles(path.join(absDir, entry.name), relPath, depth + 1, acc, fileSystem);
      continue;
    }

    if (!entry.isFile()) continue;
    if (shouldExcludeEvidencePath(relPath)) {
      acc.excludedCount += 1;
      continue;
    }

    const pathKey = relPath.toLowerCase();
    if (acc.seenPaths.has(pathKey)) continue;
    if (acc.budget.remaining <= 0) {
      acc.truncated = true;
      acc.truncationReason = 'file_budget_exceeded';
      acc.stopped = true;
      break;
    }

    acc.budget.remaining -= 1;
    acc.seenPaths.add(pathKey);
    acc.files.push({
      path: relPath,
      basename: entry.name,
    });
  }
}

/**
 * @param {string} projectDir
 * @param {string} scopeDir
 * @param {string[]} hintPaths
 * @param {typeof fs} fileSystem
 */
async function statPriorityHints(projectDir, scopeDir, hintPaths, fileSystem) {
  const files = [];
  const seenHints = new Set();
  const seenFiles = new Set();
  let truncated = false;
  let truncationReason;
  let excludedCount = 0;
  for (const rawHint of hintPaths) {
    const hint = String(rawHint ?? '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (
      !hint
      || hint.split('/').some((segment) => segment === '..')
      || seenHints.has(hint.toLowerCase())
    ) continue;
    seenHints.add(hint.toLowerCase());

    const candidates = hint.includes('/')
      ? [hint]
      : [`${scopeDir}/${hint}`];

    for (const candidate of candidates) {
      if (!isUnderScope(candidate, scopeDir)) continue;
      if (shouldExcludeEvidencePath(candidate)) {
        excludedCount += 1;
        continue;
      }
      const absPath = path.join(projectDir, ...candidate.split('/'));
      if (!isScopeWithinProject(projectDir, absPath)) continue;
      try {
        const inspected = await lstatPathWithoutLinks(projectDir, candidate, fileSystem);
        if (inspected.symbolicLink) {
          excludedCount += 1;
          continue;
        }
        const stat = inspected.stat;
        if (!stat.isFile()) continue;
        const pathKey = candidate.toLowerCase();
        if (seenFiles.has(pathKey)) break;
        seenFiles.add(pathKey);
        if (files.length >= MAX_FILES) {
          truncated = true;
          truncationReason = 'file_budget_exceeded';
          break;
        }
        files.push({
          path: candidate.replace(/\\/g, '/'),
          basename: path.basename(candidate),
          priority: true,
        });
        break;
      } catch (error) {
        if (!isMissingFsError(error)) {
          truncated = true;
          truncationReason ??= 'filesystem_error';
        }
      }
    }
  }
  return {
    files,
    truncated,
    truncationReason,
    excludedCount,
  };
}

export function parseTaskFolderSnapshotSlots(slotsRaw) {
  if (slotsRaw == null || (typeof slotsRaw === 'string' && !slotsRaw.trim())) {
    return [];
  }

  let parsed = slotsRaw;
  if (typeof slotsRaw === 'string') {
    try {
      parsed = JSON.parse(slotsRaw);
    } catch {
      throw snapshotInputError('slotsJson must be valid JSON');
    }
  }

  if (!Array.isArray(parsed)) {
    throw snapshotInputError('slotsJson must be an array');
  }
  if (parsed.some((slot) => !slot || typeof slot !== 'object' || Array.isArray(slot))) {
    throw snapshotInputError('slotsJson must be an array of slot objects');
  }
  return parsed;
}

/**
 * Build a bounded snapshot from one explicit task scope. Priority path hints are
 * reserved first, and only the remaining evidence budget is used for extras.
 *
 * @param {{
 *   projectDir: string,
 *   scopeDir: string,
 *   slots?: Array<Record<string, unknown>>,
 *   fileSystem?: typeof fs,
 * }} input
 */
export async function buildTaskFolderSnapshot(input) {
  const scopeDir = normalizeScopeDir(input.scopeDir);
  if (!scopeDir || (scopeDir !== 'artifacts' && !scopeDir.startsWith('artifacts/'))) {
    throw snapshotInputError('scopeDir must be under artifacts/');
  }
  if (!Array.isArray(input.slots ?? [])) {
    throw snapshotInputError('slots must be an array');
  }

  const projectDir = path.resolve(input.projectDir);
  const fileSystem = input.fileSystem ?? fs;
  const absDir = path.join(projectDir, ...scopeDir.split('/'));
  if (!isScopeWithinProject(projectDir, absDir)) {
    throw snapshotInputError('scopeDir escapes project root');
  }

  const slots = input.slots ?? [];
  const manifestLike = {
    slots,
    taskArtifactDir: scopeDir,
    goalVersion: 1,
    manifestVersion: 1,
    sessionGoalAnchor: '',
    compiledAtTurnId: 'snapshot',
  };

  let scopePreflight = {
    blocked: false,
    truncated: false,
    truncationReason: undefined,
    excludedCount: 0,
  };
  try {
    const inspectedScope = await lstatPathWithoutLinks(projectDir, scopeDir, fileSystem);
    if (inspectedScope.symbolicLink) {
      scopePreflight = {
        blocked: true,
        truncated: true,
        truncationReason: 'symbolic_link_excluded',
        excludedCount: 1,
      };
    }
  } catch (error) {
    if (!isMissingFsError(error)) {
      scopePreflight = {
        blocked: true,
        truncated: true,
        truncationReason: 'filesystem_error',
        excludedCount: 0,
      };
    }
  }

  const units = expandSlotsToContractUnits(manifestLike, scopeDir);
  const hintPaths = units.map((unit) => unit.expectedPath);
  for (const slot of slots) {
    if (slot?.pathHint) hintPaths.push(slot.pathHint);
    if (Array.isArray(slot?.pathHints)) hintPaths.push(...slot.pathHints);
  }

  const priority = scopePreflight.blocked
    ? {
      files: [],
      truncated: scopePreflight.truncated,
      truncationReason: scopePreflight.truncationReason,
      excludedCount: scopePreflight.excludedCount,
    }
    : await statPriorityHints(projectDir, scopeDir, hintPaths, fileSystem);
  const priorityPathKeys = new Set(priority.files.map((file) => file.path.toLowerCase()));
  const scanAcc = {
    files: [],
    scannedCount: 0,
    excludedCount: priority.excludedCount,
    truncated: priority.truncated,
    truncationReason: priority.truncationReason,
    stopped: scopePreflight.blocked || priority.truncationReason === 'file_budget_exceeded',
    seenPaths: priorityPathKeys,
    budget: { remaining: Math.max(0, MAX_FILES - priority.files.length) },
  };
  await listScopedFiles(absDir, scopeDir, 0, scanAcc, fileSystem);

  const evidenceFiles = [...priority.files, ...scanAcc.files].slice(0, MAX_FILES);
  const diskPaths = evidenceFiles.map((file) => file.path);
  const binding = bindContractUnitsStrict({
    manifest: manifestLike,
    diskPaths,
    scopeDir,
  });

  const unitBindingByPath = new Map();
  for (const unitBinding of binding.bindings) {
    if (!unitBinding.matched || !unitBinding.evidencePath) continue;
    const pathKey = unitBinding.evidencePath.toLowerCase();
    if (!unitBindingByPath.has(pathKey)) {
      unitBindingByPath.set(pathKey, {
        slotId: unitBinding.slotId,
        unitId: unitBinding.unitId,
      });
    }
  }

  const snapshotComplete = !scanAcc.truncated;
  const htmlSlotBasenames = collectSlotHtmlBasenames(slots);
  const files = evidenceFiles
    .filter((file) => {
      if (!isFolderSdmFilterEnabled() || htmlSlotBasenames.length === 0) return true;
      return !isOrphanIntermediateHtmlPath(file.path, htmlSlotBasenames);
    })
    .map((file) => {
    const unitBinding = unitBindingByPath.get(file.path.toLowerCase());
    const inContract = Boolean(unitBinding);
    return {
      path: file.path,
      basename: file.basename,
      inContract,
      slotId: unitBinding?.slotId,
      unitId: unitBinding?.unitId,
      isProcessFile: !inContract,
      resultClass: inContract ? 'contract' : 'useful_extra',
      snapshotState: snapshotComplete ? 'verified' : 'inconclusive',
    };
  });

  return {
    scopeDir,
    snapshotVersion: 2,
    truncated: scanAcc.truncated,
    scannedCount: scanAcc.scannedCount,
    excludedCount: scanAcc.excludedCount,
    snapshotComplete,
    truncationReason: scanAcc.truncationReason ?? null,
    binding: {
      requiredCount: binding.requiredCount,
      matchedCount: binding.matchedCount,
      complete: binding.complete && snapshotComplete,
      incompleteReason: snapshotComplete
        ? binding.incompleteReason
        : (binding.incompleteReason ?? 'snapshot_incomplete'),
    },
    files,
  };
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {{
 *   extractProjectDirectory?: typeof extractProjectDirectory,
 *   buildTaskFolderSnapshot?: typeof buildTaskFolderSnapshot,
 * } | unknown} [dependencies]
 */
export async function handleTaskFolderSnapshot(req, res, dependencies) {
  try {
    const resolvedDependencies = dependencies && typeof dependencies === 'object'
      ? dependencies
      : {};
    const resolveProjectDirectory = resolvedDependencies.extractProjectDirectory
      ?? extractProjectDirectory;
    const buildSnapshot = resolvedDependencies.buildTaskFolderSnapshot
      ?? buildTaskFolderSnapshot;
    const projectName = req.params.projectName;
    const slots = parseTaskFolderSnapshotSlots(req.query.slotsJson);
    const projectDir = await resolveProjectDirectory(projectName, req);
    if (!projectDir) {
      return res.status(404).json({ error: 'project not found' });
    }

    const snapshot = await buildSnapshot({
      projectDir,
      scopeDir: req.query.scopeDir,
      slots,
    });
    return res.json(snapshot);
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    return res.status(statusCode).json({ error: String(error?.message ?? error) });
  }
}

export function registerDeliverableTaskFolderRoutes(app, authenticateToken) {
  app.get(
    '/api/projects/:projectName/deliverables/task-folder-snapshot',
    authenticateToken,
    handleTaskFolderSnapshot,
  );
}
