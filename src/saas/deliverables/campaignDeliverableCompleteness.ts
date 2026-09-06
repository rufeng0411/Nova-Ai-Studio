// PD-SAAS-FORK: campaign full-case folder completeness for final acceptance
import fs from "node:fs/promises";
import path from "node:path";
import type { CanonicalMessage } from "../../model/index.js";
import type { SessionDeliverableSlot } from "../taskState/sessionDeliverableManifest.js";
import {
  buildBrandCampaignSdmSlots,
  buildCampaignSdmSlots,
  buildWorldcupCampaignSdmSlots,
  extractStandardDeliverableChecklistSection,
  isBrandCampaignFullCaseGoal,
  isCampaignFullCaseGoal,
  isWorldcupCampaignFullCaseGoal,
  mapBrandChecklistSlots,
  resolveCampaignSdmSlots,
} from "./campaignDeliverableGoal.js";

export {
  buildBrandCampaignSdmSlots,
  buildCampaignSdmSlots,
  buildWorldcupCampaignSdmSlots,
  extractStandardDeliverableChecklistSection,
  isBrandCampaignFullCaseGoal,
  isCampaignFullCaseGoal,
  isWorldcupCampaignFullCaseGoal,
  mapBrandChecklistSlots,
  resolveCampaignSdmSlots,
};

function isCampaignPngDegradeEnabled(): boolean {
  // PD-SAAS-FORK VAP: official_only goals must not HTML-degrade PNG slots.
  const officialPolicy = String(
    process.env.PILOTDECK_CAMPAIGN_OFFICIAL_MEDIA_POLICY ?? "",
  ).trim().toLowerCase();
  if (officialPolicy === "official_only") return false;
  const raw = process.env.PILOTDECK_CAMPAIGN_PNG_DEGRADE;
  if (raw == null) return true;
  const value = raw.trim().toLowerCase();
  if (value === "0" || value === "false" || value === "off") return false;
  return true;
}

/** Call before campaign completeness when goal quality contract is known. */
export function setCampaignOfficialMediaPolicyForDegrade(
  policy: string | undefined,
): void {
  if (!policy) {
    delete process.env.PILOTDECK_CAMPAIGN_OFFICIAL_MEDIA_POLICY;
    return;
  }
  process.env.PILOTDECK_CAMPAIGN_OFFICIAL_MEDIA_POLICY = policy;
}

const WRITE_TOOL_NAMES = new Set([
  "write_file",
  "Write",
  "Edit",
  "edit_file",
  "MultiEdit",
  "multi_edit",
  "create_file",
  "ApplyPatch",
  "apply_patch",
  "generate_image",
  "generate_video",
  "render_html_video",
  "compose_images_to_document",
  "ocr_to_editable_pptx",
  "export_document",
]);

const PROCESS_ONLY_EXTENSIONS = new Set([
  ".bat",
  ".cmd",
  ".js",
  ".mjs",
  ".ps1",
  ".py",
  ".sh",
  ".ts",
  ".tsx",
]);

export type CampaignRequiredDeliverableCheck = {
  id: string;
  label: string;
  path?: string;
  exists: boolean;
  valid: boolean;
  reason?: "missing" | "unsafe_draft";
};

function normalizePath(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^['"`]+|['"`]+$/g, "");
}

function collectWritePathsFromValue(value: unknown, paths: Set<string>): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectWritePathsFromValue(item, paths);
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (
      typeof nested === "string"
      && (key === "file_path" || key === "filePath" || key === "output_path" || key === "outputPath" || key === "writtenFilePath")
    ) {
      addWritePath(paths, nested);
      continue;
    }
    collectWritePathsFromValue(nested, paths);
  }
}

function addWritePath(paths: Set<string>, raw: string): void {
  const normalized = normalizePath(raw);
  if (!normalized || normalized.includes("://")) return;
  if (!/(?:^|\/)artifacts\//i.test(normalized) && !/\.(?:html|md|docx|pdf|pptx|png|jpe?g|webp)$/i.test(normalized)) {
    return;
  }
  paths.add(normalized);
}

