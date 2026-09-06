/**
 * PD-SAAS-FORK: 能力中心「试一下」与流程模板提示词统一策略（v2）
 * Hub 预填须通过 assertTryPromptQuality（禁 read_skill / 直接开始做 / artifacts/语义目录）
 * 流程模板可含 read_skill、标准成果清单、降级说明
 */

import {
  appendHtmlPairsToDeliverables,
} from './geoDualReport.mjs';
import {
  appendCanonicalDerivedInstruction,
} from './deliverableDerivation.mjs';
import { CN_COMPLIANCE_DELIVERABLES } from './cnComplianceTryPrompts.mjs';

/** @typedef {{ slug: string; name: string; majorCategory?: string }} SkillMeta */

/** Hub 单能力：须交付清单（不含禁止词） */
/** @type {Record<string, string[]>} */
export const HUB_DELIVERABLE_BY_SLUG = {
  'pd-geo': appendHtmlPairsToDeliverables([
    'geo-aeo-audit-checklist.md',
    'keywords-research.md',
    'zhihu-article.md',
    'xiaohongshu-article.md',
    'wechat-article.md',
    'optimized.md',
    'schema.jsonld',
    'citability-report.md',
    'score-report.md',
    'visibility-report.html',
  ], 'pd-geo'),
  'geo-aeo-audit': appendHtmlPairsToDeliverables(['geo-aeo-audit-checklist.md'], 'geo-aeo-audit'),
  'geo-content-optimizer': appendHtmlPairsToDeliverables([
    'optimization-report.md',
    'optimized.md',
  ], 'geo-content-optimizer'),
  'geo-citability': appendHtmlPairsToDeliverables(['citability-report.md'], 'geo-citability'),
  'geo-keyword-research': appendHtmlPairsToDeliverables(['keywords.md'], 'geo-keyword-research'),
  'geo-competitor-analysis': appendHtmlPairsToDeliverables([
    'geo-competitor-report.md',
    'competitor-visibility.md',
  ], 'geo-competitor-analysis'),
  'geo-rank-track': appendHtmlPairsToDeliverables(['rank-track.md'], 'geo-rank-track'),
  'geo-monitor-hub': ['monitor-data.json'],
  'geo-monitor-report': ['monitor-report.md', 'geo-monitor-report.html', 'monitor-data.json'],
  'geo-visibility-probe': ['monitor-data.json', 'probe-results.json'],
  'geo-cn-crawlers': appendHtmlPairsToDeliverables(['aeo-audit.md', 'llms.txt'], 'geo-cn-crawlers'),
  'geo-content-gap-analysis': appendHtmlPairsToDeliverables(['content-gap.md'], 'geo-content-gap-analysis'),
  'geo-serp-analysis': appendHtmlPairsToDeliverables(['serp-analysis.md'], 'geo-serp-analysis'),
  'geo-backlink-analyzer': appendHtmlPairsToDeliverables(['backlink-report.md'], 'geo-backlink-analyzer'),
  'geo-performance-reporter': appendHtmlPairsToDeliverables(['performance-report.md'], 'geo-performance-reporter'),
  'geo-seo-content-writer': appendHtmlPairsToDeliverables(['content-strategy-report.md'], 'geo-seo-content-writer'),
  'geo-on-page-audit': appendHtmlPairsToDeliverables(['on-page-audit.md'], 'geo-on-page-audit'),
  'geo-dual-report': ['（内部）将分析 MD 同步为同名 HTML'],
  'mcp-agent-aeo': ['monitor-data.json'],
  'mcp-geo-optimizer': appendHtmlPairsToDeliverables(['aeo-audit.md', 'llms.txt'], 'mcp-geo-optimizer'),
  'mcp-ai-seo': appendHtmlPairsToDeliverables(['aeo-page-audit.md'], 'mcp-ai-seo'),
  'mkt-ai-seo': appendHtmlPairsToDeliverables(['audit-checklist.md', 'competitor-visibility.md'], 'mkt-ai-seo'),
  // PD-SAAS-FORK: P0-1 exact slug overrides broad mkt-* one-file fallback.
  'mkt-last30days': ['marketing-deliverable.md'],
  'mkt-schema': ['schema.jsonld'],
  'mkt-programmatic-seo': ['programmatic-template.html'],
  'mkt-brand-mention': appendHtmlPairsToDeliverables(['mention-report.md'], 'mkt-brand-mention'),
  'mkt-review-mining': appendHtmlPairsToDeliverables(['sentiment-report.md'], 'mkt-review-mining'),
  'mkt-performance-report': appendHtmlPairsToDeliverables(['performance-summary.md'], 'mkt-performance-report'),
  'geo-technical-seo': appendHtmlPairsToDeliverables(['technical-seo-audit.md'], 'geo-technical-seo'),
  'nova-research-industry-market': ['industry-market-report.md'],
  'nova-research-competitor': ['competitor-benchmark-report.md'],
  'nova-research-general': ['research-report.md'],
  'nova-research-user-general': ['user-research-report.md'],
  'nova-research-product-user': ['product-user-research.md'],
  'nova-research-academic-professional': ['academic-report.md'],
  'nova-customer-acquisition-leads': ['leads-report.md'],
  'nova-ppt-aesthetic-slides': ['slide-NN.png', 'slide-manifest.json'],
  'nova-bento-slides': ['deck.bento.html'],
  'social-creative-matrix': ['brief.md', 'creative-anchors.md', 'copywriting.md', 'manifest.json'],
  'anth-docx': ['*.docx'],
  'anth-pptx': ['presentation.pptx'],
  'ppt-master': ['presentation.pptx'],
  'html-ppt': ['index.html'],
  'cyber-ppt': ['presentation.pptx', 'slide_manifest.json', 'visual_qa_gate.json'],
  'create-taste-brutalist': ['index.html'],
  'ppt-gorden-super': ['presentation.pptx', 'slide-NN.png', 'slide-manifest.json'],
  'ppt-gorden-image-gen': ['slide-NN.png', 'presentation.pptx'],
  'ppt-gorden-image2pptx': ['presentation.pptx'],
  'frontend-slides': ['index.html'],
  'open-design': ['index.html'],
  'od-saas-landing': ['index.html'],
  'od-dashboard': ['index.html'],
  'od-data-report': ['report.html'],
  'od-mobile-app': ['screen-*.html'],
  'hf-website-to-video': ['promo.mp4'],
  'hf-hyperframes': ['promo.mp4'],
  'hf-product-launch-video': ['promo.mp4'],
  'hf-motion-graphics': ['promo.mp4'],
  'hf-general-video': ['promo.mp4'],
  'hf-faceless-explainer': ['promo.mp4'],
  'hf-slideshow': ['hf-project/index.html'],
  'remotion-video': ['03/out.mp4', 'Remotion 工程目录'],
  'create-vid-seedance-prompt': ['03-seedance-prompts.md'],
  'create-vid-storyboard-pack': ['continuity_bible.md', 'shot_cards.md', 'handoff_design_matrix.md'],
  'create-vid-visual-prompt': ['01-shot-cards.md'],
  'create-vid-director': ['02-director-board.md'],
  'create-vid-viral-copy': ['01-hooks.md'],
  'mkt-dmp-video-script': ['02-script-timed.md'],
  'mkt-brand-video': ['storyboard.md'],
  'df-deep-research': ['research-report.md'],
  'tool-generate-image': ['*.png', '*.jpg'],
  'tool-generate-video': ['*.mp4'],
  'tool-render-html-video': ['*.mp4'],
  'tool-web-search': ['search-summary.md'],
  'yixiaoer': ['draft-task-id.txt'],
  'legal-risk-assessment': ['risk-assessment.md'],
  'legal-response': ['response-draft.md'],
  'mkt-ads': ['ads-plan.md', 'channel-matrix.md'],
  'pms-competitive-battlecard': ['battlecard.md'],
  'mkt-competitive-intel': ['intel.md'],
  'mkt-sales-enablement': ['talk-track.md'],
  'hub-pack-brand-website': ['按子任务交付 md/html/docx'],
  'hub-pack-ad-funnel': ['按子任务交付创意/落地页/投放 md'],
  'hub-pack-aso': ['关键词与元数据优化 md'],
  'hub-pack-fal-video': ['*.mp4', 'storyboard.md'],
  'hub-pack-pm-toolkit': ['PRD/路线图/竞品 md 或 docx'],
  'edu-sci-timesfm-forecasting': ['forecast.json 或 forecast.csv', 'forecast.png'],
  // PD-SAAS-FORK: 企业合规 Hub 卡须交付 basename（与 SDM profile / try-prompt 同源）
  ...CN_COMPLIANCE_DELIVERABLES,
};

