#!/usr/bin/env node
/**
 * Verify relative links in about/ web assets resolve to real files.
 * Run: node scripts/check-about-links.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..');
const ABOUT = join(REPO, 'about');

function walk(dir, base = dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, base, acc);
    } else if (/\.(html|md)$/i.test(name)) {
      acc.push(join(full));
    }
  }
  return acc;
}

function extractHrefs(content) {
  const hrefs = [];
  const mdRe = /\[[^\]]*\]\(([^)]+)\)/g;
  const htmlRe = /href="([^"]+)"/g;
  let m;
  while ((m = mdRe.exec(content))) hrefs.push(m[1]);
  while ((m = htmlRe.exec(content))) hrefs.push(m[1]);
  return hrefs;
}

function resolveHref(fromFile, href) {
  const raw = href.split('#')[0].trim();
  if (!raw || /^[a-z]+:/i.test(raw) || raw.startsWith('/')) {
    return null;
  }
  return resolve(dirname(fromFile), raw);
}

function checkFile(filePath, failures) {
  const content = readFileSync(filePath, 'utf8');
  for (const href of extractHrefs(content)) {
    const target = resolveHref(filePath, href);
    if (!target) continue;
    if (!existsSync(target)) {
      failures.push({ from: filePath.slice(ABOUT.length + 1), href, target: target.slice(ABOUT.length + 1) });
    }
  }
}

function main() {
  const failures = [];
  const files = [
    join(ABOUT, 'index.html'),
    join(ABOUT, 'README.md'),
    join(ABOUT, 'pdf', 'README.md'),
    ...walk(join(ABOUT, '_pdf-html')),
  ].filter(existsSync);

  for (const f of files) {
    checkFile(f, failures);
  }

  if (failures.length) {
    console.error(`[about-links] FAIL: ${failures.length} broken link(s)`);
    for (const f of failures.slice(0, 30)) {
      console.error(`  ${f.from} → ${f.href} (missing: ${f.target})`);
    }
    process.exit(1);
  }

  console.log(`[about-links] OK: checked ${files.length} files, all relative links resolve`);
}

main();
