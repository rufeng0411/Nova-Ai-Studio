import { afterEach, describe, expect, it } from "vitest";
import {
  assessFactualPremise,
  buildFactualPremiseSystemAppend,
  factualPremiseGuardMode,
} from "./factualPremisePolicy.js";

const CURRENT_YEAR = new Date().getFullYear();

describe("factualPremisePolicy", () => {
  afterEach(() => {
    delete process.env.PILOTDECK_FACTUAL_PREMISE_GUARD;
  });

  it.each([
    [undefined, "off"],
    ["off", "off"],
    ["shadow", "shadow"],
    ["enforce", "enforce"],
  ] as const)("resolves the independent tri-state flag %s", (raw, expected) => {
    if (raw == null) delete process.env.PILOTDECK_FACTUAL_PREMISE_GUARD;
    else process.env.PILOTDECK_FACTUAL_PREMISE_GUARD = raw;
    expect(factualPremiseGuardMode()).toBe(expected);
  });

  it.each([
    [`调研：${CURRENT_YEAR} 年网传微软将收购 Anthropic，请核实来源`, "rumor"],
    [`${CURRENT_YEAR} prediction market gives Microsoft acquiring Anthropic a 60% chance`, "prediction"],
    [`调研 ${CURRENT_YEAR} 年微软宣布收购 Anthropic 的公开来源`, "announced"],
    [`Research the ${CURRENT_YEAR} agreement signed for Microsoft to acquire Anthropic`, "signed"],
    [`核实 ${CURRENT_YEAR} 年微软已完成收购 Anthropic 的权威来源`, "closed"],
  ] as const)("distinguishes recent high-impact deal state: %s", (goal, expectedKind) => {
    const result = assessFactualPremise(goal);
    expect(result?.requiresSource).toBe(true);
    expect(result?.suggestedKind).toBe(expectedKind);
    expect(result?.highImpact).toBe(true);
    expect(result?.recent).toBe(true);
  });

  it.each([
    "微软产品要收购用户并提升留存",
    "Use Microsoft SDK to acquire users",
    "merge arrays in the Microsoft SDK",
    "merge PR #42 after checks pass",
    "合并数组并提交 PR",
    `Microsoft recently acquired a small startup in ${CURRENT_YEAR}`,
    "分析 Microsoft 2016 年收购 LinkedIn 的历史案例",
  ])("does not trigger on technical, growth, or old acquisition language: %s", (goal) => {
    expect(assessFactualPremise(goal)).toBeNull();
  });

  it("starts brainstorming guidance with the explicit assumption sentence without forcing tools", () => {
    process.env.PILOTDECK_FACTUAL_PREMISE_GUARD = "enforce";
    const append = buildFactualPremiseSystemAppend(
      `脑暴：假设 ${CURRENT_YEAR} 年微软已完成收购 Anthropic，会有哪些产品机会？`,
    );
    expect(append?.split("\n")[0]).toBe("以下按假设推演。");
    expect(append).toContain("无需为纯脑暴调用工具");
    expect(append).not.toContain("必须搜索");
  });

  it("requires source verification for research tasks and stays bounded", () => {
    process.env.PILOTDECK_FACTUAL_PREMISE_GUARD = "shadow";
    const append = buildFactualPremiseSystemAppend(
      `调研 ${CURRENT_YEAR} 年微软宣布收购 Anthropic 的事实并给出报告`,
    );
    expect(append).toContain("核验");
    expect(append).toContain("来源");
    expect(append?.length).toBeLessThan(500);
  });

  it("appends nothing while off", () => {
    expect(buildFactualPremiseSystemAppend(
      `调研 ${CURRENT_YEAR} 年微软宣布收购 Anthropic 的事实并给出报告`,
    )).toBeUndefined();
  });
});