/** @type {Array<{ test: (slug: string, name: string) => boolean; deliverables: string[] }>} */
export const HUB_DELIVERABLE_RULES = [
  {
    test: (slug) => slug.startsWith('nova-research-') && !HUB_DELIVERABLE_BY_SLUG[slug],
    deliverables: ['research-report.md'],
  },
  {
    test: (slug) => slug.startsWith('geo-') && !HUB_DELIVERABLE_BY_SLUG[slug],
    deliverables: appendHtmlPairsToDeliverables(['geo-deliverable.md'], 'geo-generic-fallback'),
  },
  {
    test: (slug) => slug.startsWith('create-vid-'),
    deliverables: ['分镜.md', 'script.md'],
  },
  {
    test: (slug) => slug.startsWith('od-') && !slug.includes('video'),
    deliverables: ['index.html 或指定页面文件'],
  },
  {
    test: (slug) => slug.startsWith('teacher-') && slug.includes('lesson'),
    deliverables: ['lesson-plan.md'],
  },
  {
    test: (slug) => slug.includes('homework-generation'),
    deliverables: ['homework.md'],
  },
  {
    test: (slug) => slug.includes('unit-review'),
    deliverables: ['unit-review.md'],
  },
  {
    test: (slug) => slug.startsWith('mkt-') && !slug.startsWith('mkt-brand-skills'),
    deliverables: ['marketing-deliverable.md'],
  },
  {
    test: (slug) => slug.startsWith('ala-') && !slug.includes('advisor'),
    deliverables: ['output.md 或修订稿（按任务）'],
  },
  {
    test: (slug) => slug.startsWith('tool-'),
    deliverables: ['按工具产出对应格式文件'],
  },
  {
    test: (slug) => slug.startsWith('anth-'),
    deliverables: ['办公格式文件（docx/pptx/xlsx/pdf）'],
  },
  {
    test: (slug) => slug.startsWith('hf-'),
    deliverables: ['视频或分镜 md/mp4'],
  },
  {
    test: (slug) => slug.startsWith('ora-'),
    deliverables: ['academic-output.md 或论文级图表 PDF/SVG'],
  },
];

