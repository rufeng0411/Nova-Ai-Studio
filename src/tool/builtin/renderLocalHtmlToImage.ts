// PD-SAAS-FORK P0-5: offline task.local HTML rendering with strict task isolation.

import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  stat,
  unlink,
} from "node:fs/promises";
import path from "node:path";

import type {
  Browser,
  BrowserContext,
  Page,
  Route,
} from "playwright";
import sharp from "sharp";

import type { PermissionResult } from "../../permission/index.js";
import {
  configurePlaywrightPool,
  withPlaywrightBrowserSlot,
} from "../../saas/document-export/playwrightPool.js";
import { PilotDeckToolRuntimeError } from "../protocol/errors.js";
import type {
  PilotDeckToolDefinition,
  PilotDeckToolRuntimeContext,
} from "../protocol/types.js";

export const TASK_LOCAL_ORIGIN = "https://task.local";
export const TASK_LOCAL_CSP = [
  "default-src 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "worker-src 'none'",
  "connect-src 'none'",
  "form-action 'none'",
  "img-src https://task.local data: blob:",
  "media-src https://task.local data: blob:",
  "font-src https://task.local data:",
  "style-src https://task.local 'unsafe-inline'",
  "script-src https://task.local 'unsafe-inline'",
].join("; ");

const MAX_TASK_LOCAL_RESOURCE_BYTES = 20 * 1024 * 1024;
const MAX_RENDERED_IMAGE_PIXELS = 40_000_000;

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export type TaskLocalRequestResolution =
  | {
    action: "abort";
    reason:
      | "external_request"
      | "path_not_allowed"
      | "file_not_found"
      | "resource_too_large";
  }
  | {
    action: "fulfill";
    status: 200;
    body: Buffer;
    contentType: string;
    headers: Record<string, string>;
  };

export type LocalHtmlRenderRequest = {
  sourceUrl: string;
  taskRoot: string;
  width: number;
  height: number;
  fullPage: boolean;
  timeoutMs: number;
  resolveRequest(url: string): Promise<TaskLocalRequestResolution>;
  onExternalRequestBlocked?: (url: string) => void;
};

export type LocalHtmlRenderer = (
  request: LocalHtmlRenderRequest,
) => Promise<Buffer>;

export type RenderLocalHtmlToImageInput = {
  html_path: string;
  output_path?: string;
  width?: number;
  height?: number;
  full_page?: boolean;
};

export type RenderLocalHtmlToImageOutput = {
  localPath: string;
  width: number;
  height: number;
  derivedFrom: string;
  sha256: string;
};

export type CreateRenderLocalHtmlToImageToolOptions = {
  renderer?: LocalHtmlRenderer;
  onExternalRequestBlocked?: (url: string) => void;
  timeoutMs?: number;
};

type SecureTaskRoot = {
  workspaceAbsolute: string;
  workspaceReal: string;
  taskRootAbsolute: string;
  taskRootReal: string;
  taskRootRelative: string;
};