export function extractToolWrittenDeliverablePaths(messages: CanonicalMessage[]): string[] {
  const paths = new Set<string>();
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    for (const block of msg.content) {
      if (block.type === "tool_call" && WRITE_TOOL_NAMES.has(block.name)) {
        collectWritePathsFromValue(block.input, paths);
      }
      if (block.type === "tool_result") {
        collectWritePathsFromValue(block, paths);
        for (const part of block.content ?? []) {
          if (part.type === "text") {
            try {
              collectWritePathsFromValue(JSON.parse(part.text), paths);
            } catch {
              // ignore non-json tool text
            }
          }
        }
      }
    }
  }
  return [...paths];
}

function inferDominantCampaignDir(paths: string[]): string | null {
  const scores = new Map<string, number>();
  for (const raw of paths) {
    const normalized = normalizePath(raw);
    if (!normalized.includes("/")) continue;
    const dir = normalized.slice(0, normalized.lastIndexOf("/"));
    if (!/(?:^|\/)artifacts\/campaign\//i.test(dir) && !/^artifacts\/[^/]+$/i.test(dir)) {
      continue;
    }
    scores.set(dir, (scores.get(dir) ?? 0) + 1);
  }
  let bestDir: string | null = null;
  let bestScore = 0;
  for (const [dir, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }
  return bestDir;
}

/** When transcript lacks tool paths, pick the campaign folder with the most deliverable files. */
async function inferDominantCampaignDirFromDisk(cwd: string): Promise<string | null> {
  const campaignRoot = path.join(cwd, "artifacts", "campaign");
  let entries: { name: string; isDirectory: () => boolean }[];
  try {
    entries = await fs.readdir(campaignRoot, { withFileTypes: true });
  } catch {
    return null;
  }
  let bestDir: string | null = null;
  let bestScore = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const relDir = `artifacts/campaign/${entry.name}`.replace(/\\/g, "/");
    const files = await walkDeliverableFiles(path.join(campaignRoot, entry.name));
    const score = files.filter((abs) => isUserFacingCampaignFile(
      path.relative(cwd, abs).replace(/\\/g, "/"),
    )).length;
    if (score > bestScore) {
      bestScore = score;
      bestDir = relDir;
    }
  }
  return bestDir;
}

async function walkDeliverableFiles(root: string, maxDepth = 4): Promise<string[]> {
  const out: string[] = [];
  async function visit(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    let entries: { name: string; isDirectory: () => boolean }[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(abs, depth + 1);
        continue;
      }
      out.push(abs);
    }
  }
  await visit(root, 0);
  return out;
}

function isUserFacingCampaignFile(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, "/").toLowerCase();
  if (!normalized || normalized.includes("/skills/") || normalized.endsWith("skill.md")) return false;
  const ext = path.extname(normalized);
  if (PROCESS_ONLY_EXTENSIONS.has(ext)) return false;
  if (/\.(?:failed|error|partial|incomplete|tmp|bak)\./i.test(normalized)) return false;
  return /\.(?:html?|md|markdown|docx|pdf|pptx|png|jpe?g|webp|gif|svg|json|csv|xlsx)$/i.test(normalized);
}

export async function listCampaignFolderDeliverables(input: {
  cwd: string;
  messages: CanonicalMessage[];
  artifactPathHints?: string[];
}): Promise<string[]> {
  const toolPaths = extractToolWrittenDeliverablePaths(input.messages);
  const hintPaths = [...toolPaths, ...(input.artifactPathHints ?? [])];
  let dir = inferDominantCampaignDir(hintPaths);
  if (!dir) {
    dir = await inferDominantCampaignDirFromDisk(input.cwd);
  }
  if (!dir) return [];

  const absDir = path.join(input.cwd, ...dir.split("/"));
  const files = await walkDeliverableFiles(absDir);
  return files
    .map((abs) => path.relative(input.cwd, abs).replace(/\\/g, "/"))
    .filter((rel) => isUserFacingCampaignFile(rel));
}

