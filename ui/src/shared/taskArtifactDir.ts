// PD-SAAS-FORK: STDA path helpers — browser-safe (no node:fs, no src/ imports).

/** Matches artifacts/task-{YYYYMMDD}-{id8} or conflict suffix -2, -3, … */
export const TASK_ARTIFACT_DIR_REGEX =
  /^artifacts\/task-\d{8}-[a-f0-9]{8}(-\d+)?(\/|$)/i;

export function isTaskArtifactDirPath(dir: string | null | undefined): boolean {
  if (!dir || typeof dir !== 'string') return false;
  const normalized = dir.replace(/\\/g, '/').replace(/\/+$/, '');
  return TASK_ARTIFACT_DIR_REGEX.test(`${normalized}/`);
}

export function extractTaskDirKeyFromPath(taskArtifactDir: string): string | undefined {
  const normalized = taskArtifactDir.replace(/\\/g, '/').replace(/\/+$/, '');
  const match = normalized.match(/^artifacts\/task-(\d{8}-[a-f0-9]{8}(?:-\d+)?)$/i);
  return match?.[1]?.toLowerCase();
}