function isPathWithin(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === ""
    || (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function isMissingPathError(error: unknown): boolean {
  return (
    !!error
    && typeof error === "object"
    && "code" in error
    && error.code === "ENOENT"
  );
}

async function assertNotReparsePoint(
  targetPath: string,
  expected: "file" | "directory",
): Promise<void> {
  const target = await lstat(targetPath);
  if (target.isSymbolicLink()) {
    throw new PilotDeckToolRuntimeError(
      "path_not_allowed",
      `${targetPath} must not be a symbolic link or reparse point.`,
    );
  }
  if (
    (expected === "file" && !target.isFile())
    || (expected === "directory" && !target.isDirectory())
  ) {
    throw new PilotDeckToolRuntimeError(
      "path_not_allowed",
      `${targetPath} is not a regular ${expected}.`,
    );
  }
}

async function resolveSecureTaskRoot(
  context: PilotDeckToolRuntimeContext,
): Promise<SecureTaskRoot> {
  const taskRootRelative = String(context.taskArtifactDir ?? "")
    .trim()
    .replace(/\\/gu, "/")
    .replace(/\/+$/u, "");
  const workspaceAbsolute = path.resolve(context.cwd);
  const taskRootAbsolute = path.resolve(
    workspaceAbsolute,
    taskRootRelative,
  );
  if (
    !taskRootRelative
    || path.isAbsolute(taskRootRelative)
    || taskRootRelative.includes("\0")
    || taskRootAbsolute === workspaceAbsolute
  ) {
    throw new PilotDeckToolRuntimeError(
      "path_not_allowed",
      "render_local_html_to_image requires an active task directory.",
    );
  }
  const workspaceReal = await realpath(workspaceAbsolute);
  if (!isPathWithin(taskRootAbsolute, workspaceAbsolute)) {
    throw new PilotDeckToolRuntimeError(
      "path_not_allowed",
      "The active task directory is outside the workspace.",
    );
  }
  await assertNotReparsePoint(taskRootAbsolute, "directory");
  const taskRootReal = await realpath(taskRootAbsolute);
  if (!isPathWithin(taskRootReal, workspaceReal)) {
    throw new PilotDeckToolRuntimeError(
      "path_not_allowed",
      "The active task directory resolves outside the workspace.",
    );
  }
  return {
    workspaceAbsolute,
    workspaceReal,
    taskRootAbsolute,
    taskRootReal,
    taskRootRelative,
  };
}

function decodeTaskLocalPathname(url: URL): string | undefined {
  try {
    const decoded = decodeURIComponent(url.pathname);
    if (
      !decoded
      || decoded.includes("\0")
      || decoded.includes("\\")
    ) {
      return undefined;
    }
    const relative = decoded.replace(/^\/+/u, "");
    if (
      !relative
      || relative.split("/").some(
        (segment) => segment === "." || segment === "..",
      )
    ) {
      return undefined;
    }
    return relative;
  } catch {
    return undefined;
  }
}

export async function resolveTaskLocalRequest(input: {
  requestUrl: string;
  taskRoot: string;
}): Promise<TaskLocalRequestResolution> {
  let url: URL;
  try {
    url = new URL(input.requestUrl);
  } catch {
    return { action: "abort", reason: "external_request" };
  }
  if (url.origin !== TASK_LOCAL_ORIGIN) {
    return { action: "abort", reason: "external_request" };
  }
  const relative = decodeTaskLocalPathname(url);
  if (!relative) {
    return { action: "abort", reason: "path_not_allowed" };
  }

  const taskRootAbsolute = path.resolve(input.taskRoot);
  let taskRootReal: string;
  try {
    await assertNotReparsePoint(taskRootAbsolute, "directory");
    taskRootReal = await realpath(taskRootAbsolute);
  } catch {
    return { action: "abort", reason: "path_not_allowed" };
  }
  const targetAbsolute = path.resolve(taskRootAbsolute, relative);
  if (!isPathWithin(targetAbsolute, taskRootAbsolute)) {
    return { action: "abort", reason: "path_not_allowed" };
  }
  try {
    await assertNotReparsePoint(targetAbsolute, "file");
    const targetReal = await realpath(targetAbsolute);
    if (!isPathWithin(targetReal, taskRootReal)) {
      return { action: "abort", reason: "path_not_allowed" };
    }
    const targetStats = await stat(targetReal);
    if (targetStats.size > MAX_TASK_LOCAL_RESOURCE_BYTES) {
      return { action: "abort", reason: "resource_too_large" };
    }
    const body = await readFile(targetReal);
    return {
      action: "fulfill",
      status: 200,
      body,
      contentType:
        CONTENT_TYPES[path.extname(targetReal).toLowerCase()]
        ?? "application/octet-stream",
      headers: {
        "content-security-policy": TASK_LOCAL_CSP,
        "x-content-type-options": "nosniff",
        "cache-control": "no-store",
      },
    };
  } catch (error) {
    return {
      action: "abort",
      reason: isMissingPathError(error)
        ? "file_not_found"
        : "path_not_allowed",
    };
  }
}

async function handleTaskLocalRoute(
  route: Route,
  request: LocalHtmlRenderRequest,
): Promise<void> {
  const url = route.request().url();
  const resolved = await request.resolveRequest(url);
  if (resolved.action === "abort") {
    if (resolved.reason === "external_request") {
      request.onExternalRequestBlocked?.(url);
    }
    await route.abort("blockedbyclient").catch(() => undefined);
    return;
  }
  await route.fulfill({
    status: resolved.status,
    body: resolved.body,
    contentType: resolved.contentType,
    headers: resolved.headers,
  });
}

async function hardenPage(page: Page): Promise<void> {
  page.on("popup", (popup) => {
    void popup.close().catch(() => undefined);
  });
  page.on("download", (download) => {
    void download.cancel().catch(() => undefined);
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, "open", {
      configurable: false,
      value: () => null,
      writable: false,
    });
  });
}

async function createLockedBrowserContext(
  browser: Browser,
  request: LocalHtmlRenderRequest,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    acceptDownloads: false,
    javaScriptEnabled: true,
    serviceWorkers: "block",
    viewport: {
      width: request.width,
      height: request.height,
    },
  });
  await context.clearPermissions();
  await context.route("**/*", (route) =>
    handleTaskLocalRoute(route, request)
  );
  return context;
}

