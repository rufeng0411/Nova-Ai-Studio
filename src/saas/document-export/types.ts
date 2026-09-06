// PD-SAAS-FORK: document export provider contracts and shared types
export type ExportOcrRuntimeConfig = {
  provider: "mineru" | "qwen-vl";
  mode: "cloud" | "local";
  apiUrl: string;
  apiKey?: string;
  model: string;
  fallbackProvider?: "mineru" | "qwen-vl";
  dashscopeApiKey?: string;
  extractorMethod?: "mineru" | "hybrid";
  inpaintMethod?: "baidu" | "pil_fallback";
  baiduApiKey?: string;
  baiduSecretKey?: string;
};

export type ResolvedDocumentExportConfig = {
  cloudPreference: CloudPreference;
  defaultQuality: ExportQuality;
  playwrightPoolSize: number;
  nutrientApiKey?: string;
  enabledProviders: Record<string, boolean | "auto">;
};

export type OutputFormat = "pdf" | "docx" | "pptx" | "xlsx";

export type ExportQuality = "fast" | "balanced" | "fidelity";

export type CloudPreference = "cloud_first" | "local_only";

export type ProviderAvailability = "ready" | "needs_config" | "unavailable";

export type IntegrationLevel = "L2" | "L1" | "cloud";

export type DocumentIrBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "blockquote"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "image"; src: string; alt?: string; resolvedPath?: string }
  | { type: "chartImage"; resolvedPath: string; caption?: string }
  | { type: "videoLink"; href: string; posterPath?: string; caption?: string }
  | { type: "code"; language?: string; text: string }
  | { type: "pageBreak" }
  | { type: "slideBreak" };

export type DocumentIr = {
  title?: string;
  sourcePath: string;
  sourceKind: "markdown" | "html" | "image" | "pdf" | "spreadsheet" | "unknown";
  blocks: DocumentIrBlock[];
};

export type ExportDocumentOptions = {
  quality?: ExportQuality;
  page_size?: string;
  include_editable_text?: boolean;
  cloud_preference?: CloudPreference;
  design_profile?: string;
};

export type ExportInput = {
  sourcePath: string;
  sourceAbsolutePath: string;
  outputFormat: OutputFormat;
  outputAbsolutePath: string;
  workspaceRoot: string;
  options: ExportDocumentOptions;
};

export type ExportResult = {
  outputAbsolutePath: string;
  relativePath: string;
  providerId: string;
  format: OutputFormat;
};

export type DocumentExportContext = {
  cwd: string;
  env: NodeJS.ProcessEnv;
  documentExport: ResolvedDocumentExportConfig;
  documentOcr?: ExportOcrRuntimeConfig;
};

export type DocumentExportProvider = {
  id: string;
  formats: OutputFormat[];
  integrationLevel: IntegrationLevel;
  priority: number;
  availability: (ctx: DocumentExportContext) => ProviderAvailability;
  canHandle: (input: ExportInput, ir: DocumentIr) => boolean;
  render: (ctx: DocumentExportContext, input: ExportInput, ir: DocumentIr) => Promise<ExportResult>;
};
