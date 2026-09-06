// PD-SAAS-FORK VAP: crawler sidecar facade — health, circuit, cheerio→playwright upgrade.

import { createAnycrawlExtractClient } from "./anycrawlAdapter.js";
import {
  isSidecarCircuitOpen,
  recordSidecarFailure,
  recordSidecarSuccess,
} from "./circuit.js";
import type {
  VapCrawlerEngine,
  VapRenderExtractClient,
  VapRenderExtractResult,
} from "./types.js";

export type CrawlerSidecarMode = "off" | "anycrawl" | "crawl4ai";

let injectClient: VapRenderExtractClient | null = null;

export function resolveCrawlerSidecarMode(): CrawlerSidecarMode {
  const raw = (process.env.PILOTDECK_VAP_CRAWLER_SIDECAR ?? "off").trim().toLowerCase();
  if (raw === "anycrawl" || raw === "1" || raw === "true") return "anycrawl";
  if (raw === "crawl4ai") return "crawl4ai";
  return "off";
}

export function isStealthSidecarEnabled(): boolean {
  const raw = process.env.PILOTDECK_VAP_STEALTH_SIDECAR?.trim().toLowerCase();
  return raw === "1" || raw === "true";
}

export function setVapCrawlerClientForTests(
  client: VapRenderExtractClient | null,
): void {
  injectClient = client;
}

function getClient(): VapRenderExtractClient | null {
  if (injectClient) return injectClient;
  const mode = resolveCrawlerSidecarMode();
  if (mode === "off") return null;
  // crawl4ai shares AnyCrawl-shaped HTTP for now (same adapter interface).
  return createAnycrawlExtractClient();
}

export async function probeCrawlerSidecarHealth(
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const mode = resolveCrawlerSidecarMode();
  if (mode === "off") return false;
  const base = (process.env.PILOTDECK_VAP_CRAWLER_URL ?? "http://127.0.0.1:8080")
    .trim()
    .replace(/\/$/u, "");
  try {
    const response = await fetchImpl(`${base}/health`, {
      signal: AbortSignal.timeout(2_000),
    });
    return response.ok;
  } catch {
    try {
      const response = await fetchImpl(`${base}/`, {
        signal: AbortSignal.timeout(2_000),
      });
      return response.status < 500;
    } catch {
      return false;
    }
  }
}

/**
 * T4/T5 extract: cheerio first, upgrade to playwright once if empty;
 * stealth only when enabled and prior engines fail with 403-ish errors.
 */
export async function extractImagesViaCrawlerSidecar(input: {
  url: string;
  timeoutMs?: number;
  preferStealth?: boolean;
}): Promise<VapRenderExtractResult> {
  if (isSidecarCircuitOpen()) {
    return {
      imageUrls: [],
      skipped: true,
      error: "sidecar_circuit_open",
    };
  }
  const client = getClient();
  if (!client) {
    return { imageUrls: [], skipped: true, error: "sidecar_off" };
  }

  const timeoutMs = input.timeoutMs ?? 12_000;
  const engines: VapCrawlerEngine[] = input.preferStealth && isStealthSidecarEnabled()
    ? ["stealth"]
    : ["cheerio", "playwright"];

  let last: VapRenderExtractResult = { imageUrls: [], error: "no_engine" };
  for (const engine of engines) {
    last = await client.extractImages({
      url: input.url,
      engine,
      timeoutMs: engine === "cheerio" ? Math.min(timeoutMs, 8_000) : timeoutMs,
    });
    if (last.skipped) {
      recordSidecarFailure();
      return last;
    }
    if (last.imageUrls.length > 0) {
      recordSidecarSuccess();
      return last;
    }
    const err = (last.error ?? "").toLowerCase();
    const is403 = err.includes("403") || err.includes("challenge") || err.includes("cloudflare");
    if (is403 && isStealthSidecarEnabled() && engine !== "stealth") {
      last = await client.extractImages({
        url: input.url,
        engine: "stealth",
        timeoutMs: 15_000,
      });
      if (last.imageUrls.length > 0) {
        recordSidecarSuccess();
        return last;
      }
    }
  }

  recordSidecarFailure();
  return last;
}
