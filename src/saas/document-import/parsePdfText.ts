// PD-SAAS-FORK: PDF text-layer extraction via mupdf
import type { DocumentIr } from "../document-export/types.js";

const INSUFFICIENT_CHAR_THRESHOLD = 200;

export type PdfTextExtractResult = {
  ir: DocumentIr;
  charCount: number;
  pageCount: number;
  insufficientContent: boolean;
};

export async function extractPdfTextToIr(
  pdfBuffer: Buffer,
  relativePath: string,
): Promise<PdfTextExtractResult> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(pdfBuffer, "application/pdf");
  const pageCount = doc.countPages();
  const paragraphs: string[] = [];

  for (let i = 0; i < pageCount; i += 1) {
    const page = doc.loadPage(i);
    const st = page.toStructuredText("preserve-whitespace");
    let pageText = "";
    const stAny = st as { asText?: () => string; asJSON?: () => string };
    if (typeof stAny.asText === "function") {
      pageText = stAny.asText().trim();
    } else if (typeof stAny.asJSON === "function") {
      pageText = extractTextFromStructuredJson(stAny.asJSON());
    }
    if (pageText) {
      paragraphs.push(`## Page ${i + 1}\n\n${pageText}`);
    }
  }

  const merged = paragraphs.join("\n\n").trim();
  const charCount = merged.length;
  const ir: DocumentIr = {
    sourcePath: relativePath,
    sourceKind: "pdf",
    title: relativePath.split("/").pop(),
    blocks: merged
      ? merged.split(/\n{2,}/).map((chunk) => ({ type: "paragraph" as const, text: chunk.trim() }))
      : [],
  };

  return {
    ir,
    charCount,
    pageCount,
    insufficientContent: charCount < INSUFFICIENT_CHAR_THRESHOLD,
  };
}

function extractTextFromStructuredJson(jsonRaw: string): string {
  try {
    const payload = JSON.parse(jsonRaw) as { blocks?: Array<{ lines?: Array<{ text?: string }> }> };
    const parts: string[] = [];
    for (const block of payload.blocks ?? []) {
      for (const line of block.lines ?? []) {
        if (line.text?.trim()) parts.push(line.text.trim());
      }
    }
    return parts.join("\n");
  } catch {
    return "";
  }
}
