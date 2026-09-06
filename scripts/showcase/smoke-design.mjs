#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const demos = path.join(root, 'deploy/marketing/showcase/shared/demos.css');
const tokens = path.join(root, 'deploy/marketing/shared/tokens.css');
const css = fs.readFileSync(demos, 'utf8');
const tok = fs.readFileSync(tokens, 'utf8');

let fail = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    fail += 1;
  } else console.log('OK', msg);
}

ok(tok.includes('#0a0a0a') && tok.includes('#10a37f'), 'marketing tokens colors');
ok(css.includes('scrollbar-width: none'), 'deck scrollbar hidden');
ok(css.includes('--dur-panel') || tok.includes('--dur-panel'), 'dur-panel token');
ok(!/#a855f7|#c084fc|#f2b8c6|#F4F1EA/i.test(css), 'no forbidden palette in demos.css');
ok(fs.existsSync(path.join(root, 'deploy/marketing/showcase/index.html')), 'showcase index');
const idx = fs.readFileSync(path.join(root, 'deploy/marketing/showcase/index.html'), 'utf8');
ok(idx.includes('/shared/shell.css'), 'showcase uses shell.css');
ok(idx.includes('演示案例') || idx.includes('Showcase'), 'showcase nav label');

if (fail) process.exit(1);
console.log('smoke:showcase:design OK');
