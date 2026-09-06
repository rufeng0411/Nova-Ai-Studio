/**
 * PD-SAAS-FORK: anonymized structural fixtures from 2026-07-17 cursor-session HTML exports.
 * Extends four-line-0717-cases.ts — eight additional real-machine scenarios.
 */
import type { FourLine0717Invariant } from "./four-line-0717-cases.js";
import { assertCompletionInvariant } from "./four-line-0717-cases.js";

export type FourLine0717CursorCaseId =
  | "video-3-step"
  | "market-add-html"
  | "acquisition-research-video"
  | "10-page-slides"
  | "ipo-campaign"
  | "geo-competitor-4-slot"
  | "campaign-6-slot"
  | "brainstorm-chat-first";

export type FourLineExportKpiId =
  | "slot_collision"
  | "hash_mismatch"
  | "literal_placeholder_path"
  | "snapshot_truncated"
  | "nonterminal_export_as_final"
  | "snapshot_inconclusive";

export type FourLine0717CursorInvariant = FourLine0717Invariant & {
  /** Healthy terminal export must keep these KPIs at zero */
  forbidKpis?: FourLineExportKpiId[];
  /** Terminal snapshot banner expected when task truly complete */
  expectTerminalSnapshot?: boolean;
  /** Folder snapshot unreliable (e.g. node_modules exhausted scan budget) */
  expectSnapshotInconclusive?: boolean;
  /** Pure chat — no frozen deliverable contract */
  noDeliverableContract?: boolean;
  /** Hub major_category when applicable */
  majorCategory?: string;
  /** Exact capability slug when applicable */
  capabilitySlug?: string;
  /** Minimum distinct slot bindings in terminal export */
  minUniqueSlotBindings?: number;
};

