/**
 * PD-SAAS-FORK: Live case definitions for 0717 four-line acceptance replay.
 */
import { resolveLiveTimeout } from './resolveLiveTimeout.mjs';

function caseSpec(caseId, profileId, spec) {
  const resolved = resolveLiveTimeout({ caseId, profileId });
  return { ...spec, profileId, ...resolved };
}

export const FOUR_LINE_0717_LIVE_CASES = {
  'video-3-step': caseSpec('video-3-step', 'video-mp4', {
    label: '三步演示视频（脚本+分镜+成片）',
    message:
      '用 Seedance 做 10 秒产品演示视频，须交付：1. 视频脚本 .md 2. 分镜说明 .md 3. 成片 .mp4，写入系统分配任务目录',
    requiredSlots: 3,
    forbidKpis: ['literal_placeholder_path', 'nonterminal_export_as_final', 'hash_mismatch'],
  }),
  '10-page-slides': caseSpec('10-page-slides', 'nova-slide-deck', {
    label: 'Nova 美学幻灯 10 页',
    message:
      '用「Nova-美学幻灯」把【Cursor 产品科学图解】做成【10】页【16:9】，slide-NN 逐页 PNG + slide-manifest.json，写入系统分配任务目录',
    requiredSlots: 10,
    expectSnapshotInconclusive: true,
    forbidKpis: ['literal_placeholder_path'],
  }),
  'campaign-6-slot': caseSpec('campaign-6-slot', 'brand-campaign-full', {
    label: 'Campaign 显式 6 项（世界杯主题）',
    message: [
      '帮我做【雷蛇】世界杯主题品牌传播 campaign 全案。',
      '标准成果清单：',
      '1. 调研 .md',
      '2. brief .docx',
      '3. 海报',
      '4. 社媒包',
      '5. 草稿编号',
      '6. 监测模板',
      '写入系统分配任务目录',
    ].join('\n'),
    requiredSlots: 6,
    forbidKpis: ['slot_collision', 'nonterminal_export_as_final'],
  }),
  'market-add-html': caseSpec('market-add-html', undefined, {
    label: 'Nova 市场报告 ADD HTML',
    message:
      'Nova-行业市场研究报告，先写 industry-market-report.md，再给我 HTML 版本，写入系统分配任务目录',
    requiredSlots: 2,
    forbidKpis: ['hash_mismatch', 'literal_placeholder_path'],
  }),
  'geo-competitor-4-slot': caseSpec('geo-competitor-4-slot', undefined, {
    label: 'GEO 竞品分析 4 槽',
    message:
      '用「GEO竞品分析」对比【Nova Ai-Studio】与【2-3 家竞品】，须交付 geo-competitor-report.md/html、competitor-visibility.md/html，写入系统分配任务目录',
    requiredSlots: 4,
    forbidKpis: ['slot_collision', 'hash_mismatch'],
  }),
};
