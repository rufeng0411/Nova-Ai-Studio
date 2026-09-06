#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Self-check P0/P1/P2 roadmap items from task-driven-dialogue deep analysis.
 * Usage: node scripts/selfcheck-p0-p2-roadmap.mjs [--json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function read(file) {
  const p = path.join(ROOT, file);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

function has(file) {
  return fs.existsSync(path.join(ROOT, file));
}

function grep(content, pattern) {
  return pattern.test(content);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...opts,
  });
  return {
    ok: r.status === 0,
    status: r.status ?? 1,
    stdout: (r.stdout || '').trim(),
    stderr: (r.stderr || '').trim(),
  };
}

/** @typedef {'done'|'partial'|'missing'|'fail'} RoadmapStatus */

/**
 * @param {object} item
 * @returns {object}
 */
function checkItem(item) {
  return { ...item, checkedAt: new Date().toISOString() };
}

function staticChecks() {
  const capBinding = read('ui/src/shared/capabilityBinding.ts');
  const bypass = read('src/router/orchestrate/shouldBypassOrchestration.ts');
  const bridge = read('ui/server/pilotdeck-bridge.js');
  const toolRecovery = read('src/agent/loop/toolFailureRecovery.ts');
  const agentLoop = read('src/agent/loop/AgentLoop.ts');
  const resumeCtx = read('src/session/resume/buildTaskResumeContext.ts');
  const chatFirst = read('src/saas/chatFirstCapabilities.ts');
  const resilience = read('src/pilot/config/resolveResilienceConfig.ts');
  const ctxRuntime = read('src/context/DefaultContextRuntime.ts');
  const chatV2 = read('ui/src/components/chat-v2/ChatInterfaceV2.tsx');
  const incompleteHook = read('ui/src/components/chat-v2/hooks/useIncompleteDeliverableAutoContinue.ts');
  const validateJs = read('ui/server/utils/validateDeliverables.js');
  const validateTs = read('ui/src/shared/validateDeliverables.ts');

  /** @type {Array<{id:string,tier:string,title:string,status:RoadmapStatus,evidence:string[],tests?:string[]}>} */
  const items = [];

  // P0
  items.push(checkItem({
    id: 'P0-1',
    tier: 'P0',
    title: '会话级 capability binding',
    status: has('ui/src/shared/capabilitySessionBinding.ts')
      && grep(read('ui/src/components/chat/hooks/useChatComposerState.ts'), /resolveCapabilityContextForSend/)
        ? 'done'
        : has('ui/src/shared/capabilitySessionBinding.ts') ? 'partial' : 'missing',
    evidence: [
      has('ui/src/shared/capabilitySessionBinding.ts') ? 'capabilitySessionBinding.ts 存在' : '无会话级 binding 模块',
      grep(read('ui/src/components/chat/hooks/useChatComposerState.ts'), /resolveCapabilityContextForSend/)
        ? 'useChatComposerState 已 persist/read'
        : '发送路径未接线',
    ],
  }));

  items.push(checkItem({
    id: 'P0-2',
    tier: 'P0',
    title: 'validate-before-complete（引擎门控）',
    status: (has('ui/src/shared/validateDeliverables.ts') && has('ui/server/utils/validateDeliverables.js'))
      && grep(agentLoop, /validateEngineDeliverables/)
        ? 'done'
        : (has('ui/src/shared/validateDeliverables.ts') ? 'partial' : 'missing'),
    evidence: [
      validateTs ? 'UI validateDeliverables 已有' : '缺 UI validate',
      validateJs ? 'Server validate 已有' : '缺 server validate',
      grep(agentLoop, /validateEngineDeliverables/) ? 'AgentLoop 已门控' : 'AgentLoop 未在 turn 结束前 validate',
      grep(incompleteHook, /useIncompleteDeliverableAutoContinue/) ? 'UI incompleteDeliverable 兜底已有' : '',
    ].filter(Boolean),
  }));

  items.push(checkItem({
    id: 'P0-3',
    tier: 'P0',
    title: 'tool_recovery 按 slug（含 PPT）',
    status: grep(toolRecovery, /TOOL_RECOVERY_RESEARCH|researchReport|contentFlywheel|chatFirst/)
      && grep(toolRecovery, /ppt|anth-pptx|pptxgenjs/i)
        ? 'done'
        : grep(toolRecovery, /researchReport|contentFlywheel/) ? 'partial' : 'missing',
    evidence: [
      grep(toolRecovery, /researchReport/) ? '调研 recovery 分支' : '无调研分支',
      grep(toolRecovery, /contentFlywheel/) ? '内容飞轮 recovery 分支' : '无内容飞轮分支',
      grep(toolRecovery, /ppt|anth-pptx|pptx/i) ? 'PPT slug recovery' : '缺 PPT 专用 recovery（仍默认 HTML 文案）',
    ],
  }));

  items.push(checkItem({
    id: 'P0-4',
    tier: 'P0',
    title: 'turn_progress → resume prompt 全链路',
    status: grep(resumeCtx, /buildTaskResumeContextFromTranscript/)
      && (grep(read('ui/server/routes/messages.js'), /resume-context/)
        || grep(read('ui/src/shared/fetchTaskResumeContext.ts'), /fetchTaskResumeContext/))
        ? 'done'
        : grep(resumeCtx, /buildTaskResumeContextFromTranscript/) ? 'partial' : 'missing',
    evidence: [
      'buildTaskResumeContext.ts 实现存在',
      grep(read('ui/server/routes/messages.js'), /resume-context/)
        ? 'GET resume-context API 已接线'
        : '无 resume-context API',
      grep(read('ui/src/shared/fetchTaskResumeContext.ts'), /fetchTaskResumeContext/)
        ? 'UI fetchTaskResumeContext 已接线'
        : 'UI 仍用简化 buildTaskResumeMessage',
    ],
  }));

  items.push(checkItem({
    id: 'P0-5',
    tier: 'P0',
    title: 'Hub 能力 bypass orchestrate（PPT/GEO）',
    status: grep(bypass, /deliverableCapabilityProfiles|shouldBypassOrchestrationForProfile/)
      ? 'done'
      : grep(bypass, /nova-ppt|anth-pptx|html-ppt|pd-geo/)
        ? 'done'
        : grep(bypass, /DESIGN_CAPABILITY_PREFIXES/) ? 'partial' : 'missing',
    evidence: [
      grep(bypass, /nova-ppt|anth-pptx/) ? 'PPT slug 在 bypass 列表' : 'bypass 仅 od-/open-design/frontend-slides',
      grep(bypass, /pd-geo/) ? 'GEO 在 bypass' : 'pd-geo 仍可能 orchestrate',
    ],
  }));

  items.push(checkItem({
    id: 'P0-6',
    tier: 'P0',
    title: 'Bridge deliverable_repair 发射',
    status: grep(bridge, /scheduleDeliverableRepairCheck|deliverable_repair/)
      ? 'done'
      : grep(read('ui/src/components/chat-v2/hooks/useAutoRecoveryContinue.ts'), /deliverable_repair/)
        ? 'partial'
        : 'missing',
    evidence: [
      grep(bridge, /deliverable_repair/) ? 'Bridge 已发射' : 'Bridge 无 deliverable_repair',
      'UI useAutoRecoveryContinue 已处理 deliverable_repair',
    ],
  }));

  // P1
  items.push(checkItem({
    id: 'P1-1',
    tier: 'P1',
    title: '澄清门控（缺参数 1 条 ask）',
    status: grep(read('src/saas/clarificationGate.ts'), /detectClarificationNeeded/)
      ? 'done'
      : 'missing',
    evidence: ['无 structured clarificationGate 模块', 'core-strategy 仍优先勿停勿问继续'],
  }));

  items.push(checkItem({
    id: 'P1-2',
    tier: 'P1',
    title: 'auto_continue 豁免需用户 Key/附件句式',
    status: grep(read('src/agent/errors/userFacingErrors.ts'), /needsUserCredentialOrAttachment/)
      || grep(read('src/saas/userActionBlocker.ts'), /needsUserCredentialOrAttachment/)
        ? 'done'
        : 'missing',
    evidence: [
      grep(read('src/agent/errors/userFacingErrors.ts'), /拿不到|unable to fetch/) ? '「拿不到信息」仍可能触发 auto_continue' : '',
    ].filter(Boolean),
  }));

  items.push(checkItem({
    id: 'P1-3',
    tier: 'P1',
    title: '跨 turn repeat guard',
    status: has('src/agent/loop/crossTurnToolFailureTracker.ts') ? 'done' : 'partial',
    evidence: [
      has('src/agent/loop/toolFailureRepeatTracker.ts') ? '同 turn repeat guard 已有' : '',
      has('src/agent/loop/crossTurnToolFailureTracker.ts') ? '跨 turn tracker 已有' : '无跨 turn repeat guard',
    ].filter(Boolean),
  }));

  items.push(checkItem({
    id: 'P1-4',
    tier: 'P1',
    title: 'Recovery 子预算按模板阶段',
    status: grep(read('src/saas/resilience/stageRecoveryBudget.ts'), /resolveStageRecoveryBudget/)
      ? 'done'
      : grep(read('src/saas/resilience/recoveryPolicy.ts'), /stageBudget|templateStage|subBudget/)
        ? 'done'
        : 'missing',
    evidence: ['RecoveryBudget 仍为单 turn 双轨，无模板阶段子预算'],
  }));

  items.push(checkItem({
    id: 'P1-5',
    tier: 'P1',
    title: 'prelaunch +3 skill 实跑门禁',
    status: has('ui/e2e/prelaunch/skill-live-conversation.spec.ts')
      && grep(read('scripts/integration-prelaunch-skill-live.mjs'), /skill-live-conversation/)
        ? 'done'
        : has('scripts/integration-prelaunch-skill-live.mjs')
          ? 'partial'
          : 'missing',
    evidence: [
      'prelaunch 18/18 偏链路稳定，缺 open-design/anth-docx/pd-geo 对话实跑',
    ],
  }));

  // P2
  items.push(checkItem({
    id: 'P2-1',
    tier: 'P2',
    title: '续跑弱提示 + 阶段进度条',
    status: grep(chatV2, /ResumeHintToast/) && has('ui/src/components/chat-v2/StageProgressRail.tsx')
      ? 'done'
      : (grep(chatV2, /ResumeHintToast|useIncompleteDeliverableAutoContinue/) ? 'partial' : 'missing'),
    evidence: [
      grep(incompleteHook, /useIncompleteDeliverableAutoContinue/) ? '静默 auto continue hook 已有' : '',
      grep(chatV2, /已从上次步骤继续|resume.*toast/i) ? '续跑 toast 已有' : '无「已从上次继续」用户可见弱提示',
      has('ui/src/components/chat-v2/StageProgressRail.tsx') ? '阶段进度条组件已有' : '无阶段进度条',
    ].filter(Boolean),
  }));

  items.push(checkItem({
    id: 'P2-2',
    tier: 'P2',
    title: 'memory_retrieve 5s 超时',
    status: grep(ctxRuntime, /shouldSkipMemoryRetrievalForTurn/)
      && grep(ctxRuntime, /DEFAULT_MEMORY_RETRIEVAL_TIMEOUT_MS = 5_?000|5000/)
        ? 'done'
        : grep(ctxRuntime, /DEFAULT_MEMORY_RETRIEVAL_TIMEOUT_MS = 5_?000|5000/)
          ? 'partial'
          : 'missing',
    evidence: [
      grep(ctxRuntime, /memoryRetrievalTimeoutMs/) ? 'DefaultContextRuntime 支持 timeoutMs=5000' : '',
      'telemetry p95 仍 ~5015ms，需验证超时生效与首 turn 跳过',
    ].filter(Boolean),
  }));

  items.push(checkItem({
    id: 'P2-3',
    tier: 'P2',
    title: '续跑 turn 续接 stage hint',
    status: grep(read('src/agent/loop/stageHintDedup.ts'), /StageHintDedup/)
      && grep(agentLoop, /stageHintDedup/)
        ? 'done'
        : 'missing',
    evidence: ['新 turn 仍重复 session_prepare/memory_retrieve/router_judge'],
  }));

  // Adjacent fixes (not in roadmap table but related)
  items.push(checkItem({
    id: 'FIX-A',
    tier: 'FIX',
    title: 'incompleteDeliverable 引擎+UI 续跑',
    status: grep(agentLoop, /shouldAutoContinueAfterIncompleteDeliverableStop/)
      && grep(incompleteHook, /shouldAutoContinueAfterIncompleteDeliverableStop/)
        ? 'done'
        : 'partial',
    evidence: [
      'AgentLoop + useIncompleteDeliverableAutoContinue 已接线',
    ],
    tests: ['tests/agent/auto-continue-policy.test.ts'],
  }));

  items.push(checkItem({
    id: 'FIX-B',
    tier: 'FIX',
    title: 'userRequestsBrainstormDeliverable 运行时接线',
    status: grep(chatFirst, /userRequestsBrainstormDeliverable/)
      && (grep(read('src/saas/resolveToolRecoveryProfile.ts'), /userRequestsBrainstormDeliverable/)
        || grep(read('src/saas/taskContinuationPolicy.ts'), /userRequestsBrainstormDeliverable/)
        || grep(agentLoop, /userRequestsBrainstormDeliverable/))
        ? 'done'
        : 'missing',
    evidence: ['函数存在但 AgentLoop/binding 未调用'],
  }));

  return items;
}

