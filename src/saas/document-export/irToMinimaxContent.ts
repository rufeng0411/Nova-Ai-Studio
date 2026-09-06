// PD-SAAS-FORK: Document IR → minimax-pdf content.json blocks
import type { DocumentIr, DocumentIrBlock } from "./types.js";

export function irToMinimaxContent(ir: DocumentIr): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const block of ir.blocks) {
    out.push(...blockToMinimax(block));
  }
  if (out.length === 0) {
    out.push({ type: "body", text: ir.title ?? "Exported document" });
  }
  return out;
}

function blockToMinimax(block: DocumentIrBlock): Array<Record<string, unknown>> {
  switch (block.type) {
    case "heading": {
      const level = Math.min(Math.max(block.level, 1), 3);
      return [{ type: `h${level}`, text: block.text }];
    }
    case "paragraph":
      return [{ type: "body", text: block.text }];
    case "list":
      return block.items.map((item) => ({ type: block.ordered ? "numbered" : "bullet", text: item }));
    case "table":
      return [
        {
          type: "table",
          headers: block.headers,
          rows: block.rows,
        },
      ];
    case "image":
      return [{ type: "image", src: block.resolvedPath ?? block.src, caption: block.alt ?? "" }];
    case "chartImage":
      return [{ type: "figure", src: block.resolvedPath, caption: block.caption ?? "Chart" }];
    case "videoLink":
      return [{ type: "body", text: `视频: ${block.href}` }];
    case "code":
      return [{ type: "code", text: block.text, language: block.language ?? "" }];
    case "pageBreak":
      return [{ type: "pagebreak" }];
    case "slideBreak":
      return [{ type: "pagebreak" }];
    default:
      return [];
  }
}
