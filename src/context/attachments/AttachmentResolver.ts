// PD-SAAS-FORK: Office/PDF parallel import into CanonicalContentBlock text
import { readFile, stat } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import type { CanonicalContentBlock, CanonicalMessage } from "../../model/index.js";
import { checkDocumentImportRateLimit } from "../../saas/document-import/documentImportRateLimit.js";
import { detectImportKind, isOfficeImportKind, maxBytesForKind } from "../../saas/document-import/detectImportKind.js";
import { routeImportDocument } from "../../saas/document-import/router.js";
import type { DocumentImportContext } from "../../saas/document-import/types.js";
import { USER_FACING_PRODUCT_NAME } from "../../saas/brand/userFacingProductName.js";

export type AttachmentRequest =
  | { type: "file"; path: string }
  | { type: "image"; path: string; mimeType?: string }
  | { type: "pdf"; path: string }
  | { type: "office"; path: string };

export type ResolvedAttachment = {
  blocks: CanonicalContentBlock[];
  diagnostics: Array<{
    code:
      | "attachment_missing"
      | "attachment_too_large"
      | "attachment_unsupported"
      | "attachment_import_skipped"
      | "attachment_import_rate_limited"
      | "image_no_resize"
      | "pdf_size_estimate";
    severity: "info" | "warning" | "error";
    message: string;
  }>;
};

export type AttachmentResolverOptions = {
  /** Maximum bytes per text attachment (legacy default 1 MB). */
  maxFileBytes?: number;
  /** Maximum bytes for office import attachments. */
  maxOfficeBytes?: number;
  /** Maximum bytes for PDF import (text extraction). */
  maxPdfImportBytes?: number;
  /** Maximum image bytes after base64 decode (legacy: 5 MiB). */
  maxImageBytes?: number;
  /** Approximate bytes-per-page for PDF estimation (legacy fallback: 102_400). */
  bytesPerPdfPage?: number;
  workspaceRoot?: string;
  documentImport?: DocumentImportContext;
  tenantId?: string;
};

const DEFAULT_MAX_FILE_BYTES = 1_000_000;
const DEFAULT_MAX_OFFICE_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_PDF_IMPORT_BYTES = 20 * 1024 * 1024;
const DEFAULT_MAX_IMAGE_BYTES = 5_242_880;
const DEFAULT_BYTES_PER_PDF_PAGE = 102_400;
const PDF_EXTRACTED_TEXT_SKIP_BASE64_CHARS = 200;

/** PD-SAAS-FORK: enough extracted text → do not also embed the full PDF as base64. */
export function shouldEmbedFullPdfBase64(extractedTextChars: number): boolean {
  return extractedTextChars < PDF_EXTRACTED_TEXT_SKIP_BASE64_CHARS;
}

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".json", ".yaml", ".yml", ".ts", ".tsx", ".js", ".jsx", ".html", ".htm", ".log"]);
const IMAGE_MIME = new Map<string, string>([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
]);

export class AttachmentResolver {
  private readonly maxFileBytes: number;
  private readonly maxOfficeBytes: number;
  private readonly maxPdfImportBytes: number;
  private readonly maxImageBytes: number;
  private readonly bytesPerPdfPage: number;
  private readonly workspaceRoot?: string;
  private readonly documentImport?: DocumentImportContext;
  private readonly tenantId?: string;

  constructor(options: AttachmentResolverOptions = {}) {
    this.maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
    this.maxOfficeBytes = options.maxOfficeBytes
      ?? options.documentImport?.documentImport.maxFileBytes.office
      ?? DEFAULT_MAX_OFFICE_BYTES;
    this.maxPdfImportBytes = options.maxPdfImportBytes
      ?? options.documentImport?.documentImport.maxFileBytes.pdf
      ?? DEFAULT_MAX_PDF_IMPORT_BYTES;
    this.maxImageBytes = options.maxImageBytes ?? DEFAULT_MAX_IMAGE_BYTES;
    this.bytesPerPdfPage = options.bytesPerPdfPage ?? DEFAULT_BYTES_PER_PDF_PAGE;
    this.workspaceRoot = options.workspaceRoot;
    this.documentImport = options.documentImport;
    this.tenantId = options.tenantId;
  }

  async resolve(request: AttachmentRequest): Promise<ResolvedAttachment> {
    switch (request.type) {
      case "file":
        return this.resolveFile(request.path);
      case "image":
        return this.resolveImage(request.path, request.mimeType);
      case "pdf":
        return this.resolvePdf(request.path);
      case "office":
        return this.resolveOffice(request.path);
    }
  }

