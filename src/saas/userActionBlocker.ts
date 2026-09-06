// PD-SAAS-FORK: classify blockers requiring user action (Key/attachment/permission)

import { isProviderArrearageMessage } from "../agent/errors/userFacingErrors.js";
import { isTransientInvisibleEnabled } from "./resilience/stabilityFlags.js";

export type UserActionBlockerType =
  | "missing_key"
  | "missing_attachment"
  | "permission"
  | "billing"
  | "auth"
  | "missing_input"
  | "unknown";

export type UserActionBlocker = {
  type: UserActionBlockerType;
  fingerprint: string;
  serviceId?: string;
  alternateHints: string[];
  unambiguous: boolean;
};

const UNAMBIGUOUS_AUTH_PATTERN =
  /(?:401|403|invalid api key|invalid_api_key|incorrect api key|unauthorized|authentication failed|Arrearage|欠费|账户.*欠费)/i;

const MISSING_KEY_PATTERN =
  /(?:api[_\s-]?key|token|credential|未配置|缺少.*key|missing.*key|MINERU|mineru|BOCHA|YIXIAOER|yixiaoer|未设置)/i;

const MISSING_ATTACHMENT_PATTERN =
  /(?:请上传|缺少附件|upload.*attach|no attachment|附件|attach.*file|docx.*未提供)/i;

const PERMISSION_PATTERN =
  /(?:permission_required|permission_denied|需要确认.*权限|grant permission)/i;

const USER_CONFIGURED_RESET_PATTERN =
  /(?:已配置(?:.*继续)?|已上传|已填入|configured|uploaded)/i;

const MEDIA_NETWORK_FAILURE_PATTERN =
  /(?:fetch failed|network|ECONNREFUSED|ETIMEDOUT|timeout|无法访问|连接失败|VPN|代理)/i;

export function userIndicatesBlockerResolved(userText: string): boolean {
  const trimmed = String(userText ?? "").trim();
  if (!trimmed) return false;
  if (/^(?:继续|continue|[?？!！。.…\s]+)$/i.test(trimmed)) return false;
  return USER_CONFIGURED_RESET_PATTERN.test(trimmed);
}

export function needsUserCredentialOrAttachment(text: string): boolean {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return false;
  return MISSING_KEY_PATTERN.test(trimmed)
    || MISSING_ATTACHMENT_PATTERN.test(trimmed)
    || PERMISSION_PATTERN.test(trimmed);
}

export function isUnambiguousHardFailMessage(message: string): boolean {
  return UNAMBIGUOUS_AUTH_PATTERN.test(String(message ?? ""));
}

/**
 * PD-SAAS-FORK (P0-1): a bare transient network failure (fetch failed / timeout / ECONN*) from ANY
 * tool — not just media tools — is NOT a user-action blocker. It must be left to the engine's
 * recoverable retry / auto-continue. Returns false the moment a genuine credential / permission /
 * billing / attachment signal is present, so real "missing Key" stays a blocker. Pure & exported
 * for unit tests; only consulted by classifyUserActionBlocker when the flag is on.
 */
export function looksLikeBareTransientNetworkFailure(text: string): boolean {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return false;
  if (!MEDIA_NETWORK_FAILURE_PATTERN.test(trimmed)) return false;
  if (MISSING_KEY_PATTERN.test(trimmed)) return false;
  if (MISSING_ATTACHMENT_PATTERN.test(trimmed)) return false;
  if (PERMISSION_PATTERN.test(trimmed)) return false;
  if (UNAMBIGUOUS_AUTH_PATTERN.test(trimmed)) return false;
  if (/billing|欠费|Arrearage/i.test(trimmed)) return false;
  return true;
}

function inferMissingKeyService(text: string): string {
  if (/yixiaoer|蚁小二|YIXIAOER/i.test(text)) return "yixiaoer";
  if (/bocha|博查/i.test(text)) return "bocha";
  if (/mineru|documentocr|document_ocr/i.test(text)) return "mineru";
  if (/generate_image|tools\.image|生图|imagen|image generation/i.test(text)) return "image";
  if (/无法继续导出|export_document|文档导出/i.test(text) && !/mineru|documentocr/i.test(text)) {
    return "export";
  }
  return text.match(/(?:for|service)[:\s]+(\w+)/i)?.[1]?.toLowerCase() ?? "api";
}

const ENGINE_NOTICE_PATTERN =
  /已尝试 \d+ 种方式，仍缺少 .{0,80} API Key/;

