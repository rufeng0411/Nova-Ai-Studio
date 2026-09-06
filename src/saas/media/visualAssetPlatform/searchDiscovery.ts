// PD-SAAS-FORK VAP: search-engine + image-search discovery (Bocha API + Bing HTML fallback).

import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  fetchPublicHttpResource,
  type PublicDnsResolver,
} from "../../../tool/builtin/web/publicHttpUrlPolicy.js";
import {
  getVapOutboundGate,
  isVapDiscoverParallelEnabled,
} from "./vapOutboundGate.js";
import {
  recordAcquisitionAttempt,
  type AcquisitionAttempt,
  type AcquisitionTierId,
} from "./visualAcquisitionLadder.js";

const FETCH_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const DEFAULT_BOCHA_ENDPOINT = "https://api.bochaai.com/v1/web-search";

const LOW_QUALITY_HOST =
  /(?:book118|docin|wenku\.baidu|pptx\.cn|jianshu\.com\/p\/|max\.book118)/iu;

const AUTOMOTIVE_KEYWORDS =
  /(?:汽车|轿车|suv|越野(?:车|版)|autohome|懂车帝|chery|汽车之家|车型|内饰|外观|autohome\.com|dongchedi\.com|bitauto|pcauto|懂车帝|纵横\s*g\d+)/iu;

const EARLY_EXIT_HIT_THRESHOLD = 8;
const PARALLEL_BATCH_SIZE = 3;

type SearchPackQueries = {
  webQueries?: string[];
  imageQueries?: string[];
  trustedHosts?: string[];
};

type SearchSourcesConfig = SearchPackQueries & {
  version?: number;
  pack?: string;
  autoPack?: SearchPackQueries;
  bingWebSearchUrl?: string;
  bingImageSearchUrl?: string;
};

export type SearchDiscoveryHit = {
  url: string;
  tier: AcquisitionTierId;
  query: string;
};

export type SearchDiscoveryResult = {
  pageUrls: SearchDiscoveryHit[];
  imageUrls: SearchDiscoveryHit[];
};

export type RunSearchDiscoveryInput = {
  subject: string;
  userGoal?: string;
  dnsResolver: PublicDnsResolver;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  acquisitionAttempts: AcquisitionAttempt[];
  maxWebQueries?: number;
  maxImageQueries?: number;
};

let cachedConfig: SearchSourcesConfig | null = null;

const GENERIC_FALLBACK_CONFIG: SearchSourcesConfig = {
  webQueries: [
    "{subject} 官网",
    "{subject} 官方 高清图",
    "{subject} 产品图",
  ],
  imageQueries: ["{subject} 官方", "{subject} 高清"],
  trustedHosts: [
    "gov.cn",
    "wikipedia.org",
    "wikimedia.org",
    "sohu.com",
    "sina.com.cn",
    "163.com",
    "ifeng.com",
    "qq.com",
  ],
  bingWebSearchUrl: "https://www.bing.com/search?q={query}&count=10",
  bingImageSearchUrl:
    "https://www.bing.com/images/search?q={query}&form=HDRSC2&first=1",
};

async function loadSearchConfig(): Promise<SearchSourcesConfig> {
  if (cachedConfig) return cachedConfig;
  try {
    const raw = await readFile(
      path.resolve(process.cwd(), "config/visual-search-sources.json"),
      "utf8",
    );
    cachedConfig = JSON.parse(raw) as SearchSourcesConfig;
    return cachedConfig;
  } catch {
    cachedConfig = { ...GENERIC_FALLBACK_CONFIG };
    return cachedConfig;
  }
}

export function resetSearchDiscoveryConfigCacheForTests(): void {
  cachedConfig = null;
}

export function isAutomotiveSubject(subject: string, userGoal?: string): boolean {
  const text = `${subject} ${userGoal ?? ""}`.trim();
  if (!text) return false;
  return AUTOMOTIVE_KEYWORDS.test(text);
}

