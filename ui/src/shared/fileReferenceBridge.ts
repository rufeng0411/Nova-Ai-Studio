// PD-SAAS-FORK: connect Files tab context menu → chat composer @-mentions
export type FileReferenceHandler = (paths: string[]) => void;

let handler: FileReferenceHandler | null = null;

export function registerFileReferenceHandler(next: FileReferenceHandler | null): void {
  handler = next;
}

/** Insert paths into the chat input like selecting files from the @ menu. */
export function requestFileReferences(paths: string[]): boolean {
  if (!handler || paths.length === 0) {
    return false;
  }
  handler(paths);
  return true;
}
