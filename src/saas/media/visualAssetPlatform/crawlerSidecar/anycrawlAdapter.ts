// PD-SAAS-FORK VAP: AnyCrawl local Docker OpenAPI adapter.

import type {
  VapRenderExtractClient,
  VapRenderExtractInput,
  VapRenderExtractResult,
} from "./types.js";

function resolveBaseUrl(): string {
  const raw = process.env.PILOTDECK_VAP_CRAWLER_URL?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/$/u, "") : "http://127.0.0.1:8080";
}

function isLoopbackOrPrivateBase(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return true;
    }
    if (/^10\./u.test(host) || /^192\.168\./u.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./u.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

function mapEngine(engine: VapRenderExtractInput["engine"]): string {
  if (engine === "stealth") return "playwright";
  return engine;
}

function collectImageUrls(payload: unknown): string[] {
  const urls = new Set<string>();
  const visit = (value: unknown, depth = 0): void => {
    if (depth > 6 || value == null) return;
    if (typeof value === "string") {
      if (/^https:\/\//iu.test(value) && /\.(avif|gif|jpe?g|png|webp)(?:[?#]|$)/iu.test(value)) {
        urls.add(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    if (typeof value === "object") {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (/image|media|src|url/iu.test(key)) visit(child, depth + 1);
        else if (typeof child === "object") visit(child, depth + 1);
      }
    }
  };
  visit(payload);
  return [...urls].slice(0, 40);
}

export function createAnycrawlExtractClient(
  fetchImpl: typeof fetch = fetch,
): VapRenderExtractClient {
  return {
    async extractImages(input: VapRenderExtractInput): Promise<VapRenderExtractResult> {
      const base = resolveBaseUrl();
      if (!isLoopbackOrPrivateBase(base)) {
        return {
          imageUrls: [],
          error: "crawler_base_not_allowlisted",
          skipped: true,
        };
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), input.timeoutMs);
      try {
        const response = await fetchImpl(`${base}/v1/scrape`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            url: input.url,
            engine: mapEngine(input.engine),
            formats: ["markdown", "html", "links"],
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          return {
            imageUrls: [],
            error: `anycrawl_http_${response.status}`,
          };
        }
        const json = await response.json() as {
          success?: boolean;
          data?: unknown;
          message?: string;
        };
        if (json.success === false) {
          return {
            imageUrls: [],
            error: json.message ?? "anycrawl_failed",
          };
        }
        const imageUrls = collectImageUrls(json.data ?? json);
        return {
          imageUrls,
          finalUrl: input.url,
        };
      } catch (error) {
        return {
          imageUrls: [],
          error: error instanceof Error ? error.message : String(error),
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
