/**
 * DEPRECATED — do not run. This script was too aggressive and corrupted non-className code.
 * Use scripts/fix-classname-artifacts.mjs instead (tsx className/cn scope only).
 *
 * Fix orphaned opacity fragments left by migrate-ui-tokens.mjs
 * e.g. "text-muted-foreground /60", "bg-warning/10/70"
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_SRC = path.join(__dirname, '..', 'ui', 'src');

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (/\.(tsx|ts|jsx|js|css)$/.test(ent.name)) files.push(p);
  }
  return files;
}

const FIXES = [
  // Double opacity from partial replacements
  [/(\w)\/(\d{2})\/(\d{2})/g, '$1/$2'],
  // Orphaned opacity token (space + /digits not attached to a class)
  [/ (?![\/'"`])\/?(\d{2})(?=\s|['"`])/g, ''],
  // Trailing orphaned opacity before quote
  [/ (?![\/'"`])\/?(\d{2})"/g, '"'],
  [/ (?![\/'"`])\/?(\d{2})'/g, "'"],
  // Redundant dark: semantic overrides
  [/ dark:text-emerald-300/g, ''],
  [/ dark:text-amber-300/g, ''],
  [/ dark:text-amber-100/g, ''],
  [/ dark:text-amber-200/g, ''],
  [/ dark:border-emerald-800\/60/g, ''],
  [/ dark:border-emerald-900\/50/g, ''],
  [/ dark:border-emerald-900\/60/g, ''],
  [/ dark:border-amber-900\/50/g, ''],
  [/ dark:border-amber-900\/60/g, ''],
  [/ dark:bg-popover\/60/g, ''],
  [/ dark:border-border \/40/g, ''],
  [/ dark:border-border \/60/g, ''],
  [/ dark:border-border/g, ''],
  [/ dark:text-muted-foreground/g, ''],
  [/ dark:hover:border-border/g, ''],
  // Broken border-warning patterns
  [/border-warning\/30\/60/g, 'border-warning/30'],
  [/border-warning\/30\/80/g, 'border-warning/30'],
  [/bg-warning\/10\/70/g, 'bg-warning/10'],
  [/bg-warning\/10\/90/g, 'bg-warning/10'],
  [/bg-success\/10\/70/g, 'bg-success/10'],
  [/bg-success\/10\/50/g, 'bg-success/10'],
  [/border-emerald-200\/80/g, 'border-success/30'],
  [/text-amber-900/g, 'text-warning'],
  [/text-amber-950/g, 'text-warning'],
  [/text-amber-800/g, 'text-warning'],
  // Neutral remnants in main-content-v2
  [/border-neutral-100/g, 'border-border'],
  [/bg-neutral-900/g, 'bg-primary'],
  [/border-neutral-800/g, 'border-primary/30'],
  [/text-white(?![\w-])/g, 'text-primary-foreground'],
  // focus ring blue -> ring
  [/focus-visible:ring-blue-500/g, 'focus-visible:ring-ring'],
  // Cleanup double spaces
  [/  +/g, ' '],
  [/className=" /g, 'className="'],
];

let changed = 0;
for (const file of walk(UI_SRC)) {
  let src = fs.readFileSync(file, 'utf8');
  const orig = src;
  for (const [pat, rep] of FIXES) {
    src = src.replace(pat, rep);
  }
  if (src !== orig) {
    fs.writeFileSync(file, src, 'utf8');
    changed++;
    console.log('fixed:', path.relative(UI_SRC, file));
  }
}
console.log(`Done. ${changed} files fixed.`);
