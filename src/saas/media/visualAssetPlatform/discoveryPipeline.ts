// PD-SAAS-FORK VAP: multi-source visual asset discovery (deterministic, no LLM).

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createOfficialMediaDnsResolver,
  fetchPublicHttpResource,
  type PublicDnsResolver,
} from "../../../tool/builtin/web/publicHttpUrlPolicy.js";
import {
  extractImageUrlsFromHtml,
  extractPageImageCandidatesFromHtml,
} from "../../../tool/builtin/web/pageImageUrls.js";
import {
  loadOfficialSourceRoots,
  type OfficialSourceRoot,
} from "../officialSourceRoots.js";
import {
  applyAnalysisToEntry,
  analyzeVisualAsset,
} from "./analyzer.js";
import {
  createIngestedEntry,
  ingestVisualAssetEntry,
} from "./manifestStore.js";
import { capturePageViewportPng } from "./pageCaptureFallback.js";
import { resolveSessionDownloadsRelDir } from "./sessionDownloadPaths.js";
import { runSearchDiscovery } from "./searchDiscovery.js";
import type { VisualAssetManifest } from "./types.js";
import {
  recordAcquisitionAttempt,
  tiersAttempted,
  type AcquisitionAttempt,
  type AcquisitionTierId,
} from "./visualAcquisitionLadder.js";
import {
  filterOfficialRootsForGoal,
} from "./officialRootsGoalFilter.js";
import { sanitizeUrlFromText } from "./urlSanitize.js";
import {
  coerceMinWidth,
  getVapOutboundGate,
  isVapDiscoverParallelEnabled,
  isVapOfficialFirstEnabled,
} from "./vapOutboundGate.js";
import {
  extractImagesViaCrawlerSidecar,
} from "./crawlerSidecar/client.js";

const FETCH_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type UrlTemplate = {
  id: string;
  buildUrl: (subject: string) => string;
  tier: AcquisitionTierId;
  source: "official_fetch" | "authority_site" | "web_search_image";
};

const FALLBACK_AUTHORITY: UrlTemplate[] = [
  {
    id: "autohome",
    tier: "authority_industry",
    source: "authority_site",
    buildUrl: (subject) =>
      `https://www.autohome.com.cn/search?q=${encodeURIComponent(subject)}`,
  },
  {
    id: "dongchedi",
    tier: "authority_industry",
    source: "authority_site",
    buildUrl: (subject) =>
      `https://www.dongchedi.com/search?keyword=${encodeURIComponent(subject)}`,
  },
];

const LOW_QUALITY_HOST =
  /(?:book118|docin|百度文库|wenku\.baidu|pptx\.cn|jianshu\.com\/p\/)/iu;

let cachedAuthorityTemplates: UrlTemplate[] | null = null;
let cachedPortalTemplates: UrlTemplate[] | null = null;

async function loadUrlTemplates(
  configPath: string,
  tier: AcquisitionTierId,
  source: UrlTemplate["source"],
): Promise<UrlTemplate[]> {
  try {
    const raw = await readFile(path.resolve(process.cwd(), configPath), "utf8");
    const parsed = JSON.parse(raw) as {
      sources?: Array<{ id?: string; buildUrl?: string }>;
    };
    return (parsed.sources ?? [])
      .filter((item) => item.id && item.buildUrl?.includes("{subject}"))
      .map((item) => ({
        id: item.id!,
        tier,
        source,
        buildUrl: (subject: string) =>
          String(item.buildUrl).replace(
            /\{subject\}/gu,
            encodeURIComponent(subject),
          ),
      }));
  } catch {
    return [];
  }
}

async function loadAuthorityTemplates(): Promise<UrlTemplate[]> {
  if (cachedAuthorityTemplates) return cachedAuthorityTemplates;
  const loaded = await loadUrlTemplates(
    "config/visual-authority-sources.json",
    "authority_industry",
    "authority_site",
  );
  cachedAuthorityTemplates = loaded.length > 0 ? loaded : FALLBACK_AUTHORITY;
  return cachedAuthorityTemplates;
}

async function loadPortalTemplates(): Promise<UrlTemplate[]> {
  if (cachedPortalTemplates) return cachedPortalTemplates;
  cachedPortalTemplates = await loadUrlTemplates(
    "config/visual-portal-sources.json",
    "portal_general",
    "web_search_image",
  );
  return cachedPortalTemplates;
}

