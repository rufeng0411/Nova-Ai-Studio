// PD-SAAS-FORK P0-3: evidence-based official source classification.

import {
  getRegistrableDomain,
  normalizePublicHttpUrl,
} from "../../tool/builtin/web/publicHttpUrlPolicy.js";
import type {
  OfficialSourceRoot,
  OfficialSourceRootsRegistry,
} from "./officialSourceRoots.js";
import type { OfficialMediaSourceTier } from "../constraints/officialMediaRequirement.js";

export type OfficialSourceLevel = "L0" | "L1" | "L2" | "L3";

export type OfficialSourceReason =
  | "user_explicit_url"
  | "official_source_root"
  | "trusted_root_backlink"
  | "source_page_inheritance"
  | "unverified";

export type OfficialSourceClassification = {
  url: string;
  level: OfficialSourceLevel;
  reason: OfficialSourceReason;
  sourceTier?: OfficialMediaSourceTier;
  rootId?: string;
};

export type TrustedRootReferrer = {
  url: string;
  level: OfficialSourceLevel;
  linkedUrls: readonly string[];
};

export type ClassifyOfficialSourceInput = {
  url: string;
  userExplicitUrls?: readonly string[];
  registry?: OfficialSourceRootsRegistry;
  trustedRootReferrer?: TrustedRootReferrer;
  /** Informational only. Page-authored Organization data is not trust proof. */
  declaresOrganization?: boolean;
};

export type ClassifyOfficialMediaAssetInput = {
  assetUrl: string;
  sourcePage: OfficialSourceClassification;
  registry?: OfficialSourceRootsRegistry;
};

const USER_EXPLICIT_URL = /\bhttps?:\/\/[^\s<>"'`]+/giu;
const MAX_TRUSTED_USER_EXPLICIT_URLS = 16;

export function extractTrustedUserExplicitUrls(userText: string): string[] {
  const output: string[] = [];
  for (const raw of userText.match(USER_EXPLICIT_URL) ?? []) {
    const candidate = raw.replace(/[),.;!?。，；、）】]+$/u, "");
    try {
      const normalized = normalizePublicHttpUrl(candidate).toString();
      if (!output.includes(normalized)) {
        output.push(normalized);
      }
      if (output.length >= MAX_TRUSTED_USER_EXPLICIT_URLS) break;
    } catch {
      // User text can contain local/non-HTTP references; they are not trusted.
    }
  }
  return output;
}

function canonicalEvidenceUrl(value: string): URL | null {
  try {
    const parsed = normalizePublicHttpUrl(value);
    parsed.search = "";
    parsed.hash = "";
    return parsed;
  } catch {
    return null;
  }
}

function stripWww(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./u, "").replace(/\.$/u, "");
}

function normalizePathname(pathname: string): string {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/u, "");
}

function urlsIdentifySamePage(left: URL, right: URL): boolean {
  return (
    stripWww(left.hostname) === stripWww(right.hostname)
    && normalizePathname(left.pathname) === normalizePathname(right.pathname)
  );
}

function pathFallsUnderRoot(pathname: string, rootPathname: string): boolean {
  const normalizedRoot = normalizePathname(rootPathname);
  const normalizedPath = normalizePathname(pathname);
  if (normalizedRoot === "/") return true;
  return (
    normalizedPath === normalizedRoot
    || normalizedPath.startsWith(`${normalizedRoot}/`)
  );
}

function rootMatchesUrl(root: OfficialSourceRoot, target: URL): boolean {
  const rootUrl = canonicalEvidenceUrl(root.rootUrl);
  if (!rootUrl || !pathFallsUnderRoot(target.pathname, rootUrl.pathname)) {
    return false;
  }
  if (stripWww(target.hostname) === stripWww(rootUrl.hostname)) {
    return true;
  }
  if (!root.includeSubdomains) return false;

  const targetDomain = getRegistrableDomain(target.hostname);
  const rootDomain = getRegistrableDomain(rootUrl.hostname);
  if (!targetDomain || !rootDomain || targetDomain !== rootDomain) {
    return false;
  }
  const rootHostname = stripWww(rootUrl.hostname);
  const targetHostname = stripWww(target.hostname);
  return (
    targetHostname === rootHostname
    || targetHostname.endsWith(`.${rootHostname}`)
  );
}

function findRegistryRoot(
  target: URL,
  registry: OfficialSourceRootsRegistry | undefined,
): OfficialSourceRoot | undefined {
  return registry?.roots.find((root) => rootMatchesUrl(root, target));
}

export function classifyOfficialSource(
  input: ClassifyOfficialSourceInput,
): OfficialSourceClassification {
  const target = canonicalEvidenceUrl(input.url);
  if (!target) {
    return {
      url: input.url,
      level: "L3",
      reason: "unverified",
    };
  }

  const explicitMatch = input.userExplicitUrls?.some((value) => {
    const explicit = canonicalEvidenceUrl(value);
    return explicit ? urlsIdentifySamePage(target, explicit) : false;
  });
  if (explicitMatch) {
    return {
      url: target.toString(),
      level: "L0",
      reason: "user_explicit_url",
    };
  }

  const root = findRegistryRoot(target, input.registry);
  if (root) {
    return {
      url: target.toString(),
      level: "L0",
      reason: "official_source_root",
      sourceTier: root.sourceTier,
      rootId: root.id,
    };
  }

  const trustedRootReferrer = input.trustedRootReferrer;
  if (trustedRootReferrer?.level === "L0") {
    const linked = trustedRootReferrer.linkedUrls.some((value) => {
      const linkedUrl = canonicalEvidenceUrl(value);
      return linkedUrl ? urlsIdentifySamePage(target, linkedUrl) : false;
    });
    if (linked) {
      return {
        url: target.toString(),
        level: "L0",
        reason: "trusted_root_backlink",
      };
    }
  }

  // A page's own Organization/brand claims are deliberately not considered.
  return {
    url: target.toString(),
    level: "L3",
    reason: "unverified",
  };
}

export function classifyOfficialMediaAsset(
  input: ClassifyOfficialMediaAssetInput,
): OfficialSourceClassification {
  const asset = canonicalEvidenceUrl(input.assetUrl);
  return {
    url: asset?.toString() ?? input.assetUrl,
    level: input.sourcePage.level,
    reason: "source_page_inheritance",
    ...(input.sourcePage.sourceTier
      ? { sourceTier: input.sourcePage.sourceTier }
      : {}),
    ...(input.sourcePage.rootId ? { rootId: input.sourcePage.rootId } : {}),
  };
}
