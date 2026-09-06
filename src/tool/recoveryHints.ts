import type { PilotDeckToolErrorCode } from "./protocol/errors.js";
import type { OfficialMediaPolicy } from "../saas/constraints/officialMediaRequirement.js";
import { classifyErrorMessage } from "../saas/resilience/errorClassifier.js";
import { isPreferGenerateImageEnforce } from "../saas/media/preferGenerateImageFlags.js";
import {
  GENERATE_IMAGE_CREATIVE_ENFORCE_RECOVERY,
  GENERATE_IMAGE_FORCE_PLACEHOLDER_RECOVERY,
  GENERATE_IMAGE_HARD_FAIL_RECOVERY,
  GENERATE_IMAGE_RECOVERY,
  VISUAL_MEDIA_FORCE_PLACEHOLDER_HINT,
} from "../saas/media/visualMediaDegradePolicy.js";

const WEB_SEARCH_RECOVERY =
  "Recovery: web_search did not help for images or CDN URLs. Call resolve_session_visual_assets, or use fetch_page_images on the official product page URL first, then web_fetch if needed. Do not retry the same search query. Do not use bash/curl/grep to scrape images.";

const BASH_FETCH_RECOVERY =
  "Recovery: shell scraping failed on this platform. Use resolve_session_visual_assets, fetch_page_images or web_fetch instead of curl|grep|findstr. Continue with write_file to deliver HTML.";

const MOBILE_MOCKUP_RECOVERY =
  "Recovery: mobile UI mockups must use scaffold_mobile_mockup (slug + preset), then edit_file screen-N.html. Do NOT paste HTML in chat or read_file skills/ paths. Deliver artifacts/design/<slug>/index.html.";

// PD-SAAS-FORK: neutral hint for a failing/stalled read_file. The previous code injected
// the mobile-mockup recovery here, which derailed report/research tasks (a worldcup
// competitor benchmark looped on read_file because it was told to scaffold a mockup).
// Lead with deliverable-first guidance; mockup advice is a trailing aside only.
const READ_FILE_PROGRESS_RECOVERY =
  "Recovery: a file read failed. Do not repeatedly read_file the same path — continue with write_file under artifacts/ using what you already have, and read a known path under artifacts/ only if you truly need it. (For mobile UI mockups specifically, use scaffold_mobile_mockup.)";

const GENERIC_TOOL_RECOVERY =
  "Recovery: try an alternate tool (resolve_session_visual_assets, scaffold_mobile_mockup, fetch_page_images, web_fetch, write_file) instead of repeating the same failing call.";

const GREP_FILE_SEARCH_RECOVERY =
  "Recovery: grep timed out or failed. Use glob under artifacts/ or read_file known campaign paths (@artifacts/campaign/…). Do not bash dir /s /b the whole workspace.";

const READ_SKILL_RECOVERY =
  "Recovery: read_skill failed or stalled. Continue with write_file under artifacts/ using project memory; pick a design system from skills/open-design/references/design-systems/ only when generating HTML.";

const OPEN_DESIGN_VI_RECOVERY =
  "Recovery: VI/design task — read artifacts/campaign/*/campaign-brief.md if present, then write_file artifacts/design/{slug}/ with index.html + brand tokens. Skip stalled file scans; use placeholders for missing images.";

const FETCH_PAGE_IMAGES_RECOVERY =
  "Recovery: fetch_page_images could not reach the page. Call resolve_session_visual_assets (phase_a) — it runs official URL → roots → authority sites → portals → HTML extract → screenshot before any placeholder. Do not use bash/curl/grep. For non-official goals only: after ladder exhausted you may write_file an SVG placeholder and continue.";

// PD-SAAS-FORK VAP P0-C0: official_only — never recommend SVG-as-success.
const FETCH_PAGE_IMAGES_OFFICIAL_ONLY_RECOVERY =
  "Recovery: official/website images required. Call resolve_session_visual_assets (phase_a) next — exhaust all six acquisition tiers (DoH + authority + portal + HTML extract + screenshot). Do NOT write SVG placeholders or generate_image until ladderExhausted=true. If all tiers fail, disclose the gap and keep needs_repair.";

// PD-SAAS-FORK P0-4/P0-5: bounded alternate paths for official-media tools.
const FETCH_MEDIA_ASSET_RECOVERY =
  "Recovery: fetch_media_asset could not localize this bound candidate. Use resolve_session_visual_assets or fetch_page_images once to select a different candidate from the same official page; do not pass a raw URL or retry the same candidate repeatedly.";

