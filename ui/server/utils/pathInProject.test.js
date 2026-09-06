import { describe, expect, it } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, utimesSync } from 'node:fs';
import {
  artifactPathCandidates,
  expandTruncatedWindowsProfilePath,
  findArtifactFileByBasename,
  findProjectRootContaining,
  repairCorruptedWindowsPath,
  resolveExistingProjectFilePath,
  resolvePreviewPath,
  resolveProjectDeliverableFile,
} from './pathInProject.js';

describe('pathInProject preview resolution', () => {
  it('expands truncated profile paths on Windows', () => {
    if (process.platform !== 'win32') return;
    const expanded = expandTruncatedWindowsProfilePath('Users/rufen/.pilotdeck/index.html');
    expect(expanded).toBe(path.join(os.homedir(), '.pilotdeck/index.html'));
  });

  it('repairs corrupted username segments', () => {
    expect(repairCorruptedWindowsPath('C:/Users ufen/.pilotdeck/index.html')).toBe(
      'C:/Users/rufen/.pilotdeck/index.html',
    );
  });

  it('repairs eaten \\r before rog path segments', () => {
    expect(repairCorruptedWindowsPath('C:/Users/rufen/.pilotdeck og-nuc-2026.html')).toBe(
      'C:/Users/rufen/.pilotdeck/rog-nuc-2026.html',
    );
  });

  it('resolves absolute files under a different known project root', () => {
    const generalRoot = path.join(os.homedir(), '.pilotdeck');
    const documentsRoot = path.join(os.homedir(), 'Documents');
    const target = path.join(documentsRoot, 'rog-nuc-5080-landing', 'index.html');

    const result = resolvePreviewPath(generalRoot, target, [generalRoot, documentsRoot]);
    expect(result.valid).toBe(true);
    expect(result.resolved).toBe(path.resolve(target));
  });

  it('resolves shortened social-matrix deliverable paths', () => {
    const target = 'ai-enterprise-solutions/research.md';
    const candidates = artifactPathCandidates(target);
    expect(candidates).toContain('artifacts/social-matrix/ai-enterprise-solutions/research.md');

    const filePath = 'D:/workspaces/0601/artifacts/social-matrix/ai-enterprise-solutions/research.md';
    if (!existsSync(filePath)) {
      return;
    }
    const result = resolveExistingProjectFilePath(
      'D:/workspaces/0601',
      target,
      ['D:/workspaces/0601'],
    );
    expect(result.valid).toBe(true);
    expect(result.resolved.replace(/\\/g, '/').toLowerCase()).toContain(
      'artifacts/social-matrix/ai-enterprise-solutions/research.md',
    );
  });

  it('lists geo prefix for campaign deliverable paths', () => {
    const candidates = artifactPathCandidates('hema-red-bean-corn-silk-water/keywords.md');
    expect(candidates).toContain('artifacts/geo/hema-red-bean-corn-silk-water/keywords.md');
  });

  it('resolves markdown table paths and drafts subfolders', () => {
    const root = 'D:/workspaces/0601';
    if (!existsSync(path.join(root, 'artifacts/geo/hema-red-bean-corn-silk-water/06-全案总结报告.md'))) {
      return;
    }
    const report = resolveExistingProjectFilePath(root, '[6] 全案总结报告.md', [root]);
    expect(report.valid).toBe(true);
    expect(report.resolved.replace(/\\/g, '/').toLowerCase()).toContain('06-全案总结报告.md');

    const draft = resolveExistingProjectFilePath(root, 'drafts/03a-知乎长文成稿.md', [root]);
    expect(draft.valid).toBe(true);
    expect(draft.resolved.replace(/\\/g, '/').toLowerCase()).toContain('drafts/03a-知乎长文成稿.md');
  });

  it('resolves bare filename under artifacts via basename search', () => {
    const root = 'D:/workspaces/0601';
    const filePath = 'D:/workspaces/0601/artifacts/geo/hema-red-bean-corn-silk-water/keywords.md';
    if (!existsSync(filePath)) {
      return;
    }
    const relative = findArtifactFileByBasename(root, 'keywords.md');
    expect(relative).toBeTruthy();
    expect(relative.toLowerCase()).toContain('keywords.md');

    const result = resolveExistingProjectFilePath(root, 'keywords.md', [root]);
    expect(result.valid).toBe(true);
    expect(result.resolved.replace(/\\/g, '/').toLowerCase()).toContain(
      'artifacts/geo/hema-red-bean-corn-silk-water/keywords.md',
    );
  });

  it('resolveProjectDeliverableFile returns relative path for bare filenames', () => {
    const root = 'D:/workspaces/0601';
    const filePath = 'D:/workspaces/0601/artifacts/geo/hema-red-bean-corn-silk-water/keywords.md';
    if (!existsSync(filePath)) {
      return;
    }
    const resolved = resolveProjectDeliverableFile(root, 'keywords.md', [root]);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.relativePath).toBe('artifacts/geo/hema-red-bean-corn-silk-water/keywords.md');
    }
  });

  it('finds the longest matching project root', () => {
    const generalRoot = path.join(os.homedir(), '.pilotdeck');
    const nestedRoot = path.join(generalRoot, 'artifacts', 'design');
    const target = path.join(nestedRoot, 'page', 'index.html');

    const owning = findProjectRootContaining(target, [generalRoot, nestedRoot]);
    expect(owning).toBe(path.resolve(nestedRoot));
  });

  it('returns ambiguous for bare index.html when multiple artifacts exist', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'pd-resolve-'));
    const oldArtifactDir = path.join(root, 'artifacts', 'design', 'topic-a');
    const newArtifactDir = path.join(root, 'artifacts', 'design', 'topic-b');
    mkdirSync(oldArtifactDir, { recursive: true });
    mkdirSync(newArtifactDir, { recursive: true });
    writeFileSync(path.join(oldArtifactDir, 'index.html'), 'old');
    const newest = path.join(newArtifactDir, 'index.html');
    writeFileSync(newest, 'new');

    const base = Date.now() / 1000;
    utimesSync(path.join(oldArtifactDir, 'index.html'), base, base);
    utimesSync(newest, base, base + 20);

    const ambiguous = resolveProjectDeliverableFile(root, 'index.html', [root]);
    expect(ambiguous.ok).toBe(false);
    if (!ambiguous.ok) {
      expect(ambiguous.code).toBe('ambiguous_deliverable');
    }
  });

  it('returns ambiguous for bare deck.bento.html when multiple task dirs exist', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'pd-bento-clash-'));
    const taskA = path.join(root, 'artifacts', 'task-20260728-a1b2c3d4');
    const taskB = path.join(root, 'artifacts', 'task-20260728-41dd1371');
    mkdirSync(taskA, { recursive: true });
    mkdirSync(taskB, { recursive: true });
    writeFileSync(path.join(taskA, 'deck.bento.html'), 'razer');
    const newest = path.join(taskB, 'deck.bento.html');
    writeFileSync(newest, 'fifa');

    const base = Date.now() / 1000;
    utimesSync(path.join(taskA, 'deck.bento.html'), base, base);
    utimesSync(newest, base, base + 20);

    const ambiguous = resolveProjectDeliverableFile(root, 'deck.bento.html', [root]);
    expect(ambiguous.ok).toBe(false);
    if (!ambiguous.ok) {
      expect(ambiguous.code).toBe('ambiguous_deliverable');
    }

    const scoped = resolveProjectDeliverableFile(root, 'deck.bento.html', [root], {
      hintDir: 'artifacts/task-20260728-a1b2c3d4',
    });
    expect(scoped.ok).toBe(true);
    if (scoped.ok) {
      expect(scoped.relativePath).toBe('artifacts/task-20260728-a1b2c3d4/deck.bento.html');
    }
  });

  it('prefers exact project-root index.html over ambiguous artifact indexes', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'pd-root-index-'));
    const oldArtifactDir = path.join(root, 'artifacts', 'design', 'topic-a');
    const newArtifactDir = path.join(root, 'artifacts', 'design', 'topic-b');
    mkdirSync(oldArtifactDir, { recursive: true });
    mkdirSync(newArtifactDir, { recursive: true });
    writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><body>Razer landing page</body></html>');
    writeFileSync(path.join(oldArtifactDir, 'index.html'), 'old');
    writeFileSync(path.join(newArtifactDir, 'index.html'), 'new');

    const result = resolveProjectDeliverableFile(root, 'index.html', [root]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.relativePath).toBe('index.html');
      expect(result.absolutePath).toBe(path.join(root, 'index.html'));
    }
  });

  it('prefers hintDir over mtime for bare index.html', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'pd-resolve-'));
    const oldArtifactDir = path.join(root, 'artifacts', 'design', 'topic-a');
    const newArtifactDir = path.join(root, 'artifacts', 'design', 'topic-b');
    mkdirSync(oldArtifactDir, { recursive: true });
    mkdirSync(newArtifactDir, { recursive: true });
    writeFileSync(path.join(oldArtifactDir, 'index.html'), 'old');
    const newest = path.join(newArtifactDir, 'index.html');
    writeFileSync(newest, 'new');

    const base = Date.now() / 1000;
    utimesSync(path.join(oldArtifactDir, 'index.html'), base, base);
    utimesSync(newest, base, base + 20);

    const result = resolveProjectDeliverableFile(root, 'index.html', [root], {
      hintDir: 'artifacts/design/topic-a',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.relativePath).toBe('artifacts/design/topic-a/index.html');
    }
  });

  it('does not mtime-pick a bare GEO deliverable when same basename exists in multiple artifact dirs', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'pd-geo-bare-collision-'));
    const oldGeoDir = path.join(root, 'artifacts', 'geo', '01-geo-aeo-audit');
    const newGeoDir = path.join(root, 'artifacts', 'razer-blade-5090-geo-20260623');
    mkdirSync(oldGeoDir, { recursive: true });
    mkdirSync(newGeoDir, { recursive: true });
    writeFileSync(path.join(oldGeoDir, 'audit-checklist.md'), 'old');
    const real = path.join(newGeoDir, 'audit-checklist.md');
    writeFileSync(real, 'new');

    const base = Date.now() / 1000;
    utimesSync(real, base, base);
    utimesSync(path.join(oldGeoDir, 'audit-checklist.md'), base, base + 30);

    const ambiguous = resolveProjectDeliverableFile(root, 'audit-checklist.md', [root]);
    expect(ambiguous.ok).toBe(false);
    if (!ambiguous.ok) {
      expect(ambiguous.code).toBe('ambiguous_deliverable');
    }

    const hinted = resolveProjectDeliverableFile(root, 'audit-checklist.md', [root], {
      hintDir: 'artifacts/razer-blade-5090-geo-20260623',
    });
    expect(hinted.ok).toBe(true);
    if (hinted.ok) {
      expect(hinted.relativePath).toBe('artifacts/razer-blade-5090-geo-20260623/audit-checklist.md');
    }
  });

  it('resolves Chinese xlsx under artifacts via basename search', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'pd-xlsx-'));
    const artifactDir = path.join(root, 'artifacts', 'content-rog-20250615-1030');
    mkdirSync(artifactDir, { recursive: true });
    const fileName = 'ROG大油条-活动预算表.xlsx';
    const absolute = path.join(artifactDir, fileName);
    writeFileSync(absolute, 'xlsx-smoke');

    const relative = findArtifactFileByBasename(root, fileName);
    expect(relative).toBe('artifacts/content-rog-20250615-1030/ROG大油条-活动预算表.xlsx');

    const encoded = encodeURIComponent(fileName);
    const fromEncoded = resolveExistingProjectFilePath(root, encoded, [root]);
    expect(fromEncoded.valid).toBe(true);
    expect(fromEncoded.resolved).toBe(path.resolve(absolute));
  });

  it('does not resolve bare slide-manifest.json to another deck', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'pd-slide-deck-'));
    const oldDeck = path.join(root, 'artifacts', 'slides-ming-arch-guofeng');
    const newDeck = path.join(root, 'artifacts', 'slides-ai-business-growth');
    mkdirSync(oldDeck, { recursive: true });
    mkdirSync(newDeck, { recursive: true });
    writeFileSync(path.join(oldDeck, 'slide-manifest.json'), '{"pages":[]}');
    writeFileSync(path.join(newDeck, 'slide-manifest.json'), '{"pages":[]}');

    expect(findArtifactFileByBasename(root, 'slide-manifest.json')).toBeNull();

    const missingExplicit = resolveProjectDeliverableFile(
      root,
      'artifacts/slides-ai-business-growth/slide-missing-manifest.json',
      [root],
    );
    expect(missingExplicit.ok).toBe(false);

    const wrongDeck = resolveProjectDeliverableFile(
      root,
      'artifacts/slides-ai-business-growth/slide-manifest.json',
      [root],
    );
    expect(wrongDeck.ok).toBe(true);
    if (wrongDeck.ok) {
      expect(wrongDeck.absolutePath).toBe(path.resolve(newDeck, 'slide-manifest.json'));
    }
  });

  it('resolves nested cited path to workspace-root basename when folder file is missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'pd-nested-resolve-'));
    writeFileSync(path.join(root, 'dashboard.html'), '<html></html>');
    mkdirSync(path.join(root, 'assets'), { recursive: true });

    const existing = resolveExistingProjectFilePath(root, 'assets/dashboard.html', [root]);
    expect(existing.valid).toBe(true);
    expect(existing.resolved).toBe(path.join(root, 'dashboard.html'));

    const deliverable = resolveProjectDeliverableFile(root, 'assets/dashboard.html', [root]);
    expect(deliverable.ok).toBe(true);
    if (deliverable.ok) {
      expect(deliverable.relativePath).toBe('dashboard.html');
    }
  });

  it('does not treat missing nested paths as valid without an on-disk file', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'pd-missing-resolve-'));
    mkdirSync(path.join(root, 'assets'), { recursive: true });

    const existing = resolveExistingProjectFilePath(root, 'assets/missing.html', [root]);
    expect(existing.valid).toBe(false);
  });

  it('finds deliverables in alternate SaaS hub roots when project cwd differs', () => {
    const projectRoot = mkdtempSync(path.join(os.tmpdir(), 'pd-hub-a-'));
    const orphanHub = mkdtempSync(path.join(os.tmpdir(), 'pd-hub-b-'));
    writeFileSync(path.join(orphanHub, 'dashboard.html'), '<html></html>');

    const result = resolveExistingProjectFilePath(projectRoot, 'dashboard.html', [
      projectRoot,
      orphanHub,
    ]);
    expect(result.valid).toBe(true);
    expect(result.resolved).toBe(path.join(orphanHub, 'dashboard.html'));
  });

  it('returns null for strict hintDir multi-match instead of mtime pick', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'pd-strict-hint-'));
    const hintDir = 'artifacts/slides-argentina-a1b2c3d4';
    const dirA = path.join(root, hintDir, 'deck-a');
    const dirB = path.join(root, hintDir, 'deck-b');
    mkdirSync(dirA, { recursive: true });
    mkdirSync(dirB, { recursive: true });
    writeFileSync(path.join(dirA, 'slide-01.png'), 'a');
    writeFileSync(path.join(dirB, 'slide-01.png'), 'b');
    utimesSync(path.join(dirA, 'slide-01.png'), new Date('2020-01-01'), new Date('2020-01-01'));
    utimesSync(path.join(dirB, 'slide-01.png'), new Date('2026-01-01'), new Date('2026-01-01'));

    const legacy = findArtifactFileByBasename(root, 'slide-01.png', {
      hintDir,
      legacyPathMode: 'legacy',
    });
    expect(legacy).toBeTruthy();

    const strict = findArtifactFileByBasename(root, 'slide-01.png', {
      hintDir,
      legacyPathMode: 'strict',
    });
    expect(strict).toBeNull();
  });

  it('does not mtime-guess partial assets/raw paths across task dirs', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'pd-asset-clash-'));
    const taskA = path.join(root, 'artifacts', 'task-20260719-aaaa');
    const taskB = path.join(root, 'artifacts', 'task-20260719-bbbb');
    const assetRel = path.join('assets', 'raw', 'img-e8ac1bc3f77c.jpg');
    mkdirSync(path.join(taskA, 'assets', 'raw'), { recursive: true });
    mkdirSync(path.join(taskB, 'assets', 'raw'), { recursive: true });
    writeFileSync(path.join(taskA, assetRel), 'task-a');
    writeFileSync(path.join(taskB, assetRel), 'task-b');
    utimesSync(path.join(taskA, assetRel), new Date('2020-01-01'), new Date('2020-01-01'));
    utimesSync(path.join(taskB, assetRel), new Date('2026-01-01'), new Date('2026-01-01'));

    expect(findArtifactFileByBasename(root, assetRel.replace(/\\/g, '/'))).toBeNull();

    const ambiguous = resolveProjectDeliverableFile(root, assetRel.replace(/\\/g, '/'), [root]);
    expect(ambiguous.ok).toBe(false);
    if (!ambiguous.ok) {
      expect(ambiguous.code).toBe('ambiguous_deliverable');
    }

    const scoped = resolveProjectDeliverableFile(root, assetRel.replace(/\\/g, '/'), [root], {
      hintDir: 'artifacts/task-20260719-aaaa',
    });
    expect(scoped.ok).toBe(true);
    if (scoped.ok) {
      expect(scoped.relativePath).toBe('artifacts/task-20260719-aaaa/assets/raw/img-e8ac1bc3f77c.jpg');
    }
  });
});