function runTestSuite(name, cmd, args) {
  const r = run(cmd, args);
  return { name, ok: r.ok, status: r.status, tail: (r.stdout || r.stderr).split('\n').slice(-8).join('\n') };
}

function main() {
  const jsonOut = process.argv.includes('--json');
  const items = staticChecks();

  const suites = [
    runTestSuite('auto-continue-policy', 'node', ['--import', 'tsx', 'tests/agent/auto-continue-policy.test.ts']),
    runTestSuite('buildTaskResumeContext', 'npx', ['vitest', 'run', 'src/session/resume/buildTaskResumeContext.test.ts']),
    runTestSuite('shouldBypassOrchestration', 'npx', ['vitest', 'run', 'tests/router/should-bypass-orchestration.test.ts']),
    runTestSuite('task-resilience-unit', 'npm', ['run', 'test:task-resilience:unit']),
    runTestSuite('capabilityBindingPrompt', 'node', ['--import', 'tsx', 'src/saas/capabilityBindingPrompt.test.ts']),
    runTestSuite('analyze-task-completion', 'node', ['scripts/analyze-task-completion.mjs']),
  ];

  const byTier = { P0: [], P1: [], P2: [], FIX: [] };
  for (const item of items) {
    byTier[item.tier]?.push(item);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    items,
    tests: suites,
    counts: {
      done: items.filter((i) => i.status === 'done').length,
      partial: items.filter((i) => i.status === 'partial').length,
      missing: items.filter((i) => i.status === 'missing').length,
      total: items.length,
    },
    testsPassed: suites.filter((s) => s.ok).length,
    testsTotal: suites.length,
  };

  if (jsonOut) {
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.testsPassed === summary.testsTotal ? 0 : 1);
  }

  console.log('# P0–P2 路线图自检报告\n');
  console.log(`生成时间：${summary.generatedAt}\n`);

  for (const tier of ['P0', 'P1', 'P2', 'FIX']) {
    console.log(`## ${tier}\n`);
    console.log('| ID | 项 | 状态 | 证据 |');
    console.log('|----|-----|------|------|');
    for (const item of byTier[tier] || []) {
      const icon = item.status === 'done' ? '✅' : item.status === 'partial' ? '🟡' : '❌';
      console.log(`| ${item.id} | ${item.title} | ${icon} ${item.status} | ${item.evidence.join('；')} |`);
    }
    console.log('');
  }

  console.log('## 关联单测\n');
  console.log('| 套件 | 结果 |');
  console.log('|------|------|');
  for (const s of suites) {
    console.log(`| ${s.name} | ${s.ok ? 'PASS' : 'FAIL'} |`);
  }
  console.log('');

  console.log('## 汇总\n');
  console.log(`- 路线图项：done ${summary.counts.done} / partial ${summary.counts.partial} / missing ${summary.counts.missing}（共 ${summary.counts.total}）`);
  console.log(`- 单测：${summary.testsPassed}/${summary.testsTotal} 通过`);
  console.log('\n完整 JSON：`node scripts/selfcheck-p0-p2-roadmap.mjs --json > artifacts/p0-p2-selfcheck.json`');

  const exitOk = summary.testsPassed === summary.testsTotal;
  process.exit(exitOk ? 0 : 1);
}

main();
