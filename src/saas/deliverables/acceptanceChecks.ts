// PD-SAAS-FORK: final deliverable acceptance checks (hard defects only).
import path from "node:path";
import type { AcceptanceArtifactKind } from "./acceptanceArtifactKind.js";
export type { AcceptanceArtifactKind } from "./acceptanceArtifactKind.js";
import {
  hasBrokenChartHtml,
  hasIndefiniteLoadingHtml,
  isLikelyFormalHtml as sharedIsLikelyFormalHtml,
} from "../../../ui/shared/htmlDeliverableRules.mjs";
import {
  isUndersizedBinaryDeliverable,
  isValidBinaryDeliverableHeader,
} from "../../../ui/shared/deliverableBinaryRules.mjs";
import { isFakeDocxPath, isPlaceholderVisualPath } from "./officeExtensionStrictCore.js";
import { htmlFormalAcceptanceMode, officeExtensionStrictMode } from "../resilience/stabilityFlags.js";
import { extractRequestedCount } from "./acceptanceRequestCount.js";
export { extractRequestedCount } from "./acceptanceRequestCount.js";

export type AcceptanceTier = "L0" | "L1" | "L2";

export type AcceptanceCandidate = {
  path: string;
  kind?: AcceptanceArtifactKind;
  exists: boolean;
  sizeBytes: number;
  textPreview?: string;
  /** PD-SAAS-FORK P0-7: optional measured carrier metadata for exact quality assertions. */
  pageCount?: number;
  durationSeconds?: number;
  binaryHeader?: string;
};

export type AcceptanceExpected = {
  kind?: AcceptanceArtifactKind;
  count?: number;
};

export type AcceptanceFailureReason =
  | "missing"
  | "broken"
  | "degenerate"
  | "low_quality"
  | "invalid_html"
  | "placeholder"
  | "count_insufficient"
  | "count_excess"
  | "name_mismatch"
  | "type_mismatch"
  | "composite_quality";

export type AcceptanceFailure = {
  reason: AcceptanceFailureReason;
  message: string;
  path?: string;
  expected?: number | string;
  actual?: number | string;
};

export function inferAcceptanceKind(filePath: string): AcceptanceArtifactKind {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
    case ".htm":
      return "html";
    case ".pptx":
      return "pptx";
    case ".docx":
      return "docx";
    case ".pdf":
      return "pdf";
    case ".md":
    case ".markdown":
      return "markdown";
    case ".csv":
    case ".xlsx":
      return "spreadsheet";
    case ".png":
    case ".jpg":
    case ".jpeg":
    case ".webp":
    case ".gif":
      return "image";
    case ".mp4":
    case ".webm":
    case ".mov":
      return "video";
    default:
      return "file";
  }
}

export function inferExpectedFromGoal(userGoal: string): AcceptanceExpected {
  const goal = String(userGoal || "");
  const count = extractRequestedCount(goal);
  if (/(?:mp4|MP4|视频|成片|render_html_video|render_hyperframes|HTML\s*代码做视频|HyperFrames)/i.test(goal)) return { kind: "video", count };
  if (/(?:pptx|PPTX|ppt|PPT|幻灯|演示)/.test(goal)) return { kind: "pptx", count };
  if (/(?:docx|word|Word|文档)/i.test(goal)) return { kind: "docx", count };
  if (/(?:pdf|PDF)/.test(goal)) return { kind: "pdf", count };
  if (/(?:html|HTML|网页|落地页|官网|页面)/.test(goal)) return { kind: "html", count };
  if (/(?:md|markdown|报告|调研|简报)/i.test(goal)) return { kind: "markdown", count };
  if (/(?:连续性分镜包|continuity\s*分镜|分镜包|bible|镜头卡|交接矩阵|handoff)/i.test(goal)) {
    return { kind: "markdown", count: 3 };
  }
  return { count };
}

export function isLikelyFormalHtml(content: string): boolean {
  return sharedIsLikelyFormalHtml(content);
}

