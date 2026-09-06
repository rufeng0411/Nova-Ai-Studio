// PD-SAAS-FORK: universal data-sources.md deliverable (web search, attachments, VAP).

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CanonicalMessage } from "../../model/index.js";
import { flattenToolResultBlockText } from "../../model/protocol/toolResultContent.js";
import type { SessionDeliverableSlot } from "../taskState/sessionDeliverableManifest.js";
import {
  joinArtifactPathHint,
  normalizeSdmPath,
  sdmBasename,
} from "./sdmSlotMatching.js";
import {
  loadVisualAssetManifest,
} from "../media/visualAssetPlatform/manifestStore.js";
import type { VisualAssetManifest } from "../media/visualAssetPlatform/types.js";
import {
  readResearchSourceLedger,
  type ResearchSourceEntry,
} from "../research/researchSourceLedger.js";
import { visualAssetPlatformMode } from "../resilience/stabilityFlags.js";

export const UNIVERSAL_DATA_SOURCES_SLOT_ID = "universal_data_sources";
export const UNIVERSAL_DATA_SOURCES_BASENAME = "data-sources.md";

const WEB_SOURCE_TOOLS = new Set([
  "web_search",
  "web_fetch",
  "fetch_page_images",
  "fetch_media_asset",
]);

export type DataSourceWebEntry = {
  tool: string;
  query?: string;
  title?: string;
  url: string;
  snippet?: string;
  source?: string;
};

export type DataSourceAttachmentEntry = {
  path: string;
  kind: string;
  name?: string;
};

export type DataSourceVisualEntry = {
  assetId: string;
  role?: string;
  source: string;
  sourceUrl?: string;
  sourcePageUrl?: string;
  localPath?: string;
};

export function isUniversalDataSourcesSlot(slot: {
  id?: string;
  pathHint?: string;
  pathHints?: string[];
}): boolean {
  if (slot.id === UNIVERSAL_DATA_SOURCES_SLOT_ID) return true;
  const hints = [slot.pathHint, ...(slot.pathHints ?? [])].filter(Boolean);
  return hints.some(
    (hint) => sdmBasename(String(hint)).toLowerCase() === UNIVERSAL_DATA_SOURCES_BASENAME,
  );
}

export function isUniversalDataSourcesPath(filePath: string): boolean {
  return sdmBasename(filePath).toLowerCase() === UNIVERSAL_DATA_SOURCES_BASENAME;
}

export function appendUniversalDataSourcesSlot(
  slots: SessionDeliverableSlot[],
  taskArtifactDir?: string,
): SessionDeliverableSlot[] {
  if (slots.some(isUniversalDataSourcesSlot)) return slots;
  const pathHint = taskArtifactDir
    ? joinArtifactPathHint(taskArtifactDir, UNIVERSAL_DATA_SOURCES_BASENAME)
    : UNIVERSAL_DATA_SOURCES_BASENAME;
  return [
    ...slots,
    {
      id: UNIVERSAL_DATA_SOURCES_SLOT_ID,
      label: "数据源溯源",
      kind: "markdown",
      pathHint,
      pathHints: [UNIVERSAL_DATA_SOURCES_BASENAME, pathHint],
      required: false,
      status: "pending",
    },
  ];
}

function buildToolCallNameMap(messages: CanonicalMessage[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const msg of messages) {
    for (const block of msg.content) {
      if (block.type !== "tool_call") continue;
      if (block.id && block.name) {
        map.set(block.id, block.name);
      }
    }
  }
  return map;
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function pushUniqueWebEntry(
  entries: DataSourceWebEntry[],
  seen: Set<string>,
  entry: DataSourceWebEntry,
): void {
  const key = `${entry.tool}|${entry.url}|${entry.query ?? ""}`.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  entries.push(entry);
}

function collectOrganicResults(
  entries: DataSourceWebEntry[],
  seen: Set<string>,
  tool: string,
  query: string | undefined,
  organic: unknown,
): void {
  if (!Array.isArray(organic)) return;
  for (const item of organic) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const url = String(row.link ?? row.url ?? row.href ?? "").trim();
    if (!url) continue;
    pushUniqueWebEntry(entries, seen, {
      tool,
      query,
      title: String(row.title ?? row.name ?? "").trim() || undefined,
      url,
      snippet: String(row.snippet ?? row.description ?? row.content ?? "").trim() || undefined,
      source: String(row.source ?? row.siteName ?? "").trim() || undefined,
    });
  }
}

