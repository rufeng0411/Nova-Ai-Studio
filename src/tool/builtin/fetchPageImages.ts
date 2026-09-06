/**
 * `fetch_page_images` — model-free extraction of product image URLs from a page.
 * Preferred path for official product images (no secondary model, no web_search).
 * PD-SAAS-FORK P0-3/P0-4: DNS-pinned fetch and scope-bound official candidates.
 */

import { fetchPageImagesSoftFailureText } from "../recoveryHints.js";
import type { PermissionResult } from "../../permission/index.js";
import type {
  PilotDeckToolDefinition,
  PilotDeckToolExecutionOutput,
  PilotDeckToolRuntimeContext,
} from "../protocol/types.js";
import {
  extractPageImageCandidatesFromHtml,
  extractImageUrlsFromHtml,
  type PageImageCandidate,
  type ExtractPageImageUrlsResult,
} from "./web/pageImageUrls.js";
import {
  createOfficialMediaDnsResolver,
  fetchPublicHttpResource,
  normalizePublicHttpUrl,
  type PublicDnsResolver,
} from "./web/publicHttpUrlPolicy.js";
import {
  classifyOfficialMediaAsset,
  classifyOfficialSource,
} from "../../saas/media/officialSourceClassifier.js";
import {
  getSharedOfficialMediaCandidateRegistry,
  type OfficialMediaCandidateRegistry,
  type PublicOfficialMediaCandidate,
} from "../../saas/media/officialMediaCandidateRegistry.js";
import {
  loadOfficialSourceRoots,
  type OfficialSourceRootsRegistry,
} from "../../saas/media/officialSourceRoots.js";
import {
  canonicalizeUrlForModel,
  redactUrlsInText,
} from "../../saas/security/urlRedaction.js";
import {
  getSharedOutboundGate,
  type OutboundGate,
} from "../../saas/resilience/outboundGate.js";
import { resolveResilienceConfig } from "../../pilot/config/resolveResilienceConfig.js";

export type FetchPageImagesInput = {
  url: string;
  minWidth?: number;
};

export type FetchPageImagesOutput = ExtractPageImageUrlsResult & {
  mode?: "official";
  candidates?: PublicOfficialMediaCandidate[];
};

export type CreateFetchPageImagesToolOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  dnsResolver?: PublicDnsResolver;
  candidateRegistry?: OfficialMediaCandidateRegistry;
  officialSourceRoots?: OfficialSourceRootsRegistry;
  outboundGate?: Pick<OutboundGate, "run">;
};

const DEFAULT_TIMEOUT_MS = 60_000;
const FETCH_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function isOfficialMediaContext(
  context: PilotDeckToolRuntimeContext,
): boolean {
  return (
    context.qualityContractMode === "enforce"
    && context.sessionGoalQualityContract?.officialMediaPolicy !== undefined
    && context.sessionGoalQualityContract.officialMediaPolicy !== "none"
  );
}

function emptyPayload(
  sourceUrl: string,
  officialMode: boolean,
): FetchPageImagesOutput {
  return {
    ...(officialMode ? { mode: "official" as const } : {}),
    sourceUrl: officialMode
      ? canonicalizeUrlForModel(sourceUrl)
      : sourceUrl,
    count: 0,
    images: [],
    ...(officialMode ? { candidates: [] } : {}),
  };
}

function sourceTierAllowed(
  context: PilotDeckToolRuntimeContext,
  source: ReturnType<typeof classifyOfficialSource>,
): boolean {
  if (source.level !== "L0") return false;
  const allowed = context.sessionGoalQualityContract?.allowedSourceTiers ?? [];
  return (
    allowed.length === 0
    || source.sourceTier === undefined
    || allowed.includes(source.sourceTier)
  );
}

