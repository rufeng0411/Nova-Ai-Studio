#!/usr/bin/env node
/**
 * PD-SAAS-FORK: scan JSONL/fixtures for actionable recovery copy density.
 * Usage: node scripts/diag/recovery-copy-audit.mjs [path...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ACTIONABLE_PATTERNS = [
  /您可以继续/u,
  /继续这一步/u,
  /请回复继续/u,
  /Could not finish automatically — you can continue/i,
  /Continue this step/i,
];

const WEAK_OK_PATTERNS = [
  /可能需要些时间，请稍后/u,
  /This may take a moment — please wait/i,
  /正在从上次步骤继续/u,
  /Resuming from last step/i,
];

function scanText(text, file, lineNo) {
  const hits = [];
  for (const re of ACTIONABLE_PATTERNS) {
    if (re.test(text)) {
      hits.push({ kind: 'actionable', pattern: re.source, file, lineNo, sample: text.slice(0, 120) });
    }
  }
  for (const re of WEAK_OK_PATTERNS) {
    if (re.test(text)) {
      hits.push({ kind: 'weak_ok', pattern: re.source, file, lineNo, sample: text.slice(0, 120) });
    }
  }
  return hits;
}

function scanJsonl(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const hits = [];
  lines.forEach((line, index) => {
    try {
      const entry = JSON.parse(line);
      const textBlocks = [];
      if (entry?.message?.content) {
        for (const block of entry.message.content) {
          if (block?.type === 'text' && typeof block.text === 'string') {
            textBlocks.push(block.text);
          }
        }
      }
      if (typeof entry?.content === 'string') textBlocks.push(entry.content);
      for (const text of textBlocks) {
        hits.push(...scanText(text, filePath, index + 1));
      }
    } catch {
      // skip malformed
    }
  });
  return hits;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const args = process.argv.slice(2);
  const targets = args.length > 0
    ? args.map((p) => path.resolve(p))
    : [
      path.join(root, 'tests/fixtures/task-recovery'),
    ].filter((p) => fs.existsSync(p));

  if (targets.length === 0) {
    console.error('[recovery-copy-audit] no targets');
    process.exit(1);
  }

  let actionable = 0;
  let weakOk = 0;
  for (const target of targets) {
    const stat = fs.statSync(target);
    const files = stat.isDirectory()
      ? fs.readdirSync(target).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(target, f))
      : [target];
    for (const file of files) {
      const hits = scanJsonl(file);
      for (const hit of hits) {
        if (hit.kind === 'actionable') {
          actionable += 1;
          console.log(`[ACTIONABLE] ${file}:${hit.lineNo} ${hit.pattern}`);
        } else {
          weakOk += 1;
        }
      }
    }
  }

  console.log(`[recovery-copy-audit] actionable=${actionable} weak_ok=${weakOk}`);
  if (process.env.RECOVERY_COPY_AUDIT_GATE === '1' && actionable > 0) {
    process.exit(1);
  }
}

main();
