/**
 * PD-SAAS-FORK VAP P0-E: five desensitized 2026-07-19 live-case goals (plan name).
 * Re-exports + live KPI expectations for gateway harness.
 */
export {
  MINGDI_G700_20260719_FIVE_CASES,
  type MingdiFiveCaseFixture,
} from "./mingdi-g700-20260719-five-case-goals.js";

export type MingdiLiveCaseKpi = {
  id: string;
  requireLocalizedOfficialImages: number;
  forbidGenerateImage: boolean;
  maxSlideIndex?: number;
};

export const MINGDI_G700_20260719_LIVE_KPIS: MingdiLiveCaseKpi[] = [
  {
    id: "geo-full-20260719",
    requireLocalizedOfficialImages: 0,
    forbidGenerateImage: false,
  },
  {
    id: "nova-slides-official-20260719",
    requireLocalizedOfficialImages: 1,
    forbidGenerateImage: true,
    maxSlideIndex: 8,
  },
  {
    id: "campaign-full-20260719",
    requireLocalizedOfficialImages: 1,
    forbidGenerateImage: true,
  },
  {
    id: "html-demo-official-20260719",
    requireLocalizedOfficialImages: 1,
    forbidGenerateImage: true,
  },
  {
    id: "launch-full-20260719",
    requireLocalizedOfficialImages: 1,
    forbidGenerateImage: true,
  },
];
