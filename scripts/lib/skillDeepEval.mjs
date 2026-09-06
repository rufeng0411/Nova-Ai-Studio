/**
 * Per-skill deep evaluation: stars, reasons, system fit, alternatives.
 * Used by scripts/audit-skills-deep-rating.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getHubPackForSlug, isHubPackCard } from './capabilityHubPacks.mjs';

/** @typedef {'high'|'medium'|'low'} SystemFit */
/** @typedef {'primary'|'after_config'|'via_pack'|'deprecated'|'expert_only'|'not_recommended'} UsageAdvice */

/** Bidirectional or directional functional overlap */
export const FUNCTIONAL_ALTERNATIVES = {
  'df-deep-research': ['nova-research-general', 'edu-recursive-research'],
  'nova-research-general': ['df-deep-research'],
  'nova-research-competitor': ['mkt-competitive-intel', 'mkt-competitive-brief'],
  'nova-research-industry-market': ['mkt-market-research', 'df-deep-research'],
  'nova-research-user-general': ['mkt-user-research', 'nova-research-product-user'],
  'ala-deep-research': ['df-deep-research', 'nova-research-general'],
  'ala-content-writer': ['mkt-copywriting', 'mkt-social'],
  'ala-content-creator': ['ala-content-writer', 'social-creative-matrix'],
  'mkt-competitive-brief': ['nova-research-competitor', 'mkt-competitive-intel'],
  'mkt-competitors': ['nova-research-competitor', 'mkt-competitive-intel'],
  'mkt-competitor-profiling': ['nova-research-competitor'],
  'fc-firecrawl-cli': ['mcp-firecrawl', 'fc-firecrawl-search'],
  'fc-firecrawl-search': ['mcp-firecrawl', 'tool-web-search'],
  'fc-firecrawl-scrape': ['mcp-firecrawl', 'fc-firecrawl-cli'],
  'mcp-firecrawl': ['tool-web-search', 'fc-firecrawl-search'],
  'mcp-exa': ['tool-web-search', 'nova-research-general'],
  'tool-web-search': ['mcp-exa', 'fc-firecrawl-search'],
  'tool-generate-video': ['hub-pack-fal-video', 'create-ai-video-gen'],
  'tool-generate-image': ['od-image-gen', 'hub-pack-fal-video'],
  'create-ai-video-gen': ['tool-generate-video', 'hf-hyperframes', 'remotion-video'],
  'remotion-best-practices': ['remotion-video'],
  'hf-hyperframes': ['tool-render-html-video', 'frontend-slides'],
  'hf-website-to-video': ['website-promo-video 流程模板', 'mkt-brand-video'],
  'mkt-brand-video': ['create-vid-visual-prompt', 'hf-website-to-video'],
  'mkt-dmp-video-script': ['create-vid-viral-copy', 'mkt-social'],
  'create-vid-viral-copy': ['mkt-dmp-video-script', 'mkt-social'],
  'ppt-master': ['nova-ppt-aesthetic-slides', 'anth-pptx', 'create-nanobanana-ppt'],
  'nova-ppt-aesthetic-slides': ['ppt-master', 'create-nanobanana-ppt'],
  'anth-pptx': ['ppt-master', 'pd-document-export'],
  'anth-docx': ['pd-document-export'],
  'pd-document-export': ['anth-docx', 'anth-pdf'],
  'humanizer': ['unslop'],
  'unslop': ['humanizer'],
  'open-design': ['od-pricing-page', 'od-landing-page'],
  'geo-rank-track': ['pd-geo', 'geo-aeo-audit'],
  'pd-geo': ['geo-rank-track', 'mkt-claude-seo'],
  'yixiaoer': ['mcp-postiz', 'social-creative-matrix'],
  'social-creative-matrix': ['one-article-matrix 流程模板', 'mkt-social'],
  'github': ['dev-git', 'dev-github-actions'],
  'notion': ['mcp-notion-collab'],
  'obsidian': ['mcp-notion-collab'],
};

