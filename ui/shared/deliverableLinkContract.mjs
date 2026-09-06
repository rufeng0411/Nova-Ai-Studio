import {
  isNonUserDeliverablePath,
  sanitizeDeliverableLookupPath,
} from './deliverablePathResolve.mjs';

export const DELIVERABLE_LINK_ENTRIES = [
  'bodyLink',
  'deliverableCard',
  'fileTree',
  'rightDock',
  'overlay',
];

function normalizePath(raw) {
  return sanitizeDeliverableLookupPath(raw).replace(/\\/g, '/');
}

function dirname(filePath) {
  const normalized = normalizePath(filePath);
  const index = normalized.lastIndexOf('/');
  return index > 0 ? normalized.slice(0, index) : '';
}

function statusForPath(filePath, validationStatus) {
  if (!filePath || isNonUserDeliverablePath(filePath)) return 'hidden';
  if (/\.(?:py|mjs|js|ts|tsx|sh|bat|ps1)$/i.test(filePath)) return 'hidden';
  if (validationStatus === 'verified' || validationStatus === 'softVerified') return validationStatus;
  if (validationStatus === 'phantom' || validationStatus === 'broken') return 'hidden';
  return 'pending';
}

export function buildDeliverableLinkContract(input) {
  const path = normalizePath(input.resolvedPath || input.apiPath);
  const displayStatus = statusForPath(path, input.validationStatus);
  const entryPath = displayStatus === 'hidden' ? '' : path;
  return {
    path: entryPath,
    apiPath: normalizePath(input.apiPath),
    resolvedPath: entryPath,
    hintDir: normalizePath(input.hintDir),
    turnArtifactDir: normalizePath(input.turnArtifactDir),
    folderPath: dirname(entryPath || input.turnArtifactDir || input.hintDir),
    displayStatus,
    entries: Object.fromEntries(DELIVERABLE_LINK_ENTRIES.map((entry) => [entry, entryPath])),
  };
}
