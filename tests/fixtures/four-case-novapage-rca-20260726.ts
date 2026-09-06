// PD-SAAS-FORK P0′: novapage four-case RCA replay fixtures (2026-07-26).

export type FourCaseNovapageFixture = {
  caseId: string;
  userGoal: string;
  capabilitySlug?: string;
  expectProfileId?: string;
  minSlots: number;
  forbiddenPathHints: string[];
  requiredPathHints: string[];
};

export const FOUR_CASE_NOVAPAGE_FIXTURES: FourCaseNovapageFixture[] = [
  {
    caseId: "novapage-matrix",
    userGoal: [
      "写一篇【www.novapage.online】深度长文，再 humanize 成五平台口吻，写入系统分配任务目录。",
      "直接开始做，做完告诉我文件在哪。",
      "",
      "标准成果清单：",
      "1. article.md",
      "2. zhihu.md",
      "3. xiaohongshu.md",
      "4. wechat.md",
      "5. douyin.md",
      "6. bilibili.md",
    ].join("\n"),
    expectProfileId: "one-article-matrix",
    minSlots: 7,
    forbiddenPathHints: ["01-topics.md", "office_export", "research-report.docx"],
    requiredPathHints: ["article.md", "zhihu.md", "wechat.md"],
  },
  {
    caseId: "novapage-campaign",
    userGoal: [
      "帮我做【www.novapage.online】的品牌传播 campaign 全案，按阶段一次规划执行，每阶段产出写入系统分配任务目录。",
      "直接开始做，做完告诉我文件在哪。",
      "",
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
    forbiddenPathHints: ["research-report.docx", "office_export_docx", "research.docx"],
    requiredPathHints: ["research-report.md", "campaign-brief.docx"],
  },
  {
    caseId: "novapage-launch",
    userGoal: [
      "帮我为【www.novapage.online】做一套上市全案，按以下阶段一次性规划并执行，每阶段产出存系统分配的任务目录。",
      "直接开始做，做完告诉我文件在哪。",
      "",
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
    forbiddenPathHints: ["social-matrix/", "research.docx", "office_export"],
    requiredPathHints: ["03-social-slices.md", "landing.html"],
  },
  {
    caseId: "novapage-competitor",
    userGoal: [
      "用「Nova-竞品对标」对【海绵宝宝】做竞品全量对标：竞品清单、维度对比与突围策略。",
      "须交付：competitive-brief.md、competitor-analysis.html",
      "写入系统分配任务目录。直接开始做，做完告诉我文件在哪。",
    ].join("\n"),
    minSlots: 2,
    forbiddenPathHints: ["office_export"],
    requiredPathHints: ["competitive-brief.md", "competitor-analysis.html"],
  },
];
