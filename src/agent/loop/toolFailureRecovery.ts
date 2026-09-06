// PD-SAAS-FORK: tool/model recovery turns (MAX_RECOVERY_ATTEMPTS=8)
import type { PromptLanguage } from "../../context/prompt/resolvePromptLanguage.js";
import type { CanonicalMessage } from "../../model/index.js";
import type { PilotDeckToolResult } from "../../tool/index.js";
import { buildPrematureStopRecoveryUserMessage } from "../errors/userFacingErrors.js";

// PD-SAAS-FORK: neutral, deliverable-first generic recovery. The previous copy was
// landing-page/mobile-mockup biased ("scaffold_mobile_mockup", "deliver the HTML path"),
// which derailed report/research tasks into producing or re-reading HTML instead of the
// requested .md. Mockup/landing guidance now comes only from the per-tool hints
// (recoveryHints.ts) when the task actually warrants it. Keep the opening phrases
// ("Several tools failed in a row. Stop retrying the same approach." / "连续多个工具调用
// 失败。请换一种做法，不要重复同一错误路径。") — the user-bubble boilerplate filter keys on them.
export const TOOL_RECOVERY_USER_MESSAGE_EN =
  "Several tools failed in a row. Stop retrying the same approach. From what you already have, use write_file under artifacts/ to produce the final deliverable (prefer .md for reports); do not re-read the same file or directory. When you need the web, prefer web_search / fetch_page_images / web_fetch, not bash curl/grep. Deliver the file path when done.";

export const TOOL_RECOVERY_USER_MESSAGE_ZH =
  "连续多个工具调用失败。请换一种做法，不要重复同一错误路径。请基于已掌握的信息，用 write_file 在 artifacts/ 下产出最终交付物（报告类优先 .md），不要反复 read_file 同一文件或同一目录。需要联网时优先 web_search / fetch_page_images / web_fetch，不要用 bash curl/grep 抓取。完成后给出交付文件路径。";

export const TOOL_RECOVERY_RESEARCH_ZH =
  "工具调用失败。调研报告请改走稳定路径：web_search → write_file 保存 artifacts/research-{主题}-{时间}/01-sources-and-synthesis.md → 用 Markdown 表格/Mermaid 做图表 → write_file 03-report-body.md → export_document 导出 .docx。禁止反复 read_file skills/ 或 bash 解析 docx。若导出失败，至少交付 01 与 03 两个 md 文件。";

export const TOOL_RECOVERY_RESEARCH_EN =
  "Tool failures on research delivery: web_search → write_file artifacts/research-*/01-sources-and-synthesis.md → charts in md → write_file 03-report-body.md → export_document to .docx. Do not read_file skills/ repeatedly. Deliver at least the two md files if export fails.";

export const TOOL_RECOVERY_GEO_AUDIT_ZH =
  "工具调用失败。GEO/AEO 审计请改走稳定路径：web_search → write_file 保存 audit-checklist.md 与主报告 md → 可选 visibility-report.html。禁止注入 research 三件套（01-sources-and-synthesis.md / 03-report-body.md）。若导出失败，至少交付 audit 主报告 md 与 audit-manifest.json。";

export const TOOL_RECOVERY_GEO_AUDIT_EN =
  "Tool failures on GEO/AEO audit: web_search → write_file audit-checklist.md + main audit report md → optional visibility-report.html. Do NOT use research-report paths (01-sources-and-synthesis.md / 03-report-body.md). Deliver at least the audit report md and audit-manifest.json if export fails.";

/** @deprecated Use language-aware buildToolRecoveryUserMessage instead. */
export const TOOL_RECOVERY_USER_MESSAGE = TOOL_RECOVERY_USER_MESSAGE_EN;

const NON_STUCK_ERROR_CODES = new Set([
  "permission_required",
  "permission_denied",
  "permission_cancelled",
  "tool_aborted",
]);

export const MAX_RECOVERY_ATTEMPTS = 8;

const FETCH_TOOL_NAMES = new Set([
  "web_search",
  "web_fetch",
  "fetch_page_images",
]);

export function isSoftFailedToolResult(result: PilotDeckToolResult): boolean {
  return result.type === "success" && result.metadata?.softFailed === true;
}

export function shouldInjectSoftFetchRecoveryTurn(results: PilotDeckToolResult[]): boolean {
  if (results.length === 0) return false;
  const fetchResults = results.filter((result) => FETCH_TOOL_NAMES.has(result.toolName));
  if (fetchResults.length === 0) return false;
  return fetchResults.every(isSoftFailedToolResult);
}

export function buildSoftFetchRecoveryUserMessage(
  language: PromptLanguage = "en",
): CanonicalMessage {
  const locale = language === "zh-CN" ? "zh" : "en";
  return buildPrematureStopRecoveryUserMessage(locale, "soft_fetch_failure");
}

export function isRecoverableToolErrorCode(code: string | undefined): boolean {
  if (!code) return false;
  return code === "tool_execution_failed"
    || code === "tool_timeout"
    || code === "invalid_tool_input"
    || code === "unsupported_tool";
}

export function isAgentErrorRecoverable(code: string | undefined): boolean {
  return code === "agent_max_turns_reached";
}

export function isTransientModelErrorMessage(message: string): boolean {
  if (!message) return false;
  return /(?:fetch failed|network|econnreset|econnrefused|etimedout|timeout|rate limit|503|502|504|unavailable)/i.test(message);
}

export function isAgentModelErrorRecoverable(code: string | undefined, message: string): boolean {
  return code === "agent_model_error" && isTransientModelErrorMessage(message);
}

