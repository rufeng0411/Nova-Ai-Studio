// PD-SAAS-FORK VAP P0-B: audit deliverable files reference manifest official assets.

import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { looksLikeVisualPlaceholder } from "../officialMediaPlaceholder.js";
import { loadVisualAssetManifest } from "./manifestStore.js";
import { isAcquisitionLadderExhausted } from "./visualAcquisitionLadder.js";
import type {
  VisualAssetEntry,
  VisualAssetManifest,
  VisualAssetSource,
} from "./types.js";
import { visualBindingAuditMode } from "../../resilience/stabilityFlags.js";
import type { AcceptanceFailure } from "../../deliverables/acceptanceChecks.js";

export const VISUAL_BINDING_GAP_KEY = "visual_asset.unbound_in_deliverable";
export const VISUAL_UNRENDERABLE_GAP_KEY = "visual_asset.unrenderable_in_preview";

export type VisualBindingFailure = {
  code: typeof VISUAL_BINDING_GAP_KEY | typeof VISUAL_UNRENDERABLE_GAP_KEY;
  deliverablePath: string;
  message: string;
  expectedManifestPaths?: string[];
};

export type VisualBindingAuditResult = {
  passed: boolean;
  officialAssetCount: number;
  boundPathCount: number;
  failures: VisualBindingFailure[];
  shadowOnly: boolean;
  ladderExhausted: boolean;
};

const DELIVERABLE_SCAN_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".md",
  ".markdown",
]);

const VISUAL_DELIVERABLE_BASENAME =
  /(?:^|\/)(?:index|slide-\d+|key-visual[^/]*|social-[^/]+|platform-[^/]+)\.(?:html?|png|jpe?g|webp|svg)$/iu;

const PLACEHOLDER_REF =
  /(?:placeholder(?:\.svg)?|official-media-placeholder|data:image\/(?:svg|png)|hero-placeholder)/iu;

const IMG_SRC_PATTERN =
  /<(?:img|source|image)\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/giu;
const CSS_URL_PATTERN =
  /background(?:-image)?\s*:\s*url\(\s*["']?([^"')]+)["']?\s*\)/giu;
const MARKDOWN_IMG_PATTERN =
  /!\[[^\]]*\]\(([^)]+)\)/giu;

export function isOfficialGradeVisualSource(source: VisualAssetSource): boolean {
  return (
    source === "official_fetch"
    || source === "authority_site"
    || source === "web_search_image"
  );
}

export function officialAssetsFromManifest(
  manifest: VisualAssetManifest,
): VisualAssetEntry[] {
  return manifest.assets.filter((asset) => isOfficialGradeVisualSource(asset.source));
}

export function manifestPathCandidates(entry: VisualAssetEntry): string[] {
  const paths = [entry.preparedPath, entry.rawPath].filter(Boolean) as string[];
  return [...new Set(paths.map((value) => value.replace(/\\/gu, "/")))];
}

function normalizeRef(value: string): string {
  return value
    .trim()
    .replace(/\\/gu, "/")
    .split("#")[0]!
    .split("?")[0]!
    .toLowerCase();
}

function basenameOf(value: string): string {
  return path.posix.basename(normalizeRef(value));
}

export function referencesManifestPath(
  reference: string,
  manifestPaths: string[],
): boolean {
  const normalized = normalizeRef(reference);
  if (!normalized || /^https?:/iu.test(normalized) || normalized.startsWith("data:")) {
    return false;
  }
  const refBase = basenameOf(normalized);
  return manifestPaths.some((manifestPath) => {
    const candidate = normalizeRef(manifestPath);
    if (!candidate) return false;
    if (normalized === candidate) return true;
    if (normalized.endsWith(candidate)) return true;
    if (candidate.endsWith(normalized)) return true;
    return basenameOf(candidate) === refBase;
  });
}

export function extractVisualReferences(content: string): string[] {
  const refs: string[] = [];
  for (const pattern of [IMG_SRC_PATTERN, CSS_URL_PATTERN, MARKDOWN_IMG_PATTERN]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const value = String(match[1] ?? "").trim();
      if (value) refs.push(value);
    }
  }
  return refs;
}

function isVisualDeliverablePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/gu, "/");
  if (DELIVERABLE_SCAN_EXTENSIONS.has(path.extname(normalized).toLowerCase())) {
    return true;
  }
  return VISUAL_DELIVERABLE_BASENAME.test(normalized);
}

function deliverableUsesOnlyPlaceholders(content: string, filePath: string): boolean {
  const refs = extractVisualReferences(content);
  if (refs.length === 0) {
    return looksLikeVisualPlaceholder({ path: filePath, textPreview: content });
  }
  return refs.every((ref) => {
    const normalized = normalizeRef(ref);
    return (
      PLACEHOLDER_REF.test(normalized)
      || looksLikeVisualPlaceholder({ path: ref, textPreview: ref })
      || /^https?:/iu.test(normalized)
    );
  });
}