function registerOfficialCandidates(input: {
  candidates: PageImageCandidate[];
  sourceUrl: string;
  sourceClassification: ReturnType<typeof classifyOfficialSource>;
  context: PilotDeckToolRuntimeContext;
  registry: OfficialMediaCandidateRegistry;
}): PublicOfficialMediaCandidate[] {
  const output: PublicOfficialMediaCandidate[] = [];
  for (const candidate of input.candidates) {
    try {
      const inherited = classifyOfficialMediaAsset({
        assetUrl: candidate.url,
        sourcePage: input.sourceClassification,
      });
      output.push(input.registry.register({
        // PD-SAAS-FORK P0-4: a candidate is usable only inside the exact
        // authenticated workspace/task generation that discovered it.
        tenantScopeId:
          input.context.trustedExecutionScope?.tenantScopeId ?? "local",
        principalScopeId:
          input.context.trustedExecutionScope?.principalScopeId ?? "local",
        workspaceRoot: input.context.cwd,
        sessionId: input.context.sessionId,
        taskRoot: input.context.taskArtifactDir ?? ".",
        goalVersion: input.context.taskGoalVersion ?? 1,
        turnId: input.context.turnId,
        fullUrl: candidate.url,
        sourcePageUrl: input.sourceUrl,
        width: candidate.width,
        height: candidate.height,
        mediaType: candidate.mediaType,
        sourceClassification: inherited,
      }));
    } catch {
      // Unsafe/malformed page-owned candidates are dropped, never surfaced.
    }
  }
  return output;
}

