/**
 * PD-SAAS-FORK: Harness submit_turn payload aligns with gateway golden fixture.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const GOLDEN = JSON.parse(
  fs.readFileSync(
    path.join(REPO_ROOT, 'tests/fixtures/gateway-harness-capability-payload.json'),
    'utf8',
  ),
);

function buildHarnessPayload(input) {
  return {
    sessionKey: input.sessionKey,
    channelKey: 'cli',
    projectKey: input.projectKey ?? 'general',
    workspaceCwd: input.workspaceCwd,
    mode: 'bypassPermissions',
    maxTurns: 12,
    message: `[${input.tag}] ${input.message}`,
    promptLanguage: 'zh-CN',
    capabilityContext: {
      slug: input.capabilityContext.slug,
      displayName: input.capabilityContext.displayName || input.capabilityContext.slug,
      ...(input.capabilityContext.completionMode
        ? { completionMode: input.capabilityContext.completionMode }
        : {}),
    },
  };
}

describe('gateway harness capability payload', () => {
  it('includes golden required keys and capabilityContext shape', () => {
    const payload = buildHarnessPayload({
      sessionKey: 'sess-1',
      workspaceCwd: 'C:/workspace/general',
      tag: 'nova-slides',
      message: 'test message',
      capabilityContext: {
        slug: 'nova-ppt-aesthetic-slides',
        displayName: 'Nova 美学幻灯',
      },
    });
    for (const key of GOLDEN.requiredKeys) {
      assert.ok(Object.prototype.hasOwnProperty.call(payload, key), key);
    }
    for (const key of GOLDEN.capabilityRequiredKeys) {
      assert.ok(Object.prototype.hasOwnProperty.call(payload.capabilityContext, key), key);
    }
    assert.equal(payload.promptLanguage, 'zh-CN');
    assert.ok(payload.capabilityContext.displayName);
  });
});