export function selectSearchPackForGoal(
  subject: string,
  userGoal?: string,
): "generic" | "auto" {
  const envPack = process.env.PILOTDECK_VAP_QUERY_PACK?.trim().toLowerCase();
  if (envPack === "generic") return "generic";
  const automotive = isAutomotiveSubject(subject, userGoal);
  if (envPack === "auto") {
    return automotive ? "auto" : "generic";
  }
  return automotive ? "auto" : "generic";
}

function mergeTrustedHosts(
  generic: readonly string[],
  auto: readonly string[],
): string[] {
  const merged = new Set<string>();
  for (const host of generic) merged.add(host);
  for (const host of auto) merged.add(host);
  return [...merged];
}

export function resolveEffectiveSearchConfig(
  base: SearchSourcesConfig,
  subject: string,
  userGoal?: string,
): SearchSourcesConfig {
  const pack = selectSearchPackForGoal(subject, userGoal);
  if (pack === "auto" && base.autoPack) {
    return {
      ...base,
      webQueries: base.autoPack.webQueries ?? base.webQueries,
      imageQueries: base.autoPack.imageQueries ?? base.imageQueries,
      trustedHosts: mergeTrustedHosts(
        base.trustedHosts ?? [],
        base.autoPack.trustedHosts ?? [],
      ),
    };
  }
  return base;
}

export async function resolveSearchQueriesForGoal(
  subject: string,
  userGoal?: string,
): Promise<{
  pack: "generic" | "auto";
  webQueries: string[];
  imageQueries: string[];
  trustedHosts: string[];
}> {
  const base = await loadSearchConfig();
  const pack = selectSearchPackForGoal(subject, userGoal);
  const effective = resolveEffectiveSearchConfig(base, subject, userGoal);
  return {
    pack,
    webQueries: effective.webQueries ?? [],
    imageQueries: effective.imageQueries ?? [],
    trustedHosts: effective.trustedHosts ?? [],
  };
}

function fillQuery(template: string, subject: string): string {
  return template.replace(/\{subject\}/gu, subject.trim());
}

function hostMatchesTrusted(url: string, trustedHosts: string[]): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return trustedHosts.some(
      (trusted) => host === trusted || host.endsWith(`.${trusted}`),
    );
  } catch {
    return false;
  }
}

