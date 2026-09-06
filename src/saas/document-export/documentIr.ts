// PD-SAAS-FORK: Document IR helpers
import type { DocumentIr, DocumentIrBlock } from "./types.js";

export function createEmptyIr(sourcePath: string, sourceKind: DocumentIr["sourceKind"]): DocumentIr {
  return { sourcePath, sourceKind, blocks: [] };
}

export function irHasTables(ir: DocumentIr): boolean {
  return ir.blocks.some((b) => b.type === "table");
}

export function irHasSlides(ir: DocumentIr): boolean {
  return ir.blocks.some((b) => b.type === "slideBreak") || ir.sourceKind === "html";
}

export function irTextLines(ir: DocumentIr): string[] {
  const lines: string[] = [];
  for (const block of ir.blocks) {
    switch (block.type) {
      case "heading":
        lines.push(`${"#".repeat(Math.min(block.level, 6))} ${block.text}`);
        break;
      case "paragraph":
        lines.push(block.text);
        break;
      case "list":
        block.items.forEach((item, i) => {
          lines.push(block.ordered ? `${i + 1}. ${item}` : `- ${item}`);
        });
        break;
      case "code":
        lines.push(block.text);
        break;
      default:
        break;
    }
  }
  return lines;
}

export function appendBlock(ir: DocumentIr, block: DocumentIrBlock): DocumentIr {
  return { ...ir, blocks: [...ir.blocks, block] };
}
