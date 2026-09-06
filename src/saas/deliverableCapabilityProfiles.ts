// PD-SAAS-FORK: single registry for slug → recovery/bypass/validate profile
import { isCampaignFullCaseGoal } from "./deliverables/campaignDeliverableGoal.js";
import {
  detectChecklistAuthorityTemplateId,
  parseMustDeliverClause,
  stripLaunchContextAndAttachmentBlocks,
  stripNegatedDeliverableMentions,
} from "./deliverables/deliverableChecklistAuthority.js";
import { detectResearchReportTurn } from "./processTemplateExecutionPrompt.js";
import {
  isCapabilityScopeV2EnforcedForSlug,
  isChecklistAuthorityTemplatesEnabled,
} from "./resilience/stabilityFlags.js";

export type RecoveryKind =
  | "ppt"
  | "research"
  | "content"
  | "docx"
  | "geo"
  | "html"
  | "storyboard"
  | "timesfm"
  | "video_template"
  | "video"
  | "default";

export type DeliverableProfile = {
  id: string;
  /** Optional when profile matches only via exactSlugs. */
  slugPrefixes?: string[];
  exactSlugs?: string[];
  recoveryKind: RecoveryKind;
  bypassOrchestration: boolean;
  expectedExtensions: string[];
  acceptanceTier?: "L0" | "L1" | "L2";
  /** Goal Loop rollout tier (L1 report → L2 assisted repair/verify → L3 autonomous). */
  goalLoopTier?: "L1" | "L2" | "L3";
  requiredArtifacts?: string[];
  /** Basenames that must exist under artifacts/ for multi-file packs (goal-gated). */
  requiredBasenames?: string[];
  /** Alternative basenames for one required role, e.g. preview.html OR demo-preview.html. */
  requiredBasenameGroups?: string[][];
  /** Count-based platform draft requirement for GEO/content packs. */
  requiredPlatformDrafts?: {
    count: number;
    basenames: string[];
  };
  executionContract?: {
    requiredDeliverables: string[];
    optionalSteps: string[];
    irreplaceableBlockers: string[];
    fallbackStrategy: string;
    optionalMissingKeyServices: string[];
  };
};

export const SCRIPT_DRAFT_SLUGS = [
  "create-vid-scriptwriting",
  "create-vid-saas-demo-script",
  "create-vid-viral-copy",
  "viral-talking-script",
] as const;

