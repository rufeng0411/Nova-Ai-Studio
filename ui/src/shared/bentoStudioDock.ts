// PD-SAAS-FORK: Bento deck open options — deliverable click opens sidebar edit directly
import type { FileOpenOptions } from '../components/code-editor/utils/fileOpen';
import { isBentoDeckEnabled } from './bentoStudioGate';
import {
  defaultBentoStudioMode,
  isBentoDeckFile,
  supportsBentoDeckEdit,
} from './bentoStudioSupport';

export type BentoStudioDockOptions = {
  hintDir?: string;
  bentoStudioMode?: 'view' | 'edit';
};

export function buildBentoFileOpenOptions(
  fileName: string,
  apiPath: string,
  options?: BentoStudioDockOptions,
): FileOpenOptions | undefined {
  if (!isBentoDeckEnabled()) return undefined;
  if (!supportsBentoDeckEdit(fileName, apiPath)) return undefined;
  const mode = options?.bentoStudioMode ?? defaultBentoStudioMode(fileName, apiPath);
  return {
    initialPreview: true,
    bentoStudioMode: mode,
    hintDir: options?.hintDir,
  };
}

export function openBentoDeckInSidebar(
  onFileOpen: ((filePath: string, options?: FileOpenOptions | null) => void) | undefined,
  apiPath: string,
  fileName: string,
  options?: BentoStudioDockOptions,
): boolean {
  if (!onFileOpen || !apiPath) return false;
  const openOptions = buildBentoFileOpenOptions(fileName, apiPath, {
    ...options,
    bentoStudioMode: 'edit',
  });
  if (!openOptions) return false;
  onFileOpen(apiPath, openOptions);
  return true;
}

export { isBentoDeckFile };
