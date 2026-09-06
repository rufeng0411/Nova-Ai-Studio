// PD-SAAS-FORK: Edit Dock protocol — overlay closes, sidebar opens in edit mode
import type { FileOpenOptions } from '../components/code-editor/utils/fileOpen';
import { isDesignCanvasEnabled } from './designCanvasGate';
import { supportsDesignCanvasEdit } from './designCanvasSupport';

export type DesignCanvasDockOptions = {
  hintDir?: string;
  /** When true, open sidebar in design canvas edit mode (sidebar only). */
  designCanvasMode?: 'view' | 'edit';
};

export function buildDesignCanvasFileOpenOptions(
  fileName: string,
  apiPath: string,
  options?: DesignCanvasDockOptions,
): FileOpenOptions | undefined {
  if (!isDesignCanvasEnabled()) return undefined;
  if (!supportsDesignCanvasEdit(fileName, apiPath)) return undefined;
  const mode = options?.designCanvasMode ?? 'view';
  return {
    initialPreview: true,
    designCanvasMode: mode,
    hintDir: options?.hintDir,
  };
}

export function openDesignCanvasInSidebar(
  onFileOpen: ((filePath: string, options?: FileOpenOptions | null) => void) | undefined,
  apiPath: string,
  fileName: string,
  options?: DesignCanvasDockOptions,
): boolean {
  if (!onFileOpen || !apiPath) return false;
  const openOptions = buildDesignCanvasFileOpenOptions(fileName, apiPath, {
    ...options,
    designCanvasMode: 'edit',
  });
  if (!openOptions) return false;
  onFileOpen(apiPath, openOptions);
  return true;
}