export function classifyUserActionBlocker(input: {
  assistantText?: string;
  toolErrorMessage?: string;
  toolErrorCode?: string;
}): UserActionBlocker | null {
  const toolText = String(input.toolErrorMessage ?? "").trim();
  const assistantText = String(input.assistantText ?? "").trim();
  // Ignore fully-formed engine user_action_required notices re-parsed from assistant bubbles.
  if (!toolText
    && ENGINE_NOTICE_PATTERN.test(assistantText)
    && /在本对话回复「已配置，继续」/.test(assistantText)) {
    return null;
  }
  const parts = [toolText, assistantText].filter(Boolean).join("\n");
  const text = parts.trim();
  if (!text) return null;

  if (isProviderArrearageMessage(text) || /billing|欠费|Arrearage/i.test(text)) {
    return {
      type: "billing",
      fingerprint: "billing:provider",
      alternateHints: ["check_model_pool", "verify_subscription"],
      unambiguous: isUnambiguousHardFailMessage(text),
    };
  }

  if (UNAMBIGUOUS_AUTH_PATTERN.test(text) || input.toolErrorCode === "model_auth") {
    const provider = text.match(/provider[:\s]+(\w+)/i)?.[1] ?? "default";
    return {
      type: "auth",
      fingerprint: `model_auth:${provider.toLowerCase()}`,
      alternateHints: ["check_settings_model_pool"],
      unambiguous: isUnambiguousHardFailMessage(text),
    };
  }

  if (PERMISSION_PATTERN.test(text) || input.toolErrorCode === "permission_required") {
    const tool = text.match(/tool[:\s]+(\w+)/i)?.[1] ?? "tool";
    return {
      type: "permission",
      fingerprint: `permission:${tool.toLowerCase()}`,
      alternateHints: ["grant_permission"],
      unambiguous: false,
    };
  }

  // PD-SAAS-FORK (P0-1, gated): billing/auth/permission already returned above, so a bare network
  // failure here carries no credential signal -> treat as transient (not a blocker) for ALL tools.
  // Flag OFF preserves the legacy media-only behavior in the block right below.
  if (isTransientInvisibleEnabled() && looksLikeBareTransientNetworkFailure(text)) {
    return null;
  }

  // Transient media/network failures are not credential blockers — allow retry_alternate / placeholders.
  if (/generate_image|tools\.image|fetch_page_images|generate_video|render_html_video/i.test(text)
    && MEDIA_NETWORK_FAILURE_PATTERN.test(text)
    && !/(?:not configured|未配置|missing.*key|缺少.*key)/i.test(text)) {
    return null;
  }

  if (/yixiaoer|蚁小二|YIXIAOER/i.test(text) && MISSING_KEY_PATTERN.test(text)) {
    return {
      type: "missing_key",
      fingerprint: "missing_key:yixiaoer",
      serviceId: "yixiaoer",
      alternateHints: ["deliver_files_only", "skip_publish"],
      unambiguous: false,
    };
  }

  if (/generate_image|tools\.image|生图.*未配置|image.*not configured/i.test(text)
    && MISSING_KEY_PATTERN.test(text)) {
    return {
      type: "missing_key",
      fingerprint: "missing_key:image",
      serviceId: "image",
      alternateHints: ["svg_placeholder", "fetch_page_images"],
      unambiguous: false,
    };
  }

  if (/generate_video|render_html_video|tools\.video|生视频.*未配置|video.*not configured/i.test(text)
    && MISSING_KEY_PATTERN.test(text)) {
    return {
      type: "missing_key",
      fingerprint: "missing_key:video",
      serviceId: "video",
      alternateHints: ["storyboard_placeholder", "script_and_thumbnail"],
      unambiguous: false,
    };
  }

  if (/mineru|documentocr|document_ocr/i.test(text) && MISSING_KEY_PATTERN.test(text)) {
    return {
      type: "missing_key",
      fingerprint: "missing_key:mineru",
      serviceId: "mineru",
      alternateHints: ["export_document_fallback", "compose_images"],
      unambiguous: false,
    };
  }

  if (/bocha|博查/i.test(text) && MISSING_KEY_PATTERN.test(text)) {
    return {
      type: "missing_key",
      fingerprint: "missing_key:bocha",
      serviceId: "bocha",
      alternateHints: ["web_fetch_fallback"],
      unambiguous: false,
    };
  }

  if (/无法继续导出|export_document|文档导出/i.test(text)
    && MISSING_KEY_PATTERN.test(text)
    && !/mineru|documentocr/i.test(text)) {
    return {
      type: "missing_key",
      fingerprint: "missing_key:export",
      serviceId: "export",
      alternateHints: ["deliver_markdown_only", "skip_export"],
      unambiguous: false,
    };
  }

  if (MISSING_KEY_PATTERN.test(text)) {
    const service = inferMissingKeyService(text);
    return {
      type: "missing_key",
      fingerprint: `missing_key:${service}`,
      serviceId: service,
      alternateHints: ["check_settings_providers"],
      unambiguous: false,
    };
  }

  if (MISSING_ATTACHMENT_PATTERN.test(text)) {
    const ext = text.match(/\.(docx|pdf|pptx|xlsx)/i)?.[1]?.toLowerCase() ?? "file";
    return {
      type: "missing_attachment",
      fingerprint: `missing_attachment:${ext}`,
      alternateHints: ["ask_user_upload"],
      unambiguous: false,
    };
  }

  if (needsUserCredentialOrAttachment(text)) {
    return {
      type: "unknown",
      fingerprint: "user_input:generic",
      alternateHints: [],
      unambiguous: false,
    };
  }

  return null;
}
