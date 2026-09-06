import test from "node:test";
import assert from "node:assert/strict";

import {
  extractPageImageCandidatesFromHtml,
  extractImageUrlsFromHtml,
  scoreImageUrl,
  uniqueSortedImageUrls,
} from "../../src/tool/builtin/web/pageImageUrls.js";

test("extractImageUrlsFromHtml prioritizes ASUS gain CDN URLs", () => {
  const html = `
    <img src="https://example.com/thumb-icon-16x16.png" />
    <img src="https://dlcdnwebimgs.asus.com/gain/C9628BBF-3B65-44A9-A1B0-98B3AFC5CED4/w2000/h1470/fwebp" />
    <img src="https://dlcdnwebimgs.asus.com/files/media/7dce9eea-0357-4e73-8307-5cef093661c0/V1/img/banner.jpg" />
  `;
  const images = extractImageUrlsFromHtml(html, { minWidth: 800, limit: 10 });
  assert.ok(images.length >= 2);
  assert.match(images[0] ?? "", /dlcdnwebimgs\.asus\.com/);
  const asusIndex = images.findIndex((url) => url.includes("dlcdnwebimgs.asus.com"));
  const thumbIndex = images.findIndex((url) => url.includes("16x16"));
  if (thumbIndex >= 0 && asusIndex >= 0) {
    assert.ok(asusIndex < thumbIndex);
  }
});

test("scoreImageUrl ranks hero assets above thumbnails", () => {
  const hero = scoreImageUrl(
    "https://dlcdnwebimgs.asus.com/gain/ABC/w2000/h1470/fwebp",
    800,
  );
  const thumb = scoreImageUrl("https://example.com/thumb-icon-16x16.png", 800);
  assert.ok(hero > thumb);
});

test("uniqueSortedImageUrls deduplicates and normalizes ampersands", () => {
  const urls = uniqueSortedImageUrls([
    "https://example.com/hero.jpg",
    "https://example.com/hero.jpg",
    "https://example.com/hero.jpg?x=1&amp;y=2",
  ]);
  assert.equal(urls.length, 2);
});

test("extractImageUrlsFromHtml finds generic https image URLs", () => {
  const html = `<meta property="og:image" content="https://digitalassets.tesla.com/tesla-contents/image/upload/f_auto,q_auto/Product/model-y-hero.jpg" />`;
  const images = extractImageUrlsFromHtml(html);
  assert.match(images[0] ?? "", /tesla-contents/);
});

test("extractPageImageCandidatesFromHtml covers semantic HTML, JSON-LD, and CSS sources", () => {
  const html = `
    <picture>
      <source srcset="/media/hero-1600.webp 1600w, /media/hero-2400.webp 2400w" type="image/webp" />
      <img src="/media/product.jpg" width="1400" height="900"
        srcset="/media/product-800.jpg 800w, /media/product-1800.jpg 1800w" />
    </picture>
    <meta property="og:image" content="https://cdn.example.net/social/og-cover.png?sig=secret" />
    <meta name="twitter:image" content="/social/twitter-cover.jpg" />
    <link rel="preload" as="image" href="/media/preloaded-banner.avif" />
    <script type="application/ld+json">
      {"@type":"Product","image":["/media/schema-product.webp"],"contentUrl":"/media/schema-detail.png"}
    </script>
    <section style="background-image:url('/media/inline-background.jpg')"></section>
    <style>.hero { background: url("/media/stylesheet-background.webp") center/cover; }</style>
  `;

  const candidates = extractPageImageCandidatesFromHtml(html, {
    sourceUrl: "https://www.example.com/products/item",
    limit: 40,
  });
  const urls = new Set(candidates.map((candidate) => candidate.url));

  for (const expected of [
    "https://www.example.com/media/hero-1600.webp",
    "https://www.example.com/media/hero-2400.webp",
    "https://www.example.com/media/product.jpg",
    "https://www.example.com/media/product-800.jpg",
    "https://www.example.com/media/product-1800.jpg",
    "https://cdn.example.net/social/og-cover.png?sig=secret",
    "https://www.example.com/social/twitter-cover.jpg",
    "https://www.example.com/media/preloaded-banner.avif",
    "https://www.example.com/media/schema-product.webp",
    "https://www.example.com/media/schema-detail.png",
    "https://www.example.com/media/inline-background.jpg",
    "https://www.example.com/media/stylesheet-background.webp",
  ]) {
    assert.ok(urls.has(expected), `missing extracted candidate ${expected}`);
  }

  const img = candidates.find((candidate) =>
    candidate.url.endsWith("/media/product.jpg")
  );
  assert.deepEqual(
    { width: img?.width, height: img?.height, mediaType: img?.mediaType },
    { width: 1400, height: 900, mediaType: "image/jpeg" },
  );
});

test("page image extraction filters placeholders and icon/logo sprites", () => {
  const html = `
    <img src="https://cdn.example.com/default-zhanwei.jpg" />
    <img src="https://cdn.example.com/loading.gif" />
    <img src="https://cdn.example.com/error.png" />
    <img src="https://cdn.example.com/icons/icon-search.svg" />
    <img src="https://cdn.example.com/logo-sprite.png" />
    <img src="https://cdn.example.com/products/real-hero.webp" />
  `;

  assert.deepEqual(
    extractImageUrlsFromHtml(html, {
      sourceUrl: "https://example.com/products",
    }),
    ["https://cdn.example.com/products/real-hero.webp"],
  );
});

test("page image extraction enforces a hard maximum of forty candidates", () => {
  const html = Array.from(
    { length: 55 },
    (_, index) => `<img src="/media/photo-${index}.jpg" />`,
  ).join("\n");

  const candidates = extractPageImageCandidatesFromHtml(html, {
    sourceUrl: "https://example.com/products",
    limit: 100,
  });
  assert.equal(candidates.length, 40);
});