export const FOUR_LINE_0717_CURSOR_CASES: Record<FourLine0717CursorCaseId, {
  label: string;
  userGoalSnippet: string;
  invariant: FourLine0717CursorInvariant;
}> = {
  "video-3-step": {
    label: "三步演示视频（脚本+分镜+成片）",
    userGoalSnippet:
      "用 Seedance 做 10 秒产品演示视频，须交付：1. 视频脚本 .md 2. 分镜说明 .md 3. 成片 .mp4，写入系统分配任务目录",
    invariant: {
      requiredSlots: 3,
      capabilitySlug: "hf-video-script",
      forbiddenProfileIds: ["html", "visual_canvas"],
      primaryBasenames: [".mp4", "script", "storyboard"],
      rejectPseudoPaths: ["presentation.html", "render_html_video"],
      forbidPassedWithIncomplete: true,
      expectTerminalSnapshot: true,
      forbidKpis: [
        "literal_placeholder_path",
        "nonterminal_export_as_final",
        "hash_mismatch",
      ],
      minUniqueSlotBindings: 3,
    },
  },
  "market-add-html": {
    label: "Nova 市场报告 ADD HTML",
    userGoalSnippet:
      "Nova-行业市场…industry-market-report.md…再给我 HTML 版本，写入系统分配任务目录",
    invariant: {
      requiredSlots: 2,
      primaryBasenames: ["industry-market-report.md", ".html"],
      rejectPseudoPaths: ["accumulated--html", "accumulated--md"],
      forbidPassedWithIncomplete: true,
      forbiddenSlotIds: ["verified_2_industry_market_report_docx"],
      forbidKpis: ["hash_mismatch", "literal_placeholder_path"],
      expectTerminalSnapshot: true,
    },
  },
  "acquisition-research-video": {
    label: "收购调研 HTML 报告 + 20 秒视频",
    userGoalSnippet:
      "调研 Cursor 被马斯克收购后的正负影响…产出带图表 HTML 报告，并生成 20 秒 Remotion 视频",
    invariant: {
      requiredSlots: 2,
      primaryBasenames: [".html", ".mp4"],
      forbiddenSlotIds: ["brief", "index", "video_part1", "video-part1"],
      forbiddenProfileIds: ["research"],
      rejectPseudoPaths: ["brief.md", "index.html", "video-part1.mp4"],
      forbidPassedWithIncomplete: true,
      forbidKpis: ["nonterminal_export_as_final", "literal_placeholder_path"],
      minUniqueSlotBindings: 2,
    },
  },
  "10-page-slides": {
    label: "Nova 美学幻灯 10 页",
    userGoalSnippet:
      "用「Nova-美学幻灯」把【Cursor 产品科学图解】做成【10】页【16:9】，slide-NN 逐页 PNG + slide-manifest.json",
    invariant: {
      requiredSlots: 10,
      capabilitySlug: "nova-ppt-aesthetic-slides",
      primaryBasenames: ["slide-01.png", "slide-10.png", "slide-manifest.json"],
      rejectPseudoPaths: ["slide-NN.png", "slide-NN", "slide-[N]"],
      forbidPassedWithIncomplete: true,
      expectSnapshotInconclusive: true,
      forbidKpis: ["literal_placeholder_path"],
    },
  },
  "ipo-campaign": {
    label: "上市全案 Campaign 7 槽",
    userGoalSnippet:
      "品牌上市传播全案…标准成果清单：1.调研 2.brief 3.主视觉 4.社媒 5.新闻稿 6.监测 7.路演材料",
    invariant: {
      requiredSlots: 7,
      forbiddenSlotIds: ["stage_website", "stage_plan_html"],
      primaryBasenames: [
        "research-report.md",
        "campaign-brief.docx",
        "key-visual",
        "social",
        "press-release",
        "monitoring",
        "roadshow",
      ],
      rejectPseudoPaths: ["artifacts/geo/", "nNext.js"],
      forbidPassedWithIncomplete: true,
      forbidKpis: ["nonterminal_export_as_final", "slot_collision"],
    },
  },
  "geo-competitor-4-slot": {
    label: "GEO 竞品分析 4 槽",
    userGoalSnippet:
      "用「GEO竞品分析」对比【我的品牌】与【2-3 家竞品】…须交付 geo-competitor-report.md/html、competitor-visibility.md/html",
    invariant: {
      requiredSlots: 4,
      capabilitySlug: "geo-competitor-analysis",
      primaryBasenames: [
        "geo-competitor-report.md",
        "geo-competitor-report.html",
        "competitor-visibility.md",
        "competitor-visibility.html",
      ],
      rejectPseudoPaths: ["accumulated--md", "accumulated--html"],
      forbidPassedWithIncomplete: true,
      forbidKpis: ["slot_collision", "hash_mismatch"],
      minUniqueSlotBindings: 4,
    },
  },
  "campaign-6-slot": {
    label: "Campaign 显式 6 项（世界杯主题）",
    userGoalSnippet:
      "帮我做【雷蛇】世界杯主题品牌传播 campaign 全案。\n标准成果清单：\n1. 调研 .md\n2. brief .docx\n3. 海报\n4. 社媒包\n5. 草稿编号\n6. 监测模板",
    invariant: {
      requiredSlots: 6,
      forbiddenSlotIds: ["stage_website", "stage_plan_html"],
      primaryBasenames: [
        "research-report.md",
        "campaign-brief.docx",
        "key-visual-poster.png",
        "03-social-slices.md",
        "draft-status.md",
        "monitoring-template.md",
      ],
      rejectPseudoPaths: [],
      forbidPassedWithIncomplete: true,
      maxDuplicateUserMessages: 0,
      forbidKpis: ["slot_collision", "nonterminal_export_as_final"],
    },
  },
  "brainstorm-chat-first": {
    label: "脑爆纯聊天（无成果合同）",
    userGoalSnippet:
      "脑爆一下 SaaS 定价策略，先聊思路，不要搜资料，也不要生成任何文件",
    invariant: {
      requiredSlots: 0,
      noDeliverableContract: true,
      majorCategory: "brainstorming",
      primaryBasenames: [],
      rejectPseudoPaths: ["artifacts/", "brief.md", "index.html"],
      forbidKpis: [
        "slot_collision",
        "hash_mismatch",
        "literal_placeholder_path",
        "nonterminal_export_as_final",
      ],
    },
  },
};

export { assertCompletionInvariant };

export function assertKpiInvariant(
  kpis: Partial<Record<FourLineExportKpiId, number>>,
  forbidden: FourLineExportKpiId[] | undefined,
): void {
  for (const id of forbidden ?? []) {
    const value = kpis[id] ?? 0;
    if (value > 0) {
      throw new Error(`forbidden KPI ${id}=${value}`);
    }
  }
}
