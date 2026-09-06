import test from 'node:test';
import assert from 'node:assert/strict';

function mapValidationStatus(status, resolvedPath) {
  switch (status) {
    case 'verified':
      return 'verified';
    case 'pending':
      return resolvedPath ? 'verified' : 'missing';
    case 'phantom':
      return 'phantom';
    case 'broken':
    default:
      return 'broken';
  }
}

test('maps pending with resolvedPath to verified', () => {
  assert.equal(mapValidationStatus('pending', 'artifacts/slides-a/slide-01.png'), 'verified');
  assert.equal(mapValidationStatus('pending', undefined), 'missing');
});
