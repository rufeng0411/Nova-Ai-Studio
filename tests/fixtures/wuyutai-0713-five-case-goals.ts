/** 2026-07-13 吴裕泰五案 Hub try-prompt 原文（SDM 编译 fixture） */
export const WUYUTAI_GEO_SERP_GOAL =
  "用「AI 搜索格局」帮我：【吴裕泰】。须交付：serp-analysis.md、serp-analysis.html（与 serp-analysis.md 同步的可视化报告）。写入系统分配任务目录。";

export const WUYUTAI_GEO_KEYWORD_GOAL =
  "用「GEO挖词」为【吴裕泰】整理 AI 搜索关键词：20 个核心词与用户常问句式。须交付：keywords.md（核心词与用户问句）、keywords.html（与 keywords.md 同步的可视化报告）。写入系统分配任务目录。";

export const WUYUTAI_GEO_COMPETITOR_GOAL = [
  "用「GEO竞品分析」对比【吴裕泰】与【2-3 家竞品】在 AI 搜索中的可见度，输出差距与行动清单。须交付：geo-competitor-report.md（差距与行动清单）、geo-competitor-report.html（与 geo-competitor-report.md 同步的可视化报告）、competitor-visibility.md（提及对比摘要）、competitor-visibility.html（与 competitor-visibility.md 同步的可视化报告）。",
  "",
  "标准成果清单：",
  "1. geo-competitor-report.md（差距与行动清单）",
  "2. geo-competitor-report.html（与 geo-competitor-report.md 同步的可视化报告）",
  "3. competitor-visibility.md（提及对比摘要）",
  "4. competitor-visibility.html（与 competitor-visibility.md 同步的可视化报告）写入系统分配任务目录。",
].join("\n");

export const WUYUTAI_MKT_AI_SEO_GOAL = [
  "用「AI 可见度快检」给【吴裕泰】做一轮 AI 搜索可见度快检，列出优先改进项。须交付：audit-checklist.md、audit-checklist.html（与 audit-checklist.md 同步的可视化报告）、competitor-visibility.md、competitor-visibility.html（与 competitor-visibility.md 同步的可视化报告）。",
  "",
  "标准成果清单：",
  "1. audit-checklist.md",
  "2. audit-checklist.html（与 audit-checklist.md 同步的可视化报告）",
  "3. competitor-visibility.md",
  "4. competitor-visibility.html（与 competitor-visibility.md 同步的可视化报告）写入系统分配任务目录。",
].join("\n");

export const WUYUTAI_INDUSTRY_GEO_GOAL =
  "深度调查，中国大陆geo行业现状，发展，客户，舆情，评价等";

export const WUYUTAI_TASK_RESUME_WRAP = [
  '<task-resume context="infra_interrupt">',
  "  <last_turn_id>turn-1</last_turn_id>",
  `  <user_goal>${WUYUTAI_GEO_SERP_GOAL}</user_goal>`,
  "  <instruction>从上次未完成步骤继续，勿重复已完成交付物</instruction>",
  "</task-resume>",
].join("\n");
