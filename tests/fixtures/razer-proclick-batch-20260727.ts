// PD-SAAS-FORK: Razer Pro Click V2 seven-case batch replay fixtures (2026-07-27).

export type RazerProclickBatchFixture = {
  caseId: string;
  sessionIdSuffix: string;
  userGoal: string;
  capabilitySlug?: string;
  expectProfileId?: string;
  minSlots?: number;
  maxSlots?: number;
  forbiddenPathHints: string[];
  requiredPathHints: string[];
  maxRepairSteps?: number;
  chatFirst?: boolean;
};

export const RAZER_GEO_KEYWORD_POLLUTED_GOAL =
  "用「GEO挖词」为【雷蛇 Pro Click V2】整理 AI 搜索关键词：20 个核心词与用户常问句式。须交付：keywords.md（核心词与用户问句）、keywords.html（与 keywords.md 同步的可视化报告）。写入系统分配任务目录。";

export const RAZER_GEO_KEYWORD_VERIFIED = [
  "artifacts/task-20260727-razer01/雷蛇 Pro Click V2 GEO 关键词研究.md",
  "artifacts/task-20260727-razer01/雷蛇 Pro Click V2 GEO 关键词研究.html",
];

export const RAZER_GEO_FAST_CHECK_NL_GOAL =
  "对【雷蛇 Pro Click V2】官网产品页做 GEO 快检+关键词表+优化清单，须交付 audit-checklist.md、keywords.md、optimized.md、report.html。写入系统分配任务目录。";

export const RAZER_HF_CONSTRAINT_PASTE_GOAL = [
  "用「HTML 代码做视频」为【雷蛇 Pro Click V2】做一支 30 秒产品宣传视频（16:9）。",
  "须交付：promo.mp4。写入系统分配任务目录。",
  "",
  "【硬性约束】",
  "1. 禁止调用 DeepSeek V4 Gateway 分镜",
  "2. 必须调用 render_hyperframes(project_dir=hf-project)",
  "3. 分镜须含灌篮高手风格参考",
  "",
  "标准成果清单：",
  "1. promo.mp4",
].join("\n");

