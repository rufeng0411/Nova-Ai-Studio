// PD-SAAS-FORK: Edit Dock protocol for HyperFrames Studio
import type { FileOpenOptions } from '../components/code-editor/utils/fileOpen';
import { isHfStudioEnabled } from './hfStudioGate';
import { supportsHyperframesStudioEdit, resolveHfProjectIndexPath } from './hfStudioSupport';

export type HfStudioDockOptions = {
  hintDir?: string;
  hfStudioMode?: 'view' | 'edit';
};

export function buildHfStudioFileOpenOptions(
  fileName: string,
  apiPath: string,
  siblings?: string[],
  options?: HfStudioDockOptions,
): FileOpenOptions | undefined {
  if (!isHfStudioEnabled()) return undefined;
  if (!supportsHyperframesStudioEdit(fileName, apiPath, siblings)) return undefined;
  const mode = options?.hfStudioMode ?? 'view';
  const indexPath = resolveHfProjectIndexPath(apiPath, siblings);
  return {
    initialPreview: true,
    hfStudioMode: mode,
    htmlStudioMode: undefined,
    hintDir: options?.hintDir,
    openPath: indexPath !== apiPath ? indexPath : undefined,
  };
}

export function openHfStudioInSidebar(
  onFileOpen: ((filePath: string, options?: FileOpenOptions | null) => void) | undefined,
  apiPath: string,
  fileName: string,
  siblings: string[] | undefined,
  options?: HfStudioDockOptions,
): boolean {
  if (!onFileOpen || !apiPath) return false;
  const indexPath = resolveHfProjectIndexPath(apiPath, siblings);
  const openOptions = buildHfStudioFileOpenOptions(fileName, apiPath, siblings, {
    ...options,
    hfStudioMode: 'edit',
  });
  if (!openOptions) return false;
  onFileOpen(openOptions.openPath ?? indexPath, openOptions);
  return true;
}
