#!/usr/bin/env node
/**
 * PD-SAAS-FORK: splice bento/slides JSON into Bento_Slides.bento.html shell
 * Usage: node splice-bento-shell.mjs --shell <path> --doc <json> --out deck.bento.html [--preserve-doc-id]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const BENTO_DOC_RE = /(<script\s+type=["']application\/bento\+json["']\s+id=["']bento-doc["'][^>]*>)([\s\S]*?)(<\/script>)/i;

function parseArgs(argv) {
  const args = { preserveDocId: false };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--shell') args.shell = argv[++i];
    else if (token === '--doc') args.doc = argv[++i];
    else if (token === '--out') args.out = argv[++i];
    else if (token === '--preserve-doc-id') args.preserveDocId = true;
  }
  return args;
}

function escapeBentoJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function extractDocId(html) {
  const match = BENTO_DOC_RE.exec(String(html ?? ''));
  if (!match) return null;
  try {
    const doc = JSON.parse(match[2].trim());
    return typeof doc.docId === 'string' ? doc.docId : null;
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.shell || !args.doc || !args.out) {
    console.error('Usage: splice-bento-shell.mjs --shell <shell.html> --doc <doc.json> --out <deck.bento.html> [--preserve-doc-id]');
    process.exit(2);
  }

  const [shellHtml, docRaw] = await Promise.all([
    readFile(path.resolve(args.shell), 'utf8'),
    readFile(path.resolve(args.doc), 'utf8'),
  ]);

  let doc;
  try {
    doc = JSON.parse(docRaw);
  } catch (err) {
    console.error(`Invalid JSON in --doc: ${err.message}`);
    process.exit(1);
  }

  if (!doc || doc.format !== 'bento/slides') {
    console.error('Document format must be "bento/slides"');
    process.exit(1);
  }

  if (!args.preserveDocId || !doc.docId) {
    const existing = args.preserveDocId ? extractDocId(shellHtml) : null;
    doc.docId = existing || doc.docId || randomUUID();
  }

  const match = BENTO_DOC_RE.exec(shellHtml);
  if (!match) {
    console.error('Shell missing #bento-doc block');
    process.exit(1);
  }

  const serialized = escapeBentoJson(doc);
  const output = shellHtml.replace(BENTO_DOC_RE, `$1\n${serialized}\n$3`);
  await writeFile(path.resolve(args.out), output, 'utf8');

  const bytes = Buffer.byteLength(output, 'utf8');
  console.log(JSON.stringify({
    ok: true,
    out: path.resolve(args.out),
    docId: doc.docId,
    slideCount: Array.isArray(doc.slides) ? doc.slides.length : 0,
    bytes,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
