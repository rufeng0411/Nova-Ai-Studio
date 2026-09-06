// PD-SAAS-FORK: browser-safe SDM pathHint sanitizer (no node/fs campaign imports).
import type { SessionDeliverableSlot } from "../taskState/sessionDeliverableManifest.js";

/**
 * Basename with optional CJK letters — stops before CJK punctuation
 * (e.g. `file.md。使用 Open Design` → `file.md`).
 */
const PATH_IN_LABEL =
  /([A-Za-z0-9_\u4e00-\u9fff][A-Za-z0-9._\u4e00-\u9fff\-]*?\.(?:md|markdown|html?|pdf|docx?|pptx?|json(?:ld)?|png|jpe?g|csv|xlsx?|mp4|mp3|svg))/i;

const WORKFLOW_STEP_LINE =
  /read_skill|write_file|web_search|fetch_page|generate_|export_document|geo_api|yixiaoer|mkt-schema|geo-content|geo-citability|pd-geo|geo-aeo|od-data-report/i;

const BINDING_CONSTRAINT_LINE =
  /【硬性约束】|禁止|必须调用工具|render_hyperframes\s*\(|Gateway|DeepSeek|灌篮高手|下一代推理模型/i;

const POLLUTED_PATH_HINT_RE =
  /须交付|写入系统分配|\.md\.md|keywords\.html写入/i;

export function stripDeliverableAnnotation(text: string): string {
  return String(text ?? "")
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePathHintCandidate(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const stripped = stripDeliverableAnnotation(value).trim();
  if (!stripped || POLLUTED_PATH_HINT_RE.test(stripped)) return undefined;
  // PD-SAAS-FORK 0731-fail-C: reject spaced fake hints like "策略 .md" as sole matchable basename.
  if (/\s+\.\w{1,8}$/i.test(stripped)) return undefined;
  if (/[，。；：、]/.test(stripped) && !/^[\w./《》\-]+\.(?:md|html?|pdf|docx?|pptx?|json(?:ld)?|png|jpe?g|csv|svg)$/i.test(stripped)) {
    return undefined;
  }
  const segment = stripped.split(/[/\\]/).pop()?.trim() ?? stripped;
  if (!segment || segment.length > 96) return undefined;
  if (/\s+\.\w{1,8}$/i.test(segment)) return undefined;
  const extracted = segment.match(PATH_IN_LABEL)?.[1];
  if (!extracted) return undefined;
  if (/\.(md|html?|pptx?|png)\.(md|html?|pptx?|png)$/i.test(extracted)) {
    return extracted.replace(/\.(md|html?|pptx?|png)\.(md|html?|pptx?|png)$/i, ".$1");
  }
  return extracted;
}

function isDeliverableBasename(value: string | undefined): boolean {
  return Boolean(normalizePathHintCandidate(value));
}

export function sanitizePollutedPathHints(
  slots: SessionDeliverableSlot[],
): SessionDeliverableSlot[] {
  return slots
    .map((slot) => {
      const pathHint = normalizePathHintCandidate(slot.pathHint);
      const pathHints = (slot.pathHints ?? [])
        .map((hint) => normalizePathHintCandidate(hint))
        .filter((hint): hint is string => Boolean(hint));
      const dedupedPathHints = [...new Set(pathHints)];
      return {
        ...slot,
        ...(pathHint ? { pathHint } : {}),
        ...(dedupedPathHints.length ? { pathHints: dedupedPathHints } : {}),
      };
    })
    .filter((slot) => {
      if (slot.pathHint?.trim()) return true;
      if (slot.pathHints?.some((hint) => hint.trim())) return true;
      if (WORKFLOW_STEP_LINE.test(slot.label ?? "")) return false;
      if (BINDING_CONSTRAINT_LINE.test(slot.label ?? "")) return false;
      const label = String(slot.label ?? "").trim();
      return label.length >= 2;
    });
}
