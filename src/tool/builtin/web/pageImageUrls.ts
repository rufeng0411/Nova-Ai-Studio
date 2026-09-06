/**
 * PD-SAAS-FORK P0-3: bounded semantic image extraction for public pages.
 */

export const IMAGE_URL_RE =
  /https?:\/\/[^\s"'<>)]+\.(?:avif|gif|jpe?g|png|svg|webp)(?:[/?#][^\s"'<>)]*)?/giu;

export type PageImageCandidateSource =
  | "img"
  | "srcset"
  | "picture"
  | "open_graph"
  | "twitter"
  | "preload"
  | "json_ld"
  | "css"
  | "generic";

export type PageImageCandidate = {
  url: string;
  width?: number;
  height?: number;
  mediaType?: string;
  sourceKind: PageImageCandidateSource;
};

export type ExtractPageImageUrlsOptions = {
  minWidth?: number;
  limit?: number;
  sourceUrl?: string;
};

export type ExtractPageImageUrlsResult = {
  sourceUrl: string;
  count: number;
  images: string[];
};

export function scoreImageUrl(value: string, minWidth = 800): number {
  let score = 0;
  const widthMatch = value.match(/(?:\/w|[?&](?:w|width)=)(\d+)/iu);
  if (widthMatch) {
    const width = Number.parseInt(widthMatch[1] ?? "0", 10);
    if (width >= minWidth) score += width;
  }
  if (/banner|hero|kv|product|design|thermal|connectivity/i.test(value)) score += 50;
  if (/thumb|avatar|16x16|32x32/i.test(value)) score -= 80;
  return score;
}

export function uniqueSortedImageUrls(
  urls: string[],
  minWidth = 800,
): string[] {
  const map = new Map<string, number>();
  for (const item of urls) {
    const normalized = item.replace(/\\u0026/g, "&").replace(/&amp;/g, "&");
    const current = map.get(normalized) ?? 0;
    map.set(normalized, Math.max(current, scoreImageUrl(normalized, minWidth)));
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([href]) => href);
}

type MutableCandidate = PageImageCandidate & {
  score: number;
  order: number;
};

const EXCLUDED_IMAGE_PATH =
  /(?:default[-_]?zhanwei|(?:^|[-_/])loading(?:[-_.\\/]|$)|(?:^|[-_/])error(?:[-_.\\/]|$)|(?:^|[-_/])icons?(?:[-_.\\/]|$)|logo[-_]?sprite)/iu;

function decodeHtmlValue(value: string): string {
  return value
    .replace(/\\u0026/giu, "&")
    .replace(/\\u002f/giu, "/")
    .replace(/\\\//gu, "/")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, "\"")
    .replace(/&#39;/giu, "'")
    .replace(/&#x([0-9a-f]+);/giu, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/gu, (_match, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10))
    )
    .trim();
}

function normalizeCandidateUrl(
  rawValue: string,
  sourceUrl: string | undefined,
): string | null {
  const decoded = decodeHtmlValue(rawValue);
  if (
    !decoded
    || /^(?:data|blob|javascript):/iu.test(decoded)
    || decoded.startsWith("#")
  ) {
    return null;
  }
  try {
    const parsed = sourceUrl
      ? new URL(decoded, sourceUrl)
      : new URL(decoded);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    if (EXCLUDED_IMAGE_PATH.test(parsed.pathname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/u.test(value.trim())) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function mediaTypeFromUrl(value: string, explicit?: string): string | undefined {
  if (explicit?.toLowerCase().startsWith("image/")) {
    return explicit.toLowerCase().split(";", 1)[0];
  }
  let pathname = "";
  try {
    pathname = new URL(value).pathname.toLowerCase();
  } catch {
    return undefined;
  }
  if (pathname.endsWith("/fwebp") || pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".avif")) return "image/avif";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".gif")) return "image/gif";
  if (pathname.endsWith(".svg")) return "image/svg+xml";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  return undefined;
}

function dimensionsFromUrl(value: string): {
  width?: number;
  height?: number;
} {
  const width = value.match(/(?:\/w|[?&](?:w|width)=)(\d+)/iu)?.[1];
  const height = value.match(/(?:\/h|[?&](?:h|height)=)(\d+)/iu)?.[1];
  return {
    ...(width ? { width: parsePositiveInteger(width) } : {}),
    ...(height ? { height: parsePositiveInteger(height) } : {}),
  };
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern =
    /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tag)) !== null) {
    const name = (match[1] ?? "").toLowerCase();
    if (!name || name.startsWith("<")) continue;
    attributes[name] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attributes;
}

function parseSrcset(value: string): Array<{ url: string; width?: number }> {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const pieces = part.split(/\s+/u);
      const descriptor = pieces.at(-1) ?? "";
      const widthMatch = descriptor.match(/^(\d+)w$/u);
      return {
        url: pieces[0] ?? "",
        ...(widthMatch
          ? { width: parsePositiveInteger(widthMatch[1]) }
          : {}),
      };
    });
}

