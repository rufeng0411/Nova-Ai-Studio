import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultPermissionContext, PermissionRuntime } from "../../src/permission/index.js";
import {
  buildGoalToolPolicy,
  evaluateGoalToolPolicy,
  isToolAllowedByGoalToolPolicy,
} from "../../src/saas/media/goalToolPolicy.js";
import { OfficialMediaFallbackStateMachine } from "../../src/saas/media/officialMediaFallbackStateMachine.js";
import { buildOfficialMediaPlaceholder } from "../../src/saas/media/officialMediaPlaceholder.js";
import { guardPolicyAwareToolInput } from "../../src/saas/media/policyAwarePathGuard.js";
import { ToolRuntime } from "../../src/tool/execution/ToolRuntime.js";
import type {
  PilotDeckToolDefinition,
  PilotDeckToolRuntimeContext,
} from "../../src/tool/protocol/types.js";
import { ToolRegistry } from "../../src/tool/registry/ToolRegistry.js";

const officialOnlyContract = {
  contractVersion: 1 as const,
  subjectAliases: [],
  exactQuantityAssertions: [],
  officialMediaPolicy: "official_only" as const,
  allowedSourceTiers: ["brand_official" as const],
  allowPlaceholders: false,
  forbidGenerateImage: true,
};

function officialPolicy() {
  return buildGoalToolPolicy({
    contract: officialOnlyContract,
    mode: "enforce",
    workspaceRoot: process.cwd(),
    taskArtifactDir: "artifacts/task-policy",
    taskGoalVersion: 1,
    trustedExecutionScope: {
      tenantScopeId: "tenant-policy",
      principalScopeId: "user-policy",
    },
  });
}

function runtimeContext(
  overrides: Partial<PilotDeckToolRuntimeContext> = {},
): PilotDeckToolRuntimeContext {
  return {
    sessionId: "session-policy",
    turnId: "turn-policy",
    cwd: process.cwd(),
    taskArtifactDir: "artifacts/task-policy",
    taskGoalVersion: 1,
    permissionMode: "bypassPermissions",
    permissionContext: createDefaultPermissionContext({
      cwd: process.cwd(),
      mode: "bypassPermissions",
    }),
    goalToolPolicy: officialPolicy(),
    ...overrides,
  };
}

function policyProbeTool(
  name: string,
  kind: PilotDeckToolDefinition["kind"],
  counters: { permission: number; execute: number },
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
    isReadOnly: () => false,
    isConcurrencySafe: () => false,
    checkPermissions: async () => {
      counters.permission += 1;
      return {
        type: "allow",
        reason: { type: "runtime", message: "test allow" },
      };
    },
    execute: async () => {
      counters.execute += 1;
      return { content: [{ type: "text", text: "executed" }] };
    },
  };
}

test("official-only goal policy denies shell, MCP, image generation, and unbound subagent escape", () => {
  const policy = officialPolicy();
  assert.equal(isToolAllowedByGoalToolPolicy("bash", "shell", policy), false);
  assert.equal(
    isToolAllowedByGoalToolPolicy("mcp__browser__navigate", "mcp", policy),
    false,
  );
  assert.equal(
    isToolAllowedByGoalToolPolicy("generate_image", "network", policy),
    false,
  );
  assert.equal(
    evaluateGoalToolPolicy({
      toolName: "agent",
      toolKind: "agent",
      input: {},
      policy,
      hasBoundedSubagent: false,
    }).allowed,
    false,
  );
  assert.equal(
    evaluateGoalToolPolicy({
      toolName: "agent",
      toolKind: "agent",
      input: {},
      policy,
      hasBoundedSubagent: true,
    }).allowed,
    true,
  );
});

test("ToolRuntime applies goal policy before permission hooks", async () => {
  for (const [name, kind] of [
    ["bash", "shell"],
    ["mcp__browser__navigate", "mcp"],
    ["generate_image", "network"],
  ] as const) {
    const counters = { permission: 0, execute: 0 };
    const registry = new ToolRegistry();
    registry.register(policyProbeTool(name, kind, counters));
    const runtime = new ToolRuntime(registry, new PermissionRuntime());

    const result = await runtime.execute(
      { id: `call-${name}`, name, input: {} },
      runtimeContext(),
    );

    assert.equal(result.type, "error");
    if (result.type === "error") {
      assert.equal(result.error.code, "permission_denied");
      assert.match(result.error.message, /official media|goal tool policy/iu);
    }
    assert.deepEqual(counters, { permission: 0, execute: 0 });
  }
});

