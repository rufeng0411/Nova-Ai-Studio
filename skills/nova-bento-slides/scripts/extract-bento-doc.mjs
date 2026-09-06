#!/usr/bin/env node
/**
 * PD-SAAS-FORK: extract #bento-doc JSON from *.bento.html (resume workflow)
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BENTO_DOC_RE = /<script\s+type=["']application\/bento\+json["']\s+id=["']bento-doc["'][^>]*>([\s\S]*?)<\/script>/i;

async function main() {
  const input = process.argv[2];
  const out = process.argv[3];
  if (!input) {
    console.error('Usage: extract-bento-doc.mjs <deck.bento.html> [out.json]');
    process.exit(2);
  }

  const html = await readFile(path.resolve(input), 'utf8');
  const match = BENTO_DOC_RE.exec(html);
  if (!match) {
    console.error('Missing #bento-doc block');
    process.exit(1);
  }

  let doc;
  try {
    doc = JSON.parse(match[1].trim());
  } catch (err) {
    console.error(`Invalid JSON in #bento-doc: ${err.message}`);
    process.exit(1);
  }

  const serialized = `${JSON.stringify(doc, null, 2)}\n`;
  if (out) {
    await writeFile(path.resolve(out), serialized, 'utf8');
    console.log(JSON.stringify({ ok: true, out: path.resolve(out), docId: doc.docId }, null, 2));
  } else {
    process.stdout.write(serialized);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
