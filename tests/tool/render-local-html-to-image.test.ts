import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createDefaultPermissionContext } from "../../src/permission/index.js";
import {
  createRenderLocalHtmlToImageTool,
  resolveTaskLocalRequest,
  TASK_LOCAL_CSP,
  type RenderLocalHtmlToImageOutput,
} from "../../src/tool/builtin/renderLocalHtmlToImage.js";
import type { PilotDeckToolRuntimeContext } from "../../src/tool/protocol/types.js";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function renderContext(cwd: string): PilotDeckToolRuntimeContext {
  return {
    sessionId: "session-render",
    turnId: "turn-render",
    cwd,
    taskArtifactDir: "artifacts/task-render",
    taskGoalVersion: 1,
    trustedExecutionScope: {
      tenantScopeId: "tenant-render",
      principalScopeId: "user-render",
    },
    permissionMode: "default",
    permissionContext: createDefaultPermissionContext({ cwd }),
  };
}

test("task.local resolver serves only real files inside the task root with a restrictive CSP", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "task-local-route-"));
  const taskRoot = path.join(cwd, "artifacts", "task-render");
  try {
    await mkdir(taskRoot, { recursive: true });
    await writeFile(
      path.join(taskRoot, "index.html"),
      "<!doctype html><h1>Local only</h1>",
      "utf8",
    );

    const local = await resolveTaskLocalRequest({
      requestUrl: "https://task.local/index.html",
      taskRoot,
    });
    assert.equal(local.action, "fulfill");
    if (local.action === "fulfill") {
      assert.equal(local.status, 200);
      assert.equal(local.contentType, "text/html; charset=utf-8");
      assert.equal(local.headers["content-security-policy"], TASK_LOCAL_CSP);
      assert.match(local.body.toString("utf8"), /Local only/u);
    }

    assert.deepEqual(
      await resolveTaskLocalRequest({
        requestUrl: "https://tracker.example.com/pixel.gif",
        taskRoot,
      }),
      { action: "abort", reason: "external_request" },
    );
    assert.deepEqual(
      await resolveTaskLocalRequest({
        requestUrl: "https://task.local/%2e%2e%2fsecret.txt",
        taskRoot,
      }),
      { action: "abort", reason: "path_not_allowed" },
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("render_local_html_to_image rejects HTML outside the active task before invoking Chromium", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "render-path-scope-"));
  try {
    await mkdir(path.join(cwd, "artifacts", "task-render"), {
      recursive: true,
    });
    await writeFile(
      path.join(cwd, "outside.html"),
      "<!doctype html><h1>Outside</h1>",
      "utf8",
    );
    let rendererCalls = 0;
    const tool = createRenderLocalHtmlToImageTool({
      renderer: async () => {
        rendererCalls += 1;
        return PNG_1X1;
      },
    });

    await assert.rejects(
      tool.execute(
        { html_path: "outside.html" },
        renderContext(cwd),
      ),
      /active task|outside.*task/iu,
    );
    assert.equal(rendererCalls, 0);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("render_local_html_to_image rejects the workspace root as the active task", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "render-root-scope-"));
  try {
    await writeFile(
      path.join(cwd, "index.html"),
      "<!doctype html><h1>Workspace root</h1>",
      "utf8",
    );
    let rendererCalls = 0;
    const tool = createRenderLocalHtmlToImageTool({
      renderer: async () => {
        rendererCalls += 1;
        return PNG_1X1;
      },
    });

    await assert.rejects(
      tool.execute(
        { html_path: "index.html" },
        { ...renderContext(cwd), taskArtifactDir: "." },
      ),
      /active task directory/iu,
    );
    assert.equal(rendererCalls, 0);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("render_local_html_to_image rejects an output directory reparse point", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "render-output-scope-"));
  const taskRoot = path.join(cwd, "artifacts", "task-render");
  const outsideRoot = await mkdtemp(path.join(os.tmpdir(), "render-output-outside-"));
  try {
    await mkdir(taskRoot, { recursive: true });
    await writeFile(
      path.join(taskRoot, "index.html"),
      "<!doctype html><h1>Local only</h1>",
      "utf8",
    );
    await symlink(
      outsideRoot,
      path.join(taskRoot, "rendered"),
      process.platform === "win32" ? "junction" : "dir",
    );
    let rendererCalls = 0;
    const tool = createRenderLocalHtmlToImageTool({
      renderer: async () => {
        rendererCalls += 1;
        return PNG_1X1;
      },
    });

    await assert.rejects(
      tool.execute(
        {
          html_path: "artifacts/task-render/index.html",
          output_path: "artifacts/task-render/rendered/cover.png",
        },
        renderContext(cwd),
      ),
      /reparse|symbolic|outside/iu,
    );
    assert.equal(rendererCalls, 0);
  } finally {
    await rm(cwd, { recursive: true, force: true });
    await rm(outsideRoot, { recursive: true, force: true });
  }
});

test("render_local_html_to_image writes a PNG under the task root and reports derivation metadata", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "render-local-image-"));
  const taskRoot = path.join(cwd, "artifacts", "task-render");
  try {
    await mkdir(taskRoot, { recursive: true });
    await writeFile(
      path.join(taskRoot, "index.html"),
      [
        "<!doctype html>",
        '<img src="https://external.example.com/blocked.png">',
        "<h1>Offline render</h1>",
      ].join(""),
      "utf8",
    );
    const blocked: string[] = [];
    const tool = createRenderLocalHtmlToImageTool({
      onExternalRequestBlocked: (url) => blocked.push(url),
      renderer: async (request) => {
        assert.equal(
          request.sourceUrl,
          "https://task.local/index.html",
        );
        assert.equal(request.width, 1280);
        assert.equal(request.height, 720);
        const external = await request.resolveRequest(
          "https://external.example.com/blocked.png",
        );
        if (external.action === "abort") {
          request.onExternalRequestBlocked?.(
            "https://external.example.com/blocked.png",
          );
        }
        return PNG_1X1;
      },
    });

    const result = await tool.execute(
      {
        html_path: "artifacts/task-render/index.html",
        output_path: "artifacts/task-render/rendered/cover.png",
      },
      renderContext(cwd),
    );
    const data = result.data as RenderLocalHtmlToImageOutput;
    assert.deepEqual(blocked, [
      "https://external.example.com/blocked.png",
    ]);
    assert.equal(
      data.localPath,
      "artifacts/task-render/rendered/cover.png",
    );
    assert.equal(data.width, 1);
    assert.equal(data.height, 1);
    assert.equal(
      data.derivedFrom,
      "artifacts/task-render/index.html",
    );
    assert.match(data.sha256, /^[a-f0-9]{64}$/u);
    assert.deepEqual(
      await readFile(path.join(cwd, data.localPath)),
      PNG_1X1,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
