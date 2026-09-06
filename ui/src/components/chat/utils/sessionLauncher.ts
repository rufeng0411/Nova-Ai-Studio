import type { Project, ProjectSession } from '../../../types/app';
import type { CapabilityBindingContext } from '../../../shared/capabilityBinding';
import type { ChatAttachment, PilotDeckSettings, PermissionMode } from '../types/types';
import { getPilotDeckSettings, safeLocalStorage } from './chatStorage';
import i18n from '../../../i18n/config';

type StartSessionOptions = {
  sendMessage: (message: unknown) => void;
  selectedProject: Project;
  command: string;
  sessionId?: string | null;
  temporarySessionId?: string;
  permissionMode?: PermissionMode | string;
  basePermissionMode?: PermissionMode | string;
  model?: string;
  sessionSummary?: string | null;
  toolsSettings?: PilotDeckSettings;
  images?: unknown[];
  attachments?: ChatAttachment[];
  alwaysOnPlanId?: string;
  alwaysOnExecutionToken?: string;
  workspaceCwd?: string;
  /** PD-SAAS-FORK: Hub「试一下」首次发送时锁定技能 */
  capabilityContext?: CapabilityBindingContext | null;
  /** PD-SAAS-FORK: recovery / repair / cold-resume must not occupy a new turn-queue slot. */
  resumeKind?: string;
};

const VALID_PERMISSION_MODES = new Set<PermissionMode>([
  'default',
  'acceptEdits',
  'bypassPermissions',
  'plan',
]);

export const isTemporarySessionId = (sessionId: string | null | undefined) =>
  Boolean(sessionId && sessionId.startsWith('new-session-'));

export function createTemporarySessionId(): string {
  return `new-session-${Date.now()}`;
}

export function getNotificationSessionSummary(
  selectedSession: ProjectSession | null,
  fallbackInput: string,
): string | null {
  const sessionSummary =
    selectedSession?.summary || selectedSession?.name || selectedSession?.title;
  if (typeof sessionSummary === 'string' && sessionSummary.trim()) {
    const normalized = sessionSummary.replace(/\s+/g, ' ').trim();
    return normalized.length > 80
      ? `${normalized.slice(0, 77)}...`
      : normalized;
  }

  const normalizedFallback = fallbackInput.replace(/\s+/g, ' ').trim();
  if (!normalizedFallback) {
    return null;
  }

  return normalizedFallback.length > 80
    ? `${normalizedFallback.slice(0, 77)}...`
    : normalizedFallback;
}

export function getStoredPermissionMode(
  selectedSession: ProjectSession | null,
): PermissionMode {
  if (!selectedSession?.id) {
    return 'default';
  }

  const stored = safeLocalStorage.getItem(`permissionMode-${selectedSession.id}`);
  if (stored && VALID_PERMISSION_MODES.has(stored as PermissionMode)) {
    return stored as PermissionMode;
  }

  return 'default';
}

export function getSelectedProjectPath(selectedProject: Project): string {
  return selectedProject.fullPath || selectedProject.path || '';
}

/** PD-SAAS-FORK: gateway session anchor (canonical) vs file root. */
export function getSessionProjectPath(selectedProject: Project): string {
  const sessionKey =
    typeof selectedProject.sessionProjectKey === 'string'
      ? selectedProject.sessionProjectKey
      : '';
  return sessionKey || getSelectedProjectPath(selectedProject);
}

/** PD-SAAS-FORK: always pin tool cwd to the UI file root (canonical hub when sync on). */
export function getWorkspaceCwdForProject(selectedProject: Project): string | undefined {
  const fileRoot = getSelectedProjectPath(selectedProject);
  return fileRoot || undefined;
}

export function startSessionCommand({
  sendMessage,
  selectedProject,
  command,
  sessionId,
  temporarySessionId,
  permissionMode = 'default',
  basePermissionMode,
  model,
  sessionSummary,
  toolsSettings = getPilotDeckSettings(),
  images,
  attachments,
  alwaysOnPlanId,
  alwaysOnExecutionToken,
  workspaceCwd,
  capabilityContext,
  resumeKind,
}: StartSessionOptions): string {
  const sessionToActivate =
    sessionId || temporarySessionId || createTemporarySessionId();
  const sessionProjectPath = getSessionProjectPath(selectedProject);
  const resolvedWorkspaceCwd = workspaceCwd ?? getWorkspaceCwdForProject(selectedProject);
  // PD-SAAS-FORK: per-turn UI language so agent narration matches zh-CN without waiting for yaml reload.
  const promptLanguage = i18n.language === 'zh-CN' ? 'zh-CN' : 'en';

  sendMessage({
    type: 'pilotdeck-command',
    command,
    options: {
      ...(sessionId ? { sessionId, resume: true } : {}),
      projectPath: sessionProjectPath,
      cwd: sessionProjectPath,
      projectName: selectedProject.name,
      toolsSettings,
      permissionMode,
      ...(basePermissionMode ? { basePermissionMode } : {}),
      ...(model ? { model } : {}),
      sessionSummary,
      ...(alwaysOnPlanId ? { alwaysOnPlanId } : {}),
      ...(alwaysOnExecutionToken ? { alwaysOnExecutionToken } : {}),
      ...(Array.isArray(images) && images.length > 0 ? { images } : {}),
      ...(Array.isArray(attachments) && attachments.length > 0 ? { attachments } : {}),
      ...(resolvedWorkspaceCwd ? { workspaceCwd: resolvedWorkspaceCwd } : {}),
      ...(capabilityContext?.slug
        ? { capabilityContext }
        : {}),
      promptLanguage,
      ...(resumeKind ? { resumeKind } : {}),
    },
  });

  return sessionToActivate;
}
