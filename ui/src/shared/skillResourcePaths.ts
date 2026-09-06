// PD-SAAS-FORK: skill reference URIs (slug:references:file) are not project deliverables.
import { sanitizeDeliverableLookupPath } from '../../shared/deliverablePathResolve.mjs';

const SKILL_SLUG_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;
const WINDOWS_DRIVE_PREFIX = /^[A-Za-z]:[\\/]/;

/** `diagram-maker:references:svg-template` style URIs cited by agents. */
export function isSkillResourceUri(value: string): boolean {
  const trimmed = sanitizeDeliverableLookupPath(String(value || '').trim());
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return false;
  if (WINDOWS_DRIVE_PREFIX.test(trimmed)) return false;
  const colon = trimmed.indexOf(':');
  if (colon <= 0) return false;
  const slug = trimmed.slice(0, colon);
  if (!SKILL_SLUG_RE.test(slug)) return false;
  const tail = trimmed.slice(colon + 1);
  return Boolean(tail) && !tail.includes('..');
}

export function parseSkillResourceUri(
  value: string,
): { slug: string; relativePath: string } | null {
  if (!isSkillResourceUri(value)) return null;
  const trimmed = sanitizeDeliverableLookupPath(String(value || '').trim());
  const colon = trimmed.indexOf(':');
  const slug = trimmed.slice(0, colon);
  let relativePath = trimmed
    .slice(colon + 1)
    .split(':')
    .join('/')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  if (!relativePath || relativePath.includes('..')) return null;
  if (!/\.[a-z0-9]+$/i.test(relativePath)) {
    relativePath = `${relativePath}.md`;
  }
  return { slug, relativePath };
}

export function skillAssetEditorPath(slug: string, relativePath: string): string {
  const rel = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  return `skill://${slug}/${rel}`;
}

export function parseSkillAssetEditorPath(
  editorPath: string,
): { slug: string; relativePath: string } | null {
  const raw = String(editorPath || '').trim();
  const match = /^skill:\/\/([^/]+)\/(.+)$/i.exec(raw);
  if (!match) return null;
  const slug = decodeURIComponent(match[1]);
  const relativePath = decodeURIComponent(match[2]).replace(/\\/g, '/');
  if (!SKILL_SLUG_RE.test(slug) || !relativePath || relativePath.includes('..')) {
    return null;
  }
  return { slug, relativePath };
}
