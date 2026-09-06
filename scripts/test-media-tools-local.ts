import fs from "node:fs/promises";
import path from "node:path";
import { createGenerateImageTool } from "../src/tool/builtin/generateImage.js";
import { createGenerateVideoTool } from "../src/tool/builtin/generateVideo.js";

const ROOT = path.resolve(process.cwd());
const OUT_DIR = path.join(ROOT, "artifacts", "media-smoke");

const context: any = {
  sessionId: "s",
  turnId: "t",
  cwd: ROOT,
  permissionMode: "bypassPermissions",
  permissionContext: { additionalWorkingDirectories: [] },
  env: process.env,
};

function makeFetchMock(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  return async (url: string | URL, init?: RequestInit) => handler(String(url), init);
}

async function testGenerateImage() {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y2YJ8QAAAAASUVORK5CYII=",
    "base64",
  );
  const tool = createGenerateImageTool({
    provider: "openai-compatible",
    apiKey: "sk-test",
    baseUrl: "https://mock.local/v1",
    model: "gpt-image-1",
    fetchImpl: makeFetchMock((url) => {
      if (url.includes("/images/generations")) {
        return new Response(
          JSON.stringify({
            data: [{ b64_json: png.toString("base64") }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    }) as any,
  });

  const result = await tool.execute(
    { prompt: "smoke image", output_path: "artifacts/media-smoke/local-image.png" },
    context,
  );
  const filePath = path.join(ROOT, "artifacts", "media-smoke", "local-image.png");
  const stat = await fs.stat(filePath);
  return {
    ok: stat.size > 0 && !result.metadata?.error,
    filePath,
    size: stat.size,
  };
}

async function testGenerateVideo() {
  const fakeMp4 = Buffer.from("00000018667479706d703432000000006d7034326d703431", "hex");
  const tool = createGenerateVideoTool({
    provider: "openai-compatible",
    apiKey: "sk-test",
    baseUrl: "https://mock.local/v1",
    model: "sora",
    fetchImpl: makeFetchMock((url) => {
      if (url.includes("/videos/generations")) {
        return new Response(
          JSON.stringify({
            data: [{ b64_json: fakeMp4.toString("base64") }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    }) as any,
  });

  const result = await tool.execute(
    { prompt: "smoke video", output_path: "artifacts/media-smoke/local-video.mp4" },
    context,
  );
  const filePath = path.join(ROOT, "artifacts", "media-smoke", "local-video.mp4");
  const stat = await fs.stat(filePath);
  return {
    ok: stat.size > 0 && !result.metadata?.error,
    filePath,
    size: stat.size,
  };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const image = await testGenerateImage();
  const video = await testGenerateVideo();
  const report = {
    timestamp: new Date().toISOString(),
    image,
    video,
    passed: image.ok && video.ok,
  };
  const reportPath = path.join(OUT_DIR, "local-media-tools-report.json");
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
