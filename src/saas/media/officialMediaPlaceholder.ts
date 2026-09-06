// PD-SAAS-FORK P0-6: deterministic local fallback for explicitly allowed official-media gaps.

import type { CanonicalMessage } from "../../model/index.js";
import type { PromptLanguage } from "../../context/prompt/resolvePromptLanguage.js";

export const OFFICIAL_MEDIA_PLACEHOLDER_MARKER =
  "PILOTDECK_OFFICIAL_MEDIA_PLACEHOLDER";

export type BuildOfficialMediaPlaceholderInput = {
  label?: string;
  width?: number;
  height?: number;
};

export type OfficialMediaPlaceholder = {
  filename: string;
  mimeType: "image/svg+xml";
  width: number;
  height: number;
  content: string;
};

function boundedDimension(value: number | undefined, fallback: number): number {
  if (!Number.isSafeInteger(value) || (value ?? 0) < 64) return fallback;
  return Math.min(value!, 4096);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&apos;");
}

export function buildOfficialMediaPlaceholder(
  input: BuildOfficialMediaPlaceholderInput = {},
): OfficialMediaPlaceholder {
  const width = boundedDimension(input.width, 1600);
  const height = boundedDimension(input.height, 900);
  const label = escapeXml(
    String(input.label ?? "Official media unavailable")
      .replace(/\s+/gu, " ")
      .trim()
      .slice(0, 120),
  );
  const content = [
    `<!-- ${OFFICIAL_MEDIA_PLACEHOLDER_MARKER} -->`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">`,
    "  <defs>",
    '    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">',
    '      <stop offset="0" stop-color="#e7e9ed"/>',
    '      <stop offset="1" stop-color="#c9ced6"/>',
    "    </linearGradient>",
    "  </defs>",
    `  <rect width="${width}" height="${height}" fill="url(#bg)"/>`,
    `  <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="20" fill="none" stroke="#858c98" stroke-width="4" stroke-dasharray="18 12"/>`,
    `  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#4d5561" font-family="Arial, sans-serif" font-size="${Math.max(24, Math.round(width / 32))}">${label}</text>`,
    "</svg>",
  ].join("\n");
  return {
    filename: "official-media-placeholder.svg",
    mimeType: "image/svg+xml",
    width,
    height,
    content,
  };
}

export function isOfficialMediaPlaceholderContent(content: unknown): boolean {
  return (
    typeof content === "string"
    && content.includes(OFFICIAL_MEDIA_PLACEHOLDER_MARKER)
  );
}

/** PD-SAAS-FORK VAP: count unlabeled SVG/CSS placeholders that used to false-green. */
export function looksLikeVisualPlaceholder(input: {
  path?: string;
  textPreview?: string;
}): boolean {
  const filePath = String(input.path ?? "").replace(/\\/gu, "/").toLowerCase();
  if (
    /(?:^|\/)(?:placeholder|hero-placeholder|official-media-placeholder)[^/]*\.svg$/u
      .test(filePath)
    || /placeholder\.svg$/u.test(filePath)
  ) {
    return true;
  }
  const text = String(input.textPreview ?? "");
  if (!text) return false;
  if (isOfficialMediaPlaceholderContent(text)) return true;
  if (
    /<svg[\s>]/iu.test(text)
    && (
      /占位|placeholder|official media unavailable|官方素材待补/iu.test(text)
      || /stroke-dasharray/iu.test(text)
    )
  ) {
    return true;
  }
  return false;
}

export function buildOfficialMediaPlaceholderRecoveryMessage(input: {
  taskArtifactDir: string;
  language?: PromptLanguage;
  failedTools?: string[];
}): CanonicalMessage {
  const language = input.language ?? "en";
  const placeholder = buildOfficialMediaPlaceholder({
    label: language === "zh-CN" ? "官方素材待补" : "Official media unavailable",
  });
  const failedTools = [...new Set(input.failedTools ?? [])]
    .map((tool) => String(tool).trim())
    .filter(Boolean)
    .slice(0, 8);
  const toolDetail = failedTools.length > 0
    ? (language === "zh-CN"
      ? `失败工具：${failedTools.join("、")}。`
      : `Failed tools: ${failedTools.join(", ")}. `)
    : "";
  const text = language === "zh-CN"
    ? [
        "官方素材获取预算已用尽，且本任务明确允许占位图。",
        `请只在 ${input.taskArtifactDir}/assets/ 下用 write_file 写入本地 SVG，`,
        `SVG 必须包含注释 <!-- ${OFFICIAL_MEDIA_PLACEHOLDER_MARKER} -->；`,
        `文件内容必须原样使用以下确定性 SVG：\n${placeholder.content}\n`,
        "随后在成果中引用该本地文件并继续 render_local_html_to_image 或 export_document。",
        "禁止再次调用 fetch_page_images、fetch_media_asset、generate_image、bash 或 MCP。",
        toolDetail,
      ].join("")
    : [
        "The official-media acquisition budget is exhausted and this task explicitly allows a placeholder. ",
        `Use write_file only under ${input.taskArtifactDir}/assets/ to create a local SVG containing `,
        `<!-- ${OFFICIAL_MEDIA_PLACEHOLDER_MARKER} -->. Use this exact deterministic SVG content:\n`,
        `${placeholder.content}\nReference that local file, then continue with `,
        "render_local_html_to_image or export_document. Do not call fetch_page_images, ",
        `fetch_media_asset, generate_image, bash, or MCP. ${toolDetail}`,
      ].join("");
  return {
    role: "user",
    content: [{ type: "text", text }],
    metadata: {
      synthetic: true,
      purpose: "official_media_placeholder_fallback",
    },
  };
}