export function countActualUnits(candidate: AcceptanceCandidate): number | undefined {
  const text = candidate.textPreview ?? "";
  if (!text) return undefined;
  if ((candidate.kind ?? inferAcceptanceKind(candidate.path)) === "html") {
    const articleCount = text.match(/<article\b/gi)?.length ?? 0;
    const sectionCount = text.match(/<section\b/gi)?.length ?? 0;
    const semanticClassCount = text.match(/class=["'][^"']*(?:slide|page|section|screen|panel|scene)[^"']*["']/gi)?.length ?? 0;
    const dataPageCount = text.match(/\bdata-(?:page|section|screen|panel)=/gi)?.length ?? 0;
    return Math.max(articleCount, sectionCount, semanticClassCount, dataPageCount) || 1;
  }
  return undefined;
}

export function evaluateCandidate(candidate: AcceptanceCandidate): AcceptanceFailure[] {
  const kind = candidate.kind ?? inferAcceptanceKind(candidate.path);
  const failures: AcceptanceFailure[] = [];
  if (!candidate.exists) {
    failures.push({
      reason: "missing",
      message: `${candidate.path} 不存在。`,
      path: candidate.path,
    });
    return failures;
  }
  if (candidate.sizeBytes <= 0) {
    failures.push({
      reason: "broken",
      message: `${candidate.path} 是空文件。`,
      path: candidate.path,
    });
    return failures;
  }
  // PD-SAAS-FORK speed-completion: formal/chart/Loading only veto in enforce.
  if (kind === "html" && htmlFormalAcceptanceMode() === "enforce") {
    if (!isLikelyFormalHtml(candidate.textPreview ?? "")) {
      failures.push({
        reason: "invalid_html",
        message: `${candidate.path} 无法作为正式网页交付。`,
        path: candidate.path,
      });
    }
    if (hasBrokenChartHtml(candidate.textPreview ?? "")) {
      failures.push({
        reason: "invalid_html",
        message: `${candidate.path} 声明包含图表，但缺少可渲染的图表容器。`,
        path: candidate.path,
      });
    }
    if (hasIndefiniteLoadingHtml(candidate.textPreview ?? "")) {
      failures.push({
        reason: "invalid_html",
        message: `${candidate.path} 可能停留在 Loading 状态，无法作为可打开网页交付。`,
        path: candidate.path,
      });
    }
  }
  if (kind === "markdown" && isPlaceholderMarkdown(candidate.textPreview ?? "")) {
    failures.push({
      reason: "placeholder",
      message: `${candidate.path} 仍是占位模板。`,
      path: candidate.path,
    });
  }
  if (officeExtensionStrictMode() === "enforce") {
    if (kind === "docx" && isFakeDocxPath(candidate.path)) {
      failures.push({
        reason: "broken",
        message: `${candidate.path} 不是有效的 Word 交付（.docx.md 或扩展名不匹配）。`,
        path: candidate.path,
        expected: "docx",
      });
    }
    if (kind === "image" && isPlaceholderVisualPath(candidate.path, candidate.path)) {
      failures.push({
        reason: "placeholder",
        message: `${candidate.path} 仍是占位图，不能作为主视觉交付。`,
        path: candidate.path,
      });
    }
  }
  if (["pptx", "docx", "pdf", "image", "video"].includes(kind) && !isValidBinaryDeliverableHeader(candidate.path, candidate.binaryHeader)) {
    failures.push({
      reason: "broken",
      message: `${candidate.path} 文件头不符合 ${kind.toUpperCase()} 格式。`,
      path: candidate.path,
      expected: kind,
    });
  }
  if (isUndersizedBinaryDeliverable(candidate.path, candidate.sizeBytes)) {
    failures.push({
      reason: "broken",
      message: kind === "video"
        ? `${candidate.path} 文件过小，可能是空壳视频或渲染失败。`
        : `${candidate.path} 文件过小，无法作为有效 ${kind.toUpperCase()} 交付。`,
      path: candidate.path,
      expected: kind,
    });
  }
  if ((kind === "docx" || kind === "pdf") && hasEmptyExtractedOfficeText(candidate)) {
    failures.push({
      reason: "broken",
      message: `${candidate.path} 未抽取到有效正文，可能是空壳或导出失败。`,
      path: candidate.path,
      expected: kind,
    });
  }
  return failures;
}

function hasEmptyExtractedOfficeText(candidate: AcceptanceCandidate): boolean {
  if (candidate.textPreview === undefined) return false;
  const normalized = candidate.textPreview
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length < 24;
}

function isPlaceholderMarkdown(text: string): boolean {
  const normalized = String(text || "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return true;
  if (/^(?:todo|placeholder|待补充|待完善|稍后补充|tbd)[\s:：.-]*$/i.test(normalized)) return true;
  return normalized.length < 24 && /\b(?:todo|placeholder|tbd)\b|待补充|待完善|稍后补充/i.test(normalized);
}

export function assertFootballReportMetadataHints(
  userGoal: string,
  htmlPreview?: string,
): AcceptanceFailure[] {
  const failures: AcceptanceFailure[] = [];
  const goal = String(userGoal ?? "");
  if (!/(?:球员|教练|名单|预测|赔率|对阵|世界杯)/i.test(goal)) return failures;

  if (htmlPreview) {
    if (/FIFA\s*官方评分|Opta\s*评分/i.test(htmlPreview) && !/模型评分|参考分/i.test(htmlPreview)) {
      failures.push({
        reason: "low_quality",
        message: "自建分数不得冒称 FIFA/Opta 官方评分",
      });
    }
    if (/(?:赔率|odds)/i.test(goal) && !/(?:来源|采集|市场类型|去水)/i.test(htmlPreview)) {
      failures.push({
        reason: "low_quality",
        message: "赔率报告须标注来源、市场类型与采集说明",
      });
    }
    const idMatches = htmlPreview.match(/\bid=["'][^"']+["']/gi) ?? [];
    const idSet = new Set(idMatches.map((m) => m.toLowerCase()));
    if (idMatches.length > 0 && idSet.size !== idMatches.length) {
      failures.push({
        reason: "invalid_html",
        message: "HTML 成果存在重复 DOM id",
      });
    }
  }
  return failures;
}

/** Single-image deliverable: require plausible image extension in path when goal asks for poster. */
export function assertSingleImageDeliverablePath(
  verifiedPaths: string[],
  userGoal: string,
): AcceptanceFailure[] {
  if (!/(?:海报|poster|9\s*[:：]\s*16|image-generation)/i.test(String(userGoal ?? ""))) {
    return [];
  }
  const imagePaths = verifiedPaths.filter((p) => /\.(png|jpe?g|webp|gif)$/i.test(p));
  if (imagePaths.length === 0) {
    return [{
      reason: "missing",
      message: "单图海报任务须产出真实图片文件",
    }];
  }
  return [];
}
