import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyOfficialMediaAsset,
  classifyOfficialSource,
  extractTrustedUserExplicitUrls,
} from "../../src/saas/media/officialSourceClassifier.js";
import {
  validateOfficialSourceRoots,
  type OfficialSourceRootsRegistry,
} from "../../src/saas/media/officialSourceRoots.js";

const registry: OfficialSourceRootsRegistry = {
  version: 1,
  roots: [
    {
      id: "example-brand",
      rootUrl: "https://brand.example.co.uk/",
      sourceTier: "brand_official",
      includeSubdomains: true,
    },
    {
      id: "example-platform",
      rootUrl: "https://verified.example.com/channel/",
      sourceTier: "platform_verified_official",
      includeSubdomains: false,
    },
  ],
};

test("user-explicit URL is L0 while a page Organization claim alone is not", () => {
  const explicit = classifyOfficialSource({
    url: "https://www.example.com/product?campaign=spring",
    userExplicitUrls: ["https://example.com/product?source=user"],
    declaresOrganization: false,
  });
  assert.equal(explicit.level, "L0");
  assert.equal(explicit.reason, "user_explicit_url");

  const selfDeclared = classifyOfficialSource({
    url: "https://publisher.example.net/story",
    declaresOrganization: true,
  });
  assert.equal(selfDeclared.level, "L3");
  assert.equal(selfDeclared.reason, "unverified");
});

test("trusted user URL extraction keeps only bounded public HTTP URLs", () => {
  const values = extractTrustedUserExplicitUrls([
    "官方素材页 http://brand.example.com/product?campaign=spring。",
    "不要访问 https://127.0.0.1/private，也忽略 ftp://example.com/file。",
    "重复 https://brand.example.com/product?campaign=spring",
  ].join("\n"));
  assert.deepEqual(values, [
    "https://brand.example.com/product?campaign=spring",
  ]);
});

test("official root registry matches exact roots and explicit subdomains using PSL domains", () => {
  const subdomain = classifyOfficialSource({
    url: "https://media.brand.example.co.uk/assets/hero",
    registry,
  });
  assert.deepEqual(
    {
      level: subdomain.level,
      reason: subdomain.reason,
      rootId: subdomain.rootId,
      sourceTier: subdomain.sourceTier,
    },
    {
      level: "L0",
      reason: "official_source_root",
      rootId: "example-brand",
      sourceTier: "brand_official",
    },
  );

  const unrelated = classifyOfficialSource({
    url: "https://brand.evil.co.uk/assets/hero",
    registry,
  });
  assert.equal(unrelated.level, "L3");

  const outsidePath = classifyOfficialSource({
    url: "https://verified.example.com/other/page",
    registry,
  });
  assert.equal(outsidePath.level, "L3");
});

test("a direct backlink from a verified L0 root can elevate the linked page", () => {
  const targetUrl = "https://campaign.example.net/official-launch";
  const linked = classifyOfficialSource({
    url: targetUrl,
    trustedRootReferrer: {
      url: "https://brand.example.co.uk/",
      level: "L0",
      linkedUrls: [targetUrl],
    },
  });
  assert.equal(linked.level, "L0");
  assert.equal(linked.reason, "trusted_root_backlink");

  const unlinked = classifyOfficialSource({
    url: targetUrl,
    trustedRootReferrer: {
      url: "https://brand.example.co.uk/",
      level: "L0",
      linkedUrls: ["https://campaign.example.net/other"],
    },
  });
  assert.equal(unlinked.level, "L3");
});

test("CDN media inherits only the source-page classification", () => {
  const inherited = classifyOfficialMediaAsset({
    assetUrl: "https://brand.example.co.uk/assets/cdn-image.jpg",
    sourcePage: {
      url: "https://unverified.example.net/article",
      level: "L3",
      reason: "unverified",
    },
    registry,
  });
  assert.equal(inherited.level, "L3");
  assert.equal(inherited.reason, "source_page_inheritance");
});

test("official source registry validation rejects malformed or unsafe roots", () => {
  const valid = validateOfficialSourceRoots(registry);
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.registry, registry);

  const invalid = validateOfficialSourceRoots({
    version: 1,
    roots: [
      {
        id: "duplicate",
        rootUrl: "https://127.0.0.1/private",
        sourceTier: "brand_official",
      },
      {
        id: "duplicate",
        rootUrl: "https://example.com:8443/private",
        sourceTier: "unknown",
      },
    ],
  });
  assert.equal(invalid.ok, false);
  assert.ok((invalid.issues?.length ?? 0) >= 3);
});
