#!/usr/bin/env node
// PD-SAAS-FORK: Extract deploy/marketing/showcase/shared/catalog.js → seed-catalog.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

function resolveCatalogJs() {
  const candidates = [
    path.join(repoRoot, 'deploy/marketing/showcase/shared/catalog.js'),
    path.join(repoRoot, 'artifacts/saas-design/demos-showcase/shared/catalog.js'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('catalog.js not found under deploy/marketing or artifacts');
}

function loadCatalog(catalogJsPath) {
  const source = fs.readFileSync(catalogJsPath, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: catalogJsPath });
  const catalog = sandbox.window.NOVA_SHOWCASE_CATALOG;
  if (!catalog?.sections) throw new Error('NOVA_SHOWCASE_CATALOG.sections missing');
  return catalog;
}

function toSeedJson(catalog) {
  return {
    brandNote: catalog.brandNote ?? '',
    sections: (catalog.sections ?? []).map((sec) => ({
      id: sec.id,
      title: sec.title,
      title_zh: sec.title_zh ?? sec.title,
      title_en: sec.title_en ?? sec.title,
      lead: sec.lead ?? '',
      lead_zh: sec.lead_zh ?? sec.lead ?? '',
      lead_en: sec.lead_en ?? sec.lead ?? '',
      star: Boolean(sec.star),
      items: (sec.items ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        name_zh: item.name_zh ?? item.name,
        name_en: item.name_en ?? item.name,
        annotation: item.annotation,
        annotation_zh: item.annotation_zh ?? item.annotation,
        annotation_en: item.annotation_en ?? item.annotation,
        badge: item.badge,
        badge_zh: item.badge_zh ?? item.badge,
        badge_en: item.badge_en ?? item.badge,
        prompt: item.prompt,
        prompt_zh: item.prompt_zh ?? item.prompt,
        prompt_en: item.prompt_en ?? item.prompt,
        thumb: item.thumb,
        href: item.href,
        star: Boolean(item.star),
      })),
    })),
  };
}

async function main() {
  const catalogPath = resolveCatalogJs();
  const catalog = loadCatalog(catalogPath);
  const seed = toSeedJson(catalog);
  const outPath = path.join(repoRoot, 'deploy/marketing/showcase/seed-catalog.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');
  const itemCount = seed.sections.reduce((n, sec) => n + (sec.items?.length ?? 0), 0);
  console.log(`[showcase] wrote ${outPath} (${seed.sections.length} sections, ${itemCount} items)`);
}

main().catch((error) => {
  console.error('[showcase] seed-from-catalog failed:', error?.message || error);
  process.exit(1);
});
