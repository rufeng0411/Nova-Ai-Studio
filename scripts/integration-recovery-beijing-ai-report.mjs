#!/usr/bin/env node
/**
 * Beijing AI transformation research report — recovery path smoke (offline).
 * Live e2e: dev:saas + 流程模板「调研报告交付」+ RUN_LIVE=1.
 */
import assert from 'node:assert/strict';

async function offlineChecks() {
  const { detectResearchReportTurn, buildResearchReportExecutionPrompt } = await import(
    '../src/saas/processTemplateExecutionPrompt.ts'
  );
  const { RecoveryBudget } = await import('../src/saas/resilience/recoveryBudget.ts');
  const { resolveTieredRecoveryLimits, worstHardFailFromToolResults } = await import(
    '../src/saas/resilience/recoveryPolicy.ts'
  );
  const { shouldAutoContinueAfterAssistantText } = await import(
    '../src/agent/errors/userFacingErrors.ts'
  );

  const userPrompt =
    '帮我就【北京地区企业人工智能业务转型研究】做一份正式调研报告，3 步一次做完：深度调研、图表、Word 报告';
  assert.ok(detectResearchReportTurn(userPrompt), 'should detect beijing research template');
  const execBlock = buildResearchReportExecutionPrompt('zh-CN');
  assert.match(execBlock, /export_document/);
  assert.match(execBlock, /禁止.*read_file skills/);

  const limits = resolveTieredRecoveryLimits({});
  assert.equal(limits.recoverableMax, 12);
  assert.equal(limits.hardFailMax, 3);

  const budget = new RecoveryBudget(limits.recoverableMax, limits.hardFailMax);
  for (let i = 0; i < 12; i += 1) {
    assert.ok(budget.tryConsume('tool_recovery'));
  }
  assert.equal(budget.tryConsume('tool_recovery'), null);

  assert.equal(
    worstHardFailFromToolResults([
      { type: 'error', error: { message: '403 invalid api key' } },
    ]),
    'model_auth',
  );

  const planningAfterSearch = '调研已完成，接下来生成图表并整合 Word 报告。';
  assert.equal(
    shouldAutoContinueAfterAssistantText(planningAfterSearch, { hadRecentToolSuccess: true }),
    false,
    'planning after tool success must not trigger auto_continue',
  );

  console.log('integration-recovery-beijing-ai-report: offline checks OK');
}

await offlineChecks();

if (process.env.RUN_LIVE === '1') {
  console.log('RUN_LIVE=1: 请在 dev:saas 中用「调研报告交付」模板实测北京 AI 主题全链路');
}