function extractHttpUrls(text: string, limit = 20): string[] {
  const matches = text.match(/https?:\/\/[^\s"'<>\\]+/giu) ?? [];
  const unique = new Set<string>();
  for (const raw of matches) {
    let url = raw.replace(/[\\),.]+$/u, "");
    if (LOW_QUALITY_HOST.test(url)) continue;
    try {
      url = new URL(url).toString();
      unique.add(url);
    } catch {
      // skip
    }
    if (unique.size >= limit) break;
  }
  return [...unique];
}

function extractBingImageUrls(html: string, limit = 24): string[] {
  const urls = new Set<string>();
  const murlRe = /"murl"\s*:\s*"([^"]+)"/giu;
  let match: RegExpExecArray | null;
  while ((match = murlRe.exec(html)) !== null) {
    const decoded = match[1]!.replace(/\\\//gu, "/");
    if (!LOW_QUALITY_HOST.test(decoded)) urls.add(decoded);
    if (urls.size >= limit) break;
  }
  if (urls.size < limit) {
    for (const url of extractHttpUrls(html, limit * 2)) {
      if (/\.(?:jpe?g|png|webp|gif|avif)(?:[?#]|$)/iu.test(url)) {
        urls.add(url);
      }
      if (urls.size >= limit) break;
    }
  }
  return [...urls];
}

function extractBingWebLinks(html: string, trustedHosts: string[], limit = 12): string[] {
  const links = new Set<string>();
  const citeRe = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>/giu;
  let match: RegExpExecArray | null;
  while ((match = citeRe.exec(html)) !== null) {
    const url = match[1]!;
    if (LOW_QUALITY_HOST.test(url)) continue;
    if (hostMatchesTrusted(url, trustedHosts)) links.add(url);
    if (links.size >= limit) break;
  }
  if (links.size < limit) {
    for (const url of extractHttpUrls(html, limit * 3)) {
      if (hostMatchesTrusted(url, trustedHosts)) links.add(url);
      if (links.size >= limit) break;
    }
  }
  return [...links];
}

async function fetchSearchHtml(
  url: string,
  input: RunSearchDiscoveryInput,
): Promise<string | null> {
  const gate = getVapOutboundGate();
  const timeoutMs = input.timeoutMs ?? 30_000;
  try {
    const response = await gate.run(() =>
      fetchPublicHttpResource(url, {
        fetchImpl: input.fetchImpl,
        resolver: input.dnsResolver,
        expectedKind: "html",
        headers: {
          "User-Agent": FETCH_USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
        signal: AbortSignal.timeout(timeoutMs),
      }),
    );
    if (response.status < 200 || response.status >= 300) return null;
    return response.buffer.toString("utf8").slice(0, 2_000_000);
  } catch {
    return null;
  }
}

async function runBochaWebSearch(
  query: string,
  input: RunSearchDiscoveryInput,
  organicLimit: number,
): Promise<string[]> {
  const apiKey = process.env.BOCHA_API_KEY?.trim();
  if (!apiKey) return [];
  const endpoint = process.env.BOCHA_WEB_SEARCH_ENDPOINT?.trim() || DEFAULT_BOCHA_ENDPOINT;
  const gate = getVapOutboundGate();
  const timeoutMs = input.timeoutMs ?? 25_000;
  try {
    const response = await gate.run(() =>
      (input.fetchImpl ?? fetch)(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query,
          summary: true,
          freshness: "noLimit",
          count: Math.min(organicLimit, 20),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      }),
    );
    if (!response.ok) return [];
    const raw = (await response.json()) as Record<string, unknown>;
    const code = raw.code;
    if (typeof code === "number" && code !== 200 && code !== 0) return [];
    const data = raw.data;
    if (!data || typeof data !== "object") return [];
    const webPages = (data as Record<string, unknown>).webPages;
    if (!webPages || typeof webPages !== "object") return [];
    const items = (webPages as Record<string, unknown>).value;
    if (!Array.isArray(items)) return [];
    return items
      .map((entry) => {
        if (!entry || typeof entry !== "object") return "";
        return String((entry as Record<string, unknown>).url ?? "").trim();
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

type HitCollector = {
  pushPage: (hit: SearchDiscoveryHit) => void;
  pushImage: (hit: SearchDiscoveryHit) => void;
  totalHits: () => number;
};

async function processWebQuery(
  template: string,
  subject: string,
  config: SearchSourcesConfig,
  trustedHosts: string[],
  input: RunSearchDiscoveryInput,
  collector: HitCollector,
): Promise<void> {
  const query = fillQuery(template, subject);
  const bochaLinks = await runBochaWebSearch(query, input, 10);
  recordAcquisitionAttempt(input.acquisitionAttempts, {
    tier: "search_engine_web",
    method: bochaLinks.length > 0 ? "bocha_api" : "bocha_skipped",
    target: query.slice(0, 120),
    ok: bochaLinks.length > 0,
    detail: `links=${bochaLinks.length}`,
  });
  for (const url of bochaLinks) {
    if (LOW_QUALITY_HOST.test(url)) continue;
    collector.pushPage({ url, tier: "search_engine_web", query });
  }

  if (bochaLinks.length === 0 && config.bingWebSearchUrl) {
    const bingUrl = config.bingWebSearchUrl.replace(
      "{query}",
      encodeURIComponent(query),
    );
    const html = await fetchSearchHtml(bingUrl, input);
    const links = html ? extractBingWebLinks(html, trustedHosts, 8) : [];
    recordAcquisitionAttempt(input.acquisitionAttempts, {
      tier: "search_engine_web",
      method: "bing_web_html",
      target: query.slice(0, 120),
      ok: links.length > 0,
      detail: `links=${links.length}`,
    });
    for (const url of links) {
      collector.pushPage({ url, tier: "search_engine_web", query });
    }
  }
}

async function processImageQuery(
  template: string,
  subject: string,
  config: SearchSourcesConfig,
  input: RunSearchDiscoveryInput,
  collector: HitCollector,
): Promise<void> {
  const query = fillQuery(template, subject);
  if (!config.bingImageSearchUrl) return;
  const bingUrl = config.bingImageSearchUrl.replace(
    "{query}",
    encodeURIComponent(query),
  );
  const html = await fetchSearchHtml(bingUrl, input);
  const images = html ? extractBingImageUrls(html, 16) : [];
  recordAcquisitionAttempt(input.acquisitionAttempts, {
    tier: "search_engine_image",
    method: "bing_images_html",
    target: query.slice(0, 120),
    ok: images.length > 0,
    detail: `images=${images.length}`,
  });
  for (const url of images) {
    if (LOW_QUALITY_HOST.test(url)) continue;
    collector.pushImage({ url, tier: "search_engine_image", query });
  }
}

async function runQueryBatch<T>(
  items: T[],
  batchSize: number,
  parallel: boolean,
  shouldStop: () => boolean,
  runOne: (item: T) => Promise<void>,
): Promise<void> {
  if (!parallel) {
    for (const item of items) {
      if (shouldStop()) break;
      await runOne(item);
    }
    return;
  }

  for (let index = 0; index < items.length; index += batchSize) {
    if (shouldStop()) break;
    const batch = items.slice(index, index + batchSize);
    await Promise.allSettled(batch.map((item) => runOne(item)));
  }
}

export async function runSearchDiscovery(
  input: RunSearchDiscoveryInput,
): Promise<SearchDiscoveryResult> {
  const baseConfig = await loadSearchConfig();
  const subject = input.subject.trim();
  if (!subject) {
    return { pageUrls: [], imageUrls: [] };
  }

  const config = resolveEffectiveSearchConfig(
    baseConfig,
    subject,
    input.userGoal,
  );
  const trustedHosts = config.trustedHosts ?? [];

  const pageUrls: SearchDiscoveryHit[] = [];
  const imageUrls: SearchDiscoveryHit[] = [];
  const seenPages = new Set<string>();
  const seenImages = new Set<string>();

  const pushPage = (hit: SearchDiscoveryHit) => {
    const key = hit.url.split("?")[0] ?? hit.url;
    if (seenPages.has(key)) return;
    seenPages.add(key);
    pageUrls.push(hit);
  };

  const pushImage = (hit: SearchDiscoveryHit) => {
    const key = hit.url.split("?")[0] ?? hit.url;
    if (seenImages.has(key)) return;
    seenImages.add(key);
    imageUrls.push(hit);
  };

  const collector: HitCollector = {
    pushPage,
    pushImage,
    totalHits: () => pageUrls.length + imageUrls.length,
  };

  const parallel = isVapDiscoverParallelEnabled();
  const shouldStop = () => collector.totalHits() >= EARLY_EXIT_HIT_THRESHOLD;

  const maxWeb = input.maxWebQueries ?? 4;
  const webTemplates = (config.webQueries ?? []).slice(0, maxWeb);
  await runQueryBatch(
    webTemplates,
    PARALLEL_BATCH_SIZE,
    parallel,
    shouldStop,
    async (template) => {
      if (shouldStop()) return;
      await processWebQuery(
        template,
        subject,
        config,
        trustedHosts,
        input,
        collector,
      );
    },
  );

  const maxImage = input.maxImageQueries ?? 5;
  const imageTemplates = (config.imageQueries ?? []).slice(0, maxImage);
  await runQueryBatch(
    imageTemplates,
    PARALLEL_BATCH_SIZE,
    parallel,
    shouldStop,
    async (template) => {
      if (shouldStop()) return;
      await processImageQuery(template, subject, config, input, collector);
    },
  );

  return {
    pageUrls: pageUrls.slice(0, 12),
    imageUrls: imageUrls.slice(0, 24),
  };
}

/** @internal unit tests */
export const searchDiscoveryTesting = {
  extractBingImageUrls,
  extractBingWebLinks,
  fillQuery,
  resolveEffectiveSearchConfig,
};
