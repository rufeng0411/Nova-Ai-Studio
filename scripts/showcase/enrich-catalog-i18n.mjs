#!/usr/bin/env node
/** Add title_en / name_en / annotation_en / prompt_en (+ enterprise ZH overlays) to catalog.js */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const targets = [
  'deploy/marketing/showcase/shared/catalog.js',
  'artifacts/saas-design/demos-showcase/shared/catalog.js',
];

const SECTION_EN = {
  design: 'Design',
  video: 'Video',
  copy: 'Copy',
  marketing: 'Marketing',
  office: 'PR & Comms',
  research: 'Research',
  geo: 'GEO',
  fullcase: 'Full projects',
};

/** Enterprise-tone section leads (ZH) — applied on enrich */
const SECTION_LEAD_ZH = {
  design: '官网、海报与主视觉——可验收的品牌物料包',
  video: '广告短片与官网宣传片——可交付的成片样例',
  copy: '长文与观点稿——内容团队可复用的产能样例',
  marketing: '策略提案与路演幻灯——采购与管理层可评审的增长物料',
  office: '危机、媒体日、Pitch 与公关战略——专业传播交付',
  research: '行业、用户与深度调研——立项前可共享的研究包',
  geo: '生成式引擎优化——在大模型回答中被引用、可验证',
  fullcase: '流程模板一次跑完整条业务链，清单锁定、按项验收。',
};

/** Enterprise-tone section leads (EN) — applied on enrich */
const SECTION_LEAD_EN = {
  design: 'Sites, posters, and brand visuals — verifiable creative packs for teams.',
  video: 'Ad shorts and site promos — playable mp4 deliverables for campaigns.',
  copy: 'Longform and opinion pieces — reusable content-ops capacity samples.',
  marketing: 'Strategy proposals and pitch decks — review-ready growth materials.',
  office: 'Crisis, media day, pitch, and PR strategy — professional comms.',
  research: 'Industry, user, and deep research — shareable packs before kickoff.',
  geo: 'Generative engine optimization — cited and measurable in AI answers.',
  fullcase:
    'Process templates run a full business chain; checklist locked, item-by-item acceptance.',
};

/**
 * English name / annotation / prompt per item.
 * prompt must be English (no CJK) for EN locale prompt field.
 */
