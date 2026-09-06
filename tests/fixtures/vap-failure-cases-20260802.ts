/**
 * PD-SAAS-FORK VAP: F01–F12 failure-case acceptance factors (2026-08-02).
 * Consumed by scripts/run-vap-failure-cases.mjs
 */

export type VapFailureCase = {
  id: string;
  title: string;
  layer: "L0" | "L1" | "L2" | "L3";
  soft?: boolean;
  /** Symbolic assert key handled by the runner */
  assert: string;
  setup: Record<string, unknown>;
};

export const VAP_FAILURE_CASES_20260802: VapFailureCase[] = [
  {
    id: "F01",
    title: "KM3 raw URL as candidateId",
    layer: "L1",
    assert: "direct_image_url",
    setup: {
      candidateId: "https://www.bfgoodrich.com.cn/images/km3/k1.jpg",
    },
  },
  {
    id: "F02",
    title: "cross-host news redirect same eTLD+1",
    layer: "L0",
    assert: "same_etld_redirect",
    setup: {
      from: "https://new.qq.com/rain/a/demo",
      to: "https://inews.qq.com/rain/a/demo",
    },
  },
  {
    id: "F03",
    title: "prepared assets block placeholder SVG",
    layer: "L1",
    assert: "block_placeholder_with_assets",
    setup: { assetCount: 2, filePath: "assets/placeholder-city.svg" },
  },
  {
    id: "F04",
    title: "search blocked when official URL present",
    layer: "L1",
    assert: "official_first_flag",
    setup: {},
  },
  {
    id: "F05",
    title: "minWidth string coerce",
    layer: "L0",
    assert: "coerce_min_width",
    setup: { value: "800" },
  },
  {
    id: "F06",
    title: "force ladder after 2 fetch failures",
    layer: "L1",
    assert: "force_ladder",
    setup: { sessionId: "vap-f06" },
  },
  {
    id: "F07",
    title: "query pack not car-biased for KM3/paddleboard",
    layer: "L0",
    assert: "query_pack_generic",
    setup: {
      subjects: ["百路驰 KM3", "车市水系浆板热"],
    },
  },
  {
    id: "F08",
    title: "same eTLD+1 CDN redirect",
    layer: "L0",
    assert: "same_etld_redirect",
    setup: {
      from: "https://www.example.com/p",
      to: "https://cdn.example.com/p.jpg",
    },
  },
  {
    id: "F09",
    title: "sidecar down soft-skip",
    layer: "L1",
    assert: "sidecar_down",
    setup: {},
  },
  {
    id: "F10",
    title: "SSRF sidecar poison URL rejected",
    layer: "L0",
    assert: "ssrf_reject",
    setup: { url: "http://127.0.0.1:2375/images/x.jpg" },
  },
  {
    id: "F11",
    title: "vision description without URL",
    layer: "L1",
    assert: "vision_no_url",
    setup: { text: "页面上有一张好看的轮胎产品图，主体清晰。" },
  },
  {
    id: "F12",
    title: "official placeholder incomplete",
    layer: "L1",
    assert: "official_placeholder_gate",
    setup: { filePath: "index.html", assetCount: 0 },
  },
];

export const VAP_0802_ANCHOR_CASES = [
  {
    id: "R-A",
    title: "paddleboard user research",
    taskDir: "artifacts/task-20260802-61b492f8",
    sessionHint: "c59756f4",
  },
  {
    id: "R-B",
    title: "BFGoodrich KM3 GEO",
    taskDir: "artifacts/task-20260802-15d46012",
    sessionHint: "f85df5c5",
  },
] as const;