async function renderWithPlaywright(
  request: LocalHtmlRenderRequest,
): Promise<Buffer> {
  return withPlaywrightBrowserSlot(async (browser) => {
    const context = await createLockedBrowserContext(browser, request);
    try {
      const page = await context.newPage();
      await hardenPage(page);
      await page.emulateMedia({ media: "screen" });
      await page.goto(request.sourceUrl, {
        waitUntil: "load",
        timeout: request.timeoutMs,
      });
      return await page.screenshot({
        type: "png",
        fullPage: request.fullPage,
        animations: "disabled",
        timeout: request.timeoutMs,
      });
    } finally {
      await context.close();
    }
  });
}

async function resolveSourceHtml(
  inputPath: string,
  task: SecureTaskRoot,
): Promise<{ absolutePath: string; relativePath: string; taskPath: string }> {
  const absolutePath = path.resolve(task.workspaceAbsolute, inputPath);
  if (!isPathWithin(absolutePath, task.taskRootAbsolute)) {
    throw new PilotDeckToolRuntimeError(
      "path_not_allowed",
      "render_local_html_to_image source is outside the active task.",
    );
  }
  await assertNotReparsePoint(absolutePath, "file");
  const sourceReal = await realpath(absolutePath);
  if (!isPathWithin(sourceReal, task.taskRootReal)) {
    throw new PilotDeckToolRuntimeError(
      "path_not_allowed",
      "render_local_html_to_image source resolves outside the active task.",
    );
  }
  const extension = path.extname(sourceReal).toLowerCase();
  if (extension !== ".html" && extension !== ".htm") {
    throw new PilotDeckToolRuntimeError(
      "invalid_tool_input",
      "render_local_html_to_image source must be a local HTML file.",
    );
  }
  return {
    absolutePath: sourceReal,
    relativePath: path.relative(
      task.workspaceAbsolute,
      sourceReal,
    ).split(path.sep).join("/"),
    taskPath: path.relative(
      task.taskRootReal,
      sourceReal,
    ).split(path.sep).join("/"),
  };
}