function extractWebSourceEntries(messages: CanonicalMessage[]): DataSourceWebEntry[] {
  const toolNames = buildToolCallNameMap(messages);
  const entries: DataSourceWebEntry[] = [];
  const seen = new Set<string>();

  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    for (const block of msg.content) {
      if (block.type === "tool_call" && WEB_SOURCE_TOOLS.has(block.name)) {
        const input = block.input;
        if (input && typeof input === "object" && !Array.isArray(input)) {
          const url = String((input as Record<string, unknown>).url ?? "").trim();
          const query = String((input as Record<string, unknown>).query ?? "").trim();
          if (url) {
            pushUniqueWebEntry(entries, seen, {
              tool: block.name,
              query: query || undefined,
              url,
            });
          }
        }
      }
      if (block.type !== "tool_result") continue;
      const tool = toolNames.get(block.toolCallId) ?? "unknown";
      if (!WEB_SOURCE_TOOLS.has(tool)) continue;
      const text = flattenToolResultBlockText(block);
      const parsed = parseJsonObject(text);
      if (parsed) {
        const query = String(parsed.query ?? "").trim() || undefined;
        collectOrganicResults(entries, seen, tool, query, parsed.organic);
        collectOrganicResults(entries, seen, tool, query, parsed.results);
        const url = String(parsed.url ?? parsed.finalUrl ?? "").trim();
        if (url) {
          pushUniqueWebEntry(entries, seen, {
            tool,
            query,
            url,
            title: String(parsed.title ?? "").trim() || undefined,
          });
        }
      } else {
        for (const match of text.matchAll(/https?:\/\/[^\s)\]"'<>]+/gi)) {
          pushUniqueWebEntry(entries, seen, {
            tool,
            url: match[0].replace(/[.,;]+$/u, ""),
          });
        }
      }
    }
  }
  return entries;
}

