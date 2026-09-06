#!/usr/bin/env node
/**
 * Extract image URLs from a public product/marketing page HTML.
 * Agent-friendly: no curl/grep, works on Windows, stdout is JSON.
 *
 * Usage:
 *   node scripts/extract-page-image-urls.mjs "https://rog.asus.com/us/desktops/mini-pc/rog-nuc-2025/"
 *   node scripts/extract-page-image-urls.mjs --url <url> [--min-width 800] [--json]
 */
import process from "node:process";

const args = process.argv.slice(2);
let url = "";
let minWidth = 800;
let jsonOnly = false;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--url") {
    url = args[++i] ?? "";
  } else if (arg === "--min-width") {
    minWidth = Number.parseInt(args[++i] ?? "800", 10) || 800;
  } else if (arg === "--json") {
    jsonOnly = true;
  } else if (!arg.startsWith("-") && !url) {
    url = arg;
  }
}

if (!url) {
  console.error("Usage: node scripts/extract-page-image-urls.mjs <url> [--min-width 800] [--json]");
  process.exit(1);
}

const IMAGE_URL_RE =
  /https?:\/\/[^\s"'<>)]+\.(?:jpg|jpeg|png|webp|gif)(?:\/[^\s"'<>)]*)?/gi;
const ASUS_GAIN_RE =
  /https:\/\/dlcdnwebimgs\.asus\.com\/gain\/[A-F0-9-]+\/w\d+\/h\d+\/fwebp/gi;
const ASUS_MEDIA_RE =
  /https:\/\/dlcdnwebimgs\.asus\.com\/files\/media\/[^\s"'<>)]+\.(?:jpg|jpeg|png|webp)/gi;

function scoreUrl(value) {
  let score = 0;
  if (/dlcdnwebimgs\.asus\.com/i.test(value)) score += 100;
  if (/\/w(\d+)\//i.test(value)) {
    const width = Number.parseInt(value.match(/\/w(\d+)\//i)?.[1] ?? "0", 10);
    if (width >= minWidth) score += width;
  }
  if (/banner|hero|kv|product|design|thermal|connectivity/i.test(value)) score += 50;
  if (/thumb|icon|logo|sprite|avatar|16x16|32x32/i.test(value)) score -= 80;
  return score;
}

function uniqueSorted(urls) {
  const map = new Map();
  for (const item of urls) {
    const normalized = item.replace(/\\u0026/g, "&").replace(/&amp;/g, "&");
    const current = map.get(normalized) ?? 0;
    map.set(normalized, Math.max(current, scoreUrl(normalized)));
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([href]) => href);
}

async function main() {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    console.error(`Fetch failed: HTTP ${response.status} ${response.statusText}`);
    process.exit(2);
  }

  const html = await response.text();
  const matches = [
    ...(html.match(ASUS_GAIN_RE) ?? []),
    ...(html.match(ASUS_MEDIA_RE) ?? []),
    ...(html.match(IMAGE_URL_RE) ?? []),
  ];
  const images = uniqueSorted(matches);

  const payload = {
    sourceUrl: response.url,
    count: images.length,
    images: images.slice(0, 40),
  };

  if (jsonOnly) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
