/**
 * PD-SAAS-FORK: Preflight Studio Gateway live case definitions (L-OD / L-PPT).
 */
import { compileLaunchResult } from './launchProfileProviders.mjs';

/** @typedef {'L-OD-GW' | 'L-PPT-GW'} PreflightGatewayCaseId */

/** @type {Record<PreflightGatewayCaseId, { label: string; capabilitySlug: string; buildMessage: () => string; gate: Record<string, unknown> }>} */
export const PREFLIGHT_GATEWAY_CASES = {
  'L-OD-GW': {
    label: 'open-design + launch-context → STDA HTML',
    capabilitySlug: 'open-design',
    buildMessage() {
      const compiled = compileLaunchResult('open-design', {
        selections: [
          { stepId: 'surface', optionId: 'linear-app', id: 'linear-app', label: 'Linear App' },
        ],
        brief: '验收专用：B2B AI SaaS 产品一页 Hero 落地页',
      });
      return [
        compiled.launchContext,
        '',
        compiled.compiledPrompt,
        '',
        '直接开始做，写入系统分配任务目录，禁止 ask_user 问卷，禁止换目录。',
      ].join('\n');
    },
    gate: {
      requireLaunchContext: true,
      requireTaskArtifactWrite: true,
      maxAskUserBeforeWrite: 0,
      maxFlaskSpawn: 0,
      minVerifiedPaths: 1,
    },
  },
  'L-PPT-GW': {
    label: 'ppt-master + launch-context → STDA deck',
    capabilitySlug: 'ppt-master',
    buildMessage() {
      const compiled = compileLaunchResult('ppt-master', {
        selections: [
          { stepId: 'canvas', optionId: 'ppt169', id: 'ppt169', label: '16:9' },
          { stepId: 'mode', optionId: 'pyramid', id: 'pyramid', label: '金字塔' },
          { stepId: 'style', optionId: 'swiss-minimal', id: 'swiss-minimal', label: '瑞士极简' },
        ],
        brief: '验收专用：3页技术分享',
        page_count: 3,
      });
      return [
        compiled.launchContext,
        '',
        compiled.compiledPrompt,
        '',
        '直接开始做，写入系统分配任务目录，禁止 Flask :5050 确认页，禁止 ask_user 模板问卷。',
      ].join('\n');
    },
    gate: {
      requireLaunchContext: true,
      requireTaskArtifactWrite: true,
      maxAskUserBeforeWrite: 0,
      maxFlaskSpawn: 0,
      minVerifiedPaths: 1,
    },
  },
};

export const PREFLIGHT_GATEWAY_CASE_IDS = Object.keys(PREFLIGHT_GATEWAY_CASES);
