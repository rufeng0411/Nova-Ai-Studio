import fs from "node:fs/promises";
import path from "node:path";
import { createRenderHtmlVideoTool } from "../src/tool/builtin/renderHtmlVideo.js";

const ROOT = path.resolve(process.cwd());

async function main() {
  const htmlPath = path.join(ROOT, "artifacts", "media-smoke", "local-preview.html");
  const outputPath = path.join(ROOT, "artifacts", "media-smoke", "local-render.mp4");
  await fs.writeFile(
    htmlPath,
    "<!doctype html><html><body style='margin:0'><h1>Render Smoke</h1></body></html>",
    "utf8",
  );
  const tool = createRenderHtmlVideoTool();
  const context: any = {
    sessionId: "s",
    turnId: "t",
    cwd: ROOT,
    permissionMode: "bypassPermissions",
    permissionContext: { additionalWorkingDirectories: [] },
    env: process.env,
  };

  try {
    const result = await tool.execute(
      {
        html_path: htmlPath,
        output_path: outputPath,
        duration_seconds: 2,
        fps: 10,
      },
      context,
    );
    console.log(JSON.stringify({ ok: true, data: result.data }, null, 2));
  } catch (error) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
