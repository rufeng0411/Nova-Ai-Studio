const cat = await fetch(`http://127.0.0.1:8081/showcase/shared/catalog.js?cb=${Date.now()}`).then(
  (r) => r.text(),
);
const site = await fetch(
  `http://127.0.0.1:8081/showcase/shared/site.js?v=32&cb=${Date.now()}`,
).then((r) => r.text());
for (const id of ['sc-design-lanxi-site', 'sc-design-zhiye-dash']) {
  const m = cat.match(new RegExp(`"id": "${id}"[\\s\\S]*?"thumb": "([^"]*)"`));
  console.log(id, m ? m[1] : 'MISSING');
}
console.log('target_blank', /target="_blank"/.test(site));
for (const p of [
  '/showcase/media/sc-design-lanxi-site/thumb-cover.jpg',
  '/showcase/media/sc-design-zhiye-dash/thumb-cover.jpg',
]) {
  const r = await fetch(`http://127.0.0.1:8081${p}?cb=${Date.now()}`);
  console.log(p, r.status, r.headers.get('content-length'));
}
