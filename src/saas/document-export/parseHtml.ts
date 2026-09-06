// PD-SAAS-FORK: HTML → Document IR (lightweight regex; full DOM via enrich pass)
import type { DocumentIr, DocumentIrBlock } from "./types.js";
import { createEmptyIr } from "./documentIr.js";

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseHtmlToIr(sourcePath: string, content: string): DocumentIr {
  const ir = createEmptyIr(sourcePath, "html");
  const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(content);
  if (titleMatch?.[1]) ir.title = stripTags(titleMatch[1]);

  const headingRe = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null = headingRe.exec(content);
  const usedRanges: Array<[number, number]> = [];

  while (match) {
    const level = Number(match[1]);
    const text = stripTags(match[2]);
    if (text) {
      ir.blocks.push({ type: "heading", level, text });
      usedRanges.push([match.index, match.index + match[0].length]);
    }
    match = headingRe.exec(content);
  }

  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  match = pRe.exec(content);
  while (match) {
    const text = stripTags(match[1]);
    if (text) ir.blocks.push({ type: "paragraph", text });
    match = pRe.exec(content);
  }

  const tableRe = /<table[\s\S]*?<\/table>/gi;
  match = tableRe.exec(content);
  while (match) {
    const tableHtml = match[0];
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows: string[][] = [];
    let rowMatch: RegExpExecArray | null = rowRe.exec(tableHtml);
    while (rowMatch) {
      const cellRe = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
      const cells: string[] = [];
      let cellMatch: RegExpExecArray | null = cellRe.exec(rowMatch[1]);
      while (cellMatch) {
        cells.push(stripTags(cellMatch[1]));
        cellMatch = cellRe.exec(rowMatch[1]);
      }
      if (cells.length > 0) rows.push(cells);
      rowMatch = rowRe.exec(tableHtml);
    }
    if (rows.length > 0) {
      const [headers, ...body] = rows;
      ir.blocks.push({ type: "table", headers, rows: body });
    }
    match = tableRe.exec(content);
  }

  const imgRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  match = imgRe.exec(content);
  while (match) {
    const altMatch = /alt=["']([^"']*)["']/i.exec(match[0]);
    ir.blocks.push({
      type: "image",
      src: match[1],
      alt: altMatch?.[1],
    });
    match = imgRe.exec(content);
  }

  const videoRe = /<video[^>]*>[\s\S]*?<\/video>|<video[^>]+\/>/gi;
  match = videoRe.exec(content);
  while (match) {
    const tag = match[0];
    const srcMatch = /src=["']([^"']+)["']/i.exec(tag);
    const posterMatch = /poster=["']([^"']+)["']/i.exec(tag);
    if (srcMatch) {
      ir.blocks.push({
        type: "videoLink",
        href: srcMatch[1],
        posterPath: posterMatch?.[1],
      });
    }
    match = videoRe.exec(content);
  }

  if (ir.blocks.length === 0) {
    const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(content);
    const text = stripTags(bodyMatch?.[1] ?? content);
    if (text) ir.blocks.push({ type: "paragraph", text: text.slice(0, 8000) });
  }

  return ir;
}
