#!/usr/bin/env node
// PD-SAAS-FORK P0-5: production Chromium smoke for isolated task.local rendering.

import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createDefaultPermissionContext } from "../../src/permission/index.ts";
import { closePlaywrightPool } from "../../src/saas/document-export/playwrightPool.ts";
import { createRenderLocalHtmlToImageTool } from "../../src/tool/builtin/renderLocalHtmlToImage.ts";

const cwd = await mkdtemp(path.join(os.tmpdir(), "task-local-smoke-"));
const taskRelative = "artifacts/task-local-smoke";
const taskRoot = path.join(cwd, taskRelative);

try {
  await mkdir(taskRoot, { recursive: true });
  await writeFile(
    path.join(taskRoot, "index.html"),
    [
      "<!doctype html>",
      '<meta charset="utf-8">',
      "<style>body{margin:0;background:#eef2f7;color:#1f2937}</style>",
      "<h1>task.local</h1>",
      "<script>",
      "fetch('https://external.invalid/leak').catch(()=>undefined);",
      "window.open('https://external.invalid/popup');",
      "</script>",
    ].join(""),
    "utf8",
  );

  const blocked = [];
  const tool = createRenderLocalHtmlToImageTool({
    onExternalRequestBlocked: (url) => blocked.push(url),
    timeoutMs: 30_000,
  });
  const result = await tool.execute(
    {
      html_path: `${taskRelative}/index.html`,
      output_path: `${taskRelative}/rendered/smoke.png`,
      width: 640,
      height: 360,
      full_page: false,
    },
    {
      sessionId: "runtime-smoke",
      turnId: "runtime-smoke-turn",
      cwd,
      taskArtifactDir: taskRelative,
      taskGoalVersion: 1,
      trustedExecutionScope: {
        tenantScopeId: "runtime-smoke",
        principalScopeId: "runtime-smoke",
      },
      permissionMode: "default",
      permissionContext: createDefaultPermissionContext({ cwd }),
      env: {
        ...process.env,
        PILOTDECK_PLAYWRIGHT_POOL_SIZE: "1",
      },
    },
  );

  assert.equal(
    result.data?.localPath,
    `${taskRelative}/rendered/smoke.png`,
  );
  assert.ok(blocked.some((url) => url.startsWith("https://external.invalid/")));
  const png = await readFile(path.join(cwd, result.data.localPath));
  assert.deepEqual(
    [...png.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  );
  console.log("TASK_LOCAL_RENDER_SMOKE_OK");
} finally {
  await closePlaywrightPool();
  await rm(cwd, { recursive: true, force: true });
}
