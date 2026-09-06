import type { CodeEditorDiffInfo, CodeEditorFile } from '../types/types';
import { isMarkdownEditorFile, isPreviewableEditorFile } from '../utils/previewableFile';

export type FileOpenOptions = {
  diffInfo?: CodeEditorDiffInfo | null;
  initialPreview?: boolean;
  /** PD-SAAS-FORK: design canvas view/edit when gate ON (edit only in sidebar) */
  designCanvasMode?: 'view' | 'edit';
  /** PD-SAAS-FORK: HTML Studio view/edit when gate ON (edit only in sidebar) */
  htmlStudioMode?: 'view' | 'edit';
  /** PD-SAAS-FORK: HyperFrames Studio view/edit when gate ON (edit only in sidebar) */
  hfStudioMode?: 'view' | 'edit';
  /** PD-SAAS-FORK: Bento deck view/edit when gate ON (edit only in sidebar) */
  bentoStudioMode?: 'view' | 'edit';
  hintDir?: string;
  /** PD-SAAS-FORK: path already scoped — skip Bridge file/resolve (dock / body link). */
  skipResolve?: boolean;
};

function isDiffInfo(value: unknown): value is CodeEditorDiffInfo {
  if (!value || typeof value !== 'object') return false;
  return 'old_string' in value || 'new_string' in value;
}

function isFileOpenOptions(value: unknown): value is FileOpenOptions {
  if (!value || typeof value !== 'object') return false;
  return 'initialPreview' in value || 'designCanvasMode' in value || 'htmlStudioMode' in value || 'hfStudioMode' in value || 'bentoStudioMode' in value || 'hintDir' in value || 'skipResolve' in value || ('diffInfo' in value && !isDiffInfo(value));
}

export function parseFileOpenArgs(
  second?: CodeEditorDiffInfo | FileOpenOptions | null,
): { diffInfo: CodeEditorDiffInfo | null; initialPreview: boolean; designCanvasMode?: 'view' | 'edit'; htmlStudioMode?: 'view' | 'edit'; hfStudioMode?: 'view' | 'edit'; bentoStudioMode?: 'view' | 'edit'; hintDir?: string; skipResolve?: boolean } {
  if (!second) {
    return { diffInfo: null, initialPreview: false };
  }
  if (isDiffInfo(second)) {
    return { diffInfo: second, initialPreview: false };
  }
  if (isFileOpenOptions(second)) {
    return {
      diffInfo: second.diffInfo ?? null,
      initialPreview: Boolean(second.initialPreview),
      designCanvasMode: second.designCanvasMode,
      htmlStudioMode: second.htmlStudioMode,
      hfStudioMode: second.hfStudioMode,
      bentoStudioMode: second.bentoStudioMode,
      hintDir: second.hintDir,
      skipResolve: second.skipResolve,
    };
  }
  return { diffInfo: second as CodeEditorDiffInfo, initialPreview: false };
}

export function resolveInitialPreview(
  fileName: string,
  diffInfo: CodeEditorDiffInfo | null,
  explicitPreview: boolean,
  explicitProvided: boolean,
): boolean {
  if (diffInfo) return false;
  if (isMarkdownEditorFile(fileName)) return true;
  if (explicitProvided) return explicitPreview;
  return isPreviewableEditorFile(fileName);
}

export function buildEditorFile(
  filePath: string,
  projectName: string | undefined,
  diffInfo: CodeEditorDiffInfo | null,
  initialPreview: boolean,
  extras?: Pick<FileOpenOptions, 'designCanvasMode' | 'htmlStudioMode' | 'hfStudioMode' | 'bentoStudioMode' | 'hintDir' | 'skipResolve'>,
): CodeEditorFile {
  const normalizedPath = filePath.replace(/\\/g, '/').trim();
  const fileName = normalizedPath.split('/').pop() || normalizedPath;
  return {
    name: fileName,
    path: normalizedPath,
    projectName,
    diffInfo,
    initialPreview,
    designCanvasMode: extras?.designCanvasMode,
    htmlStudioMode: extras?.htmlStudioMode,
    hfStudioMode: extras?.hfStudioMode,
    bentoStudioMode: extras?.bentoStudioMode,
    hintDir: extras?.hintDir,
    skipResolve: extras?.skipResolve,
  };
}
