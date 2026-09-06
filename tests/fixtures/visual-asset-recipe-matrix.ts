/**
 * PD-SAAS-FORK VAP: role × recipe × capability sampling matrix for regression.
 */
export type VisualAssetRecipeMatrixCase = {
  id: string;
  role: string;
  capabilitySlug: string;
  slotId?: string;
  expectedTier: string;
  forbidMatting?: boolean;
};

export const VISUAL_ASSET_RECIPE_MATRIX: VisualAssetRecipeMatrixCase[] = [
  {
    id: "geo-report-inline",
    role: "report_inline",
    capabilitySlug: "geo-serp-analysis",
    expectedTier: "resize_only",
  },
  {
    id: "nova-slide-hero",
    role: "product_hero",
    capabilitySlug: "nova-ppt-aesthetic-slides",
    slotId: "slide-01",
    expectedTier: "matting_compose",
  },
  {
    id: "landing-hero-crop",
    role: "lifestyle_scene",
    capabilitySlug: "od-saas-landing",
    slotId: "hero",
    expectedTier: "crop_fit",
    forbidMatting: true,
  },
  {
    id: "logo-none",
    role: "logo",
    capabilitySlug: "brand-campaign-full",
    expectedTier: "none",
    forbidMatting: true,
  },
  {
    id: "social-square",
    role: "product_hero",
    capabilitySlug: "brand-campaign-full",
    slotId: "social-square-1x1",
    expectedTier: "matting_compose",
  },
];
