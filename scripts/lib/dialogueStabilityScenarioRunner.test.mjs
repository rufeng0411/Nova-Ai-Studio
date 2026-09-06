import test from 'node:test';
import assert from 'node:assert/strict';

import { validateDialogueStabilityScenarioMatrix } from './dialogueStabilityScenarioRunner.mjs';

test('validateDialogueStabilityScenarioMatrix enforces historical and entrypoint coverage', () => {
  const scenarios = [
    {
      id: 'wuyutai-campaign-ledger-tail',
      title: '吴裕泰 Campaign 全案累计成果丢失',
      suites: ['historical', 'capabilities', 'process-templates'],
      source: 'capability',
      entrypoint: 'content-flywheel',
      historicalFailure: '尾页分页只显示过程 HTML。',
      userGoal: '生成 Campaign 全案六文件。',
      turns: [{ role: 'user', text: '生成 Campaign 全案六文件。' }],
      expectedGoalContract: { kinds: ['markdown'], requiredFiles: ['brief.md'] },
      expectedDeliverables: ['brief.md'],
      forbiddenDeliverables: ['process.html'],
      interruptionAssertions: { canAskUser: false, autoResume: true },
      fiveEntryAssertions: { sameResolvedPath: true },
      telemetryAssertions: { owner: 'deliverable_repair', emptySpin: false },
      coverage: {
        historical: true,
        capabilityCategory: 'marketing',
        marketingStage: 'research',
        processTemplate: 'content-flywheel',
        skillKind: 'multi_file',
      },
    },
  ];

  const result = validateDialogueStabilityScenarioMatrix(scenarios);

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('12')));
  assert.ok(result.failures.some((failure) => failure.includes('office')));
});
