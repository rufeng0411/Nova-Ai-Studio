/**
 * PD-SAAS-FORK: server-side static HTML → Bento deck repair
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hasBentoDocBlock,
  repairStaticHtmlToBento,
} from '../../../../scripts/lib/repairStaticHtmlToBento.mjs';
import { validateBentoDeckWrite } from '../storage/bentoWritePolicy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const BENTO_SHELL = path.join(REPO_ROOT, 'ui/public/vendor/bento/Bento_Slides.bento.html');

let shellCache = null;

async function loadBentoShell() {
  if (!shellCache) {
    shellCache = await readFile(BENTO_SHELL, 'utf8');
  }
  return shellCache;
}

export { hasBentoDocBlock };

export async function repairProjectBentoDeckHtml(html, options = {}) {
  const shellHtml = options.shellHtml ?? await loadBentoShell();
  return repairStaticHtmlToBento(html, shellHtml, options);
}

export function validateRepairedBentoWrite(beforeContent, afterContent) {
  return validateBentoDeckWrite(beforeContent, afterContent);
}