const PROFILES: DeliverableProfile[] = [
  {
    id: "nova-bento-deck",
    slugPrefixes: ["nova-bento"],
    exactSlugs: ["nova-bento-slides"],
    recoveryKind: "html",
    bypassOrchestration: true,
    expectedExtensions: [".bento.html"],
    acceptanceTier: "L1",
    goalLoopTier: "L2",
    requiredBasenameGroups: [["deck.bento.html"]],
  },
  {
    id: "nova-slide-deck",
    slugPrefixes: ["nova-ppt-aesthetic"],
    exactSlugs: ["nova-ppt-aesthetic-slides"],
    recoveryKind: "ppt",
    bypassOrchestration: true,
    expectedExtensions: [".png", ".json"],
    acceptanceTier: "L1",
    goalLoopTier: "L2",
    requiredBasenameGroups: [["slide-manifest.json"]],
  },
  {
    id: "ppt",
    slugPrefixes: ["nova-ppt-", "html-ppt-", "anth-pptx"],
    exactSlugs: ["frontend-slides", "cyber-ppt"],
    recoveryKind: "ppt",
    bypassOrchestration: true,
    expectedExtensions: [".pptx", ".json"],
    acceptanceTier: "L1",
    goalLoopTier: "L2",
    requiredBasenameGroups: [
      ["presentation.pptx"],
      ["slide_manifest.json", "slide-manifest.json"],
      ["visual_qa_gate.json"],
    ],
  },
  {
    // PD-SAAS-FORK a51fa91d: Hub 智能获客 — 主交付 leads-report.md，勿绑 research/docx。
    id: "acquisition_leads",
    slugPrefixes: ["nova-customer-acquisition"],
    exactSlugs: ["nova-customer-acquisition-leads"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md", ".json"],
    acceptanceTier: "L1",
    goalLoopTier: "L2",
    requiredBasenameGroups: [
      ["leads-report.md"],
      ["acquisition-manifest.json"],
    ],
  },
  {
    id: "research",
    slugPrefixes: ["research-", "market-", "nova-research-"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md", ".docx", ".pdf"],
    acceptanceTier: "L1",
    goalLoopTier: "L2",
  },
  {
    id: "geo_serp",
    slugPrefixes: ["geo-serp"],
    exactSlugs: ["geo-serp-analysis"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md", ".html"],
    acceptanceTier: "L1",
    goalLoopTier: "L2",
    requiredBasenameGroups: [
      ["serp-analysis.md"],
      ["serp-analysis.html"],
    ],
  },
  {
    id: "geo_keyword",
    slugPrefixes: ["geo-keyword"],
    exactSlugs: ["geo-keyword-research"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md", ".html"],
    acceptanceTier: "L1",
    goalLoopTier: "L2",
    requiredBasenameGroups: [
      ["keywords.md", "keywords-research.md"],
      ["keywords.html", "keywords-research.html"],
    ],
  },
  {
    id: "geo_competitor",
    slugPrefixes: ["geo-competitor"],
    exactSlugs: ["geo-competitor-analysis"],
    recoveryKind: "geo",
    bypassOrchestration: true,
    expectedExtensions: [".md", ".html"],
    acceptanceTier: "L1",
    goalLoopTier: "L2",
    requiredBasenameGroups: [
      ["geo-competitor-report.md"],
      ["geo-competitor-report.html"],
      ["competitor-visibility.md"],
      ["competitor-visibility.html"],
    ],
  },
  {
    id: "geo_visibility_audit",
    slugPrefixes: ["mkt-ai-seo"],
    exactSlugs: ["mkt-ai-seo"],
    recoveryKind: "geo",
    bypassOrchestration: true,
    expectedExtensions: [".md", ".html"],
    acceptanceTier: "L1",
    goalLoopTier: "L2",
    requiredBasenameGroups: [
      ["audit-checklist.md", "geo-aeo-audit-checklist.md"],
      ["audit-checklist.html", "geo-aeo-audit-checklist.html"],
      ["competitor-visibility.md"],
      ["competitor-visibility.html"],
    ],
  },
  {
    id: "geo",
    slugPrefixes: ["pd-geo", "geo-aeo", "geo-content"],
    recoveryKind: "geo",
    bypassOrchestration: true,
    expectedExtensions: [".md", ".html", ".jsonld", ".json"],
    acceptanceTier: "L1",
    goalLoopTier: "L2",
    requiredArtifacts: [
      "geo-aeo-audit-checklist.md",
      "keywords-research.md",
      "zhihu-article.md",
      "xiaohongshu-article.md",
      "wechat-article.md",
      "optimized.md",
      "schema.jsonld",
      "citability-report.md",
      "visibility-report.html",
    ],
    requiredBasenameGroups: [
      ["geo-aeo-audit-checklist.md", "01-audit-checklist.md", "01-aeo-audit-checklist.md", "audit-checklist.md"],
      ["keywords-research.md", "02-keywords.md", "02-keyword-research.md", "keywords.md"],
      ["optimized.md"],
      ["schema.jsonld"],
      ["citability-report.md", "05-citability-score-report.md", "citability-score-report.md"],
      ["visibility-report.html"],
    ],
    requiredPlatformDrafts: {
      count: 3,
      basenames: [
        "zhihu-article.md",
        "zhihu.md",
        "xiaohongshu-article.md",
        "xiaohongshu.md",
        "wechat-article.md",
        "wechat.md",
        "weibo-article.md",
        "weibo.md",
        "csdn-article.md",
        "csdn.md",
        "douyin.md",
        "bilibili.md",
      ],
    },
    executionContract: {
      requiredDeliverables: [
        "geo-aeo-audit",
        "keywords",
        "platform-drafts",
        "optimized",
        "schema",
        "citability",
        "visibility-report",
      ],
      optionalSteps: ["yixiaoer_draft", "geo_api_validation", "mineru_ocr"],
      irreplaceableBlockers: [],
      fallbackStrategy:
        "评分/联网/geo_api/蚁小二草稿不可用时跳过该步并在正文说明，仍交付 artifacts/geo/<brand>/ 全套文件。",
      optionalMissingKeyServices: ["yixiaoer", "mineru", "bocha", "api", "export"],
    },
  },
  {
    // PD-SAAS-FORK: viral-article-generator 四槽 pack，须早于 content/matrix 泛化。
    id: "viral_article_pack",
    slugPrefixes: ["viral-article"],
    exactSlugs: ["viral-article-generator"],
    recoveryKind: "content",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["article-brief.md", "选题简报.md"],
      ["article.md", "爆款母稿.md"],
      ["quotes.md", "金句.md"],
      ["channel-plan.md", "渠道计划.md"],
    ],
    executionContract: {
      requiredDeliverables: ["article-brief", "article", "quotes", "channel-plan"],
      optionalSteps: ["web_search", "repurpose"],
      irreplaceableBlockers: [],
      fallbackStrategy: "风格路由四文件须主线程 write_file；stub 软切换仍交稿；禁止 subagent。",
      optionalMissingKeyServices: [],
    },
  },
  {
    id: "one-article-matrix",
    slugPrefixes: ["humanizer", "one-article-matrix"],
    exactSlugs: ["humanizer"],
    recoveryKind: "content",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["article.md", "deep_article.md"],
      ["zhihu.md", "zhihu_answer.md"],
      ["xiaohongshu.md"],
      ["wechat.md", "wechat_article.md"],
      ["douyin.md"],
      ["bilibili.md"],
      ["data-sources.md"],
    ],
    executionContract: {
      requiredDeliverables: ["article", "zhihu", "xiaohongshu", "wechat", "douyin", "bilibili", "data-sources"],
      optionalSteps: ["humanize", "web_search"],
      irreplaceableBlockers: [],
      fallbackStrategy: "深度长文 + 五平台 humanize 须主线程 write_file 落盘，禁止 subagent 委派。",
      optionalMissingKeyServices: [],
    },
  },
  {
    id: "social_matrix",
    slugPrefixes: ["social-creative-matrix", "social-matrix"],
    exactSlugs: ["social-creative-matrix"],
    recoveryKind: "content",
    bypassOrchestration: true,
    expectedExtensions: [".md", ".json", ".png", ".svg"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["brief.md"],
      ["creative-anchors.md"],
      ["copywriting.md", "copy-matrix.md"],
      ["manifest.json"],
      ["visuals/image-9x16.png", "visual-9x16.png"],
      ["visuals/image-3x4.png", "visual-3x4.png"],
      ["visuals/image-1x1.png", "visual-1x1.png"],
      ["visuals/image-16x9.png", "visual-16x9.png"],
    ],
    executionContract: {
      requiredDeliverables: ["brief", "creative-anchors", "platform-copy", "manifest"],
      optionalSteps: ["image_generation", "video_generation", "document_export", "ocr"],
      irreplaceableBlockers: ["yixiaoer"],
      fallbackStrategy: "生图/生视频不可用时使用 SVG/PNG 占位和脚本说明继续；蚁小二缺 Key 只阻断草稿推送。",
      optionalMissingKeyServices: ["image", "video", "export", "mineru"],
    },
  },
  {
    id: "video-mp4",
    slugPrefixes: ["tool-generate-video", "od-video-gen", "happyhorse", "seedance"],
    exactSlugs: ["ai-video-gen"],
    recoveryKind: "video_template",
    bypassOrchestration: true,
    expectedExtensions: [".mp4"],
    acceptanceTier: "L1",
    goalLoopTier: "L2",
    executionContract: {
      requiredDeliverables: ["mp4"],
      optionalSteps: ["render_html_video"],
      irreplaceableBlockers: [],
      fallbackStrategy: "generate_video API 全失败才 video_api_exhausted；禁止单次 Model not exist 即 HTML 录屏。",
      optionalMissingKeyServices: ["video"],
    },
  },
  {
    id: "script-md",
    exactSlugs: [...SCRIPT_DRAFT_SLUGS],
    slugPrefixes: [],
    recoveryKind: "default",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["脚本.md", "script.md", "口播脚本.md", "视频脚本.md"],
    ],
  },
  {
    id: "hyperframes",
    slugPrefixes: ["hf-"],
    exactSlugs: [
      "hf-hyperframes",
      "hf-product-launch-video",
      "hf-motion-graphics",
      "hf-general-video",
      "hf-faceless-explainer",
      "hf-hyperframes-core",
      "hf-hyperframes-animation",
      "hf-hyperframes-keyframes",
      "hf-hyperframes-creative",
      "hf-hyperframes-cli",
      "hf-hyperframes-registry",
      "hf-media-use",
      "hf-pr-to-video",
      "hf-embedded-captions",
      "hf-talking-head-recut",
      "hf-music-to-video",
      "hf-remotion-to-hyperframes",
      "hf-figma",
      "hf-website-to-video",
      "hf-hyperframes-media",
      "hf-gsap",
    ],
    recoveryKind: "video_template",
    bypassOrchestration: true,
    expectedExtensions: [".mp4"],
    acceptanceTier: "L1",
    goalLoopTier: "L2",
    requiredBasenameGroups: [["promo.mp4"]],
    executionContract: {
      requiredDeliverables: ["mp4"],
      optionalSteps: ["render_hyperframes"],
      irreplaceableBlockers: [],
      fallbackStrategy: "HyperFrames 成片须 render_hyperframes 产出 promo.mp4；禁止 md/Studio URL 软过关。",
      optionalMissingKeyServices: ["video", "tts"],
    },
  },
  {
    id: "hyperframes-slideshow",
    exactSlugs: ["hf-slideshow"],
    slugPrefixes: ["hf-slideshow"],
    recoveryKind: "html",
    bypassOrchestration: true,
    expectedExtensions: [".html", ".json"],
    acceptanceTier: "L1",
    executionContract: {
      requiredDeliverables: ["html-deck"],
      optionalSteps: ["render_hyperframes"],
      irreplaceableBlockers: [],
      fallbackStrategy: "幻灯 HyperFrames 工程交付 HTML/deck，不要求 mp4。",
      optionalMissingKeyServices: ["video"],
    },
  },
  {
    id: "hyperframes-overlay",
    exactSlugs: ["hf-embedded-captions", "hf-talking-head-recut"],
    slugPrefixes: ["hf-embedded-captions", "hf-talking-head-recut"],
    recoveryKind: "video_template",
    bypassOrchestration: true,
    expectedExtensions: [".mp4"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [["promo.mp4"]],
    executionContract: {
      requiredDeliverables: ["mp4"],
      optionalSteps: ["render_hyperframes"],
      irreplaceableBlockers: ["user_mp4_input"],
      fallbackStrategy: "须用户附件 mp4 作输入；无附件时 UserActionRequired，禁止空 render。",
      optionalMissingKeyServices: ["video"],
    },
  },
  {
    id: "web_3d",
    slugPrefixes: ["3d-", "web-3d", "threejs-", "three-"],
    recoveryKind: "html",
    bypassOrchestration: true,
    expectedExtensions: [".html", ".js", ".css", ".json"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["index.html"],
    ],
    executionContract: {
      requiredDeliverables: ["index.html", "assets-or-inline-scene"],
      optionalSteps: ["external_assets", "image_generation"],
      irreplaceableBlockers: [],
      fallbackStrategy: "外部素材不可用时用几何体、渐变材质、内联纹理和灯光动画占位，必须交可打开 3D 网页。",
      optionalMissingKeyServices: ["image", "video", "export", "mineru"],
    },
  },
  {
    id: "single-image",
    slugPrefixes: ["image-generation", "mkt-image-gen"],
    exactSlugs: ["image-generation"],
    recoveryKind: "default",
    bypassOrchestration: true,
    expectedExtensions: [".png", ".jpg", ".jpeg", ".webp"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [["poster.png", "key-visual.png", "image.png"]],
    executionContract: {
      requiredDeliverables: ["final-image"],
      optionalSteps: ["canvas-manifest", "layout"],
      irreplaceableBlockers: [],
      fallbackStrategy: "单图任务以最终 PNG/JPG 为主成果，manifest/layout 仅为可选过程文件。",
      optionalMissingKeyServices: [],
    },
  },
  {
    id: "visual_canvas",
    slugPrefixes: ["visual-canvas", "canvas-design", "design-canvas", "poster-"],
    recoveryKind: "html",
    bypassOrchestration: true,
    expectedExtensions: [".json", ".png", ".svg", ".html", ".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["canvas-manifest.json", "manifest.json"],
      ["layout.md", "poster.md", "design-brief.md"],
    ],
    executionContract: {
      requiredDeliverables: ["canvas-manifest", "layout", "pending-assets"],
      optionalSteps: ["official_image_fetch", "image_generation"],
      irreplaceableBlockers: [],
      fallbackStrategy: "官方图或生图失败时先交版式稿、占位视觉和待补素材表，不停在风格问卷。",
      optionalMissingKeyServices: ["image", "video", "export", "mineru", "bocha"],
    },
  },
  {
    id: "x_article",
    slugPrefixes: ["mkt-x-article"],
    exactSlugs: ["mkt-x-article-publisher"],
    recoveryKind: "content",
    bypassOrchestration: true,
    expectedExtensions: [".md", ".html"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["article.md", "post.md", "x-article.md"],
      ["article_html.html", "article.html", "post.html"],
    ],
    executionContract: {
      requiredDeliverables: ["article.md", "article_html.html"],
      optionalSteps: ["publish", "fetch"],
      irreplaceableBlockers: ["x_api", "twitter"],
      fallbackStrategy: "发布失败仍须交付本地 md/html；禁止无文件 completed。",
      optionalMissingKeyServices: ["x", "twitter", "typefully"],
    },
  },
  {
    id: "sales_enablement",
    slugPrefixes: ["mkt-sales-enablement", "pms-competitive-battlecard", "mkt-competitive-intel"],
    exactSlugs: ["sales-battlecard-full"],
    recoveryKind: "content",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    goalLoopTier: "L2",
    requiredBasenameGroups: [
      ["intel.md"],
      ["battlecard.md"],
      ["talk-track.md", "talk_track.md"],
    ],
    executionContract: {
      requiredDeliverables: ["intel", "battlecard", "talk-track"],
      optionalSteps: ["web_search", "mineru_ocr"],
      irreplaceableBlockers: [],
      fallbackStrategy: "竞品情报不可联网时基于常识与公开资料补齐三文件，禁止只交单文件即停。",
      optionalMissingKeyServices: ["mineru", "bocha"],
    },
  },
  {
    id: "programmatic_seo",
    slugPrefixes: ["programmatic-seo", "pseo", "geo-content-optimizer", "geo-content"],
    recoveryKind: "content",
    bypassOrchestration: true,
    expectedExtensions: [".md", ".html", ".csv"],
    acceptanceTier: "L1",
    goalLoopTier: "L2",
    requiredBasenameGroups: [
      ["keywords.md", "keyword-matrix.md"],
      ["landing-pages.md", "page-list.md"],
      ["template.html", "landing-template.html"],
    ],
  },
  {
    id: "content_flywheel",
    slugPrefixes: ["content-flywheel", "content-ip"],
    exactSlugs: ["mkt-content-flywheel"],
    recoveryKind: "content",
    bypassOrchestration: true,
    expectedExtensions: [".md", ".html", ".json", ".pdf"],
    acceptanceTier: "L1",
    goalLoopTier: "L2",
    requiredBasenameGroups: [
      ["01-topics.md", "01-选题规划.md"],
      ["02-longform.md", "02-长文成稿.md"],
      ["03-social-slices.md", "03-社媒切片.md"],
    ],
  },
  {
    id: "campaign",
    slugPrefixes: ["mkt-campaign", "campaign-"],
    recoveryKind: "content",
    bypassOrchestration: false,
    expectedExtensions: [".md", ".html", ".png", ".pdf"],
    acceptanceTier: "L1",
    goalLoopTier: "L2",
    executionContract: {
      requiredDeliverables: ["research", "brief", "platform", "monitoring"],
      optionalSteps: ["generate_image", "generate_video", "yixiaoer_draft", "website"],
      irreplaceableBlockers: [],
      fallbackStrategy: "主视觉 PNG 生图失败时用 HTML/CSS 占位或 Playwright 截图替代，禁止为补 PNG 创建时间戳占位 md。",
      optionalMissingKeyServices: ["image", "video", "yixiaoer"],
    },
  },
  {
    id: "mkt_ads",
    slugPrefixes: [],
    exactSlugs: ["mkt-ads"],
    recoveryKind: "content",
    bypassOrchestration: false,
    expectedExtensions: [".md", ".html"],
    acceptanceTier: "L1",
    goalLoopTier: "L2",
    requiredBasenameGroups: [
      ["ads-plan.md", "paid-media-plan.md"],
      ["channel-matrix.md", "audience-targeting.md"],
    ],
  },
  {
    // PD-SAAS-FORK: P0-1 exact last30days profile must win before broad mkt-* content.
    id: "last30days",
    slugPrefixes: [],
    exactSlugs: ["mkt-last30days"],
    recoveryKind: "content",
    bypassOrchestration: false,
    expectedExtensions: [".md", ".html"],
    acceptanceTier: "L1",
    goalLoopTier: "L2",
    requiredBasenameGroups: [["marketing-deliverable.md"]],
  },
  {
    id: "content",
    slugPrefixes: ["mkt-", "content-", "social-", "yixiaoer"],
    recoveryKind: "content",
    bypassOrchestration: false,
    expectedExtensions: [".md"],
    acceptanceTier: "L0",
  },
  {
    id: "timesfm",
    slugPrefixes: [],
    exactSlugs: ["edu-sci-timesfm-forecasting"],
    recoveryKind: "timesfm",
    bypassOrchestration: true,
    expectedExtensions: [".json", ".csv", ".png"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["forecast.json", "forecast.csv", "forecast-result.json", "forecast-results.csv"],
      ["forecast.png", "forecast-chart.png", "forecast.html"],
    ],
  },
  {
    id: "docx",
    slugPrefixes: ["anth-docx", "docx-"],
    exactSlugs: ["anth-docx"],
    recoveryKind: "docx",
    bypassOrchestration: true,
    expectedExtensions: [".docx"],
    acceptanceTier: "L1",
  },
  {
    id: "design",
    slugPrefixes: ["od-", "open-design", "df-frontend-design"],
    exactSlugs: ["open-design"],
    recoveryKind: "html",
    bypassOrchestration: true,
    expectedExtensions: [".html"],
    acceptanceTier: "L1",
    // PD-SAAS-FORK fd7c166c: OD website = single index.html; ban downloads/img phantom rows.
    requiredBasenameGroups: [["index.html", "landing.html", "report.html"]],
  },
  {
    id: "html",
    slugPrefixes: ["html-", "landing-", "web-", "frontend-"],
    recoveryKind: "html",
    bypassOrchestration: false,
    expectedExtensions: [".html"],
    acceptanceTier: "L1",
  },
  {
    id: "taste_landing",
    slugPrefixes: ["create-taste-"],
    exactSlugs: ["create-taste-brutalist", "create-taste-skill", "create-taste-minimalist", "create-taste-soft"],
    recoveryKind: "html",
    bypassOrchestration: true,
    expectedExtensions: [".html", ".css"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [["index.html"]],
  },
  {
    id: "storyboard",
    slugPrefixes: [
      "create-vid-storyboard-pack",
      "create-vid-seedance-prompt",
      "create-vid-director",
      "create-vid-visual-prompt",
      "create-vid-seedance-codec",
    ],
    recoveryKind: "storyboard",
    bypassOrchestration: true,
    expectedExtensions: [".md", ".txt"],
    acceptanceTier: "L1",
    requiredArtifacts: [
      "continuity_bible.md",
      "shot_cards.md",
      "handoff_design_matrix.md",
    ],
    requiredBasenames: [
      "continuity_bible.md",
      "shot_cards.md",
      "handoff_design_matrix.md",
    ],
  },
  {
    id: "media_short_video",
    slugPrefixes: ["happyhorse", "seedance", "video-gen", "commercial"],
    recoveryKind: "video",
    bypassOrchestration: true,
    expectedExtensions: [".mp4", ".webm", ".mov"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["commercial.mp4", "happyhorse-commercial.mp4", "output.mp4"],
    ],
  },
  {
    id: "video_template",
    slugPrefixes: [
      "remotion-",
      "react-video-",
      "programmatic-video-",
      "tool-render-html-video",
      "hf-website-to-video",
      "html-video-",
    ],
    recoveryKind: "video_template",
    bypassOrchestration: true,
    expectedExtensions: [".html", ".tsx", ".json", ".mp4"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["template.tsx", "AiVideoTemplate.tsx", "Root.tsx", "Composition.tsx"],
      ["params.json", "package.json", "batch-render.js", "batch-render.mjs"],
      ["preview.html", "demo-preview.html", "index.html"],
    ],
  },
  {
    id: "presentation-pptx",
    slugPrefixes: ["anth-pptx", "nova-ppt-", "html-ppt-"],
    exactSlugs: ["anth-pptx"],
    recoveryKind: "ppt",
    bypassOrchestration: true,
    expectedExtensions: [".pptx"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [["presentation.pptx"]],
  },
  {
    id: "ppt-master",
    slugPrefixes: ["ppt-master"],
    exactSlugs: ["ppt-master"],
    recoveryKind: "ppt",
    bypassOrchestration: true,
    expectedExtensions: [".pptx"],
    acceptanceTier: "L1",
    goalLoopTier: "L2",
    requiredBasenameGroups: [["presentation.pptx"]],
  },
  {
    id: "landing-html",
    slugPrefixes: ["nova-landing", "web-landing"],
    recoveryKind: "html",
    bypassOrchestration: true,
    expectedExtensions: [".html"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [["index.html"]],
  },
  {
    id: "magazine-longform",
    slugPrefixes: ["magazine-", "longform-"],
    recoveryKind: "content",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [["article.md", "longform.md", "report.md"]],
  },
  {
    id: "high-visual-pdf",
    slugPrefixes: ["pdf-report", "visual-pdf"],
    recoveryKind: "docx",
    bypassOrchestration: true,
    expectedExtensions: [".pdf"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [["report.pdf", "document.pdf"]],
  },
  // PD-SAAS-FORK: 企业合规 P0 卡轻量 profile（slots + pathHints；universal_data_sources 引擎追加）
  {
    id: "cn-compliance-entity",
    exactSlugs: ["comp-entity-compliance", "zh-entity-compliance"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["经营主体合规检查清单.md", "entity-compliance-checklist.md"],
    ],
  },
  {
    id: "cn-compliance-privacy",
    exactSlugs: ["comp-data-privacy", "zh-pia-generation"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["个人信息保护合规评估.md", "pia-draft.md", "privacy-compliance.md"],
    ],
  },
  {
    id: "cn-compliance-ad",
    exactSlugs: ["comp-ad-product", "zh-marketing-claims-review", "zhxx-ad-compliance-review"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["广告法与上线合规意见.md", "ad-product-compliance.md"],
    ],
  },
  {
    id: "cn-compliance-regulatory",
    exactSlugs: ["comp-regulatory-lite", "zh-reg-gaps"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["行业合规入门检查单.md", "regulatory-lite-checklist.md"],
    ],
  },
  {
    id: "cn-compliance-contract",
    exactSlugs: ["comp-contract-review", "zh-contract-review", "zhxx-contract-review"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["合同审查意见书.md", "contract-review-memo.md"],
    ],
  },
  {
    id: "cn-compliance-bid-analyze",
    exactSlugs: ["comp-bid-analyze", "bid-analysis"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [["招标文件解析报告.md", "bid-analysis.md"]],
  },
  {
    id: "cn-compliance-bid-write",
    exactSlugs: ["comp-bid-write", "bid-commercial-proposal", "biaoshu-writer-pro"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["商务标草案.md", "commercial-bid.md"],
      ["技术标草案.md", "technical-bid.md"],
    ],
  },
  {
    id: "cn-compliance-labor-hire",
    exactSlugs: ["comp-labor-hire", "zh-hiring-review"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["劳动合同草案.md", "录用审查意见.md", "labor-contract-draft.md", "hiring-review.md"],
    ],
  },
  {
    id: "cn-compliance-termination",
    exactSlugs: ["comp-termination", "zh-termination-review"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["解除终止风险意见.md", "termination-review.md"],
    ],
  },
  {
    id: "cn-compliance-handbook",
    exactSlugs: ["comp-handbook-compete", "zh-handbook-updates"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["竞业或手册审查意见.md", "handbook-compete-review.md"],
    ],
  },
  {
    id: "cn-compliance-corp",
    exactSlugs: ["comp-corp-governance", "zh-board-minutes"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["公司治理与章程要点.md", "corp-governance-notes.md"],
    ],
  },
  {
    id: "cn-compliance-policy-search",
    exactSlugs: ["comp-policy-search", "mcp-cn-central-policy"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["政策检索摘要.md", "policy-search-summary.md"],
    ],
  },
  {
    id: "cn-compliance-zjtx",
    exactSlugs: ["comp-zjtx-tech-sme"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["专精特新或科技型对照清单.md", "zjtx-checklist.md"],
    ],
  },
  {
    id: "cn-compliance-local-subsidy",
    exactSlugs: ["comp-local-subsidy"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["地方惠企政策路径说明.md", "local-subsidy-guide.md"],
    ],
  },
  {
    id: "cn-compliance-subsidy-checklist",
    exactSlugs: ["comp-subsidy-checklist"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["补贴申报材料清单.md", "subsidy-doc-checklist.md"],
    ],
  },
  {
    id: "cn-compliance-cashier",
    exactSlugs: ["comp-cashier-ops"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md", ".xlsx"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["出纳日常核对清单.md", "cashier-checklist.md"],
    ],
  },
  {
    id: "cn-compliance-invoice",
    exactSlugs: ["comp-invoice-vat", "tax-invoice-compliance-checker"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["发票与增值税合规要点.md", "invoice-vat-notes.md"],
    ],
  },
  {
    id: "cn-compliance-cit",
    exactSlugs: ["comp-cit-basics", "tax-eit-return-reviewer"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["企业所得税申报要点.md", "cit-basics.md"],
    ],
  },
  {
    id: "cn-compliance-bookkeeping",
    exactSlugs: ["comp-bookkeeping-xlsx"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md", ".xlsx"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      [
        "做账对账台账.md",
        "做账对账台账.xlsx",
        "bookkeeping-ledger.xlsx",
        "chart-of-accounts.md",
      ],
    ],
  },
  {
    id: "cn-compliance-tax-pref",
    exactSlugs: ["comp-tax-sme-hnte", "tax-preference-application-advisor"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["合法税收优惠对照备忘.md", "tax-preference-memo.md"],
    ],
  },
  {
    id: "cn-compliance-rd",
    exactSlugs: ["comp-rd-super-deduction", "tax-deduction-compliance-checker"],
    recoveryKind: "research",
    bypassOrchestration: true,
    expectedExtensions: [".md"],
    acceptanceTier: "L1",
    requiredBasenameGroups: [
      ["研发加计扣除资料指引.md", "rd-super-deduction.md"],
    ],
  },
];

const BENTO_DECK_GOAL_PATTERN =
  /(?:Nova可编辑演示稿|可编辑演示稿|deck\.bento\.html|bento\s*演示|bento\s*slides)/i;
const PPT_GOAL_PATTERN = /(?:ppt|PPT|pptx|幻灯|演示文稿|演示PPT)/i;
const DF_PPT_HUB_UPGRADE_GOAL =
  /(?:演示稿|页数|\.pptx|可编辑|原生可编辑|ppt-master|anth-pptx)/i;
const DOCX_GOAL_PATTERN = /(?:docx|word|文档)/i;
const RESEARCH_GOAL_PATTERN =
  /(?:调研|研究报告|(?:^|[^\w-])report(?!\.(?:html?|md|pdf|docx?))(?:$|[^\w-])|竞品|competitive|benchmark|竞品对标)/i;
const GEO_DELIVERABLE_SIGNAL =
  /(?:optimized\.md|schema\.jsonld|visibility-report|geo-aeo-audit|keywords-research|平台成稿|标准包|全案|须交付)/i;
const GEO_GOAL_PATTERN =
  /(?:\bGEO\b|\bAEO\b|geo-aeo|pd-geo|optimized\.md|schema\.jsonld|visibility-report|引用评分|AI\s*搜索可见度)/i;
const OPEN_INDUSTRY_GEO_RESEARCH_PATTERN =
  /(?:行业|市场|现状|发展|客户|舆情|评价|深度调查)/i;
const HTML_GOAL_PATTERN = /(?:html|HTML|网页|落地页|官网|页面|网站)/;
const STORYBOARD_GOAL_PATTERN =
  /(?:Seedance|即梦|分镜提示|storyboard prompt|scenedance)/i;
const STORYBOARD_PACK_GOAL_PATTERN =
  /(?:连续性分镜包|continuity\s*分镜|分镜包|bible|镜头卡|交接矩阵|handoff)/i;
const BRAND_GEO_FULL_CASE_GOAL_PATTERN =
  /(?:品牌\s*GEO\s*全案|AI\s*搜索可见度标准包|geo-aeo-audit|pd-geo|mkt-schema|od-data-report|visibility-report\.html)/i;
const SOCIAL_MATRIX_GOAL_PATTERN =
  /(?:社媒矩阵|social-matrix|social-creative|国内社媒|全平台文案|多套比例配图|9:16|3:4|1:1|16:9|蚁小二|yixiaoer|小红书.*草稿)/i;
const SCRIPT_DRAFT_MARK_RE = /(?:视频脚本|口播|分镜|旁白|台词|讲稿|演讲稿|演示脚本|脚本方案|不要做成视频|不用做成视频)/i;
const CODE_SCRIPT_RE = /(?:python|javascript|\bjs\b|typescript|\bts\b|bash|shell|powershell|爬虫|自动化脚本|\.py\b|\.js\b|\.ts\b|\.sh\b)/i;
const FILM_NEGATE_RE = /不要做成视频|不用做成视频|不要成片|不要视频|不做成视频/i;

export const VIDEO_MP4_GOAL_PATTERN =
  /(?:ai\s*视频|文生视频|happyhorse|\bmp4\b|成片|视频模型|10\s*秒.{0,12}视频|广告视频|video-generation|generate_video|(?:生成|制作|做)(?![\s\S]{0,16}(?:脚本|口播|分镜|旁白|台词|讲稿))[\s\S]{0,8}视频(?!脚本))/i;
export const VIDEO_HTML_EXCLUDE_PATTERN =
  /(?:Remotion\s*工程|可编辑时间轴|HTML\s*动画模板|程序化视频模板|批量渲染模板|html\s*录屏)/i;

export function isCodeScriptGoal(userGoal: string): boolean {
  const goal = String(userGoal ?? "");
  return CODE_SCRIPT_RE.test(goal) && /脚本/.test(goal);
}

export function isScriptDraftCapabilitySlug(slug: string | undefined): boolean {
  const normalized = String(slug ?? "").trim().toLowerCase();
  return (SCRIPT_DRAFT_SLUGS as readonly string[]).includes(normalized);
}

/** 文稿脚本（口播/分镜/旁白），非成片、非代码脚本。 */
export function isScriptDraftGoal(userGoal: string): boolean {
  const goal = String(userGoal ?? "");
  if (!goal || isCodeScriptGoal(goal)) return false;
  if (STORYBOARD_PACK_GOAL_PATTERN.test(goal)) return false;
  if (STORYBOARD_GOAL_PATTERN.test(goal) && !/脚本/.test(goal)) return false;
  if (FILM_NEGATE_RE.test(goal) && /脚本/.test(goal)) return true;
  return SCRIPT_DRAFT_MARK_RE.test(goal)
    || (/(?:写|生成|做|制作).{0,12}脚本/.test(goal) && /(?:视频|短视频|口播|分镜)/.test(goal));
}

/** 明确要 mp4/成片；「生成」与「视频」之间仅隔脚本词则不算。 */
export function isVideoMp4FilmGoal(userGoal: string): boolean {
  const goal = String(userGoal ?? "");
  if (!goal || FILM_NEGATE_RE.test(goal)) return false;
  if (isScriptDraftGoal(goal) && !/\bmp4\b|成片|文生视频|广告视频|generate_video/i.test(goal)) {
    return false;
  }
  return VIDEO_MP4_GOAL_PATTERN.test(goal);
}
const VIDEO_TEMPLATE_GOAL_PATTERN =
  /(?:React\s*程序化视频|Remotion|程序化视频|模板化视频|视频模板|批量渲染|render_html_video)/i;
const WEBSITE_VIDEO_GOAL_PATTERN =
  /(?:网站一键成片|官网\s*URL.*成片|website-to-video|hf-website-to-video)/i;
const WEB_3D_GOAL_PATTERN =
  /(?:3D网页|3D\s*展示网页|three\.?js|可拖拽旋转|滚动驱动动画)/i;
const VISUAL_CANVAS_GOAL_PATTERN =
  /(?:视觉画布设计|画布设计|海报|封面|poster|canvas)/i;
const BATTLECARD_GOAL_PATTERN =
  /(?:battlecard|销售\s*赋能|intel\.md|talk-track|竞品\s*battlecard)/i;
const PSEO_GOAL_PATTERN =
  /(?:programmatic\s*seo|pSEO|落地页清单|关键词矩阵|程序化\s*SEO)/i;
/** PD-SAAS-FORK 1bde3fb1: Hub/口语「内容飞轮」须命中 content_flywheel（勿落 default/docx）. */
const CONTENT_IP_GOAL_PATTERN =
  /(?:内容\s*飞轮|content[-\s]?flywheel|选题\s*[→\->]\s*长文|内容\s*IP\s*(?:启动)?\s*全案|content\s*ip|IP\s*内容矩阵)/i;

export function isStoryboardPackGoal(userGoal: string): boolean {
  return STORYBOARD_PACK_GOAL_PATTERN.test(String(userGoal ?? ""));
}

export function isBrandGeoFullCaseGoal(userGoal: string): boolean {
  return BRAND_GEO_FULL_CASE_GOAL_PATTERN.test(String(userGoal ?? ""));
}

/** Open-ended industry/market research mentioning GEO — not a pd-geo full deliverable pack. */
export function isOpenIndustryGeoResearchGoal(userGoal: string): boolean {
  const goal = String(userGoal ?? "").trim();
  if (!goal) return false;
  if (isBrandGeoFullCaseGoal(goal)) return false;
  if (GEO_DELIVERABLE_SIGNAL.test(goal)) return false;
  if (!/(?:geo|GEO|AEO)/.test(goal)) return false;
  return OPEN_INDUSTRY_GEO_RESEARCH_PATTERN.test(goal);
}

export function isHubLiteGeoCapabilitySlug(slug: string | undefined): boolean {
  const normalized = String(slug ?? "").trim().toLowerCase();
  return [
    "geo-serp-analysis",
    "geo-keyword-research",
    "geo-competitor-analysis",
    "mkt-ai-seo",
  ].includes(normalized);
}

export function isSocialMatrixGoal(userGoal: string): boolean {
  return SOCIAL_MATRIX_GOAL_PATTERN.test(String(userGoal ?? ""));
}

function envFlagEnabled(name: string, fallback: boolean): boolean {
  if (typeof process === "undefined" || !process.env) return fallback;
  const raw = process.env[name];
  if (raw == null) return fallback;
  const value = raw.trim().toLowerCase();
  if (value === "0" || value === "false" || value === "off") return false;
  if (value === "1" || value === "true" || value === "on") return true;
  return fallback;
}

/** PD-SAAS-FORK (ROG Phase 6): Tier-0 full-case profiles beat social_matrix/visual_canvas pattern hijack. */
export function isProfileTier0PriorityEnabled(): boolean {
  return envFlagEnabled("PILOTDECK_PROFILE_TIER0_PRIORITY", true);
}

const TIER0_LOCKED_PROFILE_IDS = new Set(["geo", "campaign"]);
const PPT_ROUTE_LOCKED_PROFILE_IDS = new Set(["ppt-master", "presentation-pptx"]);

export function isPptHubRouteStrictEnabled(): boolean {
  return envFlagEnabled("PILOTDECK_PPT_HUB_ROUTE_STRICT", true);
}

export function shouldUpgradeDfPptHubRoute(
  slug: string | undefined,
  userGoal: string,
): boolean {
  if (!isPptHubRouteStrictEnabled()) return false;
  const normalized = String(slug ?? "").trim().toLowerCase();
  if (normalized !== "df-ppt-generation") return false;
  return DF_PPT_HUB_UPGRADE_GOAL.test(String(userGoal ?? ""));
}

export function resolvePptHubRouteProfileId(
  slug?: string,
  userGoal?: string,
): string | undefined {
  if (!shouldUpgradeDfPptHubRoute(slug, userGoal ?? "")) return undefined;
  if (/(?:原生可编辑|ppt-master)/i.test(String(userGoal ?? ""))) return "ppt-master";
  return "ppt-master";
}

export function isPptRouteLockedProfileId(profileId: string | undefined): boolean {
  return Boolean(profileId && PPT_ROUTE_LOCKED_PROFILE_IDS.has(profileId));
}

export function isTier0LockedProfileId(profileId: string | undefined): boolean {
  return Boolean(profileId && TIER0_LOCKED_PROFILE_IDS.has(profileId));
}

const NOVA_RESEARCH_PREFIX = "nova-research-";

/** PD-SAAS-FORK: Hub Nova 调研能力 slug 前缀（preference ask_user 绕过门控）。 */
export function isNovaResearchCapabilitySlug(slug?: string): boolean {
  const normalized = String(slug ?? "").trim().toLowerCase();
  return normalized.startsWith(NOVA_RESEARCH_PREFIX);
}

function slugMatchesProfile(slug: string, profile: DeliverableProfile): boolean {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return false;
  if (profile.exactSlugs?.some((s) => normalized === s.toLowerCase())) return true;
  const prefixes = profile.slugPrefixes ?? [];
  return prefixes.some(
    (prefix) => normalized === prefix || normalized.startsWith(prefix),
  );
}

export function isExplicitContentFlywheelContractGoal(goalText: string): boolean {
  const goal = String(goalText ?? "");
  return /(?:content[-\s]?flywheel|内容飞轮)/i.test(goal)
    || /01-topics\.md|02-longform\.md|03-social-slices\.md/i.test(goal);
}

/** PD-SAAS-FORK: pure P0-1 proposal used by enforce and text-free shadow comparison. */
export function resolveCapabilityScopeV2ProposedProfile(
  slug: string | undefined,
  majorCategory?: string | null,
  userGoal?: string,
): DeliverableProfile {
  const normalizedSlug = String(slug ?? "").trim().toLowerCase();
  if (normalizedSlug === "mkt-last30days") {
    const id = isExplicitContentFlywheelContractGoal(String(userGoal ?? ""))
      ? "content_flywheel"
      : "last30days";
    return PROFILES.find((profile) => profile.id === id)!;
  }
  return resolveProfile(slug, majorCategory, userGoal);
}

export function resolveProfile(
  slug: string | undefined,
  _majorCategory?: string | null,
  userGoal?: string,
): DeliverableProfile {
  const normalizedSlug = String(slug ?? "").trim().toLowerCase();
  const goal = stripLaunchContextAndAttachmentBlocks(String(userGoal ?? "")).trim();

  if (isScriptDraftCapabilitySlug(normalizedSlug) && !isVideoMp4FilmGoal(goal)) {
    return PROFILES.find((p) => p.id === "script-md")!;
  }

  if (shouldUpgradeDfPptHubRoute(normalizedSlug, goal)) {
    return PROFILES.find((p) => p.id === "ppt-master")!;
  }

  if (normalizedSlug) {
    if (
      normalizedSlug === "nova-customer-acquisition-leads"
      || normalizedSlug.startsWith("nova-customer-acquisition")
    ) {
      return PROFILES.find((p) => p.id === "acquisition_leads")!;
    }
    if (normalizedSlug === "nova-bento-slides") {
      return PROFILES.find((p) => p.id === "nova-bento-deck")!;
    }
    if (normalizedSlug === "hf-slideshow") {
      return PROFILES.find((p) => p.id === "hyperframes-slideshow")!;
    }
    if (
      normalizedSlug.startsWith("hf-")
      && normalizedSlug !== "hf-slideshow"
    ) {
      if (
        normalizedSlug === "hf-embedded-captions"
        || normalizedSlug === "hf-talking-head-recut"
      ) {
        return PROFILES.find((p) => p.id === "hyperframes-overlay")!;
      }
      return PROFILES.find((p) => p.id === "hyperframes")!;
    }
    // PD-SAAS-FORK: image-generation 精确路由早于 visual_canvas 海报正则
    if (normalizedSlug === "image-generation") {
      return PROFILES.find((p) => p.id === "single-image")!;
    }
    // PD-SAAS-FORK: viral-article-generator 精确路由，禁 content/matrix 劫持。
    if (normalizedSlug === "viral-article-generator") {
      return PROFILES.find((p) => p.id === "viral_article_pack")!;
    }
    if (
      normalizedSlug === "mkt-last30days"
      && isCapabilityScopeV2EnforcedForSlug(normalizedSlug)
    ) {
      return resolveCapabilityScopeV2ProposedProfile(normalizedSlug, _majorCategory, goal);
    }
    for (const profile of PROFILES) {
      if (
        profile.id === "last30days"
        && !isCapabilityScopeV2EnforcedForSlug(normalizedSlug)
      ) {
        continue;
      }
      if (slugMatchesProfile(normalizedSlug, profile)) {
        return profile;
      }
    }
  }

  if (goal) {
    // PD-SAAS-FORK ES9: checklist-authority templates before broad social_matrix hijack.
    if (isChecklistAuthorityTemplatesEnabled()) {
      const checklistTemplate = detectChecklistAuthorityTemplateId(goal, normalizedSlug);
      if (checklistTemplate === "content-ip-launch") {
        return PROFILES.find((p) => p.id === "content_flywheel")!;
      }
      if (checklistTemplate === "product-launch-full") {
        return PROFILES.find((p) => p.id === "campaign")!;
      }
      if (checklistTemplate === "viral-article-pack") {
        return PROFILES.find((p) => p.id === "viral_article_pack")!;
      }
      if (checklistTemplate === "one-article-matrix") {
        return PROFILES.find((p) => p.id === "one-article-matrix")!;
      }
      if (checklistTemplate === "geo-fast-check-hub") {
        return {
          id: "default",
          slugPrefixes: [],
          recoveryKind: "default",
          bypassOrchestration: false,
          expectedExtensions: [],
        };
      }
    }
    // PD-SAAS-FORK (ROG Phase 6 F1): full-case GEO/campaign before broad social/visual patterns.
    if (isProfileTier0PriorityEnabled()) {
      if (isBrandGeoFullCaseGoal(goal)) {
        return PROFILES.find((p) => p.id === "geo")!;
      }
      if (isCampaignFullCaseGoal(goal)) {
        return PROFILES.find((p) => p.id === "campaign")!;
      }
    }
    if (BENTO_DECK_GOAL_PATTERN.test(goal) && !/(?:pptx|Office\s*原生|交\s*Office)/i.test(goal)) {
      return PROFILES.find((p) => p.id === "nova-bento-deck")!;
    }
    if (SOCIAL_MATRIX_GOAL_PATTERN.test(goal)) {
      return PROFILES.find((p) => p.id === "social_matrix")!;
    }
    if (isScriptDraftGoal(goal) && !isVideoMp4FilmGoal(goal)) {
      return PROFILES.find((p) => p.id === "script-md")!;
    }
    if (isCodeScriptGoal(goal)) {
      return {
        id: "default",
        slugPrefixes: [],
        recoveryKind: "default",
        bypassOrchestration: false,
        expectedExtensions: [],
      };
    }
    const mustDeliverSlots = parseMustDeliverClause(goal);
    const mustHtmlOnly = mustDeliverSlots.length > 0
      && mustDeliverSlots.every((slot) => slot.kind === "html" || /\.html?$/i.test(slot.pathHint ?? ""))
      && !mustDeliverSlots.some((slot) => /\.pptx?$/i.test(slot.pathHint ?? ""));
    if (
      mustHtmlOnly
      || (/HTML\s*(?:简报|摘要|报告|单页)/i.test(goal) && /须交付\s*[:：][^\n]*\.html?/i.test(goal))
    ) {
      return PROFILES.find((p) => p.id === "html")!;
    }
    if (WEBSITE_VIDEO_GOAL_PATTERN.test(goal)) {
      return PROFILES.find((p) => p.id === "website_video")!;
    }
    if (WEB_3D_GOAL_PATTERN.test(goal)) {
      return PROFILES.find((p) => p.id === "web_3d")!;
    }
    // PD-SAAS-FORK: PPT/演示 intent before visual_canvas — Hub「封面」章节不得抢绑画布槽.
    // 「不要 Word/PPT」经 stripNegated 后不得绑 ppt。
    if (PPT_GOAL_PATTERN.test(stripNegatedDeliverableMentions(goal))) {
      return PROFILES.find((p) => p.id === "ppt")!;
    }
    if (VISUAL_CANVAS_GOAL_PATTERN.test(goal) && normalizedSlug !== "image-generation") {
      return PROFILES.find((p) => p.id === "visual_canvas")!;
    }
    if (BATTLECARD_GOAL_PATTERN.test(goal)) {
      return PROFILES.find((p) => p.id === "sales_enablement")!;
    }
    if (PSEO_GOAL_PATTERN.test(goal)) {
      return PROFILES.find((p) => p.id === "programmatic_seo")!;
    }
    if (CONTENT_IP_GOAL_PATTERN.test(goal) && !SOCIAL_MATRIX_GOAL_PATTERN.test(goal)) {
      return PROFILES.find((p) => p.id === "content_flywheel")!;
    }
    if (isCampaignFullCaseGoal(goal)) {
      return PROFILES.find((p) => p.id === "campaign")!;
    }
    if (isVideoMp4FilmGoal(goal) && !VIDEO_HTML_EXCLUDE_PATTERN.test(goal)) {
      return PROFILES.find((p) => p.id === "video-mp4")!;
    }
    // PD-SAAS-FORK Showcase OD：定价卡片/仪表盘等 Hub 文案无 slug 时仍绑 design→index.html 槽（成果落袋）。
    if (/(?:定价卡片|Pricing\s*Card|(?:后台管理)?仪表盘|\bdashboard\b|页面组件)/i.test(goal)) {
      return PROFILES.find((p) => p.id === "design")!;
    }
    // PD-SAAS-FORK a51fa91d: 获客/线索表勿被「报告」误绑 research。
    if (/(?:潜在客户|智能获客|线索表|leads-report|nova-customer-acquisition)/i.test(goal)) {
      return PROFILES.find((p) => p.id === "acquisition_leads")!;
    }
    // PD-SAAS-FORK 0731: lite 须交付单 md 勿回退 research 三件套 profile。
    const liteMustDeliver = /须交付\s*[:：]/i.test(goal)
      && /\.md\b/i.test(goal)
      && !/\.docx\b|01-sources-and-synthesis|03-report-body/i.test(goal);
    // PD-SAAS-FORK: 「正式调研报告 + Word」须走 research 而非 docx 泛型 brief/document 槽。
    if (
      detectResearchReportTurn(goal)
      && !isHubLiteGeoCapabilitySlug(normalizedSlug)
      && !liteMustDeliver
      && !mustHtmlOnly
    ) {
      return PROFILES.find((p) => p.id === "research")!;
    }
    if (
      RESEARCH_GOAL_PATTERN.test(goal)
      && !isHubLiteGeoCapabilitySlug(normalizedSlug)
      && !liteMustDeliver
      && !mustHtmlOnly
    ) {
      return PROFILES.find((p) => p.id === "research")!;
    }
    if (DOCX_GOAL_PATTERN.test(goal)) {
      return PROFILES.find((p) => p.id === "docx")!;
    }
    if (GEO_GOAL_PATTERN.test(goal) && !isOpenIndustryGeoResearchGoal(goal)) {
      return PROFILES.find((p) => p.id === "geo")!;
    }
    if (HTML_GOAL_PATTERN.test(goal)) {
      return PROFILES.find((p) => p.id === "html")!;
    }
    if (STORYBOARD_PACK_GOAL_PATTERN.test(goal) || STORYBOARD_GOAL_PATTERN.test(goal)) {
      return PROFILES.find((p) => p.id === "storyboard")!;
    }
    if (VIDEO_TEMPLATE_GOAL_PATTERN.test(goal)) {
      return PROFILES.find((p) => p.id === "video_template")!;
    }
  }

  return {
    id: "default",
    slugPrefixes: [],
    recoveryKind: "default",
    bypassOrchestration: false,
    expectedExtensions: [],
  };
}

export function isPptDeliverableProfile(slug?: string, majorCategory?: string | null, userGoal?: string): boolean {
  return resolveProfile(slug, majorCategory, userGoal).recoveryKind === "ppt";
}

export function shouldBypassOrchestrationForProfile(slug?: string, majorCategory?: string | null): boolean {
  return resolveProfile(slug, majorCategory).bypassOrchestration;
}

export function listDeliverableProfiles(): readonly DeliverableProfile[] {
  return PROFILES;
}

export function resolveGoalLoopTier(profile: DeliverableProfile): "L1" | "L2" | "L3" {
  if (profile.goalLoopTier) return profile.goalLoopTier;
  if (profile.acceptanceTier === "L2") return "L2";
  if (profile.id === "default") return "L1";
  return profile.acceptanceTier === "L0" ? "L1" : "L2";
}
