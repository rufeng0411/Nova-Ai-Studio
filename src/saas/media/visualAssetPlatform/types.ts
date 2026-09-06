// PD-SAAS-FORK VAP: shared types for Visual Asset Platform.

export type ProcessingTier =
  | "none"
  | "resize_only"
  | "crop_fit"
  | "matting_compose";

export type AssetRole =
  | "product_hero"
  | "product_detail"
  | "logo"
  | "lifestyle_scene"
  | "person_spokesperson"
  | "diagram_chart"
  | "texture_background"
  | "unknown";

export type VisualAssetSource =
  | "official_fetch"
  | "authority_site"
  | "web_search_image"
  | "generate_image"
  | "user_attachment"
  | "placeholder";

export type SubjectMatch = "high" | "medium" | "low" | "unknown";

export type ProcessingStatus =
  | "skipped"
  | "ok"
  | "degraded"
  | "failed"
  | "pending";

export type VisualAssetProvenance = {
  sourceUrl?: string;
  sourcePageUrl?: string;
  candidateId?: string;
  recipeId?: string;
  fetchedAt?: string;
  notes?: string;
};

export type VisualAssetEntry = {
  assetId: string;
  source: VisualAssetSource;
  rawPath: string;
  preparedPath?: string;
  recommendedTier: ProcessingTier;
  role: AssetRole;
  slotIds?: string[];
  subjectMatch?: SubjectMatch;
  needsMatting?: boolean;
  suggestedRecipes?: string[];
  provenance: VisualAssetProvenance;
  processingStatus: ProcessingStatus;
  width?: number;
  height?: number;
};

export type VisualAssetManifest = {
  version: 1;
  sessionId: string;
  taskArtifactDir: string;
  goalVersion: number;
  subject?: string;
  sourceUrls: string[];
  updatedAt: string;
  assets: VisualAssetEntry[];
  slotBindings: Record<string, string>;
  phase: "phase_a" | "phase_b" | "idle";
  autoDiscoverTriggered: boolean;
  errors: string[];
  /** PD-SAAS-FORK VAP: ordered multi-tier acquisition audit trail. */
  acquisitionAttempts?: import("./visualAcquisitionLadder.js").AcquisitionAttempt[];
};

export type VisualAssetPlan = {
  manifest: VisualAssetManifest;
  hintForModel: string;
};

export const VISUAL_ASSET_MANIFEST_FILENAME = "visual-asset-manifest.json";
