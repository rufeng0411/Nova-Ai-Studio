#!/usr/bin/env node
/**
 * PD-SAAS-FORK: lightweight four-line deliverable fixture.
 * Live browser probes remain in four-line-alignment-acceptance.mjs with FOUR_LINE_LIVE=1.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveProjectDeliverableFile } from '../ui/server/utils/pathInProject.js';

function writeFixtureFile(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function resolveFiveProbes(projectRoot, lookupPath, hintDir) {
  const knownRoots = [projectRoot];
  const probes = {
    bodyLink: resolveProjectDeliverableFile(projectRoot, lookupPath, knownRoots, { hintDir }),
    deliverableCard: resolveProjectDeliverableFile(projectRoot, lookupPath, knownRoots, { hintDir }),
    fileTree: resolveProjectDeliverableFile(projectRoot, lookupPath, knownRoots, { hintDir }),
    rightDock: resolveProjectDeliverableFile(projectRoot, lookupPath, knownRoots, { hintDir }),
    overlay: resolveProjectDeliverableFile(projectRoot, lookupPath, knownRoots, { hintDir }),
  };
  const paths = Object.entries(probes).map(([probe, result]) => {
    assert.ok(result.ok, `${probe} failed to resolve ${lookupPath}`);
    return result.relativePath;
  });
  assert.equal(new Set(paths).size, 1, `${lookupPath} probes resolved to different paths: ${paths.join(', ')}`);
  return paths[0];
}

const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pd-four-line-'));
const liveDir = 'artifacts/campaign/wuyutai-2026summer';
const oldDir = 'artifacts/campaign/old-task';
const files = [
  'index.html',
  'platform-content.html',
  'visual-kv-preview.html',
  'Wuyutai-2026Summer-Brief.docx',
  'Wuyutai-2026Summer-CampaignPlan.md',
  'monitoring-retrospective.md',
];

writeFixtureFile(projectRoot, `${oldDir}/index.html`, '<!doctype html><html><body><section>old</section></body></html>');
for (const name of files) {
  const content = name.endsWith('.docx')
    ? Buffer.from('PK\x03\x04docx-bytes', 'latin1')
    : name.endsWith('.html')
      ? '<!doctype html><html><body><section>four-line</section></body></html>'
      : '# four-line\n';
  writeFixtureFile(projectRoot, `${liveDir}/${name}`, content);
}

const displayPaths = files.map((name) => `${liveDir}/${name}`);
for (const filePath of displayPaths) {
  const resolved = resolveFiveProbes(projectRoot, path.basename(filePath) === 'index.html' ? 'index.html' : filePath, liveDir);
  assert.equal(resolved, filePath);
}

const ambiguous = resolveProjectDeliverableFile(projectRoot, 'index.html', [projectRoot]);
assert.equal(ambiguous.ok, false, 'bare index.html without hintDir must not mtime-guess across tasks');

// PD-SAAS-FORK: phase 5 — the same bare name lives in two turn directories. Every entry
// point (body link / acceptance card / right-dock editor / file tree / overlay) must forward
// the turn-scoped hintDir so it resolves into the hinted turn only, never the other task's
// same-named file. This guards the useEditorSidebar/CodeEditorSurface hintDir fix.
const liveIndex = resolveProjectDeliverableFile(projectRoot, 'index.html', [projectRoot], { hintDir: liveDir });
assert.ok(
  liveIndex.ok && liveIndex.relativePath === `${liveDir}/index.html`,
  `index.html with live hintDir must resolve into ${liveDir}, got ${liveIndex.ok ? liveIndex.relativePath : 'unresolved'}`,
);
const oldIndex = resolveProjectDeliverableFile(projectRoot, 'index.html', [projectRoot], { hintDir: oldDir });
assert.ok(
  oldIndex.ok && oldIndex.relativePath === `${oldDir}/index.html`,
  `index.html with old hintDir must resolve into ${oldDir}, got ${oldIndex.ok ? oldIndex.relativePath : 'unresolved'}`,
);
assert.notEqual(
  liveIndex.relativePath,
  oldIndex.relativePath,
  'same bare name with different hintDir must not cross turns',
);

console.log(
  `[four-line-deliverable-e2e] PASS ${displayPaths.length} files x 5 probes + cross-turn hintDir isolation`,
);
