import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  expandAmbiguousDeliverablePath,
  extractDeliverablePathsFromText,
  isLikelyDeliverablePath,
  normalizeArtifactPath,
  parsePilotdeckLink,
  toProjectApiPath,
  getArtifactFileName,
} from '../../../shared/artifactPaths';
import {
  parseSkillResourceUri,
  skillAssetEditorPath,
} from '../../../shared/skillResourcePaths';
import { supportsUnifiedFilePreview } from '../../../shared/projectPreviewCapabilities';
import { buildBentoFileOpenOptions } from '../../../shared/bentoStudioDock';
import type { FileOpenOptions } from '../../code-editor/utils/fileOpen';
import { getFileOpenHandler, requestFileOpen } from '../../../shared/fileOpenBridge';
import { resolveDeliverablePath } from '../../../shared/resolveDeliverablePath';
import { showGentleToast } from '../../../shared/gentleToast';
import { useMarkdownInteraction } from '../view/subcomponents/MarkdownInteractionContext';
import { api } from '../../../utils/api';

type DeliverablePathLinkProps = {
  path: string;
  children?: React.ReactNode;
  action?: 'open' | 'reveal' | 'preview';
  /** Full path or URL for hover tooltip */
  title?: string;
};

function resolveOpenHandler(
  onFileOpen?: (filePath: string, options?: FileOpenOptions | null) => void,
) {
  if (onFileOpen) {
    return (filePath: string, options?: FileOpenOptions | null) => {
      onFileOpen(filePath, options ?? null);
    };
  }
  const bridge = getFileOpenHandler();
  if (bridge) {
    return (filePath: string, options?: FileOpenOptions | null) => {
      requestFileOpen(filePath, options ?? null);
    };
  }
  return null;
}

export function DeliverablePathLink({ path, children, action = 'open', title: titleProp }: DeliverablePathLinkProps) {
  const { t } = useTranslation('chat');
  const interaction = useMarkdownInteraction();
  const selectedProject = interaction?.selectedProject;
  const projectRoot = interaction?.projectRoot || selectedProject?.fullPath || selectedProject?.path || '';
  const turnArtifactDir = interaction?.turnArtifactDir;
  const onFileOpen = interaction?.onFileOpen;

  const pilotdeck = parsePilotdeckLink(path);
  const rawPath = pilotdeck?.path || path;
  const skillResource = useMemo(() => parseSkillResourceUri(rawPath), [rawPath]);

  let normalized = expandAmbiguousDeliverablePath(normalizeArtifactPath(rawPath));
  if (!skillResource && !isLikelyDeliverablePath(normalized)) {
    const extracted = extractDeliverablePathsFromText(rawPath);
    if (extracted[0]) {
      normalized = expandAmbiguousDeliverablePath(normalizeArtifactPath(extracted[0]));
    }
  }
  const resolvedAction = pilotdeck?.action || action;
  const apiPath = skillResource ? null : toProjectApiPath(normalized, projectRoot);
  const label = children
    ?? (skillResource
      ? getArtifactFileName(skillResource.relativePath)
      : getArtifactFileName(normalized) ?? normalized);
  const isExternal = !skillResource && /^https?:\/\//i.test(normalized);

  const handleClick = useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (skillResource) {
      const openFile = resolveOpenHandler(onFileOpen);
      const editorPath = skillAssetEditorPath(skillResource.slug, skillResource.relativePath);
      const fileName = getArtifactFileName(skillResource.relativePath);
      openFile?.(
        editorPath,
        supportsUnifiedFilePreview(fileName) ? { initialPreview: true } : undefined,
      );
      return;
    }

    if (isExternal) {
      window.open(normalized, '_blank', 'noopener');
      return;
    }

    const openFile = resolveOpenHandler(onFileOpen);

    if (resolvedAction === 'reveal') {
      if (!selectedProject?.name || !apiPath) {
        openFile?.(apiPath || normalized);
        return;
      }
      try {
        const response = await api.revealProjectPath(selectedProject.name, apiPath, 'folder');
        const data = await response.json();
        if (!response.ok || data.success === false) {
          throw new Error(data.error);
        }
      } catch {
        openFile?.(apiPath || normalized, {
          initialPreview: true,
          ...(turnArtifactDir ? { hintDir: turnArtifactDir } : {}),
        });
      }
      return;
    }

    let openPath = apiPath || normalized;
    if (selectedProject?.name) {
      const resolved = await resolveDeliverablePath({
        projectName: selectedProject.name,
        path: openPath,
        turnArtifactDir,
        projectRoot,
      });
      if (resolved?.ambiguous) {
        showGentleToast(
          t('deliverables.ambiguousPathHint', {
            defaultValue: '同名文件存在于多个任务目录，请从文件 Tab 选择具体文件夹',
          }),
        );
        return;
      }
      if (resolved?.relativePath && !resolved.ambiguous) {
        openPath = resolved.relativePath;
      }
    }

    const fileName = openPath.split('/').pop() || openPath;
    const wantsPreview =
      resolvedAction === 'preview' || supportsUnifiedFilePreview(fileName);
    const bentoOptions = buildBentoFileOpenOptions(fileName, openPath, {
      hintDir: turnArtifactDir,
      bentoStudioMode: 'edit',
    });
    const openOptions: FileOpenOptions | null =
      bentoOptions
      ?? ((wantsPreview || turnArtifactDir)
        ? {
          ...(wantsPreview ? { initialPreview: true } : {}),
          ...(turnArtifactDir ? { hintDir: turnArtifactDir } : {}),
        }
        : null);

    if (openFile) {
      openFile(openPath, openOptions);
      return;
    }

    // PD-SAAS-FORK: never window.open relative deliverables — that reloads the SPA in a new tab.
  }, [
    apiPath,
    isExternal,
    normalized,
    onFileOpen,
    projectRoot,
    resolvedAction,
    selectedProject?.name,
    turnArtifactDir,
  ]);

  const isLinkable = skillResource || isExternal || (normalized && isLikelyDeliverablePath(normalized));
  if (!isLinkable) {
    return <span>{label}</span>;
  }

  const defaultTitle = skillResource
    ? t('deliverables.openSkillReference', { defaultValue: '打开技能参考文件' })
    : isExternal
      ? t('deliverables.openLink', { defaultValue: '打开链接' })
      : t('deliverables.openFile', { defaultValue: '打开文件' });

  return (
    <button
      type="button"
      onClick={(event) => void handleClick(event)}
      className="inline rounded-md border border-blue-200/80 bg-blue-50/70 px-1 py-0.5 font-mono text-[0.92em] text-info transition-colors hover:bg-blue-100 hover:underline dark:border-blue-900/50 dark:bg-blue-950/30 dark:hover:bg-blue-950/50"
      title={titleProp ?? defaultTitle}
    >
      {label}
    </button>
  );
}

export default DeliverablePathLink;
