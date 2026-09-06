import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.resolve(__dirname, '../fixtures/deliverable-partial');

describe('readSessionMessages deliverable meta replay', () => {
  it('fixture includes expectedManifest for partial nova replay', () => {
    const fixturePath = path.join(fixtureDir, 'nova-argentina-partial-3of6.meta.json');
    const payload = JSON.parse(readFileSync(fixturePath, 'utf8'));
    expect(Array.isArray(payload.expectedManifest)).toBe(true);
    expect(payload.expectedManifest[0]?.count).toBe(6);
    expect(payload.missingPaths.length).toBeGreaterThan(0);
    expect(payload.verifiedPaths.length).toBe(3);
  });

  it('completed bad-meta fixture keeps six verified disk paths', () => {
    const fixturePath = path.join(fixtureDir, 'nova-argentina-completed-bad-meta.meta.json');
    const payload = JSON.parse(readFileSync(fixturePath, 'utf8'));
    expect(payload.verifiedPaths).toHaveLength(0);
    expect(payload.missingPaths.some((p: string) => p.includes('*'))).toBe(true);
    expect(payload.knownDiskPaths).toHaveLength(6);
  });
});