const ITEM_EN = {
  'site-south': {
    name: 'South America travel site',
    annotation:
      'Lead-gen landing for travel programs: narrative layout and responsive structure for first-screen conversion demos.',
    prompt:
      'Design and deliver a single-page marketing site (HTML) for a “South America long-stay travel” theme: hero, destination highlights, itinerary/services, trust proof, and inquiry CTA. Premium minimal, mobile-ready; write into the system-assigned task directory.',
  },
  'site-modric': {
    name: 'Legend athlete brand site',
    annotation:
      'Athlete IP brand narrative page with strong headline hierarchy — suited to endorsement and legacy content hubs.',
    prompt:
      'Build a brand narrative landing page for a legendary football athlete (Chinese UI copy OK): career highlights, brand ethos, and partnership/memorial content entry points. Premium, restrained visuals; deliver openable HTML into the system-assigned task directory.',
  },
  poster: {
    name: 'Flagship peripheral poster',
    annotation:
      '9:16 product poster with clear value props and specs — suited to paid media and e-commerce hero assets.',
    prompt:
      'Create a 9:16 vertical product poster for a flagship wireless mouse (HTML or hi-res image): hero product visual, three core value props, brief specs. Tech feel, graphite premium palette; write into the system-assigned task directory.',
  },
  graphic: {
    name: 'Brand KV & social kit',
    annotation: 'Hero KV plus multi-aspect social cards in one pass — multi-channel ready.',
    prompt:
      'Output a brand key-visual kit: one vertical hero poster + 16:9 landscape + 1:1 and 9:16 social cards. Unified style, campaign-ready; write into the system-assigned task directory.',
  },
  'video-ad': {
    name: 'EV flagship short ad',
    annotation: 'Product short with mood and selling cadence — suited to paid-media creative preview.',
    prompt:
      'Produce a ~5–15s landscape ad short for a smart EV flagship: opening mood, product close-ups, one brand line at the end. Must deliver a playable mp4 into the system-assigned task directory.',
  },
  'video-hf': {
    name: 'Website promo film',
    annotation: 'Promo film rendered from web/motion project — demonstrates page-to-video delivery.',
    prompt:
      'Using HTML/motion-project render-to-film, produce a brand website promo short (landscape 1080p): clear chapters, restrained premium motion. Must deliver an mp4 into the system-assigned task directory.',
  },
  'article-01': {
    name: 'Speed is justice — sports opinion essay',
    annotation: 'Pillar opinion essay for owned media and issue-ops content libraries.',
    prompt:
      'Write a sports/football pillar longform on why pacey players feel addictive. Clear thesis, section headings, and a closing line; deliver Markdown into the system-assigned task directory.',
  },
  'article-02': {
    name: 'China football animation IP — industry brief',
    annotation: 'Industry commentary longform for owned media and channel distribution.',
    prompt:
      'Write a candid, evidence-based commentary essay on whether China needs its own football animation IP. Deliver Markdown into the system-assigned task directory.',
  },
  'article-03': {
    name: 'The endgame of AI creation tools',
    annotation: 'Product narrative essay for site blogs and sales enablement forwards.',
    prompt:
      'Write a deep longform on how AI creation/collaboration platforms reshape content production, emphasizing “deliver verifiable results, not chat logs.” Deliver Markdown into the system-assigned task directory.',
  },
  'article-04': {
    name: '800 km road-trip field test',
    annotation: 'Field-test longform for channel enablement and dealer content packs.',
    prompt:
      'From a smart EV owner’s perspective, write an 800 km road-trip field-test longform (range, assisted driving, charging). Concrete detail; deliver Markdown into the system-assigned task directory.',
  },
  'article-05': {
    name: 'Bring home into the cabin',
    annotation: 'Lifestyle narrative for brand content libraries and family-scenario positioning.',
    prompt:
      'Write a family road-trip lifestyle longform: bringing home comfort into a smart cabin. Warm and restrained, light on hard sell; deliver Markdown into the system-assigned task directory.',
  },
  'html-plan': {
    name: 'Growth strategy HTML proposal',
    annotation: 'Structured strategy page for screen demos, stakeholder review, and link-based sign-off.',
    prompt:
      'Write a growth / programmatic SEO strategy proposal as polished openable HTML (TOC, insights, strategy pillars, rollout steps, KPIs). Write into the system-assigned task directory.',
  },
  'ppt-product': {
    name: 'Product aesthetic pitch deck',
    annotation:
      'Luxury-product 16:9 aesthetic deck (8 slides) for launches, sales pitches, and exec reviews.',
    prompt:
      'Create an 8-page 16:9 product pitch aesthetic deck (luxury off-road / flagship-mod aesthetic): cover, value props, scenes, specs, comparison, CTA. Must deliver slide image pack + slide-manifest.json into the system-assigned task directory. Cinematic, restrained premium look.',
  },
  'ppt-guofeng': {
    name: 'Chinese-style science aesthetic deck',
    annotation: 'Cultural explainer with line-art aesthetic for training, sharing, and management reports.',
    prompt:
      'Using Chinese ink line-art aesthetics, create an 8-page 16:9 science explainer deck on Ming-dynasty architecture: cover, overview, component breakdown, structural principles, etc. Must deliver PNG pack + slide-manifest.json into the system-assigned task directory.',
  },
  deep: {
    name: 'Deep research report',
    annotation: 'Synthesis, body, and charts — market scan pack before project kickoff.',
    prompt:
      'Write a presentation-ready deep market research report: market size and structure, key drivers, risks and opportunities, conclusions and recommendations. Deliver Markdown body with simple chart notes into the system-assigned task directory.',
  },
  user: {
    name: 'Enterprise Agent user research report',
    annotation: 'Jobs, pains, and opportunities structured for product, growth, and procurement alignment.',
    prompt:
      'Produce a user research report for an enterprise AI Agent platform: target roles, critical jobs, current tool pains, purchase triggers, and product opportunities. Deliver openable HTML into the system-assigned task directory.',
  },
  industry: {
    name: 'Industry market research report',
    annotation: 'Market size, segments, and trends for sales enablement and strategy packs.',
    prompt:
      'Output an industry market research report (market size, segments, competitive landscape, trend judgment, action recommendations). Deliver HTML into the system-assigned task directory.',
  },
  'geo-report': {
    name: 'GEO competitive visibility report',
    annotation: 'Competitor presence and citability in AI search, with actionable gaps for teams.',
    prompt:
      'Run a GEO/AEO competitive visibility analysis: mention and citation gaps vs key competitors in AI-search scenarios; output an HTML report and prioritized optimization checklist into the system-assigned task directory.',
  },
  'full-campaign': {
    name: 'Brand campaign full pack',
    annotation:
      'End-to-end strategy proposal from insight to channel and content cadence — for kickoff and agency pitches.',
    prompt:
      'Using the “Brand Campaign Full Pack” process template, produce a management-ready communications kickoff pack: deliver insight summary, audience, proposition, channel mix, content cadence, and milestones per checklist; primary deliverable is openable HTML strategy proposal; write all into the system-assigned task directory.',
  },
  'full-flywheel': {
    name: 'Content flywheel pack',
    annotation: 'Topics → pillar longform → multi-platform slices — one pass through content ops capacity.',
    prompt:
      'Start the “Content Marketing Flywheel” process template for a quarter of actionable samples: topic plan, one pillar longform, then WeChat/social slice outlines; accept item-by-item against the results checklist; write all into the system-assigned task directory.',
  },
  'full-geo': {
    name: 'Brand GEO visibility pack',
    annotation: 'Visibility audit, competitor contrast, and optimization checklist for AI-search readiness.',
    prompt:
      'Use the “Brand GEO Visibility Full Pack” process template: contrast mention/citation gaps vs key competitors in AI search; output openable HTML report plus citability gaps and this-week priority actions into the system-assigned task directory.',
  },
};