export function isStuckInvalidInputTurn(results: PilotDeckToolResult[]): boolean {
  return results.length > 0 && results.every(
    (result) => result.type === "error" && result.error.code === "invalid_tool_input",
  );
}

export function shouldInjectToolRecoveryTurn(results: PilotDeckToolResult[]): boolean {
  if (results.length === 0) return false;
  return results.every((result) => {
    if (result.type === "success") return false;
    return !NON_STUCK_ERROR_CODES.has(result.error.code);
  });
}

const TOOL_RECOVERY_CHAT_FIRST_ZH =
  "这是脑爆 Tab 对话型能力。请停止重试工具，直接基于当前对话用自然语言回复；不要 read_skill、read_file、web_search 或 write_file，除非用户明确要求生成报告、总结分析或文件交付。";

const TOOL_RECOVERY_CHAT_FIRST_EN =
  "Brainstorm-tab conversational mode: stop retrying tools and reply in natural language; do not read_skill, read_file, web_search, or write_file unless the user explicitly asked for a report, written analysis summary, or file deliverable.";

const TOOL_RECOVERY_CONTENT_ZH =
  "工具调用失败。内容营销请改走稳定路径：write_file artifacts/content-{主题}-{时间}/01-topics.md → 02-longform.md → 03-social-slices.md。禁止反复 read_file skills/。Recovery 耗尽前至少交付 01 与 02 两个 md。";

const TOOL_RECOVERY_CONTENT_EN =
  "Tool failures on content marketing: write_file artifacts/content-*/01-topics.md → 02-longform.md → 03-social-slices.md. No read_file skills/. Deliver at least 01+02 md before recovery exhausts.";

export const TOOL_RECOVERY_PPT_ZH =
  "工具调用失败。若用户确实要 .pptx：直接调用工具 export_document（已有 md/html 为 source_path）或 ocr_to_editable_pptx。需要配方时才 read_skill anth-pptx。禁止 read_skill export_document。禁止让用户本机安装或转换。禁止 HTML 冒充 PPT。完成后给出 .pptx 路径。";

export const TOOL_RECOVERY_PPT_EN =
  "Tool failures on PPT delivery: call the export_document tool (source_path + output_format=pptx) or ocr_to_editable_pptx. read_skill anth-pptx only for the recipe. Never read_skill export_document. Never ask the user to convert locally. Do not write_file HTML as PPT. Deliver the .pptx path.";

const TOOL_REPEAT_TERMINAL_ZH =
  "同一工具与输入已连续失败两次。请换一种做法或拆分任务，不要重复相同调用。";

const TOOL_REPEAT_TERMINAL_EN =
  "The same tool call failed twice with the same input. Try a different approach or break the task into smaller steps — do not repeat the same call.";

function toolRecoveryBaseMessage(
  language: PromptLanguage = "en",
  options?: {
    researchReport?: boolean;
    contentFlywheel?: boolean;
    chatFirst?: boolean;
    pptDeliverable?: boolean;
    geoAudit?: boolean;
  },
): string {
  if (options?.pptDeliverable) {
    return language === "zh-CN" ? TOOL_RECOVERY_PPT_ZH : TOOL_RECOVERY_PPT_EN;
  }
  if (options?.chatFirst) {
    return language === "zh-CN" ? TOOL_RECOVERY_CHAT_FIRST_ZH : TOOL_RECOVERY_CHAT_FIRST_EN;
  }
  if (options?.geoAudit) {
    return language === "zh-CN" ? TOOL_RECOVERY_GEO_AUDIT_ZH : TOOL_RECOVERY_GEO_AUDIT_EN;
  }
  if (options?.researchReport) {
    return language === "zh-CN" ? TOOL_RECOVERY_RESEARCH_ZH : TOOL_RECOVERY_RESEARCH_EN;
  }
  if (options?.contentFlywheel) {
    return language === "zh-CN" ? TOOL_RECOVERY_CONTENT_ZH : TOOL_RECOVERY_CONTENT_EN;
  }
  return language === "zh-CN" ? TOOL_RECOVERY_USER_MESSAGE_ZH : TOOL_RECOVERY_USER_MESSAGE_EN;
}

export function buildToolRepeatTerminalMessage(
  language: PromptLanguage = "en",
): CanonicalMessage {
  const text = language === "zh-CN" ? TOOL_REPEAT_TERMINAL_ZH : TOOL_REPEAT_TERMINAL_EN;
  return {
    role: "user",
    content: [{ type: "text", text }],
    metadata: { synthetic: true, purpose: "tool_repeat_terminal" },
  };
}

export function buildToolRecoveryUserMessage(
  results: PilotDeckToolResult[],
  language: PromptLanguage = "en",
  options?: {
    researchReport?: boolean;
    contentFlywheel?: boolean;
    chatFirst?: boolean;
    pptDeliverable?: boolean;
    geoAudit?: boolean;
  },
): CanonicalMessage {
  const failedTools = [...new Set(
    results
      .filter((result): result is Extract<PilotDeckToolResult, { type: "error" }> => result.type === "error")
      .map((result) => result.toolName),
  )];
  const detail = failedTools.length > 0
    ? (language === "zh-CN"
      ? ` 失败工具：${failedTools.join("、")}。`
      : ` Failed tools: ${failedTools.join(", ")}.`)
    : "";
  return {
    role: "user",
    content: [{ type: "text", text: `${toolRecoveryBaseMessage(language, options)}${detail}` }],
    metadata: { synthetic: true, purpose: "tool_recovery" },
  };
}
