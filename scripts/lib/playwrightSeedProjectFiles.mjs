/**
 * PD-SAAS-FORK: seed Playwright fixtures into the live SaaS project file root.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

export async function fetchProjectFileRoot(page, projectName = 'general') {
  const projects = await page.evaluate(async () => {
    const token = localStorage.getItem('auth-token');
    const res = await fetch('/api/projects', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`projects HTTP ${res.status}`);
    return res.json();
  });
  const project = (projects || []).find(
    (p) => p?.name === projectName || p?.displayName === projectName,
  );
  const fileRoot = String(project?.fullPath || project?.path || '').trim();
  if (!fileRoot) {
    throw new Error(`project file root not found for ${projectName}`);
  }
  return fileRoot;
}

export async function copyTree(srcDir, destDir) {
  await fs.mkdir(destDir, { recursive: true });
  for (const entry of await fs.readdir(srcDir, { withFileTypes: true })) {
    const from = path.join(srcDir, entry.name);
    const to = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyTree(from, to);
    } else {
      await fs.copyFile(from, to);
    }
  }
}

export async function seedFixtureTree(page, projectName, fixtureDir, targetRelative) {
  const root = await fetchProjectFileRoot(page, projectName);
  const dest = path.join(root, targetRelative.split('/').join(path.sep));
  await copyTree(fixtureDir, dest);
  return { projectRoot: root, destDir: dest };
}

export async function statProjectRelative(page, projectName, relativePath) {
  const root = await fetchProjectFileRoot(page, projectName);
  const abs = path.join(root, relativePath.split('/').join(path.sep));
  return fs.stat(abs);
}