  async resolveAll(requests: AttachmentRequest[]): Promise<ResolvedAttachment> {
    if (requests.length === 0) {
      return { blocks: [], diagnostics: [] };
    }
    const results = await Promise.all(requests.map((request) => this.resolve(request)));
    const blocks: CanonicalContentBlock[] = [];
    const diagnostics: ResolvedAttachment["diagnostics"] = [];
    for (const result of results) {
      blocks.push(...result.blocks);
      diagnostics.push(...result.diagnostics);
    }
    return { blocks, diagnostics };
  }

  toUserMessage(attachment: ResolvedAttachment): CanonicalMessage {
    return { role: "user", content: attachment.blocks };
  }

  private relativePath(absolute: string): string {
    if (this.workspaceRoot) {
      try {
        return relative(this.workspaceRoot, absolute).replace(/\\/g, "/");
      } catch {
        // fall through
      }
    }
    return absolute.replace(/\\/g, "/");
  }

  private async runImport(absolute: string): Promise<ResolvedAttachment> {
    const ctx = this.documentImport;
    if (!ctx?.documentImport.enabled) {
      return {
        blocks: [
          { type: "text", text: `<attachment path="${absolute}">\n(Office/PDF import disabled)\n</attachment>` },
        ],
        diagnostics: [{
          code: "attachment_import_skipped",
          severity: "info",
          message: `Document import disabled; attachment path preserved: ${absolute}`,
        }],
      };
    }

    const rate = checkDocumentImportRateLimit(this.tenantId ?? ctx.tenantId);
    if (!rate.allowed) {
      return {
        blocks: [
          { type: "text", text: `<attachment path="${absolute}">\n(Import rate limited)\n</attachment>` },
        ],
        diagnostics: [{
          code: "attachment_import_rate_limited",
          severity: "warning",
          message: `Document import rate limit exceeded; retry in ~${Math.ceil((rate.retryAfterMs ?? 60_000) / 1000)}s.`,
        }],
      };
    }

    const sourcePath = this.relativePath(absolute);
    const result = await routeImportDocument({
      sourceAbsolutePath: absolute,
      sourcePath,
      workspaceRoot: ctx.workspaceRoot,
      ctx: { ...ctx, tenantId: this.tenantId ?? ctx.tenantId },
    });

    if (result.status === "ok" && result.text) {
      return {
        blocks: [{ type: "text", text: result.text }],
        diagnostics: result.truncated
          ? [{
            code: "attachment_import_skipped",
            severity: "info",
            message: `Imported ${sourcePath} via ${result.providerId}; content truncated.`,
          }]
          : [],
      };
    }

    return {
      blocks: [
        { type: "text", text: `<attachment path="${absolute}">\n(Import skipped: ${result.reason ?? "no provider"})\n</attachment>` },
      ],
      diagnostics: [{
        code: "attachment_import_skipped",
        severity: "warning",
        message: result.reason ?? `Could not import ${sourcePath}.`,
      }],
    };
  }

  private async resolveOffice(path: string): Promise<ResolvedAttachment> {
    const absolute = resolve(path);
    let info;
    try {
      info = await stat(absolute);
    } catch (error) {
      return {
        blocks: [],
        diagnostics: [{
          code: "attachment_missing",
          severity: "warning",
          message: `Attachment not found: ${absolute} (${error instanceof Error ? error.message : String(error)}).`,
        }],
      };
    }
    if (info.size > this.maxOfficeBytes) {
      return {
        blocks: [],
        diagnostics: [{
          code: "attachment_too_large",
          severity: "warning",
          message: `Office attachment ${absolute} is ${info.size} bytes (limit ${this.maxOfficeBytes}); skipped.`,
        }],
      };
    }
    return this.runImport(absolute);
  }

