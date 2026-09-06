import assert from "node:assert/strict";
import test from "node:test";

import type { AgentRuntimeConfig } from "../../src/agent/runtime/AgentRuntimeConfig.js";
import type { AgentRuntimeDependencies } from "../../src/agent/runtime/AgentRuntimeDependencies.js";
import { SubAgentSession } from "../../src/agent/sub/SubAgentSession.js";
import { createDefaultPermissionContext } from "../../src/permission/index.js";
import { OfficialMediaFallbackStateMachine } from "../../src/saas/media/officialMediaFallbackStateMachine.js";
import { buildGoalToolPolicy } from "../../src/saas/media/goalToolPolicy.js";
import type {
  PilotDeckToolDefinition,
  PilotDeckToolKind,
} from "../../src/tool/protocol/types.js";
import { ToolRegistry } from "../../src/tool/registry/ToolRegistry.js";

function probeTool(
  name: string,
  kind: PilotDeckToolKind,
): PilotDeckToolDefinition {
  return {
    name,
    description: `probe ${name}`,
    kind,
    inputSchema: {
      type: "object",
      additionalProperties: true,
      properties: {},
    },
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    execute: async () => ({
      content: [{ type: "text", text: "ok" }],
    }),
  };
}

test("subagent preserves the parent official-media budget and filters escape tools", () => {
  const parentRegistry = new ToolRegistry();
  for (const [name, kind] of [
    ["bash", "shell"],
    ["mcp__browser__navigate", "mcp"],
    ["generate_image", "network"],
    ["fetch_page_images", "network"],
    ["fetch_media_asset", "network"],
    ["write_file", "filesystem"],
  ] as const) {
    parentRegistry.register(probeTool(name, kind));
  }
  const goalToolPolicy = buildGoalToolPolicy({
    contract: {
      contractVersion: 1,
      subjectAliases: [],
      exactQuantityAssertions: [],
      officialMediaPolicy: "official_only",
      allowedSourceTiers: ["brand_official"],
      allowPlaceholders: true,
      forbidGenerateImage: true,
    },
    mode: "enforce",
    workspaceRoot: process.cwd(),
    taskArtifactDir: "artifacts/task-subagent",
    taskGoalVersion: 1,
  });
  const officialMediaBudget = new OfficialMediaFallbackStateMachine({
    allowPlaceholders: true,
  });
  const parentConfig: AgentRuntimeConfig = {
    provider: "test",
    model: "test",
    cwd: process.cwd(),
    permissionMode: "bypassPermissions",
    permissionContext: createDefaultPermissionContext({
      cwd: process.cwd(),
      mode: "bypassPermissions",
    }),
  };
  const parentDependencies = {
    tools: { registry: parentRegistry },
  } as unknown as AgentRuntimeDependencies;
  const session = new SubAgentSession({
    definition: {
      id: "general-purpose",
      description: "test",
      allowedTools: ["*"],
      omitProjectInstructions: false,
      omitGitStatus: false,
      isReadOnly: false,
      systemPromptSuffix: "",
    },
    directive: "test",
    parentMessages: [],
    parentConfig,
    parentDependencies,
    parentSessionId: "parent-session",
    parentTurnId: "parent-turn",
    subagentSessionId: "child-session",
    subagentId: "child",
    goalToolPolicy,
    officialMediaBudget,
  });
  const access = session as unknown as {
    options: {
      goalToolPolicy: typeof goalToolPolicy;
      officialMediaBudget: typeof officialMediaBudget;
    };
    buildScopedRegistry(): ToolRegistry;
  };

  assert.equal(access.options.goalToolPolicy, goalToolPolicy);
  assert.equal(access.options.officialMediaBudget, officialMediaBudget);
  const scoped = access.buildScopedRegistry();
  assert.equal(scoped.get("bash"), undefined);
  assert.equal(scoped.get("mcp__browser__navigate"), undefined);
  assert.equal(scoped.get("generate_image"), undefined);
  assert.ok(scoped.get("fetch_page_images"));
  assert.ok(scoped.get("fetch_media_asset"));
  assert.ok(scoped.get("write_file"));
});
