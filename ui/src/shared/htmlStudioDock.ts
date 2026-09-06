// PD-SAAS-FORK: Edit Dock protocol for HTML Studio — overlay closes, sidebar opens in edit mode
import type { FileOpenOptions } from '../components/code-editor/utils/fileOpen';
import { isHtmlStudioEnabled } from './htmlStudioGate';
import { supportsHtmlStudioEdit } from './htmlStudioSupport';

export type HtmlStudioDockOptions = {
  hintDir?: string;
  htmlStudioMode?: 'view' | 'edit';
};

export function buildHtmlStudioFileOpenOptions(
  fileName: string,
  apiPath: string,
  pagesCount: number,
  options?: HtmlStudioDockOptions,
): FileOpenOptions | undefined {
  if (!isHtmlStudioEnabled()) return undefined;
  if (!supportsHtmlStudioEdit(fileName, apiPath, pagesCount)) return undefined;
  const mode = options?.htmlStudioMode ?? 'view';
  return {
    initialPreview: true,
    htmlStudioMode: mode,
    hintDir: options?.hintDir,
  };
}

export function openHtmlStudioInSidebar(
  onFileOpen: ((filePath: string, options?: FileOpenOptions | null) => void) | undefined,
  apiPath: string,
  fileName: string,
  pagesCount: number,
  options?: HtmlStudioDockOptions,
): boolean {
  if (!onFileOpen || !apiPath) return false;
  const openOptions = buildHtmlStudioFileOpenOptions(fileName, apiPath, pagesCount, {
    ...options,
    htmlStudioMode: 'edit',
  });
  if (!openOptions) return false;
  onFileOpen(apiPath, openOptions);
  return true;
}
