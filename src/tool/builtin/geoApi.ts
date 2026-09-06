import { existsSync } from "node:fs";
// PD-SAAS-FORK: geo_api builtin — SaaS GEO tool wiring (see config/pilotdeck-core-fork.manifest.json)
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from '../../util/childProcess.js';
import { withHiddenConsole } from "../../util/withHiddenConsole.js";
import type { PermissionResult } from "../../permission/index.js";
import { applyGeoToolEnv } from "../../pilot/config/applyGeoToolEnv.js";
import { resolvePilotDeckRepoRoot } from "../../pilot/config/applyYixiaoerToolEnv.js";
import { PilotDeckToolRuntimeError } from "../protocol/errors.js";
import type {
  PilotDeckToolDefinition,
  PilotDeckToolRuntimeContext,
} from "../protocol/types.js";

import { USER_FACING_PRODUCT_NAME } from "../../saas/brand/userFacingProductName.js";

export type CreateGeoApiToolOptions = {
  bochaApiKey?: string;
  dataDir?: string;
  wrapperPath?: string;
  /** @deprecated Ignored ? GEO verify no longer uses Perplexity. */
  perplexityApiKey?: string;
};

export type GeoApiInput = {
  payload?: Record<string, unknown>;
  action?: string;
  brand?: string;
  content?: string;
  content_path?: string;
  advantages?: string;
  platform?: string;
  queries?: string[];
  competitors?: string[];
};

const READ_ONLY_ACTIONS = new Set(["rag_query", "history_summary", "keywords", "schema"]);

const TOOL_DESCRIPTION = `GEO (AI search visibility) operations: content scoring, mention verification, keywords, schema, brand knowledge base.

**Always use this tool** for AI search visibility scoring/verify tasks. Do not invent 0-100 scores.

**Search / verify order (mandatory)**:
1. Built-in web_search (model web search)
2. Bocha API (BOCHA_API_KEY) when web_search soft-fails
3. Do NOT use Perplexity, Google Custom Search, or other extra search API keys for GEO

Examples:
- Score: {"action":"score","brand":"Acme","content_path":"artifacts/geo/acme/optimized.md","platform":"zhihu"}
- Verify: {"action":"verify","brand":"Acme","queries":["best XX brand","XX vs YY"]}
- Keywords: {"action":"keywords","brand":"Acme","advantages":"..."}

If verify returns verification_mode agent_web_search, run web_search per query and write verify-report.json. If scoring_mode quick, accept rule score plus CORE-EEAT checklist.`;

