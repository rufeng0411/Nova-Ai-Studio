/**
 * PD-SAAS-FORK: anonymized structural fixtures from 2026-07-17 enhanced HTML exports.
 * No user PII or full transcript bodies — only invariants for regression gates.
 */

export type FourLine0717CaseId =
  | "campaign-worldcup-razer-6slot"
  | "image-generation-poster-916"
  | "geo-audit-html-pdf-add"
  | "nova-market-report-md-only"
  | "argentina-spain-prediction-report"
  | "spain-squad-html-report"
  | "argentina-squad-html-report";

export type FourLine0717Invariant = {
  /** Required slot count after contract freeze */
  requiredSlots: number;
  /** Must not appear as required slots */
  forbiddenSlotIds?: string[];
  /** Profile must not bind to this id */
  forbiddenProfileIds?: string[];
  /** Capability slug when applicable */
  capabilitySlug?: string;
  /** Primary deliverable basename patterns */
  primaryBasenames: string[];
  /** Must not treat as deliverable paths */
  rejectPseudoPaths: string[];
  /** complete only when done === total */
  forbidPassedWithIncomplete?: boolean;
  /** Export/message invariants */
  maxDuplicateUserMessages?: number;
  /** Single-image must not require canvas manifest */
  forbidCanvasManifest?: boolean;
};

export const FOUR_LINE_0717_CASES: Record<FourLine0717CaseId, {
  label: string;
  userGoalSnippet: string;
  invariant: FourLine0717Invariant;
}> = {
  "campaign-worldcup-razer-6slot": {
    label: "Campaign 显式6项（产品名含世界杯）",
    userGoalSnippet: "世界杯版本雷蛇…标准成果清单：1.调研 2.brief 3.海报…",
    invariant: {
      requiredSlots: 6,
      forbiddenSlotIds: ["stage_website", "stage_plan_html"],
      forbiddenProfileIds: [],
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
    },
  },
  "image-generation-poster-916": {
    label: "image-generation 单图海报 9:16",
    userGoalSnippet: "image-generation…阿根廷VS西班牙…海报…9：16",
    invariant: {
      requiredSlots: 1,
      capabilitySlug: "image-generation",
      forbiddenProfileIds: ["visual_canvas"],
      primaryBasenames: ["world-cup-final-poster", ".png"],
      rejectPseudoPaths: ["canvas-manifest.json", "layout.md"],
      forbidCanvasManifest: true,
      forbidPassedWithIncomplete: true,
    },
  },
  "geo-audit-html-pdf-add": {
    label: "GEO 审计 ADD HTML+PDF",
    userGoalSnippet: "全球网络AI搜索可见度审计…转为 HTML…还有 PDF",
    invariant: {
      requiredSlots: 4,
      primaryBasenames: [
        "世界杯2026-全球网络AI搜索可见度审计报告.md",
        "验证问句库.json",
        ".html",
        ".pdf",
      ],
      rejectPseudoPaths: ["accumulated--md", "accumulated--html"],
      forbidPassedWithIncomplete: true,
      maxDuplicateUserMessages: 0,
    },
  },
  "nova-market-report-md-only": {
    label: "Nova 行业市场 MD 单槽",
    userGoalSnippet: "Nova-行业市场…世界杯决赛经济价值…industry-market-report.md",
    invariant: {
      requiredSlots: 1,
      primaryBasenames: ["industry-market-report.md"],
      rejectPseudoPaths: [],
      forbiddenSlotIds: ["verified_2_industry_market_report_docx"],
    },
  },
  "argentina-spain-prediction-report": {
    label: "赛前预测报告（非 GEO keyword）",
    userGoalSnippet: "深度挖掘阿根廷VS西班牙…深度预测参考报告",
    invariant: {
      requiredSlots: 1,
      forbiddenProfileIds: ["geo_keyword"],
      primaryBasenames: ["index.html", "wcfinal-deep-report"],
      rejectPseudoPaths: ["www.go", "keywords.md", "keywords.html"],
      forbidPassedWithIncomplete: true,
    },
  },
  "spain-squad-html-report": {
    label: "西班牙阵容 HTML 报告",
    userGoalSnippet: "西班牙的2026世界杯球员及教练名单…HTML",
    invariant: {
      requiredSlots: 1,
      primaryBasenames: ["spain-worldcup-2026-report/index.html"],
      rejectPseudoPaths: [],
    },
  },
  "argentina-squad-html-report": {
    label: "阿根廷阵容 HTML 报告",
    userGoalSnippet: "阿根廷的2026世界杯球员及教练名单…HTML",
    invariant: {
      requiredSlots: 1,
      primaryBasenames: ["argentina-worldcup-2026-report/index.html"],
      rejectPseudoPaths: [".meta-tag.go", "然后考虑是否需要额外生成.md"],
      forbidPassedWithIncomplete: true,
    },
  },
};

export function assertCompletionInvariant(input: {
  completionState?: string;
  acceptanceStatus?: string;
  requiredDone: number;
  requiredTotal: number;
}): void {
  const complete =
    input.completionState === "complete"
    || (input.acceptanceStatus === "passed" && input.requiredDone === input.requiredTotal);
  if (input.acceptanceStatus === "passed" && input.requiredDone < input.requiredTotal) {
    throw new Error(
      `passed with incomplete slots: ${input.requiredDone}/${input.requiredTotal}`,
    );
  }
  if (input.completionState === "complete" && input.requiredDone !== input.requiredTotal) {
    throw new Error(
      `complete without all required slots: ${input.requiredDone}/${input.requiredTotal}`,
    );
  }
  if (!complete && input.acceptanceStatus === "passed" && input.requiredDone < input.requiredTotal) {
    throw new Error("false complete");
  }
}
