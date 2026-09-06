import { describe, expect, it } from "vitest";

import type { CanonicalModelRequest, CanonicalToolSchema } from "../../model/index.js";
import { applyOrchestration } from "./applyOrchestration.js";
import type { RouterAutoOrchestrateConfig } from "../config/schema.js";

function mockRequest(tools: CanonicalToolSchema[]): CanonicalModelRequest {
  return {
    messages: [{ role: "user", content: [{ type: "text", text: "须交付 report.md 和 PDF" }] }],
    tools,
  };
}

describe("applyOrchestration deliverable preserve", () => {
  const config: RouterAutoOrchestrateConfig = {
    enabled: true,
    allowedTools: ["agent"],
    triggerTiers: ["fast"],
  };

  it("strips tools when preserveDeliverableTools=false", () => {
    const tools = [
      { name: "write_file", description: "", inputSchema: { type: "object" } },
      { name: "agent", description: "", inputSchema: { type: "object" } },
    ];
    const result = applyOrchestration({
      request: mockRequest(tools),
      config,
      isMainAgent: true,
      tier: "fast",
      preserveDeliverableTools: false,
    });
    expect(result.applied).toBe(true);
    expect(result.request.tools?.map((t) => t.name)).toEqual(["agent"]);
    expect(result.mutations.toolsStripped).toBeTruthy();
  });

  it("preserves tools when preserveDeliverableTools=true", () => {
    const tools = [
      { name: "write_file", description: "", inputSchema: { type: "object" } },
      { name: "agent", description: "", inputSchema: { type: "object" } },
    ];
    const result = applyOrchestration({
      request: mockRequest(tools),
      config,
      isMainAgent: true,
      tier: "fast",
      preserveDeliverableTools: true,
    });
    expect(result.request.tools?.length).toBe(2);
    expect(result.mutations.toolsStripped).toBeUndefined();
  });
});
