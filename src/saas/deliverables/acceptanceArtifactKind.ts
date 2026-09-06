// PD-SAAS-FORK: browser-safe acceptance artifact kind union (no node imports).
export type AcceptanceArtifactKind =
  | "html"
  | "pptx"
  | "docx"
  | "pdf"
  | "markdown"
  | "spreadsheet"
  | "image"
  | "video"
  | "file";
