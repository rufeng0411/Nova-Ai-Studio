import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectsSource = fs.readFileSync(
  path.join(__dirname, '../../ui/server/projects.js'),
  'utf8',
);

describe('projects listSessionsForProjectKey regression', () => {
  it('does not reference undefined options in catalog branch', () => {
    const fnStart = projectsSource.indexOf('async function listSessionsForProjectKey');
    assert.ok(fnStart >= 0);
    const fnBody = projectsSource.slice(fnStart, fnStart + 2500);
    assert.doesNotMatch(fnBody, /includeOlder:\s*options\.includeOlder/);
    assert.match(fnBody, /includeOlder,/);
  });
});