const RENDER_LOCAL_HTML_IMAGE_RECOVERY =
  "Recovery: render_local_html_to_image could not render the local HTML. Keep all assets under the active task directory, remove external references, then update the local HTML with write_file and render once more.";

const WEB_FETCH_RECOVERY =
  "Recovery: web_fetch could not reach the page. Call resolve_session_visual_assets or fetch_page_images on the official product URL. Do not use bash/curl/grep. For non-official goals only: after 2 failed attempts you may write_file an SVG placeholder and finish.";

const WEB_FETCH_OFFICIAL_ONLY_RECOVERY =
  "Recovery: official/website images required. Prefer resolve_session_visual_assets (phase_a) to run the full six-tier ladder. Do NOT finish with unlabeled SVG placeholders until ladderExhausted=true; disclose gaps if acquisition fails.";

const GENERATE_IMAGE_OFFICIAL_ONLY_RECOVERY =
  "Recovery: generate_image is forbidden for official product photos. Call resolve_session_visual_assets (phase_a) to exhaust official → authority → portal → extract → screenshot tiers first. Do not invent product imagery.";

function readBashCommand(toolInput: unknown): string {
  if (!toolInput || typeof toolInput !== "object") return "";
  const command = (toolInput as { command?: unknown }).command;
  return typeof command === "string" ? command : "";
}

function looksLikeShellScrape(command: string): boolean {
  return /\b(curl|wget|grep|findstr|Invoke-WebRequest|Select-String)\b/i.test(command);
}

