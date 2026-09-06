/**
 * PD-SAAS-FORK: SaaS HTML Studio write policy — whitelist, validation, audit
 */
import { createHash } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ARTIFACTS_ROOT_RE = /(?:^|[\\/])artifacts[\\/]/i;
const HTML_FILE_RE = /\.html?$/i;
const BACKUP_DIR_RE = /(?:^|[\\/])\.nova-edit-backups(?:[\\/]|$)/i;
const CANVAS_BOARD_ROOT_RE = /(?:^|[\\/])artifacts[\\/]canvas-[^\\/]+(?:[\\/]|$)/i;
export const HTML_STUDIO_MAX_BYTES = 2 * 1024 * 1024;

const REPORT_DATA_SCRIPT_RE = /<script\b[^>]*\bid=["']report-data["'][^>]*>[\s\S]*?<\/script>/gi;

function stripReportDataScripts(html) {
  return String(html ?? '').replace(REPORT_DATA_SCRIPT_RE, '');
}

function extractScriptBlocks(html) {
  const blocks = [];
  const re = /<script[\s\S]*?<\/script>/gi;
  let match = re.exec(String(html ?? ''));
  while (match) {
    blocks.push(match[0]);
    match = re.exec(String(html ?? ''));
  }
  return blocks;
}

/** Compare scripts for write policy — `#report-data` JSON dual-write is allowed (NGRS). */
export function scriptsChangedForPolicy(before, after) {
  const beforeScripts = extractScriptBlocks(stripReportDataScripts(before));
  const afterScripts = extractScriptBlocks(stripReportDataScripts(after));
  if (beforeScripts.length !== afterScripts.length) return true;
  for (let i = 0; i < beforeScripts.length; i += 1) {
    if (sha256Content(beforeScripts[i]) !== sha256Content(afterScripts[i])) return true;
  }
  return false;
}

function sha256Content(content) {
  return createHash('sha256').update(String(content ?? ''), 'utf8').digest('hex');
}

export function scriptsChanged(before, after) {
  const beforeScripts = extractScriptBlocks(before);
  const afterScripts = extractScriptBlocks(after);
  if (beforeScripts.length !== afterScripts.length) return true;
  for (let i = 0; i < beforeScripts.length; i += 1) {
    if (sha256Content(beforeScripts[i]) !== sha256Content(afterScripts[i])) return true;
  }
  return false;
}

export function isHtmlDeliverableWritePath(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!ARTIFACTS_ROOT_RE.test(normalized)) return false;
  if (CANVAS_BOARD_ROOT_RE.test(normalized)) return false;
  // PD-SAAS-FORK: Bento decks use bentoWritePolicy
  if (/\.bento\.html$/i.test(normalized)) return false;
  if (BACKUP_DIR_RE.test(normalized)) return true;
  if (HTML_FILE_RE.test(normalized)) return true;
  if (/\.(css|js)$/i.test(normalized)) {
    const dir = path.posix.dirname(normalized);
    return ARTIFACTS_ROOT_RE.test(`${dir}/`);
  }
  return false;
}

export function validateHtmlDeliverableWrite(beforeContent, afterContent) {
  const after = String(afterContent ?? '');
  const before = String(beforeContent ?? '');
  if (Buffer.byteLength(after, 'utf8') > HTML_STUDIO_MAX_BYTES) {
    return { ok: false, error: 'HTML file exceeds size limit (2MB).' };
  }
  if (scriptsChangedForPolicy(before, after)) {
    return { ok: false, error: 'Script changes require AI assistance via chat.' };
  }
  return { ok: true };
}

export async function appendHtmlStudioWriteAudit(dataRoot, entry) {
  if (!dataRoot) return;
  const dir = path.join(dataRoot, 'telemetry');
  await mkdir(dir, { recursive: true });
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...entry,
  });
  await appendFile(path.join(dir, 'html-studio-writes.jsonl'), `${line}\n`, 'utf8');
}

export function sha256ContentHex(content) {
  return sha256Content(content);
}