function extractUserAttachmentEntries(messages: CanonicalMessage[]): DataSourceAttachmentEntry[] {
  const entries: DataSourceAttachmentEntry[] = [];
  const seen = new Set<string>();

  const pushAttachment = (rawPath: string, kind: string, name?: string): void => {
    const normalized = normalizeSdmPath(rawPath).replace(/^\/+/u, "");
    if (!normalized || seen.has(normalized.toLowerCase())) return;
    seen.add(normalized.toLowerCase());
    entries.push({ path: normalized, kind, ...(name ? { name } : {}) });
  };

  for (const msg of messages) {
    if (msg.role !== "user") continue;
    const descriptors = msg.metadata?.acceptedInput?.attachmentDescriptors ?? [];
    for (const descriptor of descriptors) {
      if (descriptor.path) {
        pushAttachment(descriptor.path, descriptor.type ?? "attachment", descriptor.name);
      }
    }
    for (const block of msg.content) {
      if (block.type === "text") {
        for (const match of block.text.matchAll(/@([^\s@][^\s]*)/g)) {
          const candidate = match[1]?.replace(/^["'`]+|["'`]+$/gu, "");
          if (candidate && /\.[a-z0-9]{1,8}$/i.test(candidate)) {
            pushAttachment(candidate, "reference");
          }
        }
      }
    }
  }
  return entries;
}

function extractVisualAssetEntries(manifest: VisualAssetManifest | null): DataSourceVisualEntry[] {
  if (!manifest?.assets?.length) return [];
  return manifest.assets.map((asset) => ({
    assetId: asset.assetId,
    role: asset.role,
    source: asset.source,
    sourceUrl: asset.provenance.sourceUrl,
    sourcePageUrl: asset.provenance.sourcePageUrl,
    localPath: asset.preparedPath ?? asset.rawPath,
  }));
}

function escapeMdCell(value: string | undefined): string {
  return String(value ?? "")
    .replace(/\|/gu, "\\|")
    .replace(/\r?\n/gu, " ")
    .trim();
}

function renderWebSection(entries: DataSourceWebEntry[]): string {
  if (entries.length === 0) {
    return "_（本会话暂无联网搜索记录）_\n";
  }
  const lines = [
    "| # | 工具 | 查询 | 标题 | 链接 | 摘要 |",
    "|---:|---|---|---|---|---|",
  ];
  entries.forEach((entry, index) => {
    lines.push(
      `| ${index + 1} | ${escapeMdCell(entry.tool)} | ${escapeMdCell(entry.query)} | ${escapeMdCell(entry.title)} | ${escapeMdCell(entry.url)} | ${escapeMdCell(entry.snippet)} |`,
    );
  });
  return `${lines.join("\n")}\n`;
}

function renderAttachmentSection(entries: DataSourceAttachmentEntry[]): string {
  if (entries.length === 0) {
    return "_（本会话未使用用户附件）_\n";
  }
  const lines = [
    "| # | 路径 | 类型 | 名称 |",
    "|---:|---|---|---|",
  ];
  entries.forEach((entry, index) => {
    lines.push(
      `| ${index + 1} | ${escapeMdCell(entry.path)} | ${escapeMdCell(entry.kind)} | ${escapeMdCell(entry.name)} |`,
    );
  });
  return `${lines.join("\n")}\n`;
}

function renderVisualSection(entries: DataSourceVisualEntry[], sourceUrls: string[]): string {
  const lines: string[] = [];
  if (sourceUrls.length > 0) {
    lines.push("### 种子 URL", "");
    sourceUrls.forEach((url, index) => {
      lines.push(`${index + 1}. ${url}`);
    });
    lines.push("");
  }
  if (entries.length === 0) {
    lines.push("_（本会话暂无 VAP 配图/素材记录）_");
    return `${lines.join("\n")}\n`;
  }
  lines.push(
    "| # | 素材 ID | 角色 | 来源类型 | 来源 URL | 页面 URL | 落盘路径 |",
    "|---:|---|---|---|---|---|---|",
  );
  entries.forEach((entry, index) => {
    lines.push(
      `| ${index + 1} | ${escapeMdCell(entry.assetId)} | ${escapeMdCell(entry.role)} | ${escapeMdCell(entry.source)} | ${escapeMdCell(entry.sourceUrl)} | ${escapeMdCell(entry.sourcePageUrl)} | ${escapeMdCell(entry.localPath)} |`,
    );
  });
  return `${lines.join("\n")}\n`;
}

function renderLedgerSection(entries: ResearchSourceEntry[]): string {
  if (entries.length === 0) {
    return "_（暂无 research-source-ledger.json 台账条目）_\n";
  }
  const lines = [
    "| # | 来源 ID | 类型 | 状态 | 链接 | 标题 |",
    "|---:|---|---|---|---|---|",
  ];
  entries.forEach((entry, index) => {
    lines.push(
      `| ${index + 1} | ${escapeMdCell(entry.sourceId)} | ${escapeMdCell(entry.kind)} | ${escapeMdCell(entry.status)} | ${escapeMdCell(entry.canonicalUrl)} | ${escapeMdCell(entry.title)} |`,
    );
  });
  return `${lines.join("\n")}\n`;
}

export function buildDataSourcesMarkdown(input: {
  webEntries: DataSourceWebEntry[];
  attachmentEntries: DataSourceAttachmentEntry[];
  visualEntries: DataSourceVisualEntry[];
  visualSourceUrls?: string[];
  ledgerEntries?: ResearchSourceEntry[];
  updatedAt?: string;
}): string {
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  return [
    "# 数据源溯源",
    "",
    "> 系统自动汇总本会话联网搜索、用户附件与 VAP 配图/素材来源，供审计与引用。",
    "",
    "## 联网搜索",
    "",
    renderWebSection(input.webEntries),
    "## 用户附件",
    "",
    renderAttachmentSection(input.attachmentEntries),
    "## VAP 配图 / 素材",
    "",
    renderVisualSection(input.visualEntries, input.visualSourceUrls ?? []),
    "## 调研台账（research-source-ledger）",
    "",
    renderLedgerSection(input.ledgerEntries ?? []),
    "",
    `_更新时间：${updatedAt}_`,
    "",
  ].join("\n");
}

export async function collectDataSourcesSnapshot(input: {
  cwd: string;
  messages: CanonicalMessage[];
  taskArtifactDir: string;
  sessionId?: string;
  goalVersion?: number;
}): Promise<{
  webEntries: DataSourceWebEntry[];
  attachmentEntries: DataSourceAttachmentEntry[];
  visualEntries: DataSourceVisualEntry[];
  visualSourceUrls: string[];
  ledgerEntries: ResearchSourceEntry[];
}> {
  const webEntries = extractWebSourceEntries(input.messages);
  const attachmentEntries = extractUserAttachmentEntries(input.messages);
  const taskRoot = path.resolve(input.cwd, input.taskArtifactDir);
  const ledger = await readResearchSourceLedger(taskRoot).catch(() => ({
    version: 1 as const,
    entries: [] as ResearchSourceEntry[],
  }));

  let visualEntries: DataSourceVisualEntry[] = [];
  let visualSourceUrls: string[] = [];
  if (visualAssetPlatformMode() !== "off") {
    try {
      const manifest = await loadVisualAssetManifest({
        workspaceRoot: input.cwd,
        taskArtifactDir: input.taskArtifactDir,
        sessionId: input.sessionId ?? "data-sources",
        goalVersion: input.goalVersion,
      });
      visualEntries = extractVisualAssetEntries(manifest);
      visualSourceUrls = manifest.sourceUrls ?? [];
    } catch {
      // ignore VAP read failures
    }
  }

  return {
    webEntries,
    attachmentEntries,
    visualEntries,
    visualSourceUrls,
    ledgerEntries: ledger.entries,
  };
}

export async function syncDataSourcesMarkdown(input: {
  cwd: string;
  messages: CanonicalMessage[];
  taskArtifactDir: string;
  sessionId?: string;
  goalVersion?: number;
}): Promise<{ relativePath: string; written: boolean; bytes: number }> {
  const relDir = normalizeSdmPath(input.taskArtifactDir).replace(/\/+$/u, "");
  const relativePath = joinArtifactPathHint(relDir, UNIVERSAL_DATA_SOURCES_BASENAME);
  const absPath = path.join(input.cwd, relativePath);
  const snapshot = await collectDataSourcesSnapshot(input);
  const markdown = buildDataSourcesMarkdown({
    ...snapshot,
    updatedAt: new Date().toISOString(),
  });
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, markdown, "utf8");
  return {
    relativePath: relativePath.replace(/\\/g, "/"),
    written: true,
    bytes: Buffer.byteLength(markdown, "utf8"),
  };
}
