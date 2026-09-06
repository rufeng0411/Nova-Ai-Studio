// PD-SAAS-FORK: redirect new-turn writes into the assigned STDA task root.
import { basename, posix as pathPosix } from "node:path";
import {
  isSemanticArtifactDirPath,
  isTaskArtifactDirPath,
  type SessionTaskDirectory,
} from "./sessionTaskDirectoryCore.js";

const CANVAS_DIR_REGEX = /^artifacts\/canvas-[^/]+(\/|$)/i;
const TASK_ARTIFACT_SUBPATH_REGEX = /^artifacts\/task-[^/]+\/(.+)$/i;

export function isCanvasArtifactPath(inputPath: string): boolean {
  const normalized = String(inputPath ?? "").replace(/\\/g, "/").replace(/\/+$/, "");
  return CANVAS_DIR_REGEX.test(`${normalized}/`)
    || normalized.includes("/canvas/");
}

export function normalizeArtifactRelativePath(inputPath: string): string {
  return String(inputPath ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
}

/** Soft-redirect write paths into taskArtifactDir; legacy read paths are untouched at call sites. */
export function redirectWritePathToTaskDir(
  inputPath: string,
  taskArtifactDir: string | undefined,
  options?: { allowCanvas?: boolean; knownTaskDirs?: string[] },
): string {
  const normalized = normalizeArtifactRelativePath(inputPath);
  if (!taskArtifactDir || !normalized) return inputPath;

  const taskRoot = taskArtifactDir.replace(/\\/g, "/").replace(/\/+$/, "");

  const knownDirs = (options?.knownTaskDirs ?? [])
    .map((dir) => dir.replace(/\\/g, "/").replace(/\/+$/, ""))
    .filter(Boolean);
  for (const known of knownDirs) {
    if (normalized === known || normalized.startsWith(`${known}/`)) {
      return normalized;
    }
  }

  if (normalized === taskRoot || normalized.startsWith(`${taskRoot}/`)) {
    return normalized;
  }

  if (options?.allowCanvas !== false && isCanvasArtifactPath(normalized)) {
    return normalized;
  }

  const fileName = basename(normalized.replace(/\\/g, "/"));

  // PD-SAAS-FORK Fix-7: process/tmp paths redirect to task root basename only.
  if (/^(?:tmp_workspace|tmp|temp)(?:\/|$)/i.test(normalized)) {
    return `${taskRoot}/${fileName || "output"}`;
  }
  if (!fileName) return `${taskRoot}/output`;

  const taskScoped = normalized.match(TASK_ARTIFACT_SUBPATH_REGEX);
  if (taskScoped?.[1]) {
    const tail = taskScoped[1].replace(/\.\./g, "");
    return pathPosix.join(taskRoot, tail);
  }

  if (normalized.includes("/") && !normalized.startsWith("artifacts/")) {
    const safeTail = normalized.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\.\./g, "");
    return pathPosix.join(taskRoot, safeTail);
  }

  if (
    isSemanticArtifactDirPath(normalized)
    || normalized.startsWith("artifacts/")
    || !normalized.includes("/")
  ) {
    return `${taskRoot}/${fileName}`;
  }

  const relativeTail = normalized.includes("/")
    ? normalized.split("/").slice(-2).join("/")
    : fileName;
  const safeTail = relativeTail.replace(/\.\./g, "");
  return pathPosix.join(taskRoot, safeTail);
}

export function shouldGuardWritePath(taskDirectory?: SessionTaskDirectory | null): boolean {
  return Boolean(taskDirectory?.taskArtifactDir && isTaskArtifactDirPath(taskDirectory.taskArtifactDir));
}

/** PD-SAAS-FORK three-case RCA P0-E: path belongs to a different task-* root than scopeDir. */
export function isCrossTaskArtifactPath(
  inputPath: string,
  scopeDir: string | undefined,
): boolean {
  const normalized = normalizeArtifactRelativePath(inputPath);
  const scope = normalizeArtifactRelativePath(String(scopeDir ?? "")).replace(/\/+$/, "");
  if (!normalized || !scope) return false;
  const taskMatch = normalized.match(/^artifacts\/task-[^/]+/i);
  if (!taskMatch) return false;
  const pathRoot = taskMatch[0].toLowerCase();
  const scopeRoot = scope.match(/^artifacts\/task-[^/]+/i)?.[0]?.toLowerCase();
  if (!scopeRoot) return false;
  return pathRoot !== scopeRoot;
}