export async function checkCampaignRequiredDeliverables(input: {
  cwd: string;
  messages: CanonicalMessage[];
  userGoal: string;
  artifactPathHints?: string[];
}): Promise<CampaignRequiredDeliverableCheck[]> {
  if (!isCampaignFullCaseGoal(input.userGoal)) return [];
  const rules = isBrandCampaignFullCaseGoal(input.userGoal)
    ? CAMPAIGN_REQUIRED_RULES.filter((rule) =>
      rule.id !== "website_index" && rule.id !== "social_images")
    : CAMPAIGN_REQUIRED_RULES;
  const toolPaths = extractToolWrittenDeliverablePaths(input.messages);
  const hintPaths = [...toolPaths, ...(input.artifactPathHints ?? [])];
  let dir = inferDominantCampaignDir(hintPaths);
  if (!dir) {
    dir = await inferDominantCampaignDirFromDisk(input.cwd);
  }
  if (!dir) {
    return rules.map((rule) => ({
      id: rule.id,
      label: rule.label,
      exists: false,
      valid: false,
      reason: "missing",
    }));
  }

  const files = await listCampaignFolderDeliverables({
    cwd: input.cwd,
    messages: input.messages,
    artifactPathHints: hintPaths,
  });
  return Promise.all(rules.map((rule) => rule.check({
    cwd: input.cwd,
    dir,
    files,
  })));
}

type CampaignRuleContext = {
  cwd: string;
  dir: string;
  files: string[];
};

type CampaignRequiredRule = {
  id: string;
  label: string;
  check: (ctx: CampaignRuleContext) => Promise<CampaignRequiredDeliverableCheck>;
};

function firstMatchingFile(files: string[], pattern: RegExp): string | undefined {
  return files.find((file) => pattern.test(file.replace(/\\/g, "/")));
}

function checkSimpleRule(input: {
  id: string;
  label: string;
  files: string[];
  pattern: RegExp;
}): CampaignRequiredDeliverableCheck {
  const match = firstMatchingFile(input.files, input.pattern);
  return {
    id: input.id,
    label: input.label,
    path: match,
    exists: Boolean(match),
    valid: Boolean(match),
    reason: match ? undefined : "missing",
  };
}

