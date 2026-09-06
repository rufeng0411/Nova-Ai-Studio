import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  HUB_DELIVERABLE_BY_SLUG,
  finalizeHubTryPrompt,
  resolveHubDeliverables,
} from './promptTemplateStrategy.mjs';

const ROOT = new URL('../../', import.meta.url);

async function source(relativePath) {
  return readFile(new URL(relativePath, ROOT), 'utf8');
}

test('Hub exact capability prompts preserve scoped file contracts', () => {
  assert.equal(
    Object.hasOwn(HUB_DELIVERABLE_BY_SLUG, 'mkt-last30days'),
    true,
    'mkt-last30days must use an exact one-file Hub contract',
  );
  assert.deepEqual(resolveHubDeliverables('mkt-last30days', 'marketing'), [
    'marketing-deliverable.md',
  ]);

  const strategyPrompt = finalizeHubTryPrompt(
    '请分析我的品牌下一步应该怎么走',
    {
      slug: 'ala-strategy-advisor',
      majorCategory: 'office',
      taskGroup: 'strategy',
    },
  );
  assert.doesNotMatch(strategyPrompt, /须交付：|系统分配任务目录|strategy-report\.md/);
});

test('Korea K3 defaults to one authoritative last30days result and keeps legacy coverage', async () => {
  const korea = await source('scripts/integration-korea-deliverable-matrix-live.mjs');
  const k3 = korea.match(/\{\s*id:\s*'K3',[\s\S]*?\n\s*\},/)?.[0] ?? '';
  assert.match(k3, /slug:\s*'mkt-last30days'/);
  assert.match(k3, /expectMinRows:\s*1/);
  assert.match(k3, /expectMaxRows:\s*1/);
  assert.match(k3, /expectBasenames:\s*\['marketing-deliverable\.md'\]/);

  const legacy = korea.match(/\{\s*id:\s*'K3L',[\s\S]*?\n\s*\},/)?.[0] ?? '';
  assert.match(legacy, /content-flywheel/);
  assert.match(legacy, /01-topics\.md/);
  assert.match(legacy, /02-longform\.md/);
  assert.match(legacy, /03-social-slices\.md/);
  assert.match(legacy, /expectMinRows:\s*3/);

  assert.match(korea, /writePaths\.length\s*<=\s*entry\.expectMaxRows/);
  assert.match(korea, /entry\.expectBasenames/);
  assert.match(korea, /const required = \[[^\]]*'K3L'/);
});

test('development, packaging, and cloud scripts share the single tri-state scope switch', async () => {
  const [launcher, pack, cloud] = await Promise.all([
    source('scripts/lib/devLauncherCore.mjs'),
    source('scripts/release/pack.mjs'),
    source('scripts/release/apply-cloud-perf-env.sh'),
  ]);

  assert.match(launcher, /PILOTDECK_CAPABILITY_SCOPE_V2:\s*process\.env\.PILOTDECK_CAPABILITY_SCOPE_V2\s*\?\?\s*'enforce'/);
  assert.match(launcher, /PILOTDECK_QUALITY_CANARY_SLUGS/);
  assert.match(launcher, /PILOTDECK_GOAL_QUALITY_CONTRACT:\s*process\.env\.PILOTDECK_GOAL_QUALITY_CONTRACT\s*\?\?\s*'shadow'/);
  assert.match(launcher, /PILOTDECK_GOAL_QUALITY_CANARY_SLUGS:\s*process\.env\.PILOTDECK_GOAL_QUALITY_CANARY_SLUGS\s*\?\?\s*''/);
  assert.match(launcher, /PILOTDECK_GOAL_QUALITY_CANARY_TENANTS:\s*process\.env\.PILOTDECK_GOAL_QUALITY_CANARY_TENANTS\s*\?\?\s*''/);
  assert.match(launcher, /PILOTDECK_CONTENT_QUALITY_V2:\s*process\.env\.PILOTDECK_CONTENT_QUALITY_V2\s*\?\?\s*'shadow'/);

  assert.match(pack, /PILOTDECK_CAPABILITY_SCOPE_V2/);
  assert.match(pack, /PILOTDECK_QUALITY_CANARY_SLUGS/);
  assert.match(pack, /PILOTDECK_CAPABILITY_SCOPE_V2:\s*'shadow'/);
  assert.match(pack, /PILOTDECK_GOAL_QUALITY_CONTRACT:\s*'shadow'/);
  assert.match(pack, /PILOTDECK_GOAL_QUALITY_CANARY_SLUGS:\s*''/);
  assert.match(pack, /PILOTDECK_GOAL_QUALITY_CANARY_TENANTS:\s*''/);
  assert.match(pack, /PILOTDECK_CONTENT_QUALITY_V2:\s*'off'/);

  assert.match(cloud, /PILOTDECK_CAPABILITY_SCOPE_V2/);
  assert.match(cloud, /PILOTDECK_QUALITY_CANARY_SLUGS/);
  assert.match(cloud, /CAPABILITY_SCOPE_V2.*\^\(off\|shadow\|enforce\)\$/);
  assert.match(cloud, /PILOTDECK_GOAL_QUALITY_CONTRACT/);
  assert.match(cloud, /PILOTDECK_GOAL_QUALITY_CANARY_SLUGS/);
  assert.match(cloud, /PILOTDECK_GOAL_QUALITY_CANARY_TENANTS/);
  assert.match(cloud, /GOAL_QUALITY_CONTRACT.*\^\(off\|shadow\|enforce\)\$/);
  assert.match(cloud, /PILOTDECK_CONTENT_QUALITY_V2/);
  assert.match(cloud, /CONTENT_QUALITY_V2.*\^\(off\|shadow\|enforce\)\$/);

  for (const text of [launcher, pack, cloud]) {
    assert.doesNotMatch(text, /PILOTDECK_LAST30DAYS_SCOPE_V2|PILOTDECK_STRATEGY_ADVISOR_REPORT_MODE/);
  }
});