/** 脑爆/纯对话类：不追加文件交付句 */
const CHAT_FIRST_PREFIXES = ['persona-', 'brainstorm-'];
const CHAT_FIRST_EXACT = new Set(['edu-fun-caveman', 'df-surprise-me', 'df-bootstrap']);
const FILELESS_DEFAULT_EXACT = new Set(['ala-strategy-advisor']);

/**
 * @param {string} slug
 * @param {string} [majorCategory]
 */
export function isChatFirstSlug(slug, majorCategory) {
  const mc = String(majorCategory ?? '').trim().toLowerCase();
  if (mc === 'brainstorming') return true;
  if (CHAT_FIRST_EXACT.has(slug)) return true;
  return CHAT_FIRST_PREFIXES.some((p) => slug.startsWith(p));
}

/**
 * @param {string} slug
 * @returns {string[]|null}
 */
export function resolveHubDeliverables(slug) {
  if (HUB_DELIVERABLE_BY_SLUG[slug]) return HUB_DELIVERABLE_BY_SLUG[slug];
  for (const rule of HUB_DELIVERABLE_RULES) {
    if (rule.test(slug, slug)) return rule.deliverables;
  }
  return null;
}

/**
 * PD-SAAS-FORK workbench yield P0-C: showcase-overlap whitelist for denser try-prompt structure.
 * Keep small (R6); toggle via PILOTDECK_TRY_PROMPT_CONTRACT_V2=0.
 */
