// PD-SAAS-FORK: MinerU JSON → Document IR (text blocks)
import type { DocumentIr } from "../document-export/types.js";

function collectLines(payload: unknown): string[] {
  const lines: string[] = [];
  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (!item || typeof item !== "object") continue;
      const text = String((item as { text?: string; content?: string }).text
        ?? (item as { content?: string }).content
        ?? "").trim();
      if (text) lines.push(text);
    }
    return lines;
  }
  if (!payload || typeof payload !== "object") return lines;
  const obj = payload as Record<string, unknown>;
  const pdfInfo = obj.pdf_info;
  if (Array.isArray(pdfInfo)) {
    for (const page of pdfInfo) {
      if (!page || typeof page !== "object") continue;
      const blocks = (page as { para_blocks?: unknown; preproc_blocks?: unknown }).para_blocks
        ?? (page as { preproc_blocks?: unknown }).preproc_blocks;
      if (!Array.isArray(blocks)) continue;
      for (const block of blocks) {
        if (!block || typeof block !== "object") continue;
        const blockObj = block as { lines?: unknown[]; text?: string };
        const lineItems = blockObj.lines ?? [block];
        for (const line of lineItems) {
          if (!line || typeof line !== "object") continue;
          const lineObj = line as { spans?: unknown[]; text?: string };
          const parts: string[] = [];
          if (Array.isArray(lineObj.spans)) {
            for (const span of lineObj.spans) {
              if (!span || typeof span !== "object") continue;
              const part = String((span as { content?: string; text?: string }).content
                ?? (span as { text?: string }).text
                ?? "").trim();
              if (part) parts.push(part);
            }
          }
          const merged = parts.join("").trim() || String(lineObj.text ?? "").trim();
          if (merged) lines.push(merged);
        }
      }
    }
  }
  if (lines.length > 0) return lines;
  for (const key of ["content_list", "pages", "data"]) {
    const nested = obj[key];
    if (Array.isArray(nested)) {
      return collectLines(nested);
    }
  }
  return lines;
}

export function mineruJsonToIr(payload: unknown, relativePath: string): DocumentIr {
  const lines = collectLines(payload);
  return {
    sourcePath: relativePath,
    sourceKind: "pdf",
    title: relativePath.split("/").pop(),
    blocks: lines.map((text) => ({ type: "paragraph", text })),
  };
}
