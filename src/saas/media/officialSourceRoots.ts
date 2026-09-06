// PD-SAAS-FORK P0-3: validated, domain-agnostic official source registry.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { OfficialMediaSourceTier } from "../constraints/officialMediaRequirement.js";
import { normalizePublicHttpUrl } from "../../tool/builtin/web/publicHttpUrlPolicy.js";

export const OFFICIAL_SOURCE_ROOTS_VERSION = 1 as const;
export const MAX_OFFICIAL_SOURCE_ROOTS = 1_000;

export type OfficialSourceRoot = {
  id: string;
  rootUrl: string;
  sourceTier: OfficialMediaSourceTier;
  includeSubdomains?: boolean;
  /** Optional goal keywords — configured in registry JSON, not hardcoded in engine. */
  matchHints?: string[];
};

export type OfficialSourceRootsRegistry = {
  version: typeof OFFICIAL_SOURCE_ROOTS_VERSION;
  roots: OfficialSourceRoot[];
};

export type OfficialSourceRootsValidation =
  | {
      ok: true;
      registry: OfficialSourceRootsRegistry;
      issues?: never;
    }
  | {
      ok: false;
      registry?: never;
      issues: string[];
    };

const VALID_SOURCE_TIERS = new Set<OfficialMediaSourceTier>([
  "brand_official",
  "authorized_partner_official",
  "platform_verified_official",
]);

const ROOT_KEYS = new Set([
  "id",
  "rootUrl",
  "sourceTier",
  "includeSubdomains",
  "matchHints",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateOfficialSourceRoots(
  input: unknown,
): OfficialSourceRootsValidation {
  const issues: string[] = [];
  if (!isRecord(input)) {
    return {
      ok: false,
      issues: ["registry must be an object"],
    };
  }
  for (const key of Object.keys(input)) {
    if (key.startsWith("$")) continue;
    if (key !== "version" && key !== "roots") {
      issues.push(`registry contains unknown property: ${key}`);
    }
  }
  if (input.version !== OFFICIAL_SOURCE_ROOTS_VERSION) {
    issues.push(`registry version must be ${OFFICIAL_SOURCE_ROOTS_VERSION}`);
  }
  if (!Array.isArray(input.roots)) {
    issues.push("registry roots must be an array");
    return { ok: false, issues };
  }
  if (input.roots.length > MAX_OFFICIAL_SOURCE_ROOTS) {
    issues.push(
      `registry roots exceeds ${MAX_OFFICIAL_SOURCE_ROOTS} entries`,
    );
  }

  const roots: OfficialSourceRoot[] = [];
  const ids = new Set<string>();
  for (const [index, rawRoot] of input.roots.entries()) {
    const prefix = `roots[${index}]`;
    if (!isRecord(rawRoot)) {
      issues.push(`${prefix} must be an object`);
      continue;
    }
    for (const key of Object.keys(rawRoot)) {
      if (!ROOT_KEYS.has(key)) {
        issues.push(`${prefix} contains unknown property: ${key}`);
      }
    }

    const id = typeof rawRoot.id === "string" ? rawRoot.id.trim() : "";
    if (!/^[a-z0-9][a-z0-9._-]{0,79}$/u.test(id)) {
      issues.push(`${prefix}.id is invalid`);
    } else if (ids.has(id)) {
      issues.push(`${prefix}.id duplicates ${id}`);
    } else {
      ids.add(id);
    }

    const sourceTier = rawRoot.sourceTier;
    if (!VALID_SOURCE_TIERS.has(sourceTier as OfficialMediaSourceTier)) {
      issues.push(`${prefix}.sourceTier is invalid`);
    }
    if (
      rawRoot.includeSubdomains !== undefined
      && typeof rawRoot.includeSubdomains !== "boolean"
    ) {
      issues.push(`${prefix}.includeSubdomains must be boolean`);
    }

    let matchHints: string[] | undefined;
    if (rawRoot.matchHints !== undefined) {
      if (!Array.isArray(rawRoot.matchHints)) {
        issues.push(`${prefix}.matchHints must be an array`);
      } else {
        const hints: string[] = [];
        for (const [hintIndex, rawHint] of rawRoot.matchHints.entries()) {
          if (typeof rawHint !== "string" || !rawHint.trim()) {
            issues.push(`${prefix}.matchHints[${hintIndex}] must be a non-empty string`);
            continue;
          }
          hints.push(rawHint.trim());
        }
        if (hints.length > 32) {
          issues.push(`${prefix}.matchHints exceeds 32 entries`);
        }
        if (hints.length > 0) matchHints = hints;
      }
    }

    let rootUrl = "";
    if (typeof rawRoot.rootUrl !== "string") {
      issues.push(`${prefix}.rootUrl must be a string`);
    } else {
      try {
        const parsed = normalizePublicHttpUrl(rawRoot.rootUrl);
        if (parsed.search || parsed.hash) {
          issues.push(`${prefix}.rootUrl must not contain query or fragment`);
        }
        rootUrl = parsed.toString();
      } catch (error) {
        const message = error instanceof Error ? error.message : "invalid URL";
        issues.push(`${prefix}.rootUrl is unsafe: ${message}`);
      }
    }

    if (
      id
      && rootUrl
      && VALID_SOURCE_TIERS.has(sourceTier as OfficialMediaSourceTier)
      && (
        rawRoot.includeSubdomains === undefined
        || typeof rawRoot.includeSubdomains === "boolean"
      )
    ) {
      roots.push({
        id,
        rootUrl,
        sourceTier: sourceTier as OfficialMediaSourceTier,
        ...(typeof rawRoot.includeSubdomains === "boolean"
          ? { includeSubdomains: rawRoot.includeSubdomains }
          : {}),
        ...(matchHints ? { matchHints } : {}),
      });
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    registry: {
      version: OFFICIAL_SOURCE_ROOTS_VERSION,
      roots,
    },
  };
}

export function resolveOfficialSourceRootsPath(
  rootDir = process.cwd(),
): string {
  const override = process.env.PILOTDECK_OFFICIAL_SOURCE_ROOTS_PATH?.trim();
  if (override) {
    return resolve(override);
  }
  return resolve(rootDir, "config", "official-source-roots.json");
}

export async function loadOfficialSourceRoots(
  filePath = resolveOfficialSourceRootsPath(),
): Promise<OfficialSourceRootsRegistry> {
  const raw = await readFile(filePath, "utf8");
  const validation = validateOfficialSourceRoots(JSON.parse(raw));
  if (!validation.ok) {
    throw new Error(
      `Invalid official source roots registry: ${validation.issues.join("; ")}`,
    );
  }
  return validation.registry;
}