export const RAZER_PROCLICK_BATCH_FIXTURES: RazerProclickBatchFixture[] = [
  {
    caseId: "razer-geo-fast-check-nl",
    sessionIdSuffix: "83bed658",
    userGoal: RAZER_GEO_FAST_CHECK_NL_GOAL,
    expectProfileId: undefined,
    minSlots: 4,
    forbiddenPathHints: ["写入系统分配"],
    requiredPathHints: ["audit-checklist.md", "keywords.md", "optimized.md", "report.html"],
  },
  {
    caseId: "razer-geo-keyword-glued",
    sessionIdSuffix: "1cb993e4",
    userGoal: "用「GEO挖词」为【雷蛇 Pro Click V2】整理 AI 搜索关键词：20 个核心词与用户常问句式。须交付：keywords.md（核心词与用户问句）、keywords.html（与 keywords.md 同步的可视化报告）。\n\n标准成果清单：\n1. keywords.md\n2. keywords.html写入系统分配任务目录。",
    capabilitySlug: "geo-keyword-research",
    expectProfileId: "geo_keyword",
    minSlots: 2,
    maxSlots: 2,
    forbiddenPathHints: ["（与 keywords", "写入系统分配任务目录.html", "HTML 综合报告"],
    requiredPathHints: ["keywords.md", "keywords.html"],
  },
  {
    caseId: "razer-hf-constraint-paste",
    sessionIdSuffix: "89bff28d",
    userGoal: RAZER_HF_CONSTRAINT_PASTE_GOAL,
    capabilitySlug: "hf-hyperframes",
    expectProfileId: "hyperframes",
    minSlots: 1,
    maxSlots: 1,
    maxRepairSteps: 50,
    forbiddenPathHints: ["DeepSeek", "灌篮高手", "Gateway", "render_hyperframes"],
    requiredPathHints: ["promo.mp4"],
  },
  {
    caseId: "razer-launch",
    sessionIdSuffix: "23d921fe",
    userGoal: [
      "帮我为【雷蛇 Pro Click V2】做一套上市全案，按以下阶段一次性规划并执行，每阶段产出存系统分配的任务目录。",
      "标准成果清单：",
      "1. research.md",
      "2. gtm-strategy.md",
      "3. press-release.docx",
      "4. landing.html",
      "5. 03-social-slices.md",
      "6. go-live-checklist.md",
      "7. draft-status.md",
    ].join("\n"),
    capabilitySlug: "product-launch-full",
    expectProfileId: "campaign",
    minSlots: 7,
    forbiddenPathHints: ["keywords.html（", "写入系统分配任务目录.html"],
    requiredPathHints: ["landing.html", "03-social-slices.md"],
  },
  {
    caseId: "razer-research",
    sessionIdSuffix: "86b31acf",
    userGoal: [
      "用「Nova-产品用研」为【雷蛇 Pro Click V2】写产品用户研究报告，按固定八章展开。",
      "须交付：product-user-research.md。写入系统分配任务目录。",
    ].join("\n"),
    capabilitySlug: "nova-research-product-user",
    minSlots: 1,
    forbiddenPathHints: ["（核心词", "写入系统分配"],
    requiredPathHints: ["product-user-research.md"],
  },
  {
    caseId: "razer-campaign",
    sessionIdSuffix: "442a466e",
    userGoal: [
      "帮我做【雷蛇 Pro Click V2】的品牌传播 campaign 全案，按阶段一次规划执行，每阶段产出写入系统分配任务目录。",
      "标准成果清单：",
      "1. research-report.md",
      "2. campaign-brief.docx",
      "3. key-visual-poster.png",
      "4. copy-matrix.md",
      "5. draft-status.md",
      "6. monitoring-template.md",
    ].join("\n"),
    expectProfileId: "campaign",
    minSlots: 6,
    forbiddenPathHints: ["research-report.docx", "office_export"],
    requiredPathHints: ["research-report.md", "campaign-brief.docx"],
  },
  {
    caseId: "razer-brainstorm",
    sessionIdSuffix: "ec90be87",
    userGoal: "用「结构化脑暴」围绕【雷蛇 Pro Click V2 办公场景】带我做一轮分步头脑风暴，最后整理成点子清单。",
    capabilitySlug: "brainstorm-structured",
    chatFirst: true,
    forbiddenPathHints: ["keywords.md", "promo.mp4"],
    requiredPathHints: [],
    maxSlots: 0,
  },
  {
    caseId: "razer-geo-keyword",
    sessionIdSuffix: "df49649d",
    userGoal: RAZER_GEO_KEYWORD_POLLUTED_GOAL,
    capabilitySlug: "geo-keyword-research",
    expectProfileId: "geo_keyword",
    minSlots: 2,
    maxRepairSteps: 40,
    forbiddenPathHints: ["（与 keywords", "写入系统分配任务目录.html", "keywords.html（"],
    requiredPathHints: ["keywords.md", "keywords.html"],
  },
  {
    caseId: "razer-hf-video",
    sessionIdSuffix: "b1357a6e",
    userGoal: [
      "用「HTML 代码做视频」为【雷蛇 Pro Click V2】做一支 15 秒产品宣传视频（16:9）。",
      "须交付：promo.mp4。写入系统分配任务目录。",
    ].join("\n"),
    capabilitySlug: "hf-hyperframes",
    minSlots: 1,
    maxRepairSteps: 50,
    forbiddenPathHints: ["DeepSeek", "灌篮高手", "下一代推理模型"],
    requiredPathHints: ["promo.mp4"],
  },
  {
    caseId: "razer-visual-canvas",
    sessionIdSuffix: "9583c600",
    userGoal: [
      "用设计画布为【雷蛇 Pro Click V2】做一张主视觉海报，须使用官网官方产品素材，禁止 AI 生图冒充官图。",
      "须交付：key-visual-poster.png。写入系统分配任务目录。",
    ].join("\n"),
    minSlots: 1,
    forbiddenPathHints: ["img-placeholder"],
    requiredPathHints: ["key-visual-poster.png", ".png"],
  },
];
