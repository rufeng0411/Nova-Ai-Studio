#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchMarketingPath } from '../../ui/server/saas/marketing/marketingPathMatch.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../deploy/marketing');
const env = { PILOTDECK_SHOWCASE_SITE: 'on', PILOTDECK_MARKETING_I18N: '1' };

let fail = 0;
function check(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    fail += 1;
  } else console.log('OK', msg);
}

check(matchMarketingPath('/en/', env) === 'en/index.html', '/en/');
check(matchMarketingPath('/en/showcase/', env) === 'en/showcase/index.html', '/en/showcase/');
check(matchMarketingPath('/en/docs/', env) === 'en/docs/index.html', '/en/docs/');
check(fs.existsSync(path.join(root, 'en/index.html')), 'en/index.html exists');
check(fs.existsSync(path.join(root, 'en/docs/index.html')), 'en/docs exists');
check(fs.existsSync(path.join(root, 'en/showcase/index.html')), 'en/showcase exists');
check(fs.existsSync(path.join(root, 'shared/i18n.js')), 'i18n.js');

const enHome = fs.readFileSync(path.join(root, 'en/index.html'), 'utf8');
check(/lang="en"/.test(enHome), 'en home lang');
check(!/>主页</.test(enHome) || />Home</.test(enHome), 'en nav Home');
check(enHome.includes('hreflang'), 'hreflang present');

const zhHome = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
check(zhHome.includes('site-lang') || zhHome.includes('data-i18n-lang'), 'zh has lang switch');

if (fail) {
  console.error('i18n_switch_ok=0');
  process.exit(1);
}
console.log('i18n_switch_ok=1');
