import fs from 'node:fs';

async function gh(repo) {
  const url = `https://api.github.com/repos/${repo}/git/trees/HEAD?recursive=1`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'pilotdeck-vendor', Accept: 'application/vnd.github+json' },
  });
  if (!r.ok) {
    return { repo, error: `${r.status} ${(await r.text()).slice(0, 200)}` };
  }
  const j = await r.json();
  const skills = (j.tree || [])
    .filter((t) => t.type === 'blob' && /SKILL\.md$/i.test(t.path))
    .map((t) => t.path);
  return { repo, count: skills.length, skills };
}

async function lic(repo) {
  const r = await fetch(`https://api.github.com/repos/${repo}/license`, {
    headers: { 'User-Agent': 'pilotdeck-vendor' },
  });
  if (r.status === 404) return { license: null };
  if (!r.ok) return { licenseError: r.status };
  const j = await r.json();
  return { license: j.license?.spdx_id || j.license?.key || 'unknown', licensePath: j.path };
}

const repos = [
  'zhou210712/claude-for-legal-ZH',
  'vivy-yi/Greater-China-Legal',
  'youyouhe/bidsmart-claude-skills',
  'Get00/BiaoShu-SKILL',
  'zh-xx/legal-assistant-skills',
];

const out = {};
for (const repo of repos) {
  const tree = await gh(repo);
  const license = await lic(repo);
  out[repo] = { ...tree, ...license };
  console.log(repo, 'skills', out[repo].count ?? 'err', 'license', out[repo].license);
}

fs.writeFileSync('docs/_cn-compliance-upstream-probe.json', JSON.stringify(out, null, 2));
console.log('wrote docs/_cn-compliance-upstream-probe.json');
