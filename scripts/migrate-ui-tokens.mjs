/**
 * One-off migration: neutral/gray/blue hardcoded Tailwind → semantic tokens.
 * Run: node scripts/migrate-ui-tokens.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_SRC = path.join(__dirname, '..', 'ui', 'src');

const TARGET_DIRS = [
  'components/app-shell',
  'components/chat-v2',
  'components/code-editor',
  'components/main-content',
  'components/main-content-v2',
  'components/chat',
  'components/templates-hub',
  'components/process-templates',
  'shared/view/ui',
];

/** Pairs: [pattern, replacement] — order matters */
const REPLACEMENTS = [
  // Remove dark: pairs when light token covers both
  [/bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100/g, 'bg-background text-foreground'],
  [/bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100/g, 'bg-card text-foreground'],
  [/bg-white dark:bg-neutral-950/g, 'bg-background'],
  [/bg-white dark:bg-neutral-900/g, 'bg-card'],
  [/bg-white\/95/g, 'bg-card/95'],
  [/bg-white\/90/g, 'bg-card/90'],
  [/bg-white(?![\w-])/g, 'bg-card'],
  [/border-neutral-200\/80/g, 'border-border'],
  [/border-neutral-200\/60/g, 'border-border/60'],
  [/dark:border-neutral-700/g, ''],
  [/dark:bg-neutral-900\/80/g, ''],
  [/dark:hover:border-neutral-700/g, ''],
  [/hover:border-neutral-300/g, 'hover:border-border'],
  [/text-neutral-600 italic/g, 'text-muted-foreground italic'],
  [/dark:bg-neutral-950/g, ''],
  [/dark:bg-neutral-900/g, ''],
  [/dark:bg-neutral-800/g, ''],
  [/dark:bg-neutral-700/g, ''],

  [/bg-neutral-50(?![\w-])/g, 'bg-sidebar'],
  [/bg-neutral-100(?![\w-])/g, 'bg-muted'],
  [/bg-neutral-200\/70/g, 'bg-accent'],
  [/bg-neutral-200(?![\w-])/g, 'bg-border'],

  [/text-neutral-900(?![\w-])/g, 'text-foreground'],
  [/text-neutral-800(?![\w-])/g, 'text-foreground'],
  [/text-neutral-700(?![\w-])/g, 'text-foreground'],
  [/text-neutral-600(?![\w-])/g, 'text-muted-foreground'],
  [/text-neutral-500\/90/g, 'text-muted-foreground/90'],
  [/text-neutral-500(?![\w-])/g, 'text-muted-foreground'],
  [/text-neutral-400\/60/g, 'text-muted-foreground/60'],
  [/text-neutral-400(?![\w-])/g, 'text-muted-foreground'],
  [/text-neutral-300(?![\w-])/g, 'text-muted-foreground'],

  [/dark:text-neutral-100/g, ''],
  [/dark:text-neutral-200/g, ''],
  [/dark:text-neutral-300/g, ''],
  [/dark:text-neutral-400/g, ''],
  [/dark:text-neutral-500/g, ''],

  [/border-neutral-200(?![\w-])/g, 'border-border'],
  [/border-neutral-300(?![\w-])/g, 'border-border'],
  [/border-neutral-700(?![\w-])/g, 'border-border'],
  [/dark:border-neutral-800/g, ''],
  [/dark:border-neutral-700/g, ''],
  [/dark:border-neutral-600/g, ''],

  [/hover:bg-neutral-100(?![\w-])/g, 'hover:bg-accent'],
  [/hover:bg-neutral-200\/70/g, 'hover:bg-accent'],
  [/hover:bg-neutral-200(?![\w-])/g, 'hover:bg-accent'],
  [/dark:hover:bg-neutral-800/g, ''],
  [/dark:hover:bg-neutral-700/g, ''],

  [/hover:text-neutral-900/g, 'hover:text-foreground'],
  [/hover:text-neutral-700/g, 'hover:text-foreground'],
  [/dark:hover:text-neutral-100/g, ''],
  [/dark:hover:text-neutral-200/g, ''],

  [/bg-blue-500(?![\w-])/g, 'bg-primary'],
  [/bg-blue-600(?![\w-])/g, 'bg-primary'],
  [/bg-blue-400(?![\w-])/g, 'bg-primary'],
  [/dark:bg-blue-400/g, ''],
  [/dark:bg-blue-500/g, ''],
  [/dark:bg-blue-600/g, ''],
  [/hover:bg-blue-700/g, 'hover:bg-primary/90'],
  [/dark:hover:bg-blue-600/g, ''],
  [/text-blue-700/g, 'text-info'],
  [/dark:text-blue-300/g, ''],
  [/ring-white dark:ring-neutral-950/g, 'ring-background'],
  [/ring-2 ring-white/g, 'ring-2 ring-background'],

  [/focus-visible:ring-neutral-300/g, 'focus-visible:ring-ring'],
  [/dark:focus-visible:ring-neutral-700/g, ''],

  [/bg-emerald-500/g, 'bg-success'],
  [/text-emerald-600/g, 'text-success'],
  [/text-emerald-700/g, 'text-success'],
  [/bg-emerald-50/g, 'bg-success/10'],
  [/dark:bg-emerald-950/g, ''],
  [/dark:text-emerald-400/g, ''],

  [/bg-amber-50/g, 'bg-warning/10'],
  [/text-amber-600/g, 'text-warning'],
  [/text-amber-700/g, 'text-warning'],
  [/border-amber-200/g, 'border-warning/30'],
  [/dark:border-amber-800/g, ''],
  [/dark:bg-amber-950/g, ''],
  [/dark:text-amber-400/g, ''],

  [/focus:border-neutral-500/g, 'focus:border-ring'],
  [/focus:border-neutral-400/g, 'focus:border-ring'],
  [/dark:focus:border-neutral-600/g, ''],
  [/dark:focus:border-neutral-500/g, ''],
  [/placeholder:text-neutral-400/g, 'placeholder:text-muted-foreground'],
  [/text-gray-400 dark:text-gray-600/g, 'text-muted-foreground'],
  [/text-blue-600\/70 \/70/g, 'text-info/70'],
  [/hover:bg-neutral-300\/70 \/70/g, 'hover:bg-muted-foreground/30'],
  [/bg-gray-50/g, 'bg-muted'],
  [/bg-gray-100/g, 'bg-muted'],
  [/bg-gray-800/g, 'bg-card'],
  [/bg-gray-900/g, 'bg-popover'],
  [/text-gray-600/g, 'text-muted-foreground'],
  [/text-gray-700/g, 'text-foreground'],
  [/text-gray-900/g, 'text-foreground'],
  [/border-gray-200/g, 'border-border'],
  [/border-gray-300/g, 'border-border'],
  [/dark:bg-gray-800/g, ''],
  [/dark:bg-gray-900/g, ''],
  [/dark:text-gray-100/g, ''],
  [/dark:text-gray-400/g, ''],

  // Cleanup double spaces from removed dark: classes
  [/  +/g, ' '],
  [/className=" /g, 'className="'],
  [/className=\{cn\(\s+' /g, "className={cn('"],
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (/\.(tsx|ts|jsx|js)$/.test(ent.name)) files.push(p);
  }
  return files;
}

let changed = 0;
for (const rel of TARGET_DIRS) {
  const dir = path.join(UI_SRC, rel);
  for (const file of walk(dir)) {
    let src = fs.readFileSync(file, 'utf8');
    const orig = src;
    for (const [pat, rep] of REPLACEMENTS) {
      src = src.replace(pat, rep);
    }
    if (src !== orig) {
      fs.writeFileSync(file, src, 'utf8');
      changed++;
      console.log('updated:', path.relative(UI_SRC, file));
    }
  }
}
console.log(`Done. ${changed} files updated.`);
