// PD-SAAS-FORK: format-word mentions (PDF 中的 / 在 PPT 里没有展示) are not required kinds.
import { stripNegatedDeliverableMentions } from "./deliverableChecklistAuthority.js";

export const CASE_12FC6055 = [
  "你现在是一个很厉害的做内容营销的人，请你根据附件公司的介绍，一个知乎的系列选题。先做 5 期。",
  "PDF 中的檽糯映画是 AI 漫剧生成的产品。NOVA-KOL 是大号蒸馏。",
  "这两个内容在 PPT 里没有展示，因此说明一下",
].join("");

export const CASE_PDF_SOURCE_NOTES = "根据这份 PDF 写一份会议纪要";

export const CASE_TRUE_PPT = "请根据资料生成一份 12 页可编辑 PPT，做完告诉我文件在哪";

export const CASE_WEEKLY_PPT = "做一份周会PPT，须交付 presentation.pptx";

export const CASE_STICKY_ZHIHU = [
  "帮我做知乎选题和一篇长文，主题：企业级 Agent 落地。",
  "须交付：01-topics.md、02-longform.md。",
  "这两个内容在 PPT 里没有展示。",
  "写入系统分配任务目录。",
].join("\n");

export const CASE_DUAL = [
  "帮我做知乎选题和一篇长文，主题：企业级 Agent 落地。",
  "须交付：01-topics.md、02-longform.md。",
  "另外做成一份PPT。",
  "写入系统分配任务目录。",
].join("\n");

export const CASE_HTML_DOCX_PDF =
  "我需要一个带有雷蛇风格和好看先进图表的html版本报告，并同时输出docx和pdf版本";

export const CASE_NEGATE_PPT_WORD = "不要 PPT 了，改成一份 Word 报告";

/** Keep in sync with deliverableChecklistAuthority PPT absence + this locator. */
const FORMAT_LOCATOR_SPAN =
  /(?:附件|attached)?\s*(?:PDF|pdf|PPTX?|pptx?|幻灯片?|演示文稿|Word|WORD|docx)\s*(?:中的|里的|内的)/gi;

const IMPERATIVE_PREFIX =
  "(?:做成|做一份|来一份|导出|生成|制作|创建|输出|须交付|保存为|转成|改成|换成|整理成|写成)";

export function stripFormatLocatorMentions(goal: string): string {
  return String(goal ?? "").replace(FORMAT_LOCATOR_SPAN, " ");
}

export function sanitizeGoalForKindInference(goal: string): string {
  return stripFormatLocatorMentions(stripNegatedDeliverableMentions(goal))
    .replace(/\s+/g, " ")
    .trim();
}

export function hasImperativeOfficeFormat(
  goal: string,
  kind: "pdf" | "pptx" | "docx",
): boolean {
  const text = String(goal ?? "");
  if (kind === "pptx") {
    return new RegExp(`${IMPERATIVE_PREFIX}.{0,24}(?:pptx|PPTX|ppt|PPT|幻灯|演示文稿|演示PPT)`).test(text)
      || /可编辑的?\s*(?:PPT|pptx|幻灯)/.test(text)
      || /\d{1,2}\s*页.{0,16}(?:PPT|pptx|幻灯)/.test(text)
      || /\.(?:pptx|ppt)\b/i.test(text);
  }
  if (kind === "pdf") {
    return new RegExp(`${IMPERATIVE_PREFIX}.{0,24}(?:pdf|PDF)`).test(text)
      || /\.pdf\b/i.test(text);
  }
  return new RegExp(`${IMPERATIVE_PREFIX}.{0,24}(?:docx|word|Word)`).test(text)
    || /\.docx?\b/i.test(text);
}

export function serializeArtifactKinds(kinds: readonly string[]): string {
  return kinds.join(",");
}

export function gateOfficeKindsByImperative<T extends string>(
  kinds: readonly T[],
  sanitizedGoal: string,
  capabilitySlug?: string,
): T[] {
  const slug = String(capabilitySlug ?? "");
  return kinds.filter((kind) => {
    if (kind === "pdf") return hasImperativeOfficeFormat(sanitizedGoal, "pdf");
    if (kind === "pptx") {
      return hasImperativeOfficeFormat(sanitizedGoal, "pptx") || /ppt/i.test(slug);
    }
    if (kind === "docx") return hasImperativeOfficeFormat(sanitizedGoal, "docx");
    return true;
  });
}
