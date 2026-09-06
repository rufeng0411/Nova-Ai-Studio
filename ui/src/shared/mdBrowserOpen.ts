// PD-SAAS-FORK: open Markdown browser in a new window + local file IO helpers

export const MD_BROWSER_PATH = '/tools/md-browser';
const STORAGE_PREFIX = 'nova.mdBrowser.v1.';
const PAYLOAD_TTL_MS = 5 * 60_000;

export type MdBrowserPayload = {
  content: string;
  fileName: string;
  exp: number;
};

export function isMarkdownFileName(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return lower.endsWith('.md') || lower.endsWith('.markdown');
}

export function isMarkdownFile(file: File): boolean {
  if (isMarkdownFileName(file.name)) return true;
  const type = (file.type || '').toLowerCase();
  return type === 'text/markdown' || type === 'text/x-markdown';
}

const PROJECT_MEMORY_KEY = 'nova.mdBrowser.project';

export function rememberMdBrowserProject(projectName: string | null | undefined): void {
  const name = typeof projectName === 'string' ? projectName.trim() : '';
  if (!name) return;
  try {
    localStorage.setItem(PROJECT_MEMORY_KEY, name);
  } catch {
    // ignore
  }
}

export function readRememberedMdBrowserProject(): string | null {
  try {
    const raw = localStorage.getItem(PROJECT_MEMORY_KEY);
    return raw && raw.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
}

export function buildMdBrowserHref(opts?: {
  sid?: string | null;
  project?: string | null;
}): string {
  const basename = typeof window !== 'undefined' ? (window.__ROUTER_BASENAME__ || '') : '';
  const base = basename.replace(/\/$/, '');
  const path = `${base}${MD_BROWSER_PATH}`;
  const url = new URL(path, typeof window !== 'undefined' ? window.location.origin : 'http://local');
  if (opts?.sid) url.searchParams.set('sid', opts.sid);
  if (opts?.project?.trim()) {
    url.searchParams.set('project', opts.project.trim());
    rememberMdBrowserProject(opts.project);
  }
  const qs = url.searchParams.toString();
  return qs ? `${url.pathname}?${qs}` : url.pathname;
}

export function stashMdBrowserPayload(content: string, fileName: string): string {
  const sid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const payload: MdBrowserPayload = {
    content,
    fileName: fileName || 'untitled.md',
    exp: Date.now() + PAYLOAD_TTL_MS,
  };
  try {
    localStorage.setItem(STORAGE_PREFIX + sid, JSON.stringify(payload));
  } catch {
    // quota / private mode — open blank window
  }
  return sid;
}

export function takeMdBrowserPayload(sid: string): { content: string; fileName: string } | null {
  if (!sid) return null;
  const key = STORAGE_PREFIX + sid;
  try {
    const raw = localStorage.getItem(key);
    localStorage.removeItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MdBrowserPayload;
    if (!parsed || typeof parsed.content !== 'string') return null;
    if (typeof parsed.exp === 'number' && parsed.exp < Date.now()) return null;
    return {
      content: parsed.content,
      fileName: typeof parsed.fileName === 'string' && parsed.fileName ? parsed.fileName : 'untitled.md',
    };
  } catch {
    return null;
  }
}

export function openMdBrowserWindow(opts?: {
  sid?: string | null;
  project?: string | null;
}): Window | null {
  const href = buildMdBrowserHref(opts);
  return window.open(href, '_blank', 'noopener,noreferrer');
}

export async function openMdBrowserWithFile(
  file: File,
  opts?: { project?: string | null },
): Promise<Window | null> {
  const content = await file.text();
  const sid = stashMdBrowserPayload(content, file.name || 'untitled.md');
  return openMdBrowserWindow({ sid, project: opts?.project });
}

export async function openMdBrowserWithFiles(
  files: File[],
  opts?: { project?: string | null },
): Promise<number> {
  let opened = 0;
  for (const file of files) {
    if (!isMarkdownFile(file)) continue;
    const win = await openMdBrowserWithFile(file, opts);
    if (win) opened += 1;
  }
  return opened;
}

type FilePickerAccept = {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<FileSystemFileHandle>;
};

export async function pickLocalMarkdownFile(): Promise<{
  content: string;
  fileName: string;
  handle: FileSystemFileHandle | null;
} | null> {
  const w = window as Window & FilePickerAccept;
  if (typeof w.showOpenFilePicker === 'function') {
    try {
      const [handle] = await w.showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: 'Markdown',
            accept: { 'text/markdown': ['.md', '.markdown'] },
          },
        ],
      });
      if (!handle) return null;
      const file = await handle.getFile();
      return {
        content: await file.text(),
        fileName: file.name || 'untitled.md',
        handle,
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return null;
      // fall through to input
    }
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,text/markdown';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      void file.text().then((content) => {
        resolve({ content, fileName: file.name || 'untitled.md', handle: null });
      });
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function saveMarkdownAs(
  content: string,
  suggestedName = 'untitled.md',
): Promise<'saved' | 'downloaded' | 'cancelled'> {
  const name = suggestedName.endsWith('.md') || suggestedName.endsWith('.markdown')
    ? suggestedName
    : `${suggestedName}.md`;
  const w = window as Window & FilePickerAccept;
  if (typeof w.showSaveFilePicker === 'function') {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: name,
        types: [
          {
            description: 'Markdown',
            accept: { 'text/markdown': ['.md', '.markdown'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return 'saved';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