/** Skills intentionally hidden — tell user what to use instead */
export const HIDDEN_REDIRECT = {
  'mkt-competitors': 'nova-research-competitor 或 mkt-competitive-intel',
  'mkt-competitor-profiling': 'nova-research-competitor',
  'mkt-competitive-brief': 'nova-research-competitor',
  'ala-deep-research': 'df-deep-research 或 nova-research-general',
  'ala-content-creator': 'ala-content-writer 或 social-creative-matrix',
  'ala-content-writer': 'mkt-copywriting（飞轮）或 social-creative-matrix',
  'react-next-best-practices': 'dev-next-best-practices',
  'mkt-aso': 'hub-pack-aso',
};

export function scoreToStars(score) {
  if (score >= 4.5) return 5;
  if (score >= 3.5) return 4;
  if (score >= 2.5) return 3;
  if (score >= 1.5) return 2;
  return 1;
}

export function starsLabel(n) {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function hasChinese(s) {
  return /[\u4e00-\u9fff]/.test(s || '');
}

function resolveSkillMdPath(skillsRoot, repoRoot, source) {
  if (!source || source.startsWith('virtual:') || source.startsWith('builtin:') || source.startsWith('mcp:') || source.startsWith('hub-pack:')) {
    return null;
  }
  const full = path.join(repoRoot, source, 'SKILL.md');
  if (existsSync(full)) return full;
  const alt = path.join(skillsRoot, source.replace(/^skills\//, ''), 'SKILL.md');
  if (existsSync(alt)) return alt;
  return null;
}

function resolveAlternatives(skill, displayBySlug) {
  /** @type {Array<{slug: string, label: string, reason: string}>} */
  const out = [];
  const seen = new Set([skill.slug]);

  const add = (slug, reason) => {
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    const label = displayBySlug.get(slug) || slug;
    out.push({ slug, label, reason });
  };

  const pack = getHubPackForSlug(skill.slug);
  if (pack && !isHubPackCard(skill.slug)) {
    add(pack.slug, `Hub 能力包「${pack.display_name}」会自动选用本子技能`);
  }

  if (skill.slug.startsWith('mkt-brand-skills-')) {
    const mainSlug = skill.slug.replace('mkt-brand-skills-', 'mkt-brand-');
    add(mainSlug, '同主题非镜像主技能');
    add('hub-pack-brand-website', '品牌官网全案包（推荐入口）');
  }

  if (skill.slug.startsWith('fal-') && skill.slug !== 'fal-workflow') {
    add('hub-pack-fal-video', 'Fal 视频能力包统一入口');
  }

  if (skill.slug.startsWith('legal-lav-')) {
    add('legal-risk-assessment', '法务快检流程或 legal-* 可见卡');
  }

  if (HIDDEN_REDIRECT[skill.slug]) {
    for (const part of HIDDEN_REDIRECT[skill.slug].split(/\s+或\s+/)) {
      const slug = part.replace(/流程模板$/, '').trim();
      if (slug && !slug.includes(' ')) add(slug, 'taxonomy 隐藏，改用此可见入口');
    }
  }

  for (const altSlug of FUNCTIONAL_ALTERNATIVES[skill.slug] || []) {
    const clean = altSlug.replace(/\s+流程模板$/, '');
    if (clean.includes('-') || clean.startsWith('mkt') || clean.startsWith('nova')) {
      add(clean, '功能重叠，可按场景二选一');
    }
  }

  // OD pages → open-design
  if (skill.slug.startsWith('od-') && skill.slug !== 'open-design' && skill.hidden_in_hub) {
    add('open-design', 'Open Design 总控，150 套设计系统统一入口');
  }

  // edu-sci hidden
  if (skill.slug.startsWith('edu-sci-') && skill.hidden_in_hub) {
    add('edu-recursive-research', '教育 Tab 可见的通用调研/学术入口');
  }

  return out.slice(0, 4);
}

/**
 * @param {object} skill - catalog skill + rating fields
 * @param {object} ctx
 */
export function buildDeepEvaluation(skill, ctx) {
  const sourceKey = String(skill.source || '').replace(/\\/g, '/');
  const skillMd = resolveSkillMdPath(ctx.skillsRoot, ctx.repoRoot, sourceKey);
  const risk = ctx.riskBySource.get(sourceKey) || { high: 0, medium: 0 };
  const zhName = ctx.displayBySlug.get(skill.slug) || skill.display_name || skill.slug;

  /** @type {string[]} */
  const reasons = [];
  /** @type {string[]} */
  const misalign = [];
  /** @type {SystemFit} */
  let systemFit = 'high';
  /** @type {UsageAdvice} */
  let usageAdvice = 'primary';

  const alternatives = resolveAlternatives(skill, ctx.displayBySlug);

  // --- Score (same heuristic as audit script) ---
  let score = 3.6;
  if (typeof ctx.manualRatings[skill.slug] === 'number') {
    score = ctx.manualRatings[skill.slug];
    reasons.push(`生态人工标星 ${score} 分`);
  } else {
    if (!skillMd) {
      if (sourceKey.startsWith('hub-pack:')) {
        score = skill.availability === 'needs_config' ? 3.4 : 4.1;
        reasons.push('能力包聚合入口，Agent 通过 read_skill 调度子技能');
      } else if (sourceKey.startsWith('virtual:') || sourceKey.startsWith('builtin:')) {
        score = 3.8;
        reasons.push('平台内置工具，无独立 SKILL，经 Gateway 工具链执行');
      } else if (sourceKey.startsWith('mcp:')) {
        score = skill.availability === 'needs_config' ? 3.0 : 3.7;
        reasons.push('MCP 扩展能力，依赖外部 MCP 服务连接');
        misalign.push('需管理员在能力接入中心配置 MCP 密钥');
      } else if (sourceKey.startsWith('skills/')) {
        score = 1.0;
        reasons.push('仓库 source 指向的路径无 SKILL.md');
        misalign.push('技能未正确 vendored 或路径错误');
        systemFit = 'low';
        usageAdvice = 'not_recommended';
      } else {
        score = 2.0;
        reasons.push('来源 metadata 异常');
        systemFit = 'low';
      }
    } else {
      reasons.push('磁盘存在完整 SKILL.md，可被 read_skill 加载');
    }

    if (skill.availability === 'needs_config') {
      score -= 0.55;
      reasons.push('catalog 标记 needs_config：使用前须配置 API Key 或第三方账号');
      misalign.push('未配置 Key 时无法完成端到端交付');
      if (usageAdvice === 'primary') usageAdvice = 'after_config';
    }

    if (skill.integration_level === 'L2') {
      score -= 0.35;
      reasons.push('L2 集成：可能依赖本地 CLI（ffmpeg/yt-dlp/python 等）');
      misalign.push('SaaS 租户沙箱可能无本地 CLI，需验证或走内置工具降级');
      systemFit = systemFit === 'high' ? 'medium' : systemFit;
    } else if (skill.integration_level === 'L3' && !sourceKey.startsWith('mcp:')) {
      score -= 0.55;
      reasons.push('L3 实验性或重依赖集成');
      systemFit = 'medium';
    }

    if (risk.high > 0) {
      score -= Math.min(1.2, 0.4 + risk.high * 0.15);
      reasons.push(`SKILL 指引含 SaaS 高风险模式（如 read_file skills/）约 ${risk.high} 处`);
      misalign.push('租户 cwd 下 read_file skills/ 会失败，须 read_skill 相对路径');
      systemFit = 'low';
    } else if (risk.medium > 2) {
      score -= 0.35;
      reasons.push('SKILL 含较多 bash/node 脚本指引');
      misalign.push('与「对话+write_file+内置工具」主路径不完全一致');
      if (systemFit === 'high') systemFit = 'medium';
    }

    if (!hasChinese(zhName)) {
      score -= 0.45;
      reasons.push('中文界面下 display_name 无中文，能力中心可发现性弱');
    } else {
      reasons.push('中文 display_name 齐全，能力中心可发现');
    }

    if (skill.hidden_in_hub) {
      if (skill.slug.startsWith('mkt-brand-skills-')) {
        score = 1.0;
        usageAdvice = 'deprecated';
        systemFit = 'low';
        reasons.push('mkt-brand-skills-* 为 mkt-brand-* 重复镜像，Hub 故意隐藏');
        misalign.push('与主卡重复，不应单独露出或单独维护');
      } else if (skill.slug.startsWith('fal-')) {
        score = Math.min(score, 3.2);
        usageAdvice = 'via_pack';
        reasons.push('Fal 子技能，Hub 仅展示 hub-pack-fal-video 包卡');
      } else if (getHubPackForSlug(skill.slug)) {
        usageAdvice = 'via_pack';
        reasons.push('能力包子成员，Hub 隐藏；用户应从包卡「试一下」');
      } else if (HIDDEN_REDIRECT[skill.slug]) {
        usageAdvice = 'deprecated';
        reasons.push(`taxonomy 隐藏项，推荐改用：${HIDDEN_REDIRECT[skill.slug]}`);
      } else {
        reasons.push('Hub 隐藏：Agent 仍可 read_skill，但用户不可直接从能力中心发现');
        if (systemFit === 'high') systemFit = 'medium';
      }
    } else {
      reasons.push('Hub 可见，用户可直接「试一下」');
    }

    if (ctx.verified.has(skill.slug)) {
      score += 0.45;
      reasons.push('已有专项 smoke / 生产链路验证');
    }

    if (skill.slug.startsWith('nova-') && skillMd) {
      score += 0.15;
      reasons.push('Nova-1 专项技能，交付规范与 artifacts 路径对齐');
    }

    if (skill.slug.startsWith('create-vid-') && skillMd) {
      score += 0.1;
      reasons.push('2026 视频策划批次，与流程模板联动');
    }

    if (sourceKey.startsWith('mcp:') && skill.availability === 'needs_config') {
      score = Math.max(score, 3.0);
    }
    if (sourceKey.startsWith('hub-pack:') && skill.availability === 'needs_config') {
      score = Math.max(score, 3.0);
    }

    score = Math.max(1, Math.min(5, Math.round(score * 10) / 10));
  }

  const stars = scoreToStars(score);

  if (stars === 1 && usageAdvice !== 'deprecated') {
    usageAdvice = 'not_recommended';
  }
  if (stars <= 2 && usageAdvice === 'primary') {
    usageAdvice = 'expert_only';
  }
  if (alternatives.length > 0 && skill.hidden_in_hub && usageAdvice === 'primary') {
    usageAdvice = 'via_pack';
  }

  // System fit synthesis
  if (systemFit === 'high') {
    if (skill.stage === 'uncategorized' || skill.task_group === 'general') {
      if (skill.major_category === 'marketing') systemFit = 'medium';
    }
    if (skill.slug.startsWith('dev-') && skill.major_category !== 'development') {
      misalign.push('分类在营销飞轮但内容为开发向，非营销用户主路径');
      systemFit = 'medium';
    }
  }

  const usageLabels = {
    primary: '主力使用',
    after_config: '配置 Key 后使用',
    via_pack: '经能力包入口使用',
    deprecated: '已被替代，勿单独使用',
    expert_only: '专家/开发向，非默认推荐',
    not_recommended: '不建议使用',
  };

  return {
    score,
    stars,
    system_fit: systemFit,
    usage_advice: usageAdvice,
    usage_label: usageLabels[usageAdvice],
    reasons,
    misalignments: misalign,
    alternatives,
    has_skill_md: Boolean(skillMd),
  };
}

export function formatSkillEvalBlock(skill, evalResult) {
  const altText = evalResult.alternatives.length
    ? evalResult.alternatives.map((a) => `\`${a.slug}\`（${a.label}：${a.reason}）`).join('；')
    : '—';

  const misText = evalResult.misalignments.length ? evalResult.misalignments.join('；') : '—';

  const reasonList = evalResult.reasons.map((r, i) => `${i + 1}. ${r}`).join('\n');

  const fitLabel = { high: '高', medium: '中', low: '低' }[evalResult.system_fit];

  return [
    `#### ${skill.display_name} · ${starsLabel(evalResult.stars)} · \`${skill.slug}\``,
    '',
    '| 维度 | 评估 |',
    '|------|------|',
    `| Hub | ${skill.hidden_in_hub ? '隐藏' : '可见'} |`,
    `| 级别 | ${skill.integration_level || 'L1'} · ${skill.availability === 'needs_config' ? '需配置' : skill.availability === 'ready' ? '待确认' : '可用'} |`,
    `| 系统契合 | **${fitLabel}** |`,
    `| 使用建议 | **${evalResult.usage_label}** |`,
    `| 替代方案 | ${altText} |`,
    `| 与系统不切合 | ${misText} |`,
    '',
    '**评分原因**',
    '',
    reasonList,
    '',
  ].join('\n');
}
