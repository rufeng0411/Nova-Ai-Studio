import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from '../../util/childProcess.js';
import { withHiddenConsole } from "../../util/withHiddenConsole.js";
import type { PermissionResult } from "../../permission/index.js";
import { resolvePilotDeckRepoRoot } from "../../pilot/config/applyYixiaoerToolEnv.js";
import { PilotDeckToolRuntimeError } from "../protocol/errors.js";
import type {
  PilotDeckToolDefinition,
  PilotDeckToolRuntimeContext,
} from "../protocol/types.js";

export type CreateYixiaoerApiToolOptions = {
  apiKey?: string;
  apiUrl?: string;
  wrapperPath?: string;
};

export type YixiaoerApiInput = {
  /** Full YiXiaoEr DTO payload. Must include `action`. */
  payload?: Record<string, unknown>;
  /** Shorthand when `payload` is omitted. */
  action?: string;
  platforms?: string[];
  loginStatus?: number;
  page?: number;
  size?: number;
};

const READ_ONLY_ACTIONS = new Set([
  "accounts",
  "records",
  "details",
  "categories",
  "activities",
  "locations",
  "music",
  "music-category",
  "collections",
  "groups",
  "goods",
  "hot-events",
  "challenges",
  "miniapps",
  "overviews",
  "syncapps",
  "library",
]);

const TOOL_DESCRIPTION = `Call YiXiaoEr (蚁小�? Open API for social account management and publishing.

**Always use this tool** for 蚁小�?tasks. Do NOT search for api.ts, do NOT run bash find/dir, and do NOT call scripts/api.ts directly.

Common examples:
- List normal Douyin/Xiaohongshu accounts: {"action":"accounts","platforms":["抖音","小红�?],"loginStatus":1,"page":1,"size":100}
- Publish / upload / save-draft: pass the full DTO payload from the yixiaoer skill docs.

Either supply a complete \`payload\` object, or set \`action\` plus optional filter fields.`;

export function createYixiaoerApiTool(
  options: CreateYixiaoerApiToolOptions = {},
): PilotDeckToolDefinition<YixiaoerApiInput> {
  return {
    name: "yixiaoer_api",
    aliases: ["YixiaoerApi", "YiXiaoErApi"],
    description: TOOL_DESCRIPTION,
    kind: "network",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        payload: {
          type: "object",
          description: "Full YiXiaoEr request DTO. Must include action.",
        },
        action: {
          type: "string",
          description: "YiXiaoEr action name when payload is omitted (e.g. accounts).",
        },
        platforms: {
          type: "array",
          items: { type: "string" },
          description: "Platform names such as 抖音 or 小红�?",
        },
        loginStatus: {
          type: "integer",
          description: "1 = logged in / normal.",
        },
        page: { type: "integer" },
        size: { type: "integer" },
      },
    },
    maxResultBytes: 400_000,
    isReadOnly: (input) => isReadOnlyAction(resolvePayload(input).action),
    isConcurrencySafe: (input) => isReadOnlyAction(resolvePayload(input).action),
    isOpenWorld: () => true,
    checkPermissions: async (input) => classifyPermission(resolvePayload(input).action),
    execute: async (input, context) => {
      const payload = resolvePayload(input);
      const action = payload.action;
      if (typeof action !== "string" || !action.trim()) {
        throw new PilotDeckToolRuntimeError(
          "invalid_tool_input",
          "yixiaoer_api requires payload.action or action.",
        );
      }

      const wrapperPath = resolveWrapperPath(context, options.wrapperPath);
      const env = buildProcessEnv(context, options);
      if (!env.YIXIAOER_API_KEY?.trim()) {
        throw new PilotDeckToolRuntimeError(
          "unsupported_tool",
          "YIXIAOER_API_KEY is not configured. Set tools.yixiaoer.apiKey in PilotDeck settings.",
        );
      }

      const tempDir = await mkdtemp(join(tmpdir(), "pilotdeck-yixiaoer-"));
      const payloadPath = join(tempDir, "payload.json");
      try {
        await writeFile(payloadPath, `${JSON.stringify(payload)}\n`, "utf8");
        const output = await runWrapper(wrapperPath, payloadPath, env);
        return {
          content: [{ type: "text", text: output }],
          data: parseJsonSafely(output),
        };
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    },
  };
}

function resolvePayload(input: YixiaoerApiInput): Record<string, unknown> {
  if (input.payload && typeof input.payload === "object") {
    return { ...input.payload };
  }
  const payload: Record<string, unknown> = {};
  if (input.action?.trim()) payload.action = input.action.trim();
  if (Array.isArray(input.platforms) && input.platforms.length > 0) {
    payload.platforms = input.platforms;
  }
  if (typeof input.loginStatus === "number") payload.loginStatus = input.loginStatus;
  if (typeof input.page === "number") payload.page = input.page;
  if (typeof input.size === "number") payload.size = input.size;
  return payload;
}

function isReadOnlyAction(action: unknown): boolean {
  return typeof action === "string" && READ_ONLY_ACTIONS.has(action.trim());
}

async function classifyPermission(action: unknown): Promise<PermissionResult> {
  if (isReadOnlyAction(action)) {
    return { type: "allow", reason: { type: "runtime", message: "Read-only YiXiaoEr query." } };
  }
  return {
    type: "ask",
    reason: {
      type: "tool",
      toolName: "yixiaoer_api",
      message: "YiXiaoEr publish/upload actions may change remote social content.",
    },
    request: {
      toolCallId: "",
      toolName: "yixiaoer_api",
      inputSummary: typeof action === "string" ? action : "yixiaoer",
      reason: {
        type: "tool",
        toolName: "yixiaoer_api",
        message: "YiXiaoEr publish/upload actions may change remote social content.",
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
  options: CreateYixiaoerApiToolOptions,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...(context.env ?? {}) };
  const apiKey = options.apiKey?.trim() || env.YIXIAOER_API_KEY?.trim();
  if (apiKey) env.YIXIAOER_API_KEY = apiKey;
  const apiUrl = options.apiUrl?.trim() || env.YIXIAOER_API_URL?.trim();
  if (apiUrl) env.YIXIAOER_API_URL = apiUrl;
  return env;
}

function resolveWrapperPath(
  context: PilotDeckToolRuntimeContext,
  configured?: string,
): string {
  const candidates = [
    configured?.trim(),
    context.env?.PILOTDECK_YIXIAOER_API?.trim(),
    process.env.PILOTDECK_YIXIAOER_API?.trim(),
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  const repoRoot = resolvePilotDeckRepoRoot([context.cwd, process.cwd()]);
  if (repoRoot) {
    const fallback = join(repoRoot, "scripts", "yixiaoer-api.mjs");
    if (existsSync(fallback)) return fallback;
  }
  throw new PilotDeckToolRuntimeError(
    "unsupported_tool",
    "yixiaoer-api.mjs not found. Reinstall PilotDeck or set PILOTDECK_YIXIAOER_API.",
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
        reject(
          new PilotDeckToolRuntimeError(
            "tool_execution_failed",
            text || `yixiaoer_api exited with code ${String(code)}`,
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
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}