export const TRY_PROMPT_CONTRACT_V2_SLUGS = new Set([
  'od-saas-landing',
  'od-mobile-app',
  'od-data-report',
  'od-image-gen',
  'od-social-carousel',
  'open-design',
  'nova-ppt-aesthetic-slides',
  'nova-bento-slides',
  'anth-pptx',
  'social-creative-matrix',
  'geo-keyword-research',
  'geo-competitor-analysis',
  'hf-website-to-video',
  'hf-product-launch-video',
  'hf-hyperframes',
]);

/** @type {Record<string, string[]>} */
const TRY_PROMPT_CONTRACT_BANS = {
  'od-saas-landing': ['禁模板彩虹渐变', '禁占位灰块/假按钮', '禁 generate_image 冒充官图'],
  'od-mobile-app': ['禁桌面网页硬塞手机框', '禁线框草稿充数'],
  'nova-ppt-aesthetic-slides': ['禁 HTML 幻灯替代 PNG 包', '禁 generate_image 冒充官图'],
  'nova-bento-slides': ['禁静态 HTML 冒充 bento.html', '禁 pptx/PNG 包替代终态'],
  'anth-pptx': ['禁空壳 presentation.pptx', '禁白板无风格页'],
  'hf-website-to-video': ['禁 generate_video 冒充 HyperFrames', '禁 HTML 录屏假视频'],
  'hf-product-launch-video': ['禁 generate_video 冒充 HyperFrames'],
  'hf-hyperframes': ['禁 generate_video 冒充 render_hyperframes'],
  'social-creative-matrix': ['禁飞轮幻影三槽扩写'],
};

const TRY_PROMPT_CONTRACT_MAX_CHARS = 420;

function isTryPromptContractV2Enabled() {
  const raw = String(process.env.PILOTDECK_TRY_PROMPT_CONTRACT_V2 ?? '1').trim().toLowerCase();
  return !(raw === '0' || raw === 'false' || raw === 'off');
}

/**
 * @param {string} out
 * @param {SkillMeta} meta
 * @param {string[]} deliverables
 */
function appendTryPromptContractBlock(out, meta, deliverables) {
  if (!isTryPromptContractV2Enabled()) return out;
  if (!TRY_PROMPT_CONTRACT_V2_SLUGS.has(meta.slug)) return out;
  if (/【能力】/.test(out)) return out;

  const name = String(meta.name ?? meta.slug).trim() || meta.slug;
  const must = deliverables.slice(0, 8).join('、');
  const bans = (TRY_PROMPT_CONTRACT_BANS[meta.slug] ?? ['禁非 STDA 目录落盘']).slice(0, 3);
  const block = [
    `【能力】${name}（${meta.slug}）`,
    // Keep colon form for SDM parseMustDeliverClause (【须交付】alone is not parsed).
    `须交付：${must}。`,
    `【须交付】${must}`,
    '【目录】写入系统分配任务目录',
    `【禁】${bans.join('；')}`,
  ].join('\n');

  const next = `${out.trim()}\n${block}`;
  if (next.length > out.length + TRY_PROMPT_CONTRACT_MAX_CHARS) {
    return `${out.trim()}\n【能力】${name}（${meta.slug}）\n须交付：${must}。\n【目录】写入系统分配任务目录`;
  }
  return next;
}

/**
 * @param {string} basePrompt
 * @param {SkillMeta} meta
 */
