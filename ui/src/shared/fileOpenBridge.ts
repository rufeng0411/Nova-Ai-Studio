// PD-SAAS-FORK: global fallback when Markdown renders outside interaction context
import type { FileOpenOptions } from '../components/code-editor/utils/fileOpen';

export type FileOpenHandler = (
  filePath: string,
  options?: FileOpenOptions | null,
) => void;

let handler: FileOpenHandler | null = null;

export function registerFileOpenHandler(next: FileOpenHandler | null): void {
  handler = next;
}

export function getFileOpenHandler(): FileOpenHandler | null {
  return handler;
}

export function requestFileOpen(
  filePath: string,
  options?: FileOpenOptions | null,
): boolean {
  if (!handler || !filePath) {
    return false;
  }
  handler(filePath, options ?? null);
  return true;
}