export function appendToolRecoveryHint(
  toolName: string,
  code: PilotDeckToolErrorCode,
  message: string,
  toolInput?: unknown,
  options?: {
    forceVisualPlaceholder?: boolean;
    officialMediaPolicy?: OfficialMediaPolicy;
  },
): string {
  if (message.includes("Recovery:")) return message;

  const normalizedTool = toolName.toLowerCase();
  const hints: string[] = [];
  const officialOnly = options?.officialMediaPolicy === "official_only";

  if (options?.forceVisualPlaceholder && !officialOnly) {
    hints.push(VISUAL_MEDIA_FORCE_PLACEHOLDER_HINT);
  }

  if (normalizedTool === "generate_image") {
    if (
      code === "tool_execution_failed"
      || code === "tool_timeout"
      || code === "unsupported_tool"
      || code === "permission_required"
      || code === "permission_denied"
    ) {
      if (officialOnly) {
        hints.push(GENERATE_IMAGE_OFFICIAL_ONLY_RECOVERY);
      } else {
        // PD-SAAS-FORK: auth/billing → UserAction path; never push SVG-first recovery.
        const hardClass = classifyErrorMessage(message, code).classification;
        if (hardClass === "model_billing" || hardClass === "model_auth") {
          hints.push(GENERATE_IMAGE_HARD_FAIL_RECOVERY);
        } else if (isPreferGenerateImageEnforce() && !options?.forceVisualPlaceholder) {
          hints.push(GENERATE_IMAGE_CREATIVE_ENFORCE_RECOVERY);
        } else {
          hints.push(
            options?.forceVisualPlaceholder
              ? GENERATE_IMAGE_FORCE_PLACEHOLDER_RECOVERY
              : GENERATE_IMAGE_RECOVERY,
          );
        }
      }
    }
  }

  if (normalizedTool === "web_search") {
    if (
      code === "tool_execution_failed"
      || code === "tool_timeout"
      || code === "unsupported_tool"
      || code === "permission_required"
      || code === "permission_denied"
    ) {
      hints.push(
        officialOnly
          ? FETCH_PAGE_IMAGES_OFFICIAL_ONLY_RECOVERY
          : (options?.forceVisualPlaceholder ? VISUAL_MEDIA_FORCE_PLACEHOLDER_HINT : WEB_SEARCH_RECOVERY),
      );
    }
  }

  if (
    normalizedTool === "fetch_page_images"
    || normalizedTool === "resolve_session_visual_assets"
    || normalizedTool === "discover_visual_assets"
  ) {
    if (code === "tool_execution_failed" || code === "tool_timeout") {
      hints.push(
        officialOnly
          ? FETCH_PAGE_IMAGES_OFFICIAL_ONLY_RECOVERY
          : (options?.forceVisualPlaceholder ? VISUAL_MEDIA_FORCE_PLACEHOLDER_HINT : FETCH_PAGE_IMAGES_RECOVERY),
      );
    }
  }

  if (normalizedTool === "fetch_media_asset") {
    if (
      code === "tool_execution_failed"
      || code === "tool_timeout"
      || code === "path_not_allowed"
    ) {
      hints.push(FETCH_MEDIA_ASSET_RECOVERY);
    }
  }

  if (normalizedTool === "render_local_html_to_image") {
    if (
      code === "tool_execution_failed"
      || code === "tool_timeout"
      || code === "path_not_allowed"
    ) {
      hints.push(RENDER_LOCAL_HTML_IMAGE_RECOVERY);
    }
  }

  if (normalizedTool === "web_fetch") {
    if (officialOnly && (code === "tool_execution_failed" || code === "tool_timeout")) {
      hints.push(WEB_FETCH_OFFICIAL_ONLY_RECOVERY);
      return hints.length > 0 ? `${message}\n\n${hints.join("\n")}` : message;
    }
    if (code === "tool_execution_failed" || code === "tool_timeout") {
      hints.push(options?.forceVisualPlaceholder ? VISUAL_MEDIA_FORCE_PLACEHOLDER_HINT : WEB_FETCH_RECOVERY);
    }
  }

  if (normalizedTool === "bash") {
    const command = readBashCommand(toolInput);
    if (
      looksLikeShellScrape(command)
      || code === "invalid_tool_input"
      || code === "tool_execution_failed"
    ) {
      hints.push(BASH_FETCH_RECOVERY);
    }
  }

  if (normalizedTool === "read_file" || normalizedTool === "read") {
    if (
      code === "path_not_allowed"
      || code === "tool_execution_failed"
      || /outside the NovaStudio workspace/i.test(message)
    ) {
      hints.push(READ_FILE_PROGRESS_RECOVERY);
    }
  }

  // PD-SAAS-FORK: mockup recovery is scoped to the mockup tool itself, not to read_file.
  if (normalizedTool === "scaffold_mobile_mockup") {
    if (
      code === "tool_execution_failed"
      || code === "tool_timeout"
      || code === "invalid_tool_input"
    ) {
      hints.push(MOBILE_MOCKUP_RECOVERY);
    }
  }

  if (normalizedTool === "grep" || normalizedTool === "glob") {
    if (code === "tool_execution_failed" || code === "tool_timeout") {
      hints.push(GREP_FILE_SEARCH_RECOVERY);
    }
  }

  if (normalizedTool === "read_skill") {
    if (code === "tool_execution_failed" || code === "tool_timeout" || code === "unsupported_tool") {
      hints.push(READ_SKILL_RECOVERY);
      hints.push(OPEN_DESIGN_VI_RECOVERY);
    }
  }

  if (
    hints.length === 0
    && (code === "tool_execution_failed" || code === "tool_timeout")
    && normalizedTool !== "write_file"
    && normalizedTool !== "edit_file"
  ) {
    hints.push(GENERIC_TOOL_RECOVERY);
  }

  if (hints.length === 0) return message;
  return `${message}\n\n${hints.join("\n")}`;
}

export function appendEmptyWebSearchRecovery(summary: string): string {
  if (summary.includes("Recovery:")) return summary;
  if (!summary.includes("No organic results.")) return summary;
  return `${summary}\n\n${WEB_SEARCH_RECOVERY}`;
}

export function fetchPageImagesSoftFailureText(url: string, reason: string): string {
  return [
    `Could not fetch page images from: ${url}`,
    `Reason: ${reason}`,
    "",
    FETCH_PAGE_IMAGES_RECOVERY,
    "",
    "images: (none — treat as soft failure and continue with web_fetch/write_file.)",
  ].join("\n");
}

export function webFetchSoftFailureText(url: string, reason: string): string {
  return [
    `Could not fetch page content from: ${url}`,
    `Reason: ${reason}`,
    "",
    WEB_FETCH_RECOVERY,
    "",
    "Page content: (none — treat as soft failure and continue with fetch_page_images/write_file.)",
  ].join("\n");
}

export function webSearchSoftFailureText(query: string, reason: string): string {
  return [
    `Web search could not complete for: ${query}`,
    `Reason: ${reason}`,
    "",
    WEB_SEARCH_RECOVERY,
    "",
    "Organic results: (none — treat as soft failure and continue with fetch_page_images/web_fetch/write_file.)",
  ].join("\n");
}