export function finalizeHubTryPrompt(basePrompt, meta) {
  let out = String(basePrompt ?? '').trim();
  if (!out) return out;

  if (isChatFirstSlug(meta.slug, meta.majorCategory)) {
    return out;
  }
  // PD-SAAS-FORK: P0-1 strategy advisor stays consultation-first in Hub;
  // runtime completion mode may add a report contract only after explicit user intent.
  if (FILELESS_DEFAULT_EXACT.has(meta.slug)) {
    return appendCanonicalDerivedInstruction(out, meta.slug, meta.majorCategory, { hub: true });
  }

  const deliverables = resolveHubDeliverables(meta.slug);
  if (deliverables?.length && !/须交付[:：]/.test(out) && !/标准成果清单/.test(out)) {
    out += `须交付：${deliverables.join('、')}。`;
  }

  if (deliverables?.length >= 2 && !/标准成果清单/.test(out) && !isChatFirstSlug(meta.slug, meta.majorCategory)) {
    const lines = deliverables.map((item, idx) => `${idx + 1}. ${item}`);
    out += `\n\n标准成果清单：\n${lines.join('\n')}`;
  }

  if (!/系统分配/.test(out) && deliverables?.length) {
    // PD-SAAS-FORK: newline before task-dir suffix — prevents "keywords.html写入…" glue (案2 RCA)
    out += '\n写入系统分配任务目录。';
  }

  if (
    deliverables?.length
    && !/缺\s*Key|降级|不可用/.test(out)
    && (meta.slug.startsWith('tool-') || meta.slug.startsWith('hub-pack-') || meta.slug.includes('mcp-'))
  ) {
    out += '缺 Key 或外部服务不可用时仍交付 md 说明，勿中断。';
  }

  // PD-SAAS-FORK workbench yield P0-C + P1: video/HF missing-key degrade (no false green)
  if (
    deliverables?.length
    && !/缺\s*Key|降级|不可用/.test(out)
    && (meta.slug.startsWith('hf-') || meta.slug === 'tool-generate-video' || meta.slug.includes('seedance'))
  ) {
    out += '缺视频/HyperFrames Key 时须温和说明缺依赖并停止无限补齐，勿用 HTML 录屏假绿充数。';
  }

  if (deliverables?.length) {
    out = appendTryPromptContractBlock(out, meta, deliverables);
  }

  out = appendCanonicalDerivedInstruction(out, meta.slug, meta.majorCategory, { hub: true });

  return out;
}

const PROCESS_DEGRADE_ZH =
  '若评分、联网、生图/生视频或外部 Key 不可用，按对应技能 resilience 降级仍交付清单文件，不要中断。';
const PROCESS_DEGRADE_EN =
  'If scoring, web, image/video, or external keys are unavailable, degrade per skill resilience and still deliver the checklist files; do not stop.';

const PROCESS_FOOTER_ZH = '直接开始做，做完告诉我各文件路径。';
const PROCESS_FOOTER_EN = 'Start working directly and report all file paths when done.';

const PROCESS_NO_SKILLS_ZH = '禁止 read_file skills/；每步 write_file 落盘后再进下一步。';
const PROCESS_CANONICAL_DERIVED_ZH =
  '含 .md 与 .html/.pdf/.docx 的同一报告：须先 write_file 完成 .md 并 read_file 确认，再 read_skill geo-dual-report 或对应技能生成派生格式；禁止未写 MD 先写 HTML。';

/**
 * @param {string} outputsZh
 * @returns {string[]}
 */
