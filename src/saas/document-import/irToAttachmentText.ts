// PD-SAAS-FORK: Document IR → attachment markdown with truncation
import { irToPlainMarkdown } from "../document-export/parseMarkdown.js";
import type { DocumentIr } from "../document-export/types.js";

export type AttachmentTextOptions = {
  maxChars: number;
  maxTableRows: number;
  sourcePath: string;
  providerId: string;
};

export function truncateDocumentIr(
  ir: DocumentIr,
  maxTableRows: number,
): DocumentIr {
  const blocks = ir.blocks.map((block) => {
    if (block.type !== "table") return block;
    const rows = block.rows.slice(0, maxTableRows);
    return { ...block, rows };
  });
  return { ...ir, blocks };
}

export function irToAttachmentText(
  ir: DocumentIr,
  options: AttachmentTextOptions,
): { text: string; truncated: boolean } {
  let working = truncateDocumentIr(ir, options.maxTableRows);
  let markdown = irToPlainMarkdown(working);
  let truncated = working.blocks.some(
    (b) => b.type === "table" && b.rows.length >= options.maxTableRows,
  );

  if (markdown.length > options.maxChars) {
    markdown = `${markdown.slice(0, options.maxChars)}\n\n…（内容已截断，共 ${markdown.length} 字符）`;
    truncated = true;
  }

  const wrapped = [
    `<attachment parsed="${options.sourcePath}" provider="${options.providerId}">`,
    markdown,
    "</attachment>",
  ].join("\n");

  return { text: wrapped, truncated };
}