  private async resolveFile(path: string): Promise<ResolvedAttachment> {
    const absolute = resolve(path);
    const kind = detectImportKind(absolute);
    if (isOfficeImportKind(kind)) {
      return this.resolveOffice(absolute);
    }

    let info;
    try {
      info = await stat(absolute);
    } catch (error) {
      return {
        blocks: [],
        diagnostics: [{
          code: "attachment_missing",
          severity: "warning",
          message: `Attachment not found: ${absolute} (${error instanceof Error ? error.message : String(error)}).`,
        }],
      };
    }
    if (info.size > this.maxFileBytes) {
      return {
        blocks: [],
        diagnostics: [{
          code: "attachment_too_large",
          severity: "warning",
          message: `Attachment ${absolute} is ${info.size} bytes (limit ${this.maxFileBytes}); skipped.`,
        }],
      };
    }
    const ext = extname(absolute).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) {
      return {
        blocks: [],
        diagnostics: [{
          code: "attachment_unsupported",
          severity: "info",
          message: `File extension ${ext || "(none)"} not in text whitelist; skipped (use a more specific resolver).`,
        }],
      };
    }
    const text = await readFile(absolute, "utf8");
    return {
      blocks: [
        { type: "text", text: `<attachment path="${absolute}">\n${text}\n</attachment>` },
      ],
      diagnostics: [],
    };
  }

  private async resolveImage(path: string, mimeType?: string): Promise<ResolvedAttachment> {
    const absolute = resolve(path);
    let info;
    try {
      info = await stat(absolute);
    } catch (error) {
      return {
        blocks: [],
        diagnostics: [{
          code: "attachment_missing",
          severity: "warning",
          message: `Image attachment not found: ${absolute} (${error instanceof Error ? error.message : String(error)}).`,
        }],
      };
    }
    if (info.size > this.maxImageBytes) {
      return {
        blocks: [],
        diagnostics: [{
          code: "attachment_too_large",
          severity: "warning",
          message: `Image ${absolute} is ${info.size} bytes (limit ${this.maxImageBytes}); skipped (${USER_FACING_PRODUCT_NAME} does not resize, intentional_difference §4.5).`,
        }],
      };
    }
    const ext = extname(absolute).toLowerCase();
    const detectedMime = mimeType ?? IMAGE_MIME.get(ext);
    if (!detectedMime) {
      return {
        blocks: [],
        diagnostics: [{
          code: "attachment_unsupported",
          severity: "warning",
          message: `Cannot determine image mime type from ${absolute}; provide mimeType explicitly.`,
        }],
      };
    }
    const buffer = await readFile(absolute);
    return {
      blocks: [
        {
          type: "image",
          source: "base64",
          data: buffer.toString("base64"),
          mimeType: detectedMime,
          bytes: info.size,
        },
      ],
      diagnostics: [{
        code: "image_no_resize",
        severity: "info",
        message: `${USER_FACING_PRODUCT_NAME} does not resize images; original bytes forwarded (intentional_difference §4.5).`,
      }],
    };
  }

  private async resolvePdf(path: string): Promise<ResolvedAttachment> {
    const absolute = resolve(path);
    let info;
    try {
      info = await stat(absolute);
    } catch (error) {
      return {
        blocks: [],
        diagnostics: [{
          code: "attachment_missing",
          severity: "warning",
          message: `PDF attachment not found: ${absolute} (${error instanceof Error ? error.message : String(error)}).`,
        }],
      };
    }

    const blocks: CanonicalContentBlock[] = [];
    const diagnostics: ResolvedAttachment["diagnostics"] = [];

    if (info.size <= this.maxPdfImportBytes && this.documentImport?.documentImport.enabled) {
      const imported = await this.runImport(absolute);
      blocks.push(...imported.blocks);
      diagnostics.push(...imported.diagnostics);
    }

    const extractedTextChars = blocks
      .filter((block) => block.type === "text")
      .map((block) => String((block as { text?: string }).text ?? ""))
      .join("")
      .trim().length;
    if (!shouldEmbedFullPdfBase64(extractedTextChars)) {
      diagnostics.push({
        code: "pdf_size_estimate",
        severity: "info",
        message: `PDF text extracted (${extractedTextChars} chars); full base64 omitted.`,
      });
      return { blocks, diagnostics };
    }

    const buffer = await readFile(absolute);
    const estimatedPages = Math.max(1, Math.round(info.size / this.bytesPerPdfPage));
    blocks.push({
      type: "pdf",
      source: "base64",
      data: buffer.toString("base64"),
      mimeType: "application/pdf",
      bytes: info.size,
      pages: estimatedPages,
    });
    diagnostics.push({
      code: "pdf_size_estimate",
      severity: "info",
      message: `Estimated ${estimatedPages} pages from ${info.size} bytes (${USER_FACING_PRODUCT_NAME} does not invoke pdfinfo, intentional_difference §4.5).`,
    });

    return { blocks, diagnostics };
  }
}
