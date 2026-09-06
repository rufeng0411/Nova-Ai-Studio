import fs from 'node:fs';
import path from 'node:path';

const catalogPaths = [
  'F:/Ai-pilotdeck/deploy/marketing/showcase/shared/catalog.js',
  'F:/Ai-pilotdeck/.saas-dev-data/marketing-showcase/shared/catalog.js',
];

const THUMBS = {
  'sc-design-lanxi-site': '/showcase/media/sc-design-lanxi-site/thumb-cover.jpg',
  'sc-design-zhiye-dash': '/showcase/media/sc-design-zhiye-dash/thumb-cover.jpg',
};

function setThumb(js, id, thumb) {
  const re = new RegExp(`("id":\\s*"${id}"[\\s\\S]*?)("thumb":\\s*")([^"]*)(")`);
  if (re.test(js)) return js.replace(re, `$1$2${thumb}$4`);
  const re2 = new RegExp(`("id":\\s*"${id}"[\\s\\S]*?)("href":)`);
  if (re2.test(js)) {
    return js.replace(re2, `$1"thumb": "${thumb}",\n          $2`);
  }
  throw new Error(`not found ${id}`);
}

for (const p of catalogPaths) {
  let js = fs.readFileSync(p, 'utf8');
  for (const [id, thumb] of Object.entries(THUMBS)) js = setThumb(js, id, thumb);
  fs.writeFileSync(p, js);
  console.log('patched', p);
}

const login = await fetch('http://127.0.0.1:7990/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'SAAS_ADMIN_PASSWORD' }),
}).then((r) => r.json());
const token = login.token;
const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

async function uploadThumb(id, filePath) {
  const buf = fs.readFileSync(filePath);
  const dataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;
  const res = await fetch(`http://127.0.0.1:7990/api/saas/admin/showcase/items/${id}/thumb`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ dataUrl }),
  });
  const text = await res.text();
  console.log('thumb', id, res.status, text.slice(0, 200));
  return JSON.parse(text);
}

await uploadThumb(
  'sc-design-lanxi-site',
  'F:/Ai-pilotdeck/deploy/marketing/showcase/media/sc-design-lanxi-site/thumb-cover.jpg',
);
await uploadThumb(
  'sc-design-zhiye-dash',
  'F:/Ai-pilotdeck/deploy/marketing/showcase/media/sc-design-zhiye-dash/thumb-cover.jpg',
);

for (const id of Object.keys(THUMBS)) {
  const pub = await fetch(`http://127.0.0.1:7990/api/saas/admin/showcase/items/${id}/publish`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  console.log('publish', id, pub.status);
}

// After publish, keep authored covers + force catalog thumb paths
const overlayCat = catalogPaths[1];
const deployCat = catalogPaths[0];
let cat = fs.readFileSync(overlayCat, 'utf8');
for (const [id, thumb] of Object.entries(THUMBS)) cat = setThumb(cat, id, thumb);
fs.writeFileSync(deployCat, cat);
fs.writeFileSync(overlayCat, cat);

for (const id of Object.keys(THUMBS)) {
  const src = path.join(
    'F:/Ai-pilotdeck/deploy/marketing/showcase/media',
    id,
    'thumb-cover.jpg',
  );
  const dest = path.join(
    'F:/Ai-pilotdeck/.saas-dev-data/marketing-showcase/media',
    id,
    'thumb-cover.jpg',
  );
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

console.log('done');
