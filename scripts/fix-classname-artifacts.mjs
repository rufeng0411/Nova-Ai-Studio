/**
 * Fix orphaned opacity in className strings only (safe scope).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_SRC = path.join(__dirname, '..', 'ui', 'src');

const TARGET_DIRS = [
  'components',
  'shared/view/ui',
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (/\.tsx$/.test(ent.name)) files.push(p);
  }
  return files;
}

function fixClassString(s) {
  let out = s;
  // Collapse double opacity: foo/80/80 -> foo/80
  out = out.replace(/(\/[0-9]{2})\/[0-9]{2}/g, '$1');
  // Remove orphaned opacity fragments left by token migration (e.g. "text-muted-foreground /60")
  out = out.replace(/ (?![/[\w])\/[0-9]{2}(?=\s|['"`+,]|$)/g, '');
  while (/ \/[0-9]{2} \/[0-9]{2}/.test(out)) {
    out = out.replace(/ \/[0-9]{2}/g, '');
  }
  out = out.replace(/  +/g, ' ').trim();
  return out;
}

function fixCnArgs(src) {
  // cn('...', cond && '...') — fix quoted strings inside cn(...)
  return src.replace(/cn\(([\s\S]*?)\)/g, (match) => {
    let out = match;
    out = out.replace(/'([^']*)'/g, (_, cls) => `'${fixClassString(cls)}'`);
    out = out.replace(/"([^"]*)"/g, (_, cls) => `"${fixClassString(cls)}"`);
    out = out.replace(/`([^`]*)`/g, (_, cls) => `\`${fixClassString(cls)}\``);
    return out;
  });
}

function fixFileContent(src) {
  src = fixCnArgs(src);
  src = src.replace(/className="([^"]*)"/g, (_, cls) => `className="${fixClassString(cls)}"`);
  src = src.replace(/className=\{'([^']*)'\}/g, (_, cls) => `className={'${fixClassString(cls)}'}`);
  src = src.replace(/className=\{`([^`]*)`\}/g, (_, cls) => `className={\`${fixClassString(cls)}\`}`);
  return src;
}

let changed = 0;
for (const rel of TARGET_DIRS) {
  const dir = path.join(UI_SRC, rel);
  for (const file of walk(dir)) {
    const orig = fs.readFileSync(file, 'utf8');
    const fixed = fixFileContent(orig);
    if (fixed !== orig) {
      fs.writeFileSync(file, fixed, 'utf8');
      changed++;
      console.log('fixed:', path.relative(UI_SRC, file));
    }
  }
}
console.log(`Done. ${changed} tsx files fixed.`);
