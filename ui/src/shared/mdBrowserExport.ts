// PD-SAAS-FORK: Markdown 浏览器 → 复用 export_document（Playwright PDF / docx-js Word）
import { api } from '../utils/api';
import { triggerAuthFileDownload } from '../utils/triggerAuthFileDownload';
import { readRememberedMdBrowserProject } from './mdBrowserOpen';

export type MdBrowserExportFormat = 'pdf' | 'docx';

const POLL_MS = 1200;
const MAX_POLLS = 150;

export function sanitizeMdBrowserBaseName(fileName: string): string {
  const stripped = fileName.replace(/\.(md|markdown)$/i, '').trim() || 'untitled';
  return stripped
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_')
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'untitled';
}

/** 仅用于展示/测试；实际导出由 Bridge export-content 服务端落盘。 */
export function buildMdBrowserStagePath(fileName: string): string {
  const base = sanitizeMdBrowserBaseName(fileName);
  return `artifacts/md-browser/${base}.md`;
}

type ProjectRow = { name?: unknown; displayName?: unknown };

export async function resolveMdBrowserExportProject(
  preferred?: string | null,
): Promise<string | null> {
  const fromArg = typeof preferred === 'string' ? preferred.trim() : '';
  if (fromArg) return fromArg;
  const remembered = readRememberedMdBrowserProject();
  if (remembered) return remembered;

  try {
    const res = await api.projects({ fresh: true });
    if (!res.ok) return null;
    const data = (await res.json()) as ProjectRow[] | { projects?: ProjectRow[] };
    const list = Array.isArray(data) ? data : Array.isArray(data.projects) ? data.projects : [];
    const names = list
      .map((p) => (typeof p?.name === 'string' ? p.name.trim() : ''))
      .filter(Boolean);
    if (names.length === 0) return null;
    const general = names.find((n) => n === 'general' || n.startsWith('general'));
    return general || names[0] || null;
  } catch {
    return null;
  }
}

export async function exportMarkdownFromBrowser(opts: {
  projectName?: string | null;
  content: string;
  fileName: string;
  format: MdBrowserExportFormat;
}): Promise<{ projectName: string; sourcePath: string; resultPath: string }> {
  const projectName = await resolveMdBrowserExportProject(opts.projectName);
  if (!projectName) throw new Error('export_no_project');

  const markdown = typeof opts.content === 'string' ? opts.content : '';
  if (!markdown.trim()) throw new Error('export_empty_content');

  const started = await api.startExportFromContent(projectName, {
    content: markdown,
    fileName: opts.fileName || 'untitled.md',
    format: opts.format,
    engine: 'export_document',
    bundle: false,
  });
  const jobId = typeof started?.jobId === 'string' ? started.jobId : '';
  if (!jobId) throw new Error('export_missing_job');
  const sourcePath =
    typeof started?.sourcePath === 'string' && started.sourcePath
      ? started.sourcePath
      : buildMdBrowserStagePath(opts.fileName);

  for (let i = 0; i < MAX_POLLS; i += 1) {
    const snapshot = await api.pollExportJob(projectName, jobId);
    if (snapshot.status === 'done') {
      const resultPath = typeof snapshot.relativePath === 'string' ? snapshot.relativePath : '';
      if (!resultPath) throw new Error('export_missing_output');
      const dl = await triggerAuthFileDownload(projectName, resultPath);
      if (!dl.ok) throw new Error(dl.reason || 'export_download_failed');
      return { projectName, sourcePath, resultPath };
    }
    if (snapshot.status === 'failed') {
      throw new Error(snapshot.error || 'export_failed');
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error('export_timeout');
}

export function mapMdBrowserExportError(code: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const keyByCode: Record<string, string> = {
    export_no_project: 'mdBrowserExportNoProject',
    export_empty_content: 'mdBrowserExportEmpty',
    export_timeout: 'mdBrowserExportTimeout',
    export_download_failed: 'mdBrowserExportDownloadFailed',
    'Project not found': 'mdBrowserExportNoProject',
  };
  const mapped = keyByCode[code];
  if (mapped) {
    return t(mapped, {
      defaultValue:
        mapped === 'mdBrowserExportNoProject'
          ? '未找到可用项目，请先登录工作台后再导出'
          : mapped === 'mdBrowserExportEmpty'
            ? '文档内容为空，请先编辑或打开 Markdown 文件'
            : mapped === 'mdBrowserExportTimeout'
              ? '导出超时，请稍后重试'
              : '下载失败，请稍后重试',
    });
  }
  if (/File changes in SaaS|save_failed_403|403/i.test(code)) {
    return t('mdBrowserExportFailedSaas', {
      defaultValue: '导出暂存被拦截，请刷新页面后重试（已改走服务端导出）',
    });
  }
  return t('mdBrowserExportFailed', {
    defaultValue: '导出失败：{{code}}',
    code,
  });
}