export type DiscoveryPipelineInput = {
  workspaceRoot: string;
  manifest: VisualAssetManifest;
  subject?: string;
  userGoal?: string;
  sourceUrls?: string[];
  authorityHints?: string[];
  minCandidates?: number;
  minWidth?: number;
  localizeTop?: number;
  capabilitySlug?: string;
  dnsResolver?: PublicDnsResolver;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type DiscoveryPipelineResult = {
  manifest: VisualAssetManifest;
  discoveredCount: number;
  localizedCount: number;
  errors: string[];
  acquisitionAttempts: AcquisitionAttempt[];
};

function guessExt(url: string, mime?: string): string {
  if (mime?.includes("png")) return ".png";
  if (mime?.includes("webp")) return ".webp";
  if (mime?.includes("gif")) return ".gif";
  if (mime?.includes("jpeg") || mime?.includes("jpg")) return ".jpg";
  const match = url.match(/\.(avif|gif|jpe?g|png|webp)(?:[?#]|$)/iu);
  if (match?.[1]) {
    const ext = match[1].toLowerCase();
    return ext === "jpeg" ? ".jpg" : `.${ext}`;
  }
  return ".jpg";
}

async function fetchHtml(
  url: string,
  input: DiscoveryPipelineInput,
): Promise<{ html: string; finalUrl: string } | null> {
  const resolver = input.dnsResolver ?? createOfficialMediaDnsResolver();
  const gate = getVapOutboundGate();
  const timeoutMs = input.timeoutMs ?? 45_000;
  try {
    const response = await gate.run(() =>
      fetchPublicHttpResource(url, {
        fetchImpl: input.fetchImpl,
        resolver,
        expectedKind: "html",
        headers: {
          "User-Agent": FETCH_USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(timeoutMs),
      }),
    );
    if (response.status < 200 || response.status >= 300) return null;
    return {
      html: response.buffer.toString("utf8"),
      finalUrl: response.url,
    };
  } catch {
    return null;
  }
}

async function localizeImage(input: {
  workspaceRoot: string;
  sessionId: string;
  imageUrl: string;
  dnsResolver: PublicDnsResolver;
  fetchImpl?: typeof fetch;
  source: VisualAssetManifest["assets"][number]["source"];
}): Promise<{ relPath: string } | null> {
  if (LOW_QUALITY_HOST.test(input.imageUrl)) return null;
  const gate = getVapOutboundGate();
  try {
    const response = await gate.run(() =>
      fetchPublicHttpResource(input.imageUrl, {
        fetchImpl: input.fetchImpl,
        resolver: input.dnsResolver,
        expectedKind: "image",
        headers: {
          "User-Agent": FETCH_USER_AGENT,
          Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(45_000),
      }),
    );
    if (response.status < 200 || response.status >= 300) return null;
    const mime = response.headers["content-type"] ?? "";
    if (mime && !mime.startsWith("image/") && !mime.includes("octet-stream")) {
      return null;
    }
    const hash = createHash("sha256").update(response.buffer).digest("hex").slice(0, 12);
    const ext = guessExt(input.imageUrl, mime);
    const relDir = resolveSessionDownloadsRelDir(input.sessionId);
    const absDir = path.join(input.workspaceRoot, relDir);
    await mkdir(absDir, { recursive: true });
    const filename = `img-${hash}${ext}`;
    await writeFile(path.join(absDir, filename), response.buffer);
    return {
      relPath: `${relDir}/${filename}`.replace(/\\/gu, "/"),
    };
  } catch {
    return null;
  }
}

function collectSourceUrls(input: DiscoveryPipelineInput): string[] {
  const urls = [
    ...(input.sourceUrls ?? []),
    ...input.manifest.sourceUrls,
  ];
  const unique = new Set<string>();
  for (const raw of urls) {
    const sanitized = sanitizeUrlFromText(raw);
    if (sanitized) unique.add(sanitized);
  }
  return [...unique].slice(0, 8);
}

function rootsToPageUrls(roots: OfficialSourceRoot[]): string[] {
  return roots
    .map((root) => sanitizeUrlFromText(root.rootUrl))
    .filter((url): url is string => Boolean(url))
    .slice(0, 6);
}

type PageJob = {
  url: string;
  tier: AcquisitionTierId;
  source: VisualAssetManifest["assets"][number]["source"];
};

async function buildPageJobs(input: DiscoveryPipelineInput): Promise<PageJob[]> {
  const jobs: PageJob[] = [];
  const seen = new Set<string>();
  const push = (job: PageJob) => {
    const key = job.url.split("?")[0] ?? job.url;
    if (seen.has(key)) return;
    seen.add(key);
    jobs.push(job);
  };

  for (const url of collectSourceUrls(input)) {
    push({ url, tier: "official_direct", source: "official_fetch" });
  }

  try {
    const registry = await loadOfficialSourceRoots();
    const scopedRoots = filterOfficialRootsForGoal(registry.roots, {
      userGoal: input.userGoal,
      subject: input.subject ?? input.manifest.subject,
      sourceUrls: collectSourceUrls(input),
    });
    for (const url of rootsToPageUrls(scopedRoots)) {
      push({ url, tier: "official_roots", source: "official_fetch" });
    }
  } catch {
    // logged in runDiscoveryPipeline
  }

  const subject = input.subject ?? input.manifest.subject ?? "";
  if (subject) {
    const authority = await loadAuthorityTemplates();
    for (const template of authority) {
      if (
        input.authorityHints?.length
        && !input.authorityHints.some((hint) =>
          template.id.includes(hint.toLowerCase())
          || hint.toLowerCase().includes(template.id)
        )
      ) {
        continue;
      }
      push({
        url: template.buildUrl(subject),
        tier: template.tier,
        source: template.source,
      });
    }
    const portals = await loadPortalTemplates();
    for (const template of portals) {
      push({
        url: template.buildUrl(subject),
        tier: template.tier,
        source: template.source,
      });
    }
  }

  return jobs.slice(0, 18);
}

async function appendSearchDiscoveryJobs(
  input: DiscoveryPipelineInput,
  jobs: PageJob[],
  acquisitionAttempts: AcquisitionAttempt[],
  candidateUrls: Array<{
    url: string;
    sourcePage: string;
    source: VisualAssetManifest["assets"][number]["source"];
    tier: AcquisitionTierId;
  }>,
): Promise<void> {
  const subject = input.subject ?? input.manifest.subject ?? "";
  if (!subject.trim()) return;

  const search = await runSearchDiscovery({
    subject,
    userGoal: input.userGoal,
    dnsResolver: input.dnsResolver ?? createOfficialMediaDnsResolver(),
    fetchImpl: input.fetchImpl,
    timeoutMs: input.timeoutMs,
    acquisitionAttempts,
  });

  const seen = new Set(jobs.map((job) => job.url.split("?")[0] ?? job.url));

  for (const hit of search.pageUrls) {
    const key = hit.url.split("?")[0] ?? hit.url;
    if (seen.has(key)) continue;
    seen.add(key);
    jobs.push({
      url: hit.url,
      tier: hit.tier,
      source: hit.tier.startsWith("search") ? "web_search_image" : "authority_site",
    });
  }

  for (const hit of search.imageUrls) {
    candidateUrls.push({
      url: hit.url,
      sourcePage: `search:${hit.query.slice(0, 80)}`,
      source: "web_search_image",
      tier: "search_engine_image",
    });
  }
}

type CandidateUrl = {
  url: string;
  sourcePage: string;
  source: VisualAssetManifest["assets"][number]["source"];
  tier: AcquisitionTierId;
};

function isPriorityJob(job: PageJob): boolean {
  return job.tier === "official_direct" || job.tier === "official_roots";
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  if (!isVapDiscoverParallelEnabled() || concurrency <= 1) {
    const out: R[] = [];
    for (const item of items) out.push(await worker(item));
    return out;
  }
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index]!);
      }
    },
  );
  await Promise.all(runners);
  return results;
}

async function ingestLocalizedCandidate(
  manifest: VisualAssetManifest,
  candidate: CandidateUrl,
  localizedRelPath: string,
  subject: string,
  capabilitySlug?: string,
): Promise<VisualAssetManifest> {
  const base = createIngestedEntry({
    source: candidate.source,
    rawPath: localizedRelPath,
    provenance: {
      sourceUrl: candidate.url,
      sourcePageUrl: candidate.sourcePage,
      fetchedAt: new Date().toISOString(),
      candidateId: `disc_${randomUUID().slice(0, 8)}`,
    },
  });
  const analysis = analyzeVisualAsset({
    rawPath: localizedRelPath,
    source: candidate.source,
    sourceUrl: candidate.url,
    subject,
    capabilitySlug,
  });
  return ingestVisualAssetEntry(manifest, {
    ...applyAnalysisToEntry(
      { ...base, assetId: `va_${randomUUID().slice(0, 12)}` },
      analysis,
    ),
  });
}

async function processPageJob(input: {
  job: PageJob;
  pipeline: DiscoveryPipelineInput;
  dnsResolver: PublicDnsResolver;
  minWidth: number;
  localizeTop: number;
  subject: string;
  captureIndex: number;
  acquisitionAttempts: AcquisitionAttempt[];
  errors: string[];
  candidateUrls: CandidateUrl[];
}): Promise<{
  captureIndex: number;
  sidecarCandidates: CandidateUrl[];
}> {
  const {
    job,
    pipeline,
    dnsResolver,
    minWidth,
    localizeTop,
    subject,
    acquisitionAttempts,
    errors,
    candidateUrls,
  } = input;
  let captureIndex = input.captureIndex;
  const sidecarCandidates: CandidateUrl[] = [];

  const page = await fetchHtml(job.url, { ...pipeline, dnsResolver });
  if (!page) {
    recordAcquisitionAttempt(acquisitionAttempts, {
      tier: job.tier,
      method: "fetch_html",
      target: job.url,
      ok: false,
      detail: "fetch_failed",
    });
    errors.push(`fetch_failed:${job.url}`);
    // T4: crawler sidecar when static HTML fails
    const sidecar = await extractImagesViaCrawlerSidecar({ url: job.url });
    recordAcquisitionAttempt(acquisitionAttempts, {
      tier: job.tier,
      method: "crawler_sidecar",
      target: job.url,
      ok: sidecar.imageUrls.length > 0,
      detail: sidecar.error ?? `images=${sidecar.imageUrls.length}`,
    });
    for (const imageUrl of sidecar.imageUrls) {
      if (LOW_QUALITY_HOST.test(imageUrl)) continue;
      sidecarCandidates.push({
        url: imageUrl,
        sourcePage: job.url,
        source: job.source,
        tier: "html_image_extract",
      });
    }
    return { captureIndex, sidecarCandidates };
  }

  recordAcquisitionAttempt(acquisitionAttempts, {
    tier: job.tier,
    method: "fetch_html",
    target: job.url,
    ok: true,
  });

  const candidates = extractPageImageCandidatesFromHtml(page.html, {
    sourceUrl: page.finalUrl,
    minWidth,
    limit: 40,
  });
  let urls = candidates.length > 0
    ? candidates.map((item) => item.url)
    : extractImageUrlsFromHtml(page.html, {
        sourceUrl: page.finalUrl,
        minWidth,
        limit: 40,
      });

  if (urls.length === 0) {
    const sidecar = await extractImagesViaCrawlerSidecar({ url: page.finalUrl });
    recordAcquisitionAttempt(acquisitionAttempts, {
      tier: "html_image_extract",
      method: "crawler_sidecar",
      target: page.finalUrl,
      ok: sidecar.imageUrls.length > 0,
      detail: sidecar.error ?? `images=${sidecar.imageUrls.length}`,
    });
    urls = sidecar.imageUrls;
  }

  recordAcquisitionAttempt(acquisitionAttempts, {
    tier: "html_image_extract",
    method: "extract_candidates",
    target: page.finalUrl,
    ok: urls.length > 0,
    detail: `candidates=${urls.length}`,
  });

  for (const imageUrl of urls.slice(0, 20)) {
    if (LOW_QUALITY_HOST.test(imageUrl)) continue;
    candidateUrls.push({
      url: imageUrl,
      sourcePage: page.finalUrl,
      source: job.source,
      tier: "html_image_extract",
    });
  }

  if (urls.length === 0) {
    const capture = await capturePageViewportPng({
      workspaceRoot: pipeline.workspaceRoot,
      sessionId: pipeline.manifest.sessionId,
      taskArtifactDir: pipeline.manifest.taskArtifactDir,
      pageUrl: page.finalUrl,
      html: page.html,
      captureIndex,
    });
    captureIndex += 1;
    recordAcquisitionAttempt(acquisitionAttempts, {
      tier: "page_screenshot",
      method: "viewport_capture",
      target: page.finalUrl,
      ok: Boolean(capture),
    });
    if (capture) {
      // Capture is kept for Vision/scene; not counted toward localizeTop here.
      void subject;
      void localizeTop;
    }
  }

  return { captureIndex, sidecarCandidates };
}

export async function runDiscoveryPipeline(
  input: DiscoveryPipelineInput,
): Promise<DiscoveryPipelineResult> {
  const errors: string[] = [];
  const acquisitionAttempts: AcquisitionAttempt[] = [
    ...(input.manifest.acquisitionAttempts ?? []),
  ];
  let manifest = { ...input.manifest, errors: [...input.manifest.errors] };
  const minRequired = input.minCandidates ?? 1;
  const localizeTop = input.localizeTop
    ?? Math.max(5, minRequired, /nova-ppt|slide|campaign|brand-campaign/iu.test(input.capabilitySlug ?? "") ? 8 : 5);
  const minWidth = coerceMinWidth(input.minWidth, 400);
  const dnsResolver = input.dnsResolver ?? createOfficialMediaDnsResolver();
  const subject = input.subject ?? input.manifest.subject ?? "";
  const officialFirst = isVapOfficialFirstEnabled();

  try {
    await loadOfficialSourceRoots();
  } catch (error) {
    errors.push(
      `official-source-roots: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const pageJobs = await buildPageJobs(input);
  const candidateUrls: CandidateUrl[] = [];
  const priorityJobs = pageJobs.filter(isPriorityJob);
  const deferredJobs = pageJobs.filter((job) => !isPriorityJob(job));

  let captureIndex = 0;

  const runJobs = async (jobs: PageJob[]) => {
    await mapPool(jobs, resolveVapParallelism(), async (job) => {
      if (manifest.assets.length >= localizeTop) return;
      const result = await processPageJob({
        job,
        pipeline: input,
        dnsResolver,
        minWidth,
        localizeTop,
        subject,
        captureIndex,
        acquisitionAttempts,
        errors,
        candidateUrls,
      });
      captureIndex = Math.max(captureIndex, result.captureIndex);
      for (const candidate of result.sidecarCandidates) {
        candidateUrls.push(candidate);
      }
    });
  };

  // T1/T2 official-first before search (T7)
  await runJobs(officialFirst ? priorityJobs : pageJobs);

  // Localize what we have so far
  const localizePending = async () => {
    const seen = new Set<string>();
    for (const candidate of candidateUrls) {
      if (manifest.assets.length >= localizeTop) break;
      const key = candidate.url.split("?")[0] ?? candidate.url;
      if (seen.has(key)) continue;
      seen.add(key);
      const localized = await localizeImage({
        workspaceRoot: input.workspaceRoot,
        sessionId: input.manifest.sessionId,
        imageUrl: candidate.url,
        dnsResolver,
        fetchImpl: input.fetchImpl,
        source: candidate.source,
      });
      recordAcquisitionAttempt(acquisitionAttempts, {
        tier: candidate.tier,
        method: "localize_image",
        target: candidate.url.slice(0, 120),
        ok: Boolean(localized),
      });
      if (!localized) {
        errors.push(`localize_failed:${candidate.url.slice(0, 80)}`);
        continue;
      }
      manifest = await ingestLocalizedCandidate(
        manifest,
        candidate,
        localized.relPath,
        subject,
        input.capabilitySlug,
      );
    }
  };

  await localizePending();

  // Only search when still short
  if (manifest.assets.length < localizeTop) {
    await appendSearchDiscoveryJobs(
      input,
      deferredJobs.length > 0 ? deferredJobs : pageJobs,
      acquisitionAttempts,
      candidateUrls,
    );
    if (officialFirst) {
      await runJobs(deferredJobs);
    }
    await localizePending();
  }

  manifest = {
    ...manifest,
    autoDiscoverTriggered: true,
    sourceUrls: collectSourceUrls(input),
    acquisitionAttempts: acquisitionAttempts.slice(-80),
    errors: [...new Set([...manifest.errors, ...errors])].slice(0, 32),
  };

  const tried = tiersAttempted(acquisitionAttempts);
  if (!tried.has("html_image_extract")) {
    recordAcquisitionAttempt(acquisitionAttempts, {
      tier: "html_image_extract",
      method: "no_html_pages",
      target: subject.slice(0, 80) || "n/a",
      ok: candidateUrls.length > 0,
    });
    manifest.acquisitionAttempts = acquisitionAttempts.slice(-80);
  }
  if (!tried.has("page_screenshot")) {
    recordAcquisitionAttempt(acquisitionAttempts, {
      tier: "page_screenshot",
      method: "not_needed_or_disabled",
      target: subject.slice(0, 80) || "n/a",
      ok: manifest.assets.some((asset) =>
        asset.provenance.notes?.includes("page_screenshot"),
      ),
    });
    manifest.acquisitionAttempts = acquisitionAttempts.slice(-80);
  }

  return {
    manifest,
    discoveredCount: candidateUrls.length,
    localizedCount: manifest.assets.length,
    errors: manifest.errors,
    acquisitionAttempts,
  };
}

function resolveVapParallelism(): number {
  if (!isVapDiscoverParallelEnabled()) return 1;
  return Math.min(4, getVapOutboundGate().stats.max);
}

export function discoverySatisfied(
  manifest: VisualAssetManifest,
  minCandidates = 1,
): boolean {
  return manifest.assets.filter(
    (asset) =>
      asset.source === "official_fetch"
      || asset.source === "authority_site"
      || asset.source === "web_search_image",
  ).length >= minCandidates;
}
