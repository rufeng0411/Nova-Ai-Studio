// PD-SAAS-FORK: semantic SDM slot labels — engine + UI single source
import { sdmBasename } from "./sdmSlotMatching.js";

export type SemanticSlotLabelInput = {
  label?: string;
  kind?: string;
  pathHint?: string;
  stageId?: string;
};

const RAW_KIND_LABEL =
  /^(html|markdown|md|pdf|pptx|docx|image|video|png|file|word|ppt|幻灯)$/i;

const GENERIC_SLOT_LABEL = /^(?:交付物|成果)\s*\d+$/i;

const STAGE_DISPLAY_LABELS: Record<string, string> = {
  research: "调研",
  plan: "Campaign 策划 HTML",
  brief: "传播 brief",
  visual: "主视觉海报",
  website: "官方网站",
  platform: "多平台内容",
  draft: "平台草稿",
  monitoring: "监测复盘",
};

const KIND_DISPLAY_LABELS: Record<string, string> = {
  html: "HTML 网页",
  markdown: "Markdown 报告",
  md: "Markdown 报告",
  pdf: "PDF 版",
  docx: "Word 文档",
  word: "Word 文档",
  pptx: "PPT 幻灯",
  ppt: "PPT 幻灯",
  image: "配图",
  png: "配图",
  video: "视频",
  file: "成果文件",
};

export function isRawKindLabel(label: string): boolean {
  return RAW_KIND_LABEL.test(label.trim());
}

export function isGenericSlotLabel(label: string): boolean {
  return GENERIC_SLOT_LABEL.test(label.trim());
}

function stemFromPathHint(pathHint: string): string {
  const base = sdmBasename(pathHint.trim());
  if (!base) return "";
  const stem = base.replace(/\.[^.]+$/, "");
  if (!stem) return base;
  return stem.replace(/[-_]+/g, " ").trim();
}

function kindDisplayLabel(kind: string): string {
  const key = kind.trim().toLowerCase();
  return KIND_DISPLAY_LABELS[key] ?? kind;
}

/**
 * Resolve a user-facing slot label: stage name > non-raw label > path stem > kind semantic name.
 */
export function semanticSlotLabel(input: SemanticSlotLabelInput): string {
  const stageId = String(input.stageId ?? "").trim();
  if (stageId && STAGE_DISPLAY_LABELS[stageId]) {
    return STAGE_DISPLAY_LABELS[stageId];
  }

  const label = String(input.label ?? "").trim();
  if (label && !isRawKindLabel(label) && !isGenericSlotLabel(label)) {
    return label.slice(0, 120);
  }

  const pathHint = String(input.pathHint ?? "").trim();
  if (pathHint) {
    const stem = stemFromPathHint(pathHint);
    if (stem.length > 0) return stem.slice(0, 120);
  }

  const kind = String(input.kind ?? "").trim();
  if (kind) return kindDisplayLabel(kind);

  if (label) return kindDisplayLabel(label);

  return "成果文件";
}

export function defaultAddLabelForKind(kind: string): string {
  return kindDisplayLabel(kind);
}