/** Enterprise-tone ZH overlays (name/annotation/prompt) applied on enrich */
const ITEM_ZH = {
  'site-south': {
    annotation: '旅居获客落地站：叙事排版与响应式结构，适合首屏转化与获客演示。',
  },
  'site-modric': {
    annotation: '人物 IP 官网风：强标题与品牌叙事，适合代言与传奇内容站。',
  },
  poster: {
    annotation: '9:16 产品海报，卖点与规格区清晰，适合付费投放与电商主图物料。',
  },
  graphic: {
    annotation: '主 KV + 多画幅社媒卡，一次产出多端可投放物料。',
  },
  'video-ad': {
    annotation: '氛围与卖点节奏兼具的产品短视频，适合付费投放成片预览。',
  },
  'video-hf': {
    annotation: '由网页/动态工程渲染的宣传成片，演示「页面到视频」可交付能力。',
  },
  'article-01': {
    annotation: '观点型支柱文，适合官媒内容库与议题运营。',
  },
  'article-02': {
    name: '中国足球动画 IP 产业评论',
    annotation: '产业评论向长文，适合官媒与行业渠道分发。',
    prompt:
      '以「中国是否需要自己的足球动画 IP」为题写一篇坦诚、有论据的产业评论长文。交付 Markdown，写入系统分配任务目录。',
  },
  'article-03': {
    annotation: '产品叙事长文，适合官网博客与销售赋能转发。',
  },
  'article-04': {
    annotation: '体验测评向，适合渠道赋能与经销内容包。',
  },
  'article-05': {
    annotation: '生活方式向故事稿，适合品牌内容库与家庭场景定位。',
  },
  'html-plan': {
    annotation: '结构完整的策略页，适合屏幕演示、干系人评审与链接会签。',
  },
  'ppt-product': {
    annotation: '豪华产品向 16:9 美学幻灯 8 页，适合发布会、销售路演与管理层评审。',
  },
  'ppt-guofeng': {
    annotation: '文化科普向手绘线稿美学，适合培训、分享与管理层汇报。',
  },
  deep: {
    annotation: '含综述、正文与数据图，适合立项前的市场摸底与共享研究包。',
  },
  user: {
    annotation: '任务场景、痛点与机会点结构化，适合产品、增长与采购对齐用户。',
  },
  industry: {
    annotation: '市场规模、细分与趋势，适合销售赋能与战略共用的行业包。',
  },
  'geo-report': {
    annotation: '对照竞品在 AI 搜索中的出现与可引用性，给出团队可执行缺口。',
  },
  'full-campaign': {
    annotation: '从洞察到渠道与内容节奏的整包策略提案，适合立项与代理比稿。',
  },
  'full-flywheel': {
    annotation: '选题 → 支柱长文 → 多平台切片，一次跑通内容运营产能链路。',
  },
  'full-geo': {
    annotation: '可见度体检、竞品对照与优化清单，整包面向 AI 搜索可验证性。',
  },
};

