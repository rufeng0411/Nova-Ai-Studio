import assert from 'node:assert/strict';
import {
  buildExportOutputRelativePath,
  isExportOutputAllowed,
  resolveExportOutputDir,
} from './exportOutputPath.mjs';

assert.equal(resolveExportOutputDir('report.md'), 'artifacts/documents');
assert.equal(resolveExportOutputDir('artifacts/geo/report.md'), 'artifacts/geo');
assert.equal(resolveExportOutputDir('slide-01.png'), 'artifacts/documents');

const underArtifacts = buildExportOutputRelativePath('artifacts/geo/report.md', undefined, 'report', '.pdf');
assert.equal(underArtifacts, 'artifacts/geo/report-export.pdf');
assert.equal(isExportOutputAllowed(underArtifacts), true);

const rootMd = buildExportOutputRelativePath('炸酥带鱼.md', undefined, '炸酥带鱼', '.docx');
assert.equal(rootMd, 'artifacts/documents/炸酥带鱼-export.docx');
assert.equal(isExportOutputAllowed(rootMd), true);

const bad = buildExportOutputRelativePath('cloud-storage/users/1/ws/file.md', undefined, 'file', '.pdf');
assert.equal(bad.startsWith('artifacts/'), true);

console.log('[exportOutputPath.test] OK');