async function checkDraftManifest(ctx: CampaignRuleContext): Promise<CampaignRequiredDeliverableCheck> {
  const match = firstMatchingFile(ctx.files, /(?:draft|草稿).*manifest.*\.json$|draft-manifest\.json$/i);
  if (!match) {
    return {
      id: "draft_manifest",
      label: "平台草稿 manifest",
      exists: false,
      valid: false,
      reason: "missing",
    };
  }
  try {
    const raw = await fs.readFile(path.join(ctx.cwd, match), "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const safeDraft = parsed.publishMode === "draft" || parsed.public === false || parsed.isPublic === false;
    return {
      id: "draft_manifest",
      label: "平台草稿 manifest",
      path: match,
      exists: true,
      valid: safeDraft,
      reason: safeDraft ? undefined : "unsafe_draft",
    };
  } catch {
    return {
      id: "draft_manifest",
      label: "平台草稿 manifest",
      path: match,
      exists: true,
      valid: false,
      reason: "unsafe_draft",
    };
  }
}

const CAMPAIGN_REQUIRED_RULES: CampaignRequiredRule[] = [
  {
    id: "research_or_plan",
    label: "调研/计划文档",
    check: async (ctx) => checkSimpleRule({
      id: "research_or_plan",
      label: "调研/计划文档",
      files: ctx.files,
      pattern: /(?:research|market|调研|campaign.*plan|campaignplan|strategy|方案).*\.m(?:d|arkdown)$/i,
    }),
  },
  {
    id: "brief_docx",
    label: "传播 brief Word",
    check: async (ctx) => checkSimpleRule({
      id: "brief_docx",
      label: "传播 brief Word",
      files: ctx.files,
      pattern: /brief.*\.docx$/i,
    }),
  },
  {
    id: "main_visual",
    label: "主视觉",
    check: async (ctx) => {
      const pngMatch = firstMatchingFile(
        ctx.files,
        /(?:visual|kv|main-visual|poster|hero|主视觉).*\.(?:png|jpe?g|webp|svg)$/i,
      );
      const htmlMatch = firstMatchingFile(
        ctx.files,
        /(?:visual|kv|main-visual|poster|hero|key-visual|主视觉).*\.html?$/i,
      );
      if (pngMatch) {
        return {
          id: "main_visual",
          label: "主视觉",
          path: pngMatch,
          exists: true,
          valid: true,
        };
      }
      // PD-SAAS-FORK (ROG Phase 5): HTML poster degrades PNG requirement when image gen fails.
      if (htmlMatch && isCampaignPngDegradeEnabled()) {
        return {
          id: "main_visual",
          label: "主视觉",
          path: htmlMatch,
          exists: true,
          valid: true,
        };
      }
      const fallback = firstMatchingFile(
        ctx.files,
        /(?:visual|kv|main-visual|poster|hero|主视觉).*\.(?:png|jpe?g|webp|svg|html?)$/i,
      );
      return {
        id: "main_visual",
        label: "主视觉",
        path: fallback,
        exists: Boolean(fallback),
        valid: Boolean(fallback),
        reason: fallback ? undefined : "missing",
      };
    },
  },
  {
    id: "platform_content",
    label: "多平台内容",
    check: async (ctx) => checkSimpleRule({
      id: "platform_content",
      label: "多平台内容",
      files: ctx.files,
      pattern: /(?:platform|content|wechat|xiaohongshu|zhihu|小红书|微信|知乎).*\.(?:html?|m(?:d|arkdown))$/i,
    }),
  },
  {
    id: "social_images",
    label: "社媒比例配图",
    check: async (ctx) => {
      const pngMatch = firstMatchingFile(
        ctx.files,
        /(?:social|05-social|platform-visual|ratio).*\.(?:png|jpe?g|webp)$/i,
      );
      const htmlMatch = firstMatchingFile(
        ctx.files,
        /(?:social|05-social|platform-visual).*\.html?$/i,
      );
      if (pngMatch) {
        return {
          id: "social_images",
          label: "社媒比例配图",
          path: pngMatch,
          exists: true,
          valid: true,
        };
      }
      if (htmlMatch && isCampaignPngDegradeEnabled()) {
        return {
          id: "social_images",
          label: "社媒比例配图",
          path: htmlMatch,
          exists: true,
          valid: true,
        };
      }
      return {
        id: "social_images",
        label: "社媒比例配图",
        path: pngMatch ?? htmlMatch,
        exists: Boolean(pngMatch ?? htmlMatch),
        valid: Boolean(pngMatch ?? htmlMatch),
        reason: pngMatch ?? htmlMatch ? undefined : "missing",
      };
    },
  },
  {
    id: "website_index",
    label: "官方网站",
    check: async (ctx) => checkSimpleRule({
      id: "website_index",
      label: "官方网站",
      files: ctx.files,
      pattern: /(?:index|website|landing|home|官网).*\.html?$/i,
    }),
  },
  {
    id: "draft_manifest",
    label: "平台草稿 manifest",
    check: checkDraftManifest,
  },
  {
    id: "monitoring",
    label: "监测/复盘模板",
    check: async (ctx) => checkSimpleRule({
      id: "monitoring",
      label: "监测/复盘模板",
      files: ctx.files,
      pattern: /(?:monitor|monitoring|retrospective|复盘|监测).*\.(?:m(?:d|arkdown)|csv|xlsx)$/i,
    }),
  },
];
