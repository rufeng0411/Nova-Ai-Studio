/**
 * PD-SAAS-FORK: ES9 five-case (+ case3 four-format) Gateway live definitions.
 */
import { resolveLiveTimeout } from './resolveLiveTimeout.mjs';

const ES9_GEO_FAST_CHECK_GOAL = [
  '帮蔚来 ES9 做 GEO 快检，须交付：audit-checklist.md、keywords.md、optimized.md、report.html',
  '写入系统分配任务目录',
].join('');

const ES9_PRODUCT_RESEARCH_HTML_GOAL = [
  '须交付：product-user-research.md、带图表和风格的 HTML 报告',
  '写入系统分配任务目录',
].join('');

const ES9_FOUR_FORMAT_VAP_GOAL = [
  '为【蔚来 ES9】撰写万里越雄关复盘报告，须使用官方或权威配图。',
  '根据上述主题做四格式交付包，两步一次做完，存系统分配的任务目录。',
  '1. 写中文调研报告 → report.md。',
  '2. 用 export_document 依次导出 PDF、Word、可编辑 PPT 到同目录。',
  '禁止 read_file skills/；每步 write_file 落盘后再进下一步。',
  '直接开始做，做完告诉我各文件路径。',
  '',
  '标准成果清单：',
  '1. report.md',
  '2. report.pdf',
  '3. report.docx',
  '4. report.pptx',
].join('\n');

const ES9_PRODUCT_LAUNCH_GOAL = [
  '帮我为【蔚来ES9】做一套上市全案，按以下阶段一次性规划并执行，每阶段产出存系统分配的任务目录。',
  '',
  '标准成果清单：',
  '1. 调研 .md',
  '2. GTM 策略 .md',
  '3. 新闻稿 .docx',
  '4. landing.html',
  '5. 社媒包',
  '6. 上线清单 .md',
  '7. 草稿编号 .md',
].join('\n');

const ES9_CONTENT_IP_LAUNCH_GOAL = [
  '帮我为【蔚来ES9长途试驾】做一套内容 IP 启动全案，按阶段一次执行，存系统分配的任务目录。',
  '',
  '标准成果清单：',
  '1. 策略 .md',
  '2. 长文×2',
  '3. 社媒包',
  '4. newsletter .md',
  '5. 复盘 .md',
].join('\n');

const SAAS_GROWTH_FULL_SDM_GOAL = [
  '帮我做 SaaS 增长全案，标准成果清单：',
  '1. 调研 .md',
  '2. 策略 .md',
  '3. 竞品 .md',
  '4. 内容 .md',
  '5. 社媒包',
  '6. landing.html',
  '7. 监测 .md',
  '8. 复盘 .md',
  '写入系统分配任务目录',
].join('\n');

function withTimeout(caseId, profileId, spec) {
  const resolved = resolveLiveTimeout({ caseId, profileId });
  return {
    ...spec,
    profileId,
    timeoutMs: resolved.timeoutMs,
    maxTurns: resolved.maxTurns,
    waitAcceptanceMs: resolved.waitAcceptanceMs,
  };
}

/** @type {Record<string, object>} */
export const ES9_FIVE_CASE_LIVE_CASES = {
  'case1-saas-growth-full': withTimeout('case1-saas-growth-full', 'saas-growth-full', {
    label: 'SaaS 增长全案 8 槽',
    message: SAAS_GROWTH_FULL_SDM_GOAL,
    requiredSlots: 8,
    forbidKpis: ['slot_collision', 'hash_mismatch', 'literal_placeholder_path'],
  }),
  'case2-product-research-html': withTimeout('case2-product-research-html', 'research-report', {
    label: 'Nova 用研 MD+HTML',
    message: ES9_PRODUCT_RESEARCH_HTML_GOAL,
    requiredSlots: 2,
    expectHtmlBasename: 'product-user-research.html',
    forbidKpis: ['hash_mismatch', 'literal_placeholder_path'],
  }),
  'case3-four-format-vap': withTimeout('case3-four-format-vap', 'md-html-office-pack', {
    label: 'ES9 四格式包（report.md→pdf/docx/pptx）',
    message: ES9_FOUR_FORMAT_VAP_GOAL,
    requiredSlots: 4,
    requiredBasenames: ['report.md', 'report.pdf', 'report.docx', 'report.pptx'],
    forbidKpis: ['hash_mismatch', 'literal_placeholder_path', 'nonterminal_export_as_final'],
  }),
  'case4-geo-fast-check': withTimeout('case4-geo-fast-check', 'geo-fast-check-hub', {
    label: 'GEO 快检 4 槽',
    message: ES9_GEO_FAST_CHECK_GOAL,
    requiredSlots: 4,
    forbidKpis: ['slot_collision', 'hash_mismatch'],
  }),
  'case5-product-launch': withTimeout('case5-product-launch', 'product-launch-full', {
    label: '上市全案 7 步',
    message: ES9_PRODUCT_LAUNCH_GOAL,
    requiredSlots: 7,
    forbidKpis: ['slot_collision', 'nonterminal_export_as_final'],
  }),
  'case6-content-ip': withTimeout('case6-content-ip', 'content-ip-launch', {
    label: '内容 IP 启动全案',
    message: ES9_CONTENT_IP_LAUNCH_GOAL,
    requiredSlots: 5,
    forbidKpis: ['slot_collision', 'hash_mismatch'],
  }),
};

export const ES9_CASE_IDS = Object.keys(ES9_FIVE_CASE_LIVE_CASES);