function jsonImageValues(
  value: unknown,
  imageContext = false,
): string[] {
  if (typeof value === "string") {
    return imageContext ? [value] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => jsonImageValues(item, imageContext));
  }
  if (!value || typeof value !== "object") return [];

  const output: string[] = [];
  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey === "logo") continue;
    const nestedImageContext =
      imageContext
      || normalizedKey === "image"
      || normalizedKey === "images"
      || normalizedKey === "contenturl"
      || normalizedKey === "thumbnailurl";
    output.push(...jsonImageValues(nested, nestedImageContext));
  }
  return output;
}

export function extractPageImageCandidatesFromHtml(
  html: string,
  options: ExtractPageImageUrlsOptions = {},
): PageImageCandidate[] {
  const minWidth = options.minWidth ?? 800;
  const requestedLimit = options.limit ?? 40;
  const limit = Math.max(0, Math.min(requestedLimit, 40));
  const candidates = new Map<string, MutableCandidate>();
  let order = 0;

  const add = (
    rawValue: string,
    sourceKind: PageImageCandidateSource,
    clues: {
      width?: number;
      height?: number;
      mediaType?: string;
    } = {},
  ): void => {
    const url = normalizeCandidateUrl(rawValue, options.sourceUrl);
    if (!url) return;
    const inferredDimensions = dimensionsFromUrl(url);
    const width = clues.width ?? inferredDimensions.width;
    const height = clues.height ?? inferredDimensions.height;
    const mediaType = mediaTypeFromUrl(url, clues.mediaType);
    const score = scoreImageUrl(url, minWidth)
      + (width && width >= minWidth ? width : 0);
    const existing = candidates.get(url);
    if (existing) {
      existing.width = existing.width ?? width;
      existing.height = existing.height ?? height;
      existing.mediaType = existing.mediaType ?? mediaType;
      existing.score = Math.max(existing.score, score);
      return;
    }
    candidates.set(url, {
      url,
      sourceKind,
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
      ...(mediaType ? { mediaType } : {}),
      score,
      order,
    });
    order += 1;
  };

  const tagPattern = /<(img|source|meta|link)\b[^>]*>/giu;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagPattern.exec(html)) !== null) {
    const tagName = (tagMatch[1] ?? "").toLowerCase();
    const attributes = parseAttributes(tagMatch[0]);
    if (tagName === "img") {
      const width = parsePositiveInteger(attributes.width);
      const height = parsePositiveInteger(attributes.height);
      for (const key of ["src", "data-src", "data-original"]) {
        if (attributes[key]) {
          add(attributes[key], "img", { width, height });
        }
      }
      if (attributes.srcset) {
        for (const item of parseSrcset(attributes.srcset)) {
          add(item.url, "srcset", {
            width: item.width,
            height,
          });
        }
      }
      continue;
    }
    if (tagName === "source") {
      if (attributes.src) {
        add(attributes.src, "picture", {
          mediaType: attributes.type,
        });
      }
      if (attributes.srcset) {
        for (const item of parseSrcset(attributes.srcset)) {
          add(item.url, "picture", {
            width: item.width,
            mediaType: attributes.type,
          });
        }
      }
      continue;
    }
    if (tagName === "meta") {
      const name = (attributes.property ?? attributes.name ?? "").toLowerCase();
      if (/^og:image(?::url)?$/u.test(name) && attributes.content) {
        add(attributes.content, "open_graph");
      }
      if (/^twitter:image(?::src)?$/u.test(name) && attributes.content) {
        add(attributes.content, "twitter");
      }
      continue;
    }
    if (
      tagName === "link"
      && attributes.rel?.toLowerCase().split(/\s+/u).includes("preload")
      && attributes.as?.toLowerCase() === "image"
    ) {
      if (attributes.href) {
        add(attributes.href, "preload", {
          mediaType: attributes.type,
        });
      }
      if (attributes.imagesrcset) {
        for (const item of parseSrcset(attributes.imagesrcset)) {
          add(item.url, "preload", {
            width: item.width,
            mediaType: attributes.type,
          });
        }
      }
    }
  }

  const jsonLdPattern =
    /<script\b[^>]*type\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/giu;
  let jsonLdMatch: RegExpExecArray | null;
  while ((jsonLdMatch = jsonLdPattern.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(jsonLdMatch[1] ?? "");
      for (const value of jsonImageValues(parsed)) {
        add(value, "json_ld");
      }
    } catch {
      // Invalid page-owned JSON-LD is ignored; extraction stays best-effort.
    }
  }

  const cssPattern =
    /background(?:-image)?\s*:[^;{}]*?url\(\s*(?:"([^"]+)"|'([^']+)'|([^)"'\s]+))\s*\)/giu;
  let cssMatch: RegExpExecArray | null;
  while ((cssMatch = cssPattern.exec(html)) !== null) {
    add(cssMatch[1] ?? cssMatch[2] ?? cssMatch[3] ?? "", "css");
  }

  for (const match of html.match(IMAGE_URL_RE) ?? []) {
    add(match, "generic");
  }

  return [...candidates.values()]
    .sort((left, right) =>
      (right.score - left.score) || (left.order - right.order)
    )
    .slice(0, limit)
    .map(({ score: _score, order: _order, ...candidate }) => candidate);
}

export function extractImageUrlsFromHtml(
  html: string,
  options: ExtractPageImageUrlsOptions = {},
): string[] {
  return extractPageImageCandidatesFromHtml(html, options).map(
    (candidate) => candidate.url,
  );
}
