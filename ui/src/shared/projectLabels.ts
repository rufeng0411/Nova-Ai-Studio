// PD-SAAS-FORK: user-facing project labels — hide internal "general" slug on mobile.
import type { TFunction } from 'i18next';
import type { Project, ProjectSession } from '../types/app';
import { projectDisplayName, sessionDisplayTitle } from '../lib/customNames';

export function isGeneralProject(project: Project | null | undefined): boolean {
  if (!project) return false;
  const name = project.name?.toLowerCase();
  const display = project.displayName?.toLowerCase();
  return name === 'general' || display === 'general';
}

/** Desktop/sidebar label — never expose raw "general" slug. */
export function friendlyProjectLabel(
  project: Project,
  t: TFunction,
): string {
  if (isGeneralProject(project)) {
    return t('sidebar:general.name', { defaultValue: '通用' }) as string;
  }
  return projectDisplayName(project);
}

type MobileChatTitleInput = {
  project: Project | null;
  session: ProjectSession | null;
  t: TFunction;
};

/** Mobile header title for the chat tab — session title first, else tab label. */
export function resolveMobileChatTitle({ project, session, t }: MobileChatTitleInput): string {
  const sessionTitle = session ? sessionDisplayTitle(session) : '';
  if (sessionTitle) return sessionTitle;

  if (project && !isGeneralProject(project)) {
    return projectDisplayName(project);
  }

  return t('tabs.chat', { defaultValue: '智能体', ns: 'common' }) as string;
}

/** Files tab header — project folder name only (never server absolute paths). */
export function resolveFilesTabRootLabel(project: Project, t: TFunction): string {
  return friendlyProjectLabel(project, t);
}

/** Subtitle under mobile chat title — only non-general project names. */
export function resolveMobileChatSubtitle({ project, session, t }: MobileChatTitleInput): string | undefined {
  const sessionTitle = session ? sessionDisplayTitle(session) : '';
  if (!sessionTitle || !project || isGeneralProject(project)) return undefined;
  return projectDisplayName(project);
}
