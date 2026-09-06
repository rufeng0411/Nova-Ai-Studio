import { describe, expect, it } from "vitest";
import type { CanonicalMessage } from "../../model/index.js";
import {
  appendUniversalDataSourcesSlot,
  buildDataSourcesMarkdown,
  collectDataSourcesSnapshot,
  isUniversalDataSourcesPath,
  isUniversalDataSourcesSlot,
  UNIVERSAL_DATA_SOURCES_BASENAME,
} from "./dataSourcesDeliverable.js";

describe("dataSourcesDeliverable", () => {
  it("appends universal data sources slot once", () => {
    const base = [{
      id: "slot_1",
      label: "报告",
      pathHint: "report.md",
      required: true,
      status: "active" as const,
    }];
    const once = appendUniversalDataSourcesSlot(base, "artifacts/task-20260721-abcd1234");
    const twice = appendUniversalDataSourcesSlot(once, "artifacts/task-20260721-abcd1234");
    expect(once).toHaveLength(2);
    expect(twice).toHaveLength(2);
    expect(once[1]?.id).toBe("universal_data_sources");
    expect(once[1]?.pathHint).toBe(`artifacts/task-20260721-abcd1234/${UNIVERSAL_DATA_SOURCES_BASENAME}`);
  });

  it("matches universal data sources slot and path", () => {
    expect(isUniversalDataSourcesSlot({ id: "universal_data_sources" })).toBe(true);
    expect(isUniversalDataSourcesPath("artifacts/task-x/data-sources.md")).toBe(true);
  });

  it("builds markdown from web_search tool results", async () => {
    const messages: CanonicalMessage[] = [
      {
        role: "assistant",
        content: [
          {
            type: "tool_call",
            id: "call_1",
            name: "web_search",
            input: { query: "Nova AI Studio" },
          },
          {
            type: "tool_result",
            toolCallId: "call_1",
            content: [{
              type: "text",
              text: JSON.stringify({
                query: "Nova AI Studio",
                organic: [{
                  title: "Nova Ai Studio",
                  link: "https://www.novapage.online/",
                  snippet: "智能体协作平台",
                }],
              }),
            }],
          },
        ],
      },
    ];
    const snapshot = await collectDataSourcesSnapshot({
      cwd: process.cwd(),
      messages,
      taskArtifactDir: "artifacts/task-test",
    });
    const md = buildDataSourcesMarkdown(snapshot);
    expect(md).toContain("# 数据源溯源");
    expect(md).toContain("https://www.novapage.online/");
    expect(md).toContain("Nova AI Studio");
  });
});
