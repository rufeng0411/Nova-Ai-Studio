#!/usr/bin/env node
/**
 * PD-SAAS-FORK VAP: shared visual-deliverable verification helpers.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export { REPO_ROOT };

export function readArg(args, name) {
  const inlinePrefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(inlinePrefix));
  if (inline) return inline.slice(inlinePrefix.length);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export async function loadTsFixture(relPath, exportName) {
  const mod = await import(pathToFileURL(path.join(REPO_ROOT, relPath)).href);
  return mod[exportName];
}

export function extractImgSrcs(html) {
  const refs = [];
  const pattern = /<(?:img|source|image)\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/giu;
  let match;
  while ((match = pattern.exec(String(html ?? ''))) !== null) {
    const value = String(match[1] ?? '').trim();
    if (value && !/^https?:/iu.test(value) && !value.startsWith('data:')) {
      refs.push(value);
    }
  }
  return refs;
}

export function resolveSiblingPath(htmlAbsPath, srcRef) {
  const htmlDir = path.dirname(htmlAbsPath);
  return path.normalize(path.join(htmlDir, srcRef.replace(/^\.\//u, '')));
}

export function auditHtmlSrcOnDisk(htmlAbsPath, workspaceRoot = REPO_ROOT) {
  if (!fs.existsSync(htmlAbsPath)) {
    return { ok: false, missing: [path.relative(workspaceRoot, htmlAbsPath)], srcCount: 0 };
  }
  const html = fs.readFileSync(htmlAbsPath, 'utf8');
  const refs = extractImgSrcs(html);
  const missing = [];
  for (const ref of refs) {
    const abs = resolveSiblingPath(htmlAbsPath, ref);
    if (!fs.existsSync(abs)) {
      missing.push(ref);
    }
  }
  return { ok: missing.length === 0, missing, srcCount: refs.length };
}

export function loadJsonIfExists(absPath) {
  if (!fs.existsSync(absPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch {
    return null;
  }
}

export function writeReport(reportDir, name, payload) {
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, name);
  fs.writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return reportPath;
}

export function countOfficialAssets(manifest) {
  if (!manifest?.assets || !Array.isArray(manifest.assets)) return 0;
  return manifest.assets.filter((asset) =>
    asset?.source === 'official_fetch'
    || asset?.source === 'authority_site'
    || asset?.source === 'web_search_image',
  ).length;
}

export function hasCrossTaskRawRef(html) {
  return /\.\.\/assets\/raw/iu.test(String(html ?? ''));
}

export function manifestUsesGenerateImage(manifest) {
  if (!manifest?.assets || !Array.isArray(manifest.assets)) return false;
  return manifest.assets.some((asset) => asset?.source === 'generate_image');
}