test("ToolRuntime rechecks policy after a permission hook rewrites tool input", async () => {
  let executed = 0;
  const registry = new ToolRegistry();
  registry.register({
    name: "write_file",
    description: "permission rewrite probe",
    kind: "filesystem",
    inputSchema: {
      type: "object",
      additionalProperties: true,
      properties: {},
    },
    isReadOnly: () => false,
    isConcurrencySafe: () => false,
    checkPermissions: async () => ({
      type: "allow",
      reason: { type: "runtime", message: "rewrite for test" },
      updatedInput: {
        file_path: "artifacts/task-other/index.html",
        content: "<main>escaped</main>",
      },
    }),
    execute: async () => {
      executed += 1;
      return { content: [{ type: "text", text: "executed" }] };
    },
  });
  const runtime = new ToolRuntime(registry, new PermissionRuntime());
  const result = await runtime.execute(
    {
      id: "call-permission-rewrite",
      name: "write_file",
      input: {
        file_path: "index.html",
        content: "<main>safe</main>",
      },
    },
    runtimeContext(),
  );

  assert.equal(result.type, "error");
  if (result.type === "error") {
    assert.equal(result.error.code, "permission_denied");
    assert.match(result.error.message, /task root|active task/iu);
  }
  assert.equal(executed, 0);
});

test("ToolRuntime advances one shared official-media budget through placeholder fallback", async () => {
  const counters = { permission: 0, execute: 0 };
  const registry = new ToolRegistry();
  registry.register({
    ...policyProbeTool("fetch_page_images", "network", counters),
    execute: async () => {
      counters.execute += 1;
      return {
        content: [{ type: "text", text: "no candidates" }],
        data: { candidates: [] },
      };
    },
  });
  let capturedWrite: unknown;
  registry.register({
    ...policyProbeTool("write_file", "filesystem", counters),
    execute: async (input) => {
      counters.execute += 1;
      capturedWrite = input;
      return { content: [{ type: "text", text: "placeholder written" }] };
    },
  });
  const runtime = new ToolRuntime(registry, new PermissionRuntime());
  const budget = new OfficialMediaFallbackStateMachine({
    allowPlaceholders: true,
    maxDiscoveryAttempts: 1,
  });
  const goalToolPolicy = buildGoalToolPolicy({
    contract: { ...officialOnlyContract, allowPlaceholders: true },
    mode: "enforce",
    workspaceRoot: process.cwd(),
    taskArtifactDir: "artifacts/task-policy",
    taskGoalVersion: 1,
  });
  const context = runtimeContext({
    officialMediaBudget: budget,
    goalToolPolicy,
  });

  const discovery = await runtime.execute(
    {
      id: "call-discovery",
      name: "fetch_page_images",
      input: { url: "https://brand.example.com/product" },
    },
    context,
  );
  assert.equal(discovery.type, "success");
  assert.equal(budget.snapshot().state, "placeholder_required");

  const placeholder = buildOfficialMediaPlaceholder();
  const write = await runtime.execute(
    {
      id: "call-placeholder",
      name: "write_file",
      input: {
        file_path: "assets/official-media-placeholder.svg",
        content: placeholder.content,
      },
    },
    context,
  );
  assert.equal(write.type, "success");
  assert.equal(budget.snapshot().state, "placeholder_ready");
  assert.deepEqual(capturedWrite, {
    file_path:
      "artifacts/task-policy/assets/official-media-placeholder.svg",
    content: placeholder.content,
  });
  assert.deepEqual(counters, { permission: 2, execute: 2 });
});

test("policy-aware path guard anchors writes and exports to the active task root", () => {
  const policy = officialPolicy();
  const write = guardPolicyAwareToolInput({
    toolName: "write_file",
    input: { file_path: "pages/index.html", content: "<main>ok</main>" },
    policy,
  });
  assert.equal(write.allowed, true);
  assert.deepEqual(write.input, {
    file_path: "artifacts/task-policy/pages/index.html",
    content: "<main>ok</main>",
  });

  const exported = guardPolicyAwareToolInput({
    toolName: "export_document",
    input: {
      source_path: "report.md",
      output_format: "pdf",
    },
    policy,
  });
  assert.equal(exported.allowed, true);
  assert.deepEqual(exported.input, {
    source_path: "artifacts/task-policy/report.md",
    output_format: "pdf",
    output_path: "artifacts/task-policy/report.pdf",
  });
});

test("policy-aware path guard rejects cross-task writes and remote media hotlinks", () => {
  const policy = officialPolicy();
  const crossTask = guardPolicyAwareToolInput({
    toolName: "write_file",
    input: {
      file_path: "artifacts/task-other/index.html",
      content: "<main>other task</main>",
    },
    policy,
  });
  assert.equal(crossTask.allowed, false);
  assert.match(crossTask.reason ?? "", /active task|task root/iu);

  const hotlink = guardPolicyAwareToolInput({
    toolName: "write_file",
    input: {
      file_path: "index.html",
      content: '<img src="https://untrusted.example.com/generated.png" />',
    },
    policy,
  });
  assert.equal(hotlink.allowed, false);
  assert.match(hotlink.reason ?? "", /remote|localiz/iu);
});