export function createGeoApiTool(
  options: CreateGeoApiToolOptions = {},
): PilotDeckToolDefinition<GeoApiInput> {
  return {
    name: "geo_api",
    aliases: ["GeoApi", "GEOApi"],
    description: TOOL_DESCRIPTION,
    kind: "network",
    inputSchema: {
      type: "object",
      additionalProperties: true,
      properties: {
        payload: {
          type: "object",
          description: "Full GEO CLI payload. Must include action.",
        },
        action: { type: "string" },
        brand: { type: "string" },
        content: { type: "string" },
        content_path: { type: "string" },
        advantages: { type: "string" },
        platform: { type: "string" },
        queries: { type: "array", items: { type: "string" } },
        competitors: { type: "array", items: { type: "string" } },
      },
    },
    maxResultBytes: 400_000,
    isReadOnly: (input) => isReadOnlyAction(resolvePayload(input).action),
    isConcurrencySafe: (input) => isReadOnlyAction(resolvePayload(input).action),
    isOpenWorld: () => true,
    checkPermissions: async (input) => classifyPermission(resolvePayload(input).action),
    execute: async (input, context) => {
      const payload = resolvePayload(input);
      const actionName = payload.action;
      if (typeof actionName !== "string" || !actionName.trim()) {
        throw new PilotDeckToolRuntimeError(
          "invalid_tool_input",
          "geo_api requires payload.action or action.",
        );
      }

      const wrapperPath = resolveWrapperPath(context, options.wrapperPath);
      const env = buildProcessEnv(context, options);
      const tempDir = await mkdtemp(join(tmpdir(), "pilotdeck-geo-"));
      const payloadPath = join(tempDir, "payload.json");
      try {
        await writeFile(payloadPath, `${JSON.stringify(payload)}\n`, "utf8");
        const output = await runWrapper(wrapperPath, payloadPath, env);
        const data = parseJsonSafely(output);
        return {
          content: [{ type: "text", text: output }],
          data,
        };
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    },
  };
}

function resolvePayload(input: GeoApiInput): Record<string, unknown> {
  if (input.payload && typeof input.payload === "object") {
    return { ...input.payload };
  }
  const payload: Record<string, unknown> = {};
  if (input.action?.trim()) payload.action = input.action.trim();
  if (input.brand?.trim()) payload.brand = input.brand.trim();
  if (input.content?.trim()) payload.content = input.content.trim();
  if (input.content_path?.trim()) payload.content_path = input.content_path.trim();
  if (input.advantages?.trim()) payload.advantages = input.advantages.trim();
  if (input.platform?.trim()) payload.platform = input.platform.trim();
  if (Array.isArray(input.queries) && input.queries.length > 0) {
    payload.queries = input.queries;
  }
  if (Array.isArray(input.competitors) && input.competitors.length > 0) {
    payload.competitors = input.competitors;
  }
  return payload;
}

function isReadOnlyAction(action: unknown): boolean {
  return typeof action === "string" && READ_ONLY_ACTIONS.has(action.trim());
}

async function classifyPermission(action: unknown): Promise<PermissionResult> {
  if (isReadOnlyAction(action)) {
    return { type: "allow", reason: { type: "runtime", message: "Read-only GEO query." } };
  }
  return {
    type: "ask",
    reason: {
      type: "tool",
      toolName: "geo_api",
      message: "GEO score/verify may call external APIs.",
    },
    request: {
      toolCallId: "",
      toolName: "geo_api",
      inputSummary: typeof action === "string" ? action : "geo",
      reason: {
        type: "tool",
        toolName: "geo_api",
        message: "GEO score/verify may call external APIs.",
      },
      options: [
        { id: "allow_once", label: "Allow once" },
        { id: "deny", label: "Deny" },
      ],
    },
  };
}

function buildProcessEnv(
  context: PilotDeckToolRuntimeContext,
  options: CreateGeoApiToolOptions,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...(context.env ?? {}) };
  applyGeoToolEnv(env, {
    bochaApiKey: options.bochaApiKey,
    dataDir: options.dataDir,
  });
  return env;
}

function resolveWrapperPath(
  context: PilotDeckToolRuntimeContext,
  configured?: string,
): string {
  const candidates = [
    configured?.trim(),
    context.env?.PILOTDECK_GEO_API?.trim(),
    process.env.PILOTDECK_GEO_API?.trim(),
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  const repoRoot = resolvePilotDeckRepoRoot([context.cwd, process.cwd()]);
  if (repoRoot) {
    const fallback = join(repoRoot, "scripts", "aigeo-api.mjs");
    if (existsSync(fallback)) return fallback;
  }
  throw new PilotDeckToolRuntimeError(
    "unsupported_tool",
    `aigeo-api.mjs not found. Reinstall ${USER_FACING_PRODUCT_NAME} or set PILOTDECK_GEO_API.`,
  );
}

function runWrapper(
  wrapperPath: string,
  payloadPath: string,
  env: NodeJS.ProcessEnv,
): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [wrapperPath, "--payload-file", payloadPath], withHiddenConsole({
      env,
      stdio: ["ignore", "pipe", "pipe"],
    }));
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      reject(
        new PilotDeckToolRuntimeError(
          "tool_execution_failed",
          error instanceof Error ? error.message : String(error),
        ),
      );
    });
    child.once("close", (code) => {
      const text = stdout.trim() || stderr.trim();
      if (code !== 0) {
        try {
          const parsed = JSON.parse(text) as { ok?: boolean };
          if (parsed && parsed.ok === false) {
            resolvePromise(text);
            return;
          }
        } catch {
          // fall through
        }
        reject(
          new PilotDeckToolRuntimeError(
            "tool_execution_failed",
            text || `geo_api exited with code ${String(code)}`,
          ),
        );
        return;
      }
      resolvePromise(text);
    });
  });
}

function parseJsonSafely(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return { raw: trimmed };
      }
    }
    return { raw: trimmed };
  }
}
