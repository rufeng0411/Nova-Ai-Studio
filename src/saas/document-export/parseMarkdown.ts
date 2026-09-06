// PD-SAAS-FORK: markdown → Document IR
import type { DocumentIr } from "./types.js";
import { createEmptyIr } from "./documentIr.js";

export function parseMarkdownToIr(sourcePath: string, content: string): DocumentIr {
  const ir = createEmptyIr(sourcePath, "markdown");
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let paragraphBuf: string[] = [];
  let listBuf: { ordered: boolean; items: string[] } | null = null;
  let tableBuf: string[][] | null = null;
  let blockquoteBuf: string[] | null = null;
  let codeBuf: { language?: string; lines: string[] } | null = null;

  const flushParagraph = () => {
    const text = paragraphBuf.join(" ").trim();
    if (text) ir.blocks.push({ type: "paragraph", text });
    paragraphBuf = [];
  };

  const flushBlockquote = () => {
    const text = blockquoteBuf?.join(" ").trim() ?? "";
    if (text) ir.blocks.push({ type: "blockquote", text });
    blockquoteBuf = null;
  };

  const flushList = () => {
    if (listBuf && listBuf.items.length > 0) {
      ir.blocks.push({
        type: "list",
        ordered: listBuf.ordered,
        items: [...listBuf.items],
      });
    }
    listBuf = null;
  };

  const flushTable = () => {
    if (!tableBuf || tableBuf.length === 0) {
      tableBuf = null;
      return;
    }
    const [headerRow, ...bodyRows] = tableBuf;
    const headers = headerRow.map((c) => c.trim());
    const rows = bodyRows
      .filter((row) => row.some((c) => c.trim()))
      .map((row) => row.map((c) => c.trim()));
    if (headers.length > 0) {
      ir.blocks.push({ type: "table", headers, rows });
    }
    tableBuf = null;
  };

  const flushCode = () => {
    if (codeBuf && codeBuf.lines.length > 0) {
      ir.blocks.push({
        type: "code",
        language: codeBuf.language,
        text: codeBuf.lines.join("\n"),
      });
    }
    codeBuf = null;
  };

  const flushAll = () => {
    flushParagraph();
    flushBlockquote();
    flushList();
    flushTable();
    flushCode();
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (codeBuf) {
      if (/^```/.test(trimmed)) {
        flushCode();
        i += 1;
        continue;
      }
      codeBuf.lines.push(line);
      i += 1;
      continue;
    }

    if (!trimmed) {
      flushAll();
      i += 1;
      continue;
    }

    const fence = /^```(\w+)?\s*$/.exec(trimmed);
    if (fence) {
      flushAll();
      codeBuf = { language: fence[1], lines: [] };
      i += 1;
      continue;
    }

    const blockquote = /^>\s?(.*)$/.exec(trimmed);
    if (blockquote) {
      flushParagraph();
      flushList();
      flushTable();
      if (!blockquoteBuf) blockquoteBuf = [];
      blockquoteBuf.push(blockquote[1] ?? "");
      i += 1;
      continue;
    }

    if (blockquoteBuf) {
      flushBlockquote();
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      const text = heading[2].trim();
      if (!ir.title && level === 1) ir.title = text;
      ir.blocks.push({ type: "heading", level, text });
      i += 1;
      continue;
    }

    if (/^\|.+\|$/.test(trimmed)) {
      flushParagraph();
      flushBlockquote();
      flushList();
      const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());
      if (!tableBuf) tableBuf = [];
      if (!/^\|?[\s:-]+\|/.test(trimmed)) {
        tableBuf.push(cells);
      }
      i += 1;
      continue;
    }

    const ul = /^[-*+]\s+(.+)$/.exec(trimmed);
    if (ul) {
      flushParagraph();
      flushBlockquote();
      flushTable();
      if (!listBuf || listBuf.ordered) {
        flushList();
        listBuf = { ordered: false, items: [] };
      }
      listBuf.items.push(ul[1].trim());
      i += 1;
      continue;
    }

    const ol = /^(\d+)\.\s+(.+)$/.exec(trimmed);
    if (ol) {
      flushParagraph();
      flushBlockquote();
      flushTable();
      if (!listBuf || !listBuf.ordered) {
        flushList();
        listBuf = { ordered: true, items: [] };
      }
      listBuf.items.push(ol[2].trim());
      i += 1;
      continue;
    }

    const img = /^!\[([^\]]*)\]\(([^)]+)\)/.exec(trimmed);
    if (img) {
      flushAll();
      ir.blocks.push({ type: "image", alt: img[1], src: img[2].trim() });
      i += 1;
      continue;
    }

    if (trimmed === "---" || trimmed === "***") {
      flushAll();
      ir.blocks.push({ type: "pageBreak" });
      i += 1;
      continue;
    }

    flushList();
    flushTable();
    paragraphBuf.push(trimmed);
    i += 1;
  }

  flushAll();
  return ir;
}

export function irToPlainMarkdown(ir: DocumentIr): string {
  const parts: string[] = [];
  for (const block of ir.blocks) {
    switch (block.type) {
      case "heading":
        parts.push(`${"#".repeat(block.level)} ${block.text}`);
        break;
      case "paragraph":
        parts.push(block.text);
        break;
      case "blockquote":
        parts.push(`> ${block.text}`);
        break;
      case "list":
        block.items.forEach((item, idx) => {
          parts.push(block.ordered ? `${idx + 1}. ${item}` : `- ${item}`);
        });
        break;
      case "table": {
        parts.push(`| ${block.headers.join(" | ")} |`);
        parts.push(`| ${block.headers.map(() => "---").join(" | ")} |`);
        for (const row of block.rows) {
          parts.push(`| ${row.join(" | ")} |`);
        }
        break;
      }
      case "code":
        parts.push(`\`\`\`${block.language ?? ""}\n${block.text}\n\`\`\``);
        break;
      case "image":
        parts.push(`![${block.alt ?? ""}](${block.src})`);
        break;
      case "pageBreak":
        parts.push("\n---\n");
        break;
      default:
        break;
    }
    parts.push("");
  }
  return parts.join("\n").trim();
}
