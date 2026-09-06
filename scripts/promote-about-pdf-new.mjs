#!/usr/bin/env node
/** Promote about/pdf .pdf.new files to .pdf when targets are not locked. */
import { readdirSync, statSync, renameSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MIN_PDF_BYTES } from './lib/aboutPdfRender.mjs';

const PDF_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'about', 'pdf');

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (name.endsWith('.pdf.new')) acc.push(full);
  }
  return acc;
}

let promoted = 0;
for (const src of walk(PDF_ROOT)) {
  const dest = src.replace(/\.new$/, '');
  if (!existsSync(src) || statSync(src).size < MIN_PDF_BYTES) continue;
  try {
    if (existsSync(dest)) {
      try {
        renameSync(dest, `${dest}.bak`);
      } catch {
        console.warn(`[promote] skip locked target: ${dest}`);
        continue;
      }
    }
    renameSync(src, dest);
    console.log(`[promote] ${dest}`);
    promoted += 1;
  } catch (err) {
    console.warn(`[promote] failed ${src}:`, err instanceof Error ? err.message : err);
  }
}
console.log(`[promote] done: ${promoted} file(s)`);