async function ensureOutputParent(
  outputAbsolute: string,
  task: SecureTaskRoot,
): Promise<string> {
  const parent = path.dirname(outputAbsolute);
  const relativeParent = path.relative(task.taskRootAbsolute, parent);
  if (
    relativeParent.startsWith("..")
    || path.isAbsolute(relativeParent)
  ) {
    throw new PilotDeckToolRuntimeError(
      "path_not_allowed",
      "render_local_html_to_image output is outside the active task.",
    );
  }
  let current = task.taskRootAbsolute;
  for (
    const segment of relativeParent.split(path.sep).filter(Boolean)
  ) {
    current = path.join(current, segment);
    try {
      await assertNotReparsePoint(current, "directory");
    } catch (error) {
      if (!isMissingPathError(error)) throw error;
      await mkdir(current);
      await assertNotReparsePoint(current, "directory");
    }
    const currentReal = await realpath(current);
    if (!isPathWithin(currentReal, task.taskRootReal)) {
      throw new PilotDeckToolRuntimeError(
        "path_not_allowed",
        "render_local_html_to_image output directory resolves outside the active task.",
      );
    }
  }
  return realpath(parent);
}

async function writePngAtomically(
  outputAbsolute: string,
  outputParentReal: string,
  buffer: Buffer,
): Promise<void> {
  const safeOutputPath = path.join(
    outputParentReal,
    path.basename(outputAbsolute),
  );
  try {
    const existing = await lstat(safeOutputPath);
    if (existing.isSymbolicLink() || !existing.isFile()) {
      throw new PilotDeckToolRuntimeError(
        "path_not_allowed",
        "render_local_html_to_image output target is not a regular file.",
      );
    }
    const existingReal = await realpath(safeOutputPath);
    if (!isPathWithin(existingReal, outputParentReal)) {
      throw new PilotDeckToolRuntimeError(
        "path_not_allowed",
        "render_local_html_to_image output target escapes its directory.",
      );
    }
  } catch (error) {
    if (!isMissingPathError(error)) throw error;
  }

  const tempPath = path.join(
    outputParentReal,
    `.${path.basename(safeOutputPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(tempPath, "wx", 0o600);
    await handle.writeFile(buffer);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(tempPath, safeOutputPath);
    const finalReal = await realpath(safeOutputPath);
    if (!isPathWithin(finalReal, outputParentReal)) {
      throw new PilotDeckToolRuntimeError(
        "path_not_allowed",
        "render_local_html_to_image output escaped its directory.",
      );
    }
  } finally {
    await handle?.close().catch(() => undefined);
    await unlink(tempPath).catch(() => undefined);
  }
}

async function inspectRenderedPng(
  buffer: Buffer,
): Promise<{ width: number; height: number }> {
  if (
    buffer.byteLength < 8
    || !buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    throw new PilotDeckToolRuntimeError(
      "tool_execution_failed",
      "render_local_html_to_image renderer did not return a PNG.",
    );
  }
  try {
    const metadata = await sharp(buffer, {
      failOn: "error",
      limitInputPixels: MAX_RENDERED_IMAGE_PIXELS,
    }).metadata();
    if (
      metadata.format !== "png"
      || !metadata.width
      || !metadata.height
      || metadata.width * metadata.height > MAX_RENDERED_IMAGE_PIXELS
    ) {
      throw new Error("invalid PNG metadata");
    }
    return { width: metadata.width, height: metadata.height };
  } catch (error) {
    throw new PilotDeckToolRuntimeError(
      "tool_execution_failed",
      `render_local_html_to_image rejected the PNG: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function boundedDimension(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function permissionRequest(): PermissionResult {
  return {
    type: "ask",
    reason: {
      type: "tool",
      toolName: "render_local_html_to_image",
      message: "Rendering local HTML requires Chromium and file access.",
    },
    request: {
      toolCallId: "",
      toolName: "render_local_html_to_image",
      inputSummary: "render local html to png",
      reason: {
        type: "tool",
        toolName: "render_local_html_to_image",
        message: "Rendering local HTML requires Chromium and file access.",
      },
      options: [
        { id: "allow_once", label: "Allow render" },
        { id: "deny", label: "Deny" },
      ],
    },
  };
}

export function createRenderLocalHtmlToImageTool(
  options: CreateRenderLocalHtmlToImageToolOptions = {},
): PilotDeckToolDefinition<
  RenderLocalHtmlToImageInput,
  RenderLocalHtmlToImageOutput
> {
  return {
    name: "render_local_html_to_image",
    aliases: ["RenderLocalHtmlToImage"],
    description:
      "Render an HTML file from the active task directory to a PNG without external network access. All resources are served through https://task.local/; requests outside that virtual origin are blocked.",
    kind: "shell",
    inputSchema: {
      type: "object",
      required: ["html_path"],
      additionalProperties: false,
      properties: {
        html_path: {
          type: "string",
          minLength: 1,
          description: "Workspace-relative HTML path inside the active task.",
        },
        output_path: {
          type: "string",
          minLength: 1,
          description: "Optional PNG output path inside the active task.",
        },
        width: {
          type: "integer",
          minimum: 320,
          maximum: 3840,
        },
        height: {
          type: "integer",
          minimum: 180,
          maximum: 2160,
        },
        full_page: { type: "boolean" },
      },
    },
    maxResultBytes: 20_000,
    isReadOnly: () => false,
    isConcurrencySafe: () => true,
    isOpenWorld: () => false,
    checkPermissions: async () => permissionRequest(),
    execute: async (input, context) => {
      const task = await resolveSecureTaskRoot(context);
      const source = await resolveSourceHtml(input.html_path, task);
      const outputRelative = String(
        input.output_path
          ?? `${task.taskRootRelative}/rendered/${
            path.basename(source.taskPath, path.extname(source.taskPath))
          }.png`,
      ).trim();
      const outputAbsolute = path.resolve(
        task.workspaceAbsolute,
        outputRelative,
      );
      if (
        path.extname(outputAbsolute).toLowerCase() !== ".png"
        || !isPathWithin(outputAbsolute, task.taskRootAbsolute)
      ) {
        throw new PilotDeckToolRuntimeError(
          "path_not_allowed",
          "render_local_html_to_image output must be a PNG inside the active task.",
        );
      }
      const outputParentReal = await ensureOutputParent(
        outputAbsolute,
        task,
      );

      const env = context.env ?? process.env;
      configurePlaywrightPool(
        Number(
          env.PILOTDECK_PLAYWRIGHT_POOL_SIZE
            ?? env.PILOTDECK_DOCUMENT_EXPORT_POOL_SIZE
            ?? 1,
        ),
      );
      const width = boundedDimension(input.width, 1280, 320, 3840);
      const height = boundedDimension(input.height, 720, 180, 2160);
      const timeoutMs = boundedDimension(
        options.timeoutMs,
        60_000,
        1_000,
        120_000,
      );
      const sourceUrl = `${
        TASK_LOCAL_ORIGIN
      }/${source.taskPath.split("/").map(encodeURIComponent).join("/")}`;
      const renderRequest: LocalHtmlRenderRequest = {
        sourceUrl,
        taskRoot: task.taskRootReal,
        width,
        height,
        fullPage: input.full_page !== false,
        timeoutMs,
        resolveRequest: (url) =>
          resolveTaskLocalRequest({
            requestUrl: url,
            taskRoot: task.taskRootReal,
          }),
        onExternalRequestBlocked: options.onExternalRequestBlocked,
      };
      const buffer = await (
        options.renderer ?? renderWithPlaywright
      )(renderRequest);
      const dimensions = await inspectRenderedPng(buffer);
      await writePngAtomically(
        outputAbsolute,
        outputParentReal,
        buffer,
      );

      const localPath = path.relative(
        task.workspaceAbsolute,
        outputAbsolute,
      ).split(path.sep).join("/");
      const data: RenderLocalHtmlToImageOutput = {
        localPath,
        width: dimensions.width,
        height: dimensions.height,
        derivedFrom: source.relativePath,
        sha256: createHash("sha256").update(buffer).digest("hex"),
      };
      return {
        content: [
          {
            type: "text",
            text: `Rendered local HTML to ${localPath}.`,
          },
          {
            type: "file",
            path: outputAbsolute,
            mimeType: "image/png",
            description: "Locally rendered HTML image",
          },
        ],
        data,
      };
    },
  };
}