export function parseOutputsToDeliverableLines(outputsZh) {
  const raw = String(outputsZh ?? '').trim();
  if (!raw) return [];
  return raw
    .split(/[+＋、,，;；]/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((item, idx) => `${idx + 1}. ${item}`);
}

/**
 * @param {import('../../config/process-templates.json').templates[0]} template
 * @param {'zh-CN'|'en'} locale
 */
export function buildProcessDeliverableBlock(template, locale = 'zh-CN') {
  const lines = parseOutputsToDeliverableLines(template.outputs?.[locale] ?? template.outputs?.['zh-CN']);
  if (lines.length === 0) return '';
  const header = locale === 'zh-CN' ? '标准成果清单：' : 'Standard deliverables:';
  return `\n\n${header}\n${lines.join('\n')}`;
}

/**
 * @param {string} prompt
 */
export function normalizeProcessStoragePaths(prompt) {
  return String(prompt ?? '')
    .replace(/存\s*artifacts\/[^\n]+/gi, '存系统分配的任务目录')
    .replace(/写入\s*artifacts\/[^\n]+/gi, '写入系统分配的任务目录')
    .replace(/save under artifacts\/[^\n]+/gi, 'save under the assigned task directory')
    .replace(/存\s*artifacts\//gi, '存系统分配的任务目录 ')
    .replace(/把文件存到 artifacts\//gi, '写入系统分配的任务目录')
    .replace(/产出存\s*artifacts\//gi, '产出存系统分配的任务目录 ')
    .replace(/artifacts\/task-\{[^}]+\}/gi, '系统分配的任务目录')
    .replace(/系统分配的任务目录-\{时间\}/gi, '系统分配的任务目录')
    .replace(/系统分配的任务目录-\{timestamp\}/gi, '系统分配的任务目录');
}

/**
 * @param {import('../../config/process-templates.json').templates[0]} template
 * @param {'zh-CN'|'en'} locale
 */
export function upgradeProcessTemplatePrompt(template, locale = 'zh-CN') {
  const isZh = locale === 'zh-CN';
  let prompt = normalizeProcessStoragePaths(template.prompt?.[locale] ?? '');

  if (isZh && template.flow?.length >= 2 && !prompt.includes('禁止 read_file skills')) {
    if (prompt.includes('直接开始做')) {
      prompt = prompt.replace(
        /(\n)?直接开始做/,
        `\n${PROCESS_NO_SKILLS_ZH}\n${PROCESS_DEGRADE_ZH}\n直接开始做`,
      );
    } else {
      prompt += `\n${PROCESS_NO_SKILLS_ZH}\n${PROCESS_DEGRADE_ZH}`;
    }
  } else if (!isZh && template.flow?.length >= 2 && !/read_file skills/i.test(prompt)) {
    prompt += `\nDo not read_file skills/; write_file after each step.\n${PROCESS_DEGRADE_EN}`;
  }

  if (!prompt.includes('标准成果清单') && !prompt.includes('Standard deliverables')) {
    prompt += buildProcessDeliverableBlock(template, locale);
  }

  if (isZh && template.geoFlywheel && !prompt.includes('未写 MD')) {
    prompt += `\n${PROCESS_CANONICAL_DERIVED_ZH}`;
  } else if (
    isZh
    && /\.md.*\.html|\.html.*\.md/i.test(template.outputs?.['zh-CN'] ?? '')
    && !prompt.includes('未写 MD')
  ) {
    prompt += `\n${PROCESS_CANONICAL_DERIVED_ZH}`;
  }

  if (isZh && !prompt.includes('直接开始做') && !prompt.includes('做完告诉我')) {
    prompt += `\n${PROCESS_FOOTER_ZH}`;
  } else if (!isZh && !/Start working directly/i.test(prompt) && !/report.*path/i.test(prompt)) {
    prompt += `\n${PROCESS_FOOTER_EN}`;
  }

  return prompt.trim();
}

/** assertTryPromptQuality 禁止项检测（生成器自检） */
export function hubPromptQualityIssues(text) {
  const issues = [];
  const semanticDir =
    /artifacts\/(?:geo|slides|campaign|research|acquisition|social-matrix|matrix|content|sales|legal|promo|podcast|debate|xhs|data-story|ad-storyboard|viral-script|short-drama|saas-demo)\/|artifacts\/slides-|存\s*artifacts/i;
  if (!text?.trim()) issues.push('empty');
  if (text.includes('做完告诉我')) issues.push('suffix');
  if (text.includes('直接开始做')) issues.push('suffix');
  if (text.includes('read_skill')) issues.push('technical');
  if (text.startsWith('请帮我完成「')) issues.push('old_template');
  if (text.startsWith('请用教育学习')) issues.push('edu_generic');
  if (semanticDir.test(text)) issues.push('semantic_dir');
  // PD-SAAS-FORK: pathHint pollution — ext immediately followed by annotation paren
  if (/\.(?:md|markdown|html?|pdf|docx?|pptx?|json(?:ld)?|png|jpe?g|csv|xlsx?|mp4|svg)\s*[（(]/i.test(text)) {
    issues.push('annotated_basename');
  }
  if (/须交付\s*[:：][\s\S]*\.(?:md|html?)\s*[（(]/i.test(text)) issues.push('annotated_basename');
  if (/标准成果清单[\s\S]*\.(?:md|html?)\s*[（(]/i.test(text)) issues.push('annotated_basename');
  if (/DeepSeek V4|灌篮高手|下一代推理模型|render_hyperframes\s*\(/i.test(text)) {
    issues.push('gateway_live_template');
  }
  // PD-SAAS-FORK: glued basename + task-dir suffix on same line (案2 RCA)
  if (/\.(?:html?|md|docx|pptx)[ \t]*写入系统分配/i.test(text)) {
    issues.push('glued_task_dir_suffix');
  }
  return issues;
}