function deliverableReferencesOfficialAssets(
  content: string,
  manifestPaths: string[],
): boolean {
  const refs = extractVisualReferences(content);
  if (refs.length === 0) return false;
  return refs.some((ref) => referencesManifestPath(ref, manifestPaths));
}

/** Hero/HTML still shows placeholder chrome after binding official assets. */
export function deliverableHasLingeringPlaceholderMarkup(content: string): boolean {
  if (/class\s*=\s*["'][^"']*\bimg-placeholder\b/iu.test(content)) {
    return true;
  }
  return /图源待补|图片待补|需接入官方(?:渠道|渲染)?(?:产品)?图/iu.test(content);
}

export type RunDeliverableVisualBindingAuditInput = {
  cwd: string;
  verifiedPaths: string[];
  taskArtifactDir?: string;
  sessionId?: string;
  goalVersion?: number;
  officialMediaRequired?: boolean;
  manifest?: VisualAssetManifest;
};

export async function runDeliverableVisualBindingAudit(
  input: RunDeliverableVisualBindingAuditInput,
): Promise<VisualBindingAuditResult | null> {
  const mode = visualBindingAuditMode();
  if (mode === "off" || !input.officialMediaRequired) return null;

  let manifest = input.manifest;
  if (!manifest && input.taskArtifactDir) {
    try {
      manifest = await loadVisualAssetManifest({
        workspaceRoot: input.cwd,
        taskArtifactDir: input.taskArtifactDir,
        sessionId: input.sessionId ?? "audit",
        goalVersion: input.goalVersion,
      });
    } catch {
      manifest = undefined;
    }
  }

  const officialAssets = manifest ? officialAssetsFromManifest(manifest) : [];
  const manifestPaths = officialAssets.flatMap(manifestPathCandidates);
  const ladderExhausted = manifest
    ? isAcquisitionLadderExhausted(
        manifest.acquisitionAttempts ?? [],
        manifest.assets.length,
        1,
      )
    : false;

  if (officialAssets.length === 0) {
    return {
      passed: true,
      officialAssetCount: 0,
      boundPathCount: 0,
      failures: [],
      shadowOnly: mode === "shadow",
      ladderExhausted,
    };
  }

  const scanPaths = input.verifiedPaths.filter(isVisualDeliverablePath);
  const failures: VisualBindingFailure[] = [];
  let boundPathCount = 0;

  for (const relPath of scanPaths) {
    const absPath = path.resolve(input.cwd, relPath);
    let content = "";
    try {
      if (DELIVERABLE_SCAN_EXTENSIONS.has(path.extname(relPath).toLowerCase())) {
        content = await readFile(absPath, "utf8");
        if (/\.\.\/(?:assets\/raw|artifacts\/sessions\/[^/]+\/downloads)/iu.test(content)) {
          failures.push({
            code: VISUAL_UNRENDERABLE_GAP_KEY,
            deliverablePath: relPath,
            message: "交付物含跨 task 的 ../assets/raw 或 ../downloads 引用，预览鉴权将失败。",
            expectedManifestPaths: manifestPaths.slice(0, 6),
          });
        }
      } else if (/\.(?:png|jpe?g|webp|svg)$/iu.test(relPath)) {
        const normalizedRel = relPath.replace(/\\/gu, "/");
        const slideMatch = /slide-\d+\.png$/iu.test(normalizedRel);
        const boundAssetId = manifest?.slotBindings
          ? Object.entries(manifest.slotBindings).find(([, assetId]) => {
              const asset = manifest?.assets.find((item) => item.assetId === assetId);
              if (!asset) return false;
              const usePath = asset.preparedPath ?? asset.rawPath;
              return usePath && normalizeRef(usePath) === normalizeRef(relPath);
            })?.[1]
          : undefined;
        const boundOfficial = boundAssetId
          ? manifest?.assets.find((item) => item.assetId === boundAssetId)
          : undefined;
        if (slideMatch) {
          if (boundOfficial && isOfficialGradeVisualSource(boundOfficial.source)) {
            boundPathCount += 1;
            continue;
          }
          if (boundOfficial?.source === "generate_image") {
            failures.push({
              code: VISUAL_BINDING_GAP_KEY,
              deliverablePath: relPath,
              message: "幻灯片仍使用 AI 生图，未绑定官方 manifest 素材。",
              expectedManifestPaths: manifestPaths.slice(0, 6),
            });
            continue;
          }
        }
        const matchesManifestPath = manifestPaths.some(
          (manifestPath) => normalizeRef(manifestPath) === normalizeRef(relPath),
        );
        const isVisualRaster = VISUAL_DELIVERABLE_BASENAME.test(normalizedRel);
        if (
          isVisualRaster
          && officialAssets.length > 0
          && !matchesManifestPath
          && !(boundOfficial && isOfficialGradeVisualSource(boundOfficial.source))
        ) {
          failures.push({
            code: VISUAL_BINDING_GAP_KEY,
            deliverablePath: relPath,
            message: "视觉交付物未绑定 manifest 官方素材路径。",
            expectedManifestPaths: manifestPaths.slice(0, 6),
          });
        }
        continue;
      }
    } catch {
      continue;
    }

    if (deliverableReferencesOfficialAssets(content, manifestPaths)) {
      if (deliverableHasLingeringPlaceholderMarkup(content)) {
        failures.push({
          code: VISUAL_BINDING_GAP_KEY,
          deliverablePath: relPath,
          message:
            "交付物已引用 manifest 官方路径，但仍保留占位图层或「图源待补」文案，须 rewrite 移除 img-placeholder。",
          expectedManifestPaths: manifestPaths.slice(0, 6),
        });
      } else {
        boundPathCount += 1;
      }
      continue;
    }
    if (deliverableUsesOnlyPlaceholders(content, relPath)) {
      failures.push({
        code: VISUAL_BINDING_GAP_KEY,
        deliverablePath: relPath,
        message: "交付物仍使用占位图/外链，未引用 manifest 中的官方素材路径。",
        expectedManifestPaths: manifestPaths.slice(0, 6),
      });
    }

    if (
      DELIVERABLE_SCAN_EXTENSIONS.has(path.extname(relPath).toLowerCase())
      && content
      && !failures.some((failure) =>
        failure.deliverablePath === relPath && failure.code === VISUAL_BINDING_GAP_KEY
      )
    ) {
      const refs = extractVisualReferences(content);
      const htmlDir = path.dirname(absPath);
      for (const ref of refs) {
        const normalized = normalizeRef(ref);
        if (!normalized || /^https?:/iu.test(normalized) || normalized.startsWith("data:")) {
          continue;
        }
        if (PLACEHOLDER_REF.test(normalized) || looksLikeVisualPlaceholder({ path: ref, textPreview: ref })) {
          continue;
        }
        const candidateAbs = path.resolve(htmlDir, ref.replace(/^\.\//u, ""));
        const exists = await access(candidateAbs).then(() => true).catch(() => false);
        if (!exists && referencesManifestPath(ref, manifestPaths)) {
          failures.push({
            code: VISUAL_UNRENDERABLE_GAP_KEY,
            deliverablePath: relPath,
            message: `HTML 引用 ${ref} 在磁盘不存在，预览将裂图。`,
            expectedManifestPaths: manifestPaths.slice(0, 6),
          });
        } else if (exists && !referencesManifestPath(ref, manifestPaths)) {
          failures.push({
            code: VISUAL_UNRENDERABLE_GAP_KEY,
            deliverablePath: relPath,
            message: `HTML 引用 ${ref} 未绑定 manifest 官方路径。`,
            expectedManifestPaths: manifestPaths.slice(0, 6),
          });
        } else if (!exists && !referencesManifestPath(ref, manifestPaths)) {
          failures.push({
            code: VISUAL_UNRENDERABLE_GAP_KEY,
            deliverablePath: relPath,
            message: `HTML 引用 ${ref} 在磁盘不存在，预览将裂图。`,
            expectedManifestPaths: manifestPaths.slice(0, 6),
          });
        }
      }
    }
  }

  const passed = failures.length === 0;
  return {
    passed,
    officialAssetCount: officialAssets.length,
    boundPathCount,
    failures,
    shadowOnly: mode === "shadow",
    ladderExhausted,
  };
}

export function applyVisualBindingAuditToAcceptance(input: {
  audit: VisualBindingAuditResult | null;
  failures: AcceptanceFailure[];
  acceptance: "passed" | "needs_repair" | "user_action_required" | "not_applicable" | "failed";
}): {
  acceptance: typeof input.acceptance;
  failures: AcceptanceFailure[];
} {
  if (!input.audit || input.audit.shadowOnly || input.audit.passed) {
    return { acceptance: input.acceptance, failures: input.failures };
  }
  const nextFailures = [...input.failures];
  for (const failure of input.audit.failures) {
    nextFailures.push({
      reason: "broken",
      message: failure.message,
      path: failure.deliverablePath,
      expected: failure.expectedManifestPaths?.[0],
    });
  }
  return {
    acceptance: "needs_repair",
    failures: nextFailures,
  };
}
