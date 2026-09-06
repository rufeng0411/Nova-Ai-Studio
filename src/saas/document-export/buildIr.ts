// PD-SAAS-FORK: build Document IR from workspace source file
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { DocumentIr } from "./types.js";
import { parseHtmlToIr } from "./parseHtml.js";
import { parseMarkdownToIr, irToPlainMarkdown } from "./parseMarkdown.js";
import { markdownInlineToHtml, escapeHtml as escapeInlineHtml } from "./markdownInline.js";
import { resolveIrAssetPaths } from "./resolveAssets.js";
import { enrichMultimodalBlocks } from "./enrichMultimodal.js";
import { parseSpreadsheetToIr } from "./parseSpreadsheet.js";
import {
  enrichDocumentIrFromVisualManifest,
  inferTaskArtifactDirFromSourcePath,
} from "./enrichIrFromVisualManifest.js";

const MD_EXT = new Set([".md", ".markdown"]);
const HTML_EXT = new Set([".html", ".htm"]);
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);
const SPREADSHEET_EXT = new Set([".csv", ".tsv", ".xlsx", ".xls"]);
const SCAN_EXT = new Set([".pdf", ".ppt", ".pptx", ...IMAGE_EXT]);

const turnIrCache = new Map<string, DocumentIr>();

function irCacheKey(
  sourceAbsolutePath: string,
  mtimeMs: number,
  options?: { sessionId?: string; goalVersion?: number },
): string {
  return `${options?.sessionId ?? "anon"}:${sourceAbsolutePath}:${mtimeMs}:${options?.goalVersion ?? 0}`;
}

export function detectSourceKind(filePath: string): DocumentIr["sourceKind"] {
  const ext = path.extname(filePath).toLowerCase();
  if (MD_EXT.has(ext)) return "markdown";
  if (HTML_EXT.has(ext)) return "html";
  if (SPREADSHEET_EXT.has(ext)) return "spreadsheet";
  if (IMAGE_EXT.has(ext)) return "image";
  if (ext === ".pdf") return "pdf";
  return "unknown";
}

export async function buildDocumentIr(
  sourceAbsolutePath: string,
  workspaceRoot: string,
  options?: {
    enrichMultimodal?: boolean;
    env?: NodeJS.ProcessEnv;
    sessionId?: string;
    goalVersion?: number;
    taskArtifactDir?: string;
  },
): Promise<DocumentIr> {
  let mtimeMs = 0;
  try {
    mtimeMs = (await stat(sourceAbsolutePath)).mtimeMs;
  } catch {
    mtimeMs = 0;
  }
  const cacheKey = irCacheKey(sourceAbsolutePath, mtimeMs, options);
  const cached = turnIrCache.get(cacheKey);
  if (cached) return cached;

  const kind = detectSourceKind(sourceAbsolutePath);
  const relative = path.relative(workspaceRoot, sourceAbsolutePath).split(path.sep).join("/");
  let ir: DocumentIr;

  if (kind === "markdown") {
    const content = await readFile(sourceAbsolutePath, "utf8");
    ir = parseMarkdownToIr(relative, content);
  } else if (kind === "html") {
    const content = await readFile(sourceAbsolutePath, "utf8");
    ir = parseHtmlToIr(relative, content);
  } else if (kind === "spreadsheet") {
    ir = await parseSpreadsheetToIr(sourceAbsolutePath, workspaceRoot);
  } else if (kind === "image" || kind === "pdf") {
    ir = {
      sourcePath: relative,
      sourceKind: kind,
      title: path.basename(sourceAbsolutePath),
      blocks: [],
    };
  } else {
    const content = await readFile(sourceAbsolutePath, "utf8").catch(() => "");
    ir = content.trim()
      ? parseMarkdownToIr(relative, content)
      : { sourcePath: relative, sourceKind: "unknown", blocks: [] };
  }

  ir = await resolveIrAssetPaths(ir, workspaceRoot);
  if (options?.enrichMultimodal !== false && kind === "html") {
    ir = await enrichMultimodalBlocks(ir, sourceAbsolutePath, workspaceRoot, options?.env ?? process.env);
  }
  const taskArtifactDir =
    options?.taskArtifactDir
    ?? inferTaskArtifactDirFromSourcePath(relative);
  ir = await enrichDocumentIrFromVisualManifest({
    ir,
    workspaceRoot,
    taskArtifactDir,
    sessionId: options?.sessionId,
    goalVersion: options?.goalVersion,
  });
  turnIrCache.set(cacheKey, ir);
  if (turnIrCache.size > 64) {
    const firstKey = turnIrCache.keys().next().value;
    if (firstKey) turnIrCache.delete(firstKey);
  }
  return ir;
}