export function createFetchPageImagesTool(
  options: CreateFetchPageImagesToolOptions = {},
): PilotDeckToolDefinition<FetchPageImagesInput, FetchPageImagesOutput> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    name: "fetch_page_images",
    aliases: ["FetchPageImages"],
    description: `- L0: Fetches a public product or marketing page and extracts direct image URLs (jpg/png/webp/gif)
- Prioritizes large CDN assets — no AI image generation, no web_search for CDN URLs
- Returns JSON with sourceUrl, count, and a ranked images[] list (up to 40 URLs)
- In enforced official-media mode, images[] stays empty and candidates[] exposes only candidateId, query-free canonical URL, dimensions/type clues, and source page
- Use this FIRST for official product images, then fetch_media_asset(candidateId) to localize the selected candidate before write_file/render_local_html_to_image

Fallback tiers (when L0 returns no images):
  - L1: same-category media/blog pages (find URL via web_search, then fetch_page_images)
  - L2: major portal channel product articles
  - L3: web_fetch to preserve CDN links in markdown
  - L4: only after resolve_session_visual_assets reports ladderExhausted — disclose gaps; do not default to HTML placeholder

Usage notes:
  - Read-only network tool; does not call any LLM
  - minWidth (default 800) filters/scores wide product shots over thumbnails`,
    kind: "network",
    inputSchema: {
      type: "object",
      required: ["url"],
      additionalProperties: false,
      properties: {
        url: {
          type: "string",
          description:
            "Official product or marketing page URL. Must be a public https URL with a multi-part hostname.",
        },
        minWidth: {
          type: "number",
          description:
            "Minimum width score for extracted images (default 800). Higher values prefer hero/banner assets.",
        },
      },
    },
    maxResultBytes: 200_000,
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    isOpenWorld: () => true,
    checkPermissions: async (): Promise<PermissionResult> => ({
      type: "ask",
      reason: {
        type: "tool",
        toolName: "fetch_page_images",
        message: "Network fetch requires permission.",
      },
      request: {
        toolCallId: "",
        toolName: "fetch_page_images",
        inputSummary: "fetch page images",
        reason: {
          type: "tool",
          toolName: "fetch_page_images",
          message: "Network fetch requires permission.",
        },
        options: [
          { id: "allow_once", label: "Allow fetch" },
          { id: "deny", label: "Deny" },
        ],
      },
    }),
    validateInput: async (input) => {
      if (!input || typeof input !== "object") {
        return {
          ok: false,
          issues: [{ path: "", code: "invalid_type", message: "input must be an object" }],
        };
      }
      const url = (input as Partial<FetchPageImagesInput>).url;
      const minWidth = (input as Partial<FetchPageImagesInput>).minWidth;
      if (typeof url !== "string" || url.length === 0) {
        return {
          ok: false,
          issues: [{ path: "url", code: "required", message: "url is required" }],
        };
      }
      try {
        normalizePublicHttpUrl(url);
      } catch {
        return {
          ok: false,
          issues: [
            {
              path: "url",
              code: "invalid_type",
              message: "url failed public HTTP policy validation.",
            },
          ],
        };
      }
      if (minWidth !== undefined && (typeof minWidth !== "number" || !Number.isFinite(minWidth))) {
        return {
          ok: false,
          issues: [{ path: "minWidth", code: "invalid_type", message: "minWidth must be a number" }],
        };
      }
      return { ok: true, input };
    },
    execute: async (
      input,
      context,
    ): Promise<PilotDeckToolExecutionOutput<FetchPageImagesOutput>> => {
      const { url, minWidth = 800 } = input;
      const officialMode = isOfficialMediaContext(context);
      const signal = context.abortSignal ?? new AbortController().signal;
      const timeout = new AbortController();
      const timer = setTimeout(() => timeout.abort(new Error("fetch timeout")), timeoutMs);
      const onParentAbort = () => timeout.abort();
      signal.addEventListener("abort", onParentAbort, { once: true });

      let response: Awaited<ReturnType<typeof fetchPublicHttpResource>>;
      try {
        const resilience = resolveResilienceConfig();
        const gate = options.outboundGate
          ?? getSharedOutboundGate(resilience.outboundMaxConcurrent);
        // PD-SAAS-FORK VAP: official-mode / default use DoH fallback when system DNS fails.
        const resolver = options.dnsResolver
          ?? (officialMode ? createOfficialMediaDnsResolver() : undefined);
        response = await gate.run(() =>
          fetchPublicHttpResource(url, {
            fetchImpl: options.fetchImpl,
            resolver,
            expectedKind: "html",
            headers: {
              "User-Agent": FETCH_USER_AGENT,
              Accept: "text/html,application/xhtml+xml",
            },
            signal: timeout.signal,
          })
        );
      } catch (err) {
        const message = redactUrlsInText(
          err instanceof Error ? err.message : String(err),
        );
        const visibleUrl = officialMode
          ? canonicalizeUrlForModel(url)
          : url;
        const payload = emptyPayload(url, officialMode);
        return {
          content: [{
            type: "text",
            text: fetchPageImagesSoftFailureText(visibleUrl, message),
          }],
          data: payload,
          metadata: { softFailed: true, reason: message },
        };
      } finally {
        clearTimeout(timer);
        signal.removeEventListener("abort", onParentAbort);
      }

      if (response.status < 200 || response.status >= 300) {
        const reason = `HTTP ${response.status} ${response.statusText}`;
        const visibleUrl = officialMode
          ? canonicalizeUrlForModel(url)
          : url;
        const payload = emptyPayload(response.url, officialMode);
        return {
          content: [{
            type: "text",
            text: fetchPageImagesSoftFailureText(visibleUrl, reason),
          }],
          data: payload,
          metadata: { softFailed: true, reason },
        };
      }

      const html = response.buffer.toString("utf8");
      if (officialMode) {
        let sourceRoots = options.officialSourceRoots;
        if (!sourceRoots) {
          try {
            sourceRoots = await loadOfficialSourceRoots();
          } catch {
            sourceRoots = { version: 1, roots: [] };
          }
        }
        const sourceClassification = classifyOfficialSource({
          url: response.url,
          userExplicitUrls: context.trustedUserExplicitUrls,
          registry: sourceRoots,
        });
        const extracted = extractPageImageCandidatesFromHtml(html, {
          sourceUrl: response.url,
          minWidth,
          limit: 40,
        });
        const canExpose =
          context.sessionGoalQualityContract?.officialMediaPolicy
            === "official_preferred"
          || sourceTierAllowed(context, sourceClassification);
        const candidates = canExpose
          ? registerOfficialCandidates({
              candidates: extracted,
              sourceUrl: response.url,
              sourceClassification,
              context,
              registry: options.candidateRegistry
                ?? getSharedOfficialMediaCandidateRegistry(),
            })
          : [];
        const payload: FetchPageImagesOutput = {
          mode: "official",
          sourceUrl: canonicalizeUrlForModel(response.url),
          count: candidates.length,
          images: [],
          candidates,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
          data: payload,
        };
      }

      const images = extractImageUrlsFromHtml(html, {
        sourceUrl: response.url,
        minWidth,
        limit: 40,
      });
      const payload: FetchPageImagesOutput = {
        sourceUrl: response.url,
        count: images.length,
        images,
      };
      const text = JSON.stringify(payload, null, 2);
      return {
        content: [{ type: "text", text }],
        data: payload,
      };
    },
  };
}
