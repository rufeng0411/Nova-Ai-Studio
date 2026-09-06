import fs from 'node:fs';
import path from 'node:path';

const base = path.join(process.env.TEMP || process.env.TMP, 'pd-cn-compliance-probe');

function walkSkillDirs(dir, root, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (fs.existsSync(path.join(p, 'SKILL.md'))) {
        acc.push(path.relative(root, p).replace(/\\/g, '/'));
      }
      walkSkillDirs(p, root, acc);
    }
  }
  return acc;
}

const packs = {
  zhou: {
    plugins: [
      'employment-legal',
      'commercial-legal',
      'corporate-legal',
      'privacy-legal',
      'product-legal',
      'regulatory-legal',
    ],
  },
  vivy: { taxGlobs: ['tax-compliance', 'tax-preference'] },
  bidsmart: {},
  biaoshu: {},
  zhxx: {},
};

const out = {};
for (const [name, meta] of Object.entries(packs)) {
  const root = path.join(base, name);
  const all = walkSkillDirs(root, root);
  const licFiles = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].filter((f) =>
    fs.existsSync(path.join(root, f)),
  );
  out[name] = {
    root,
    licenseFiles: licFiles,
    allSkillDirs: all,
    count: all.length,
  };
  if (name === 'zhou') {
    out[name].byPlugin = {};
    for (const plug of meta.plugins) {
      out[name].byPlugin[plug] = all.filter(
        (d) => d === plug || d.startsWith(`${plug}/`) || d.includes(`/${plug}/`) || d.startsWith(`${plug}/skills`),
      );
      // typical layout: employment-legal/skills/foo
      out[name].byPlugin[plug] = all.filter((d) => d.startsWith(`${plug}/`));
    }
  }
  if (name === 'vivy') {
    out[name].taxDirs = all.filter(
      (d) => /tax-compliance|tax-preference|invoice|vat|cit/i.test(d),
    );
  }
  console.log(name, 'count', all.length, 'license', licFiles.join(',') || 'NONE');
  for (const d of all.slice(0, 25)) console.log(' ', d);
  if (all.length > 25) console.log(' ...+' + (all.length - 25));
}

fs.writeFileSync('docs/_cn-compliance-upstream-probe.json', JSON.stringify(out, null, 2));
console.log('wrote probe');