export function irToStandaloneHtml(ir: DocumentIr, sourceAbsolutePath?: string): string {
  const parts: string[] = [
    "<!DOCTYPE html><html lang=\"zh-CN\"><head><meta charset=\"UTF-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/>",
    "<title>",
    escapeInlineHtml(ir.title ?? "Export"),
    "</title>",
    "<style>",
    "body{font-family:'Noto Sans SC','PingFang SC','Microsoft YaHei',system-ui,sans-serif;max-width:820px;margin:0 auto;padding:2rem 2.25rem;line-height:1.7;color:#1f2937;background:#fff;}",
    "h1{font-size:1.75rem;font-weight:700;margin:0 0 1rem;}",
    "h2{font-size:1.35rem;font-weight:700;margin:1.75rem 0 0.75rem;}",
    "h3{font-size:1.15rem;font-weight:600;margin:1.25rem 0 0.5rem;}",
    "p{margin:0.65rem 0;}",
    "blockquote{margin:1rem 0;padding:0.75rem 1rem;border-left:4px solid #d1d5db;background:#f9fafb;color:#374151;}",
    "ul,ol{margin:0.65rem 0 0.65rem 1.25rem;padding:0;}",
    "li{margin:0.25rem 0;}",
    "table{border-collapse:collapse;width:100%;margin:1rem 0;font-size:0.92rem;}",
    "th,td{border:1px solid #d1d5db;padding:8px 10px;text-align:left;vertical-align:top;}",
    "th{background:#f3f4f6;font-weight:600;}",
    "code{font-family:ui-monospace,Consolas,monospace;background:#f3f4f6;padding:0.1rem 0.35rem;border-radius:4px;font-size:0.9em;}",
    "pre{background:#111827;color:#f9fafb;padding:1rem;border-radius:8px;overflow:auto;font-size:0.85rem;line-height:1.5;}",
    "a{color:#2563eb;text-decoration:none;}",
    "strong{font-weight:700;}",
    "</style></head><body>",
  ];
  for (const block of ir.blocks) {
    switch (block.type) {
      case "heading":
        parts.push(`<h${block.level}>${markdownInlineToHtml(block.text)}</h${block.level}>`);
        break;
      case "paragraph":
        parts.push(`<p>${markdownInlineToHtml(block.text)}</p>`);
        break;
      case "blockquote":
        parts.push(`<blockquote><p>${markdownInlineToHtml(block.text)}</p></blockquote>`);
        break;
      case "list":
        parts.push(block.ordered ? "<ol>" : "<ul>");
        for (const item of block.items) {
          parts.push(`<li>${markdownInlineToHtml(item)}</li>`);
        }
        parts.push(block.ordered ? "</ol>" : "</ul>");
        break;
      case "table":
        parts.push("<table><thead><tr>");
        for (const h of block.headers) parts.push(`<th>${markdownInlineToHtml(h)}</th>`);
        parts.push("</tr></thead><tbody>");
        for (const row of block.rows) {
          parts.push("<tr>");
          for (const cell of row) parts.push(`<td>${markdownInlineToHtml(cell)}</td>`);
          parts.push("</tr>");
        }
        parts.push("</tbody></table>");
        break;
      case "code":
        parts.push(`<pre><code>${escapeInlineHtml(block.text)}</code></pre>`);
        break;
      case "image": {
        const src = block.resolvedPath ?? block.src;
        parts.push(`<img src="${escapeAttr(src)}" alt="${escapeAttr(block.alt ?? "")}" style="max-width:100%;"/>`);
        break;
      }
      case "chartImage":
        parts.push(`<img src="${escapeAttr(block.resolvedPath)}" alt="chart" style="max-width:100%;"/>`);
        break;
      case "videoLink":
        parts.push(`<p><a href="${escapeAttr(block.href)}">视频链接</a></p>`);
        break;
      case "pageBreak":
        parts.push("<div style=\"page-break-before:always\"></div>");
        break;
      default:
        break;
    }
  }
  parts.push("</body></html>");
  return parts.join("");
}

export function isScanSource(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SCAN_EXT.has(ext) && !MD_EXT.has(ext) && !HTML_EXT.has(ext);
}

export { irToPlainMarkdown };

function escapeAttr(text: string): string {
  return escapeInlineHtml(text).replace(/'/g, "&#39;");
}
