#!/usr/bin/env node
// PD-SAAS-FORK: catch dialogue-stability import/runtime wiring errors before user turns.

const MODULES = [
  {
    label: 'AgentLoop',
    path: '../src/agent/loop/AgentLoop.ts',
    requiredExports: ['AgentLoop', 'extractLatestNonSyntheticUserText'],
  },
  {
    label: 'userActionBlocker',
    path: '../src/saas/userActionBlocker.ts',
    requiredExports: ['classifyUserActionBlocker'],
  },
  {
    label: 'taskContinuationPolicy',
    path: '../src/saas/taskContinuationPolicy.ts',
    requiredExports: ['resolveContinuationAction', 'buildUserActionRequiredNotice'],
  },
  {
    label: 'deliverableSessionGoal',
    path: '../src/saas/deliverableSessionGoal.ts',
    requiredExports: ['extractDeliverableSessionUserGoal', 'isAmbiguousFollowUpText'],
  },
];

const failures = [];

for (const moduleSpec of MODULES) {
  try {
    const loaded = await import(moduleSpec.path);
    for (const exportName of moduleSpec.requiredExports) {
      if (typeof loaded[exportName] !== 'function') {
        failures.push(`${moduleSpec.label}: missing function export ${exportName}`);
      }
    }
  } catch (error) {
    failures.push(`${moduleSpec.label}: ${error?.stack || error?.message || String(error)}`);
  }
}

if (failures.length > 0) {
  console.error('[dialogue-stability-module-load] failed');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[dialogue-stability-module-load] ok');
