import { describe, expect, it } from "vitest";
import {
  detectNamedViralStyles,
  resolveViralArticleMainStyle,
  type ViralStyleScore,
} from "./viralArticleStyleRouting.js";
import {
  VIRAL_ARTICLE_BANFO_GOAL,
  VIRAL_ARTICLE_MIX_HARD_GOAL,
  VIRAL_ARTICLE_STUB_LIURUN_GOAL,
  VIRAL_ARTICLE_SHOUYE_GOAL,
} from "../../tests/fixtures/viral-article-pack-goals.js";

const SAMPLE_SCORES: ViralStyleScore[] = [
  { id: "T1-6", label: "刘润气质", status: "stub", score: 95 },
  { id: "T1-1", label: "风控老炮", status: "full", score: 80 },
  { id: "T1-2", label: "调查讽刺", status: "full", score: 70 },
  { id: "T1-4", label: "吴晓波气质", status: "stub", score: 60 },
];

describe("viralArticleStyleRouting", () => {
  it("auto picks highest full even when stub scores higher", () => {
    const r = resolveViralArticleMainStyle({ goal: "写一篇爆款", scores: SAMPLE_SCORES });
    expect(r.kind).toBe("auto_full");
    if (r.kind === "auto_full") expect(r.mainStyle).toBe("T1-1");
    expect(r.top3.some((s) => s.status === "stub")).toBe(true);
  });

  it("named banfo → T1-1", () => {
    expect(detectNamedViralStyles(VIRAL_ARTICLE_BANFO_GOAL)).toEqual(["T1-1"]);
    const r = resolveViralArticleMainStyle({ goal: VIRAL_ARTICLE_BANFO_GOAL, scores: SAMPLE_SCORES });
    expect(r.kind).toBe("named_full");
    if (r.kind === "named_full") expect(r.mainStyle).toBe("T1-1");
  });

  it("named shouye → T1-2", () => {
    const r = resolveViralArticleMainStyle({ goal: VIRAL_ARTICLE_SHOUYE_GOAL, scores: SAMPLE_SCORES });
    expect(r.kind).toBe("named_full");
    if (r.kind === "named_full") expect(r.mainStyle).toBe("T1-2");
  });

  it("stub liurun → soft switch to nearest full", () => {
    const r = resolveViralArticleMainStyle({ goal: VIRAL_ARTICLE_STUB_LIURUN_GOAL, scores: SAMPLE_SCORES });
    expect(r.kind).toBe("soft_stub");
    if (r.kind === "soft_stub") {
      expect(r.requestedStub).toBe("T1-6");
      expect(r.mainStyle).toBe("T1-1");
      expect(r.notice).toMatch(/未入库|stub|改用/i);
    }
  });

  it("mix banfo+liurun → hard refuse", () => {
    const r = resolveViralArticleMainStyle({ goal: VIRAL_ARTICLE_MIX_HARD_GOAL, scores: SAMPLE_SCORES });
    expect(r.kind).toBe("hard_mix_refuse");
    if (r.kind === "hard_mix_refuse") {
      expect(r.requested).toContain("T1-1");
      expect(r.requested).toContain("T1-6");
    }
  });

  it("named full in ban zone → soft_full_low", () => {
    const scores: ViralStyleScore[] = [
      { id: "T1-2", label: "调查讽刺", status: "full", score: 22, banZone: true },
      { id: "T1-1", label: "风控老炮", status: "full", score: 50 },
    ];
    const r = resolveViralArticleMainStyle({
      goal: "用兽爷气质写消费品牌智商税吐槽",
      scores,
    });
    expect(r.kind).toBe("soft_full_low");
    if (r.kind === "soft_full_low") {
      expect(r.requestedFull).toBe("T1-2");
      expect(r.mainStyle).toBe("T1-1");
    }
  });
});