const FULLCASE_INTRO_ZH =
  '一次对话按阶段产出整包可验收成果——面向团队协作与私有化部署场景。';
const FULLCASE_INTRO_EN =
  'One conversation produces staged, checklist-verified packs — built for team workflows and private deployment.';

const HAS_CJK = /[\u4e00-\u9fff]/;

function pickEn(current, mapped, fallback) {
  if (mapped) return mapped;
  if (current && !HAS_CJK.test(current)) return current;
  return fallback || current || '';
}

function enrich(catalog) {
  catalog.brandNote_en =
    catalog.brandNote_en && !HAS_CJK.test(catalog.brandNote_en)
      ? catalog.brandNote_en
      : 'Produced with Nova Studio N2 (Nova Ai-Studio 2.0)';
  for (const sec of catalog.sections || []) {
    sec.title_zh = sec.title_zh || sec.title;
    sec.title_en = pickEn(sec.title_en, SECTION_EN[sec.id], sec.title);

    if (SECTION_LEAD_ZH[sec.id]) {
      sec.lead = SECTION_LEAD_ZH[sec.id];
      sec.lead_zh = SECTION_LEAD_ZH[sec.id];
    } else {
      sec.lead_zh = sec.lead_zh || sec.lead || '';
    }
    sec.lead_en = SECTION_LEAD_EN[sec.id] || pickEn(sec.lead_en, null, sec.lead_zh);

    if (sec.id === 'fullcase') {
      sec.intro = FULLCASE_INTRO_ZH;
      sec.intro_zh = FULLCASE_INTRO_ZH;
      sec.intro_en = FULLCASE_INTRO_EN;
    }

    for (const item of sec.items || []) {
      const tr = ITEM_EN[item.id] || {};
      const zh = ITEM_ZH[item.id] || {};

      if (zh.name) {
        item.name = zh.name;
        item.name_zh = zh.name;
      } else {
        item.name_zh = item.name_zh || item.name;
      }
      item.name_en = pickEn(item.name_en, tr.name, item.name);

      if (zh.annotation) {
        item.annotation = zh.annotation;
        item.annotation_zh = zh.annotation;
      } else {
        item.annotation_zh = item.annotation_zh || item.annotation;
      }
      item.annotation_en = pickEn(item.annotation_en, tr.annotation, item.annotation);

      if (zh.prompt) {
        item.prompt = zh.prompt;
        item.prompt_zh = zh.prompt;
      } else {
        item.prompt_zh = item.prompt_zh || item.prompt || '';
      }
      if (tr.prompt) {
        item.prompt_en = tr.prompt;
      } else if (!item.prompt_en || HAS_CJK.test(item.prompt_en)) {
        item.prompt_en = item.prompt_zh;
      }
    }
  }
  return catalog;
}

for (const rel of targets) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) continue;
  const code = fs.readFileSync(abs, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox);
  const catalog = enrich(sandbox.window.NOVA_SHOWCASE_CATALOG);
  const header = code.split('window.NOVA_SHOWCASE_CATALOG')[0];
  const out =
    header +
    'window.NOVA_SHOWCASE_CATALOG = ' +
    JSON.stringify(catalog, null, 2) +
    ';\n';
  fs.writeFileSync(abs, out, 'utf8');
  console.log('enriched', rel);
}
