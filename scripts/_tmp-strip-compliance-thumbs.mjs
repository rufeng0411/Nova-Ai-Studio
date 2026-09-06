import fs from 'node:fs';

const p = 'deploy/marketing/showcase/shared/catalog.js';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(
  /(\n\s*"id":\s*"sc-compliance-[^"]+"[\s\S]*?)(\n\s*"thumb":\s*"[^"]*",)/g,
  '$1',
);
fs.writeFileSync(p, s);

const cat = Function(`${s.replace(/window\.NOVA_SHOWCASE_CATALOG\s*=/, 'return ')};`)();
const comp = cat.sections.find((x) => x.id === 'compliance');
console.log('compliance items', comp.items.length);
console.log(
  'thumbs left',
  comp.items.filter((i) => i.thumb).map((i) => i.id),
);
