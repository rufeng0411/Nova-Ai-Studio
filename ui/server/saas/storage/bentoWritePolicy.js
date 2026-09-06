/**
 * PD-SAAS-FORK: SaaS Bento deck write policy — allow #bento-doc JSON updates, 8MB cap
 */
import { createHash } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ARTIFACTS_ROOT_RE = /(?:^|[\\/])artifacts[\\/]/i;
const BENTO_FILE_RE = /\.bento\.html$/i;
const BACKUP_DIR_RE = /(?:^|[\\/])\.nova-edit-backups(?:[\\/]|$)/i;
const BENTO_DOC_RE = /<script\s+type=["']application\/bento\+json["']\s+id=["']bento-doc["'][^>]*>([\s\S]*?)<\/script>/i;

export const BENTO_DECK_MAX_BYTES = Number(process.env.BENTO_DECK_MAX_BYTES || 8 * 1024 * 1024);

function sha256Content(content) {
  return createHash('sha256').update(String(content ?? ''), 'utf8').digest('hex');
}

function extractBentoDocBlock(html) {
  const match = BENTO_DOC_RE.exec(String(html ?? ''));
  return match ? match[0] : null;
}

function extractShellWithoutDoc(html) {
  return String(html ?? '').replace(BENTO_DOC_RE, '<!-- bento-doc -->');
}

export function isBentoDeckWritePath(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (BACKUP_DIR_RE.test(normalized)) return true;
  if (!ARTIFACTS_ROOT_RE.test(normalized)) return false;
  return BENTO_FILE_RE.test(normalized);
}

export function validateBentoDeckWrite(beforeContent, afterContent) {
  const after = String(afterContent ?? '');
  const before = String(beforeContent ?? '');

  if (Buffer.byteLength(after, 'utf8') > BENTO_DECK_MAX_BYTES) {
    return { ok: false, error: `Bento deck exceeds size limit (${Math.round(BENTO_DECK_MAX_BYTES / (1024 * 1024))}MB).` };
  }

  const match = BENTO_DOC_RE.exec(after);
  if (!match) {
    return { ok: false, error: 'Missing #bento-doc block in Bento deck.' };
  }

  const jsonText = match[1]?.trim() ?? '';
  if (/<(?![/!])/.test(jsonText) && !jsonText.includes('\\u003c')) {
    return { ok: false, error: 'Bento JSON block contains unescaped < characters.' };
  }

  if (beforeContent) {
    const beforeHasDoc = BENTO_DOC_RE.test(before);
    if (beforeHasDoc) {
      const beforeShell = extractShellWithoutDoc(before);
      const afterShell = extractShellWithoutDoc(after);
      if (sha256Content(beforeShell) !== sha256Content(afterShell)) {
        return { ok: false, error: 'Bento shell structure changes are not allowed — only #bento-doc JSON may change.' };
      }
    }
  }

  try {
    const doc = JSON.parse(jsonText);
    if (doc.format !== 'bento/slides') {
      return { ok: false, error: 'Invalid Bento document format.' };
    }
  } catch {
    return { ok: false, error: 'Invalid JSON in #bento-doc block.' };
  }

  return { ok: true };
}

export async function appendBentoDeckWriteAudit(dataRoot, entry) {
  if (!dataRoot) return;
  const dir = path.join(dataRoot, 'telemetry');
  await mkdir(dir, { recursive: true });
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
  await appendFile(path.join(dir, 'bento-deck-writes.jsonl'), `${line}\n`, 'utf8');
}

export function bentoSha256ContentHex(content) {
  return sha256Content(content);
}
