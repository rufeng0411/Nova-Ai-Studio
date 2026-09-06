// PD-SAAS-FORK: DOCX → Document IR via mammoth
import type { DocumentIr } from "../document-export/types.js";

export async function parseDocxToIr(
  absolutePath: string,
  relativePath: string,
): Promise<DocumentIr> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ path: absolutePath });
  const text = String(result.value ?? "").trim();
  const blocks: DocumentIr["blocks"] = text
    ? text.split(/\n{2,}/).filter(Boolean).map((para) => ({ type: "paragraph", text: para.trim() }))
    : [];
  return {
    sourcePath: relativePath,
    sourceKind: "unknown",
    title: relativePath.split("/").pop(),
    blocks,
  };
}
