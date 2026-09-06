#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import WebSocket from "ws";

const REPO_ROOT = process.cwd();
const TOKEN_PATH = path.join(os.homedir(), ".pilotdeck", "server-token");
const GATEWAY_URL = "ws://127.0.0.1:18789/ws";
const OUT_DIR = path.join(REPO_ROOT, "artifacts", "media-smoke");
const TIMEOUT_MS = Number(process.env.MEDIA_SMOKE_TIMEOUT_MS || 240_000);
const SKIP_FIGMA = process.env.MEDIA_SMOKE_SKIP_FIGMA === "1";
const HANDSHAKE_TIMEOUT_MS = 20_000;

const SCENARIOS = [
  {
    id: "generate-image",
    output: "smoke-image.png",
    prompt:
      "直接执行：调用 generate_image 生成一张深色科技风 PNG 图片，写入 artifacts/media-smoke/smoke-image.png。",
    expectedTool: "generate_image",
  },
  {
    id: "generate-video",
    output: "smoke-video.mp4",
    prompt:
      "直接执行：调用 generate_video 生成一段 5 秒 MP4，写入 artifacts/media-smoke/smoke-video.mp4。",
    expectedTool: "generate_video",
  },
  {
    id: "render-html-video",
    output: "smoke-html-video.mp4",
    prompt:
      "直接执行：调用 render_html_video，把 artifacts/media-smoke/demo.html 渲染为 mp4，输出到 artifacts/media-smoke/smoke-html-video.mp4。",
    expectedTool: "render_html_video",
  },
  {
    id: "figma-tools",
    output: null,
    optional: true,
    prompt:
      "直接执行：列出可用工具里以 mcp__figma__ 开头的工具，并尝试调用一个只读 figma 工具（如果可用）。",
    expectedToolPrefix: "mcp__figma__",
  },
];

const ACTIVE_SCENARIOS = SCENARIOS.filter((scenario) => !(SKIP_FIGMA && scenario.id === "figma-tools"));

function safeMkdir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readToken() {
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error(`Missing token file: ${TOKEN_PATH}`);
  }
  return fs.readFileSync(TOKEN_PATH, "utf8").trim();
}

function req(id, method, params) {
  return JSON.stringify({ type: "request", id, method, params });
}

function ensureDemoHtml() {
  const file = path.join(OUT_DIR, "demo.html");
  fs.writeFileSync(
    file,
    [
      "<!doctype html>",
      "<html><head><meta charset='utf-8'><title>Media Smoke</title></head>",
      "<body style='margin:0;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;'>",
      "<div id='text' style='font-size:48px;font-weight:700;transition:transform 300ms ease;'>PilotDeck Media Smoke</div>",
      "<script>let t=0;setInterval(()=>{t+=1;const el=document.getElementById('text');el.style.transform=`scale(${1+0.05*Math.sin(t/4)})`;},80);</script>",
      "</body></html>",
    ].join(""),
    "utf8",
  );
}

async function runScenario(ws, scenario, projectKey) {
  return new Promise((resolve) => {
    const newReqId = `new-${scenario.id}`;
    const runReqId = `run-${scenario.id}`;
    const outputPath = scenario.output ? path.join(OUT_DIR, scenario.output) : "";
    const metrics = { toolCalls: {}, turnCompleted: false };
    const startedAt = Date.now();
    let settled = false;

    const finalize = (payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.off("message", onMessage);
      resolve(payload);
    };

    const timer = setTimeout(() => {
      const outputOk = scenario.output
        ? fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0 && fs.statSync(outputPath).mtimeMs >= startedAt - 1000
        : false;
      const toolNames = Object.keys(metrics.toolCalls);
      const expectedToolHit = scenario.expectedTool
        ? toolNames.includes(scenario.expectedTool)
        : scenario.expectedToolPrefix
          ? toolNames.some((name) => name.startsWith(scenario.expectedToolPrefix))
          : true;
      const ok = scenario.optional
        ? !expectedToolHit
        : expectedToolHit && (scenario.output ? outputOk : expectedToolHit);
      finalize({
        scenario: scenario.id,
        ok,
        skipped: scenario.optional && !expectedToolHit,
        timeout: true,
        expectedToolHit,
        outputPath: scenario.output ? outputPath : undefined,
        outputOk,
        toolCalls: metrics.toolCalls,
      });
    }, TIMEOUT_MS);

    const onMessage = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "response" && msg.id === newReqId && msg.ok) {
        process.stdout.write(`[media-smoke] session created: ${scenario.id}\n`);
        ws.send(
          req(runReqId, "submit_turn", {
            sessionKey: msg.result.sessionKey,
            channelKey: "cli",
            projectKey,
            workspaceCwd: projectKey,
            mode: "bypassPermissions",
            maxTurns: 8,
            message: scenario.prompt,
          }),
        );
        return;
      }
      if (msg.type === "event" && msg.id === runReqId) {
        const event = msg.event || {};
        if (event.type === "tool_call_started") {
          const name = event.name || "unknown";
          metrics.toolCalls[name] = (metrics.toolCalls[name] || 0) + 1;
          process.stdout.write(`[media-smoke] ${scenario.id} tool_start ${name}\n`);
        }
        if (event.type === "turn_completed") {
          metrics.turnCompleted = true;
        }
      }
      if (msg.type === "response" && msg.id === runReqId) {
        const outputOk = scenario.output
          ? fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0
          : false;
        const toolNames = Object.keys(metrics.toolCalls);
        const expectedToolHit = scenario.expectedTool
          ? toolNames.includes(scenario.expectedTool)
          : scenario.expectedToolPrefix
            ? toolNames.some((name) => name.startsWith(scenario.expectedToolPrefix))
            : true;
        const requiredOk =
          Boolean(msg.ok) && metrics.turnCompleted && expectedToolHit && (scenario.output ? outputOk : true);
        const ok = scenario.optional
          ? requiredOk || !expectedToolHit
          : requiredOk || (expectedToolHit && outputOk);
        finalize({
          scenario: scenario.id,
          ok,
          skipped: scenario.optional && !expectedToolHit,
          responseOk: Boolean(msg.ok),
          turnCompleted: metrics.turnCompleted,
          expectedToolHit,
          outputPath: scenario.output ? outputPath : undefined,
          outputOk,
          toolCalls: metrics.toolCalls,
        });
      }
    };

    ws.on("message", onMessage);
    ws.send(req(newReqId, "new_session", { channelKey: "cli", projectKey }));
  });
}

async function main() {
  safeMkdir(OUT_DIR);
  ensureDemoHtml();
  const token = readToken();
  const projectKey = REPO_ROOT.replace(/\\/g, "/");
  const ws = new WebSocket(GATEWAY_URL);

  await withTimeout(
    new Promise((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    }),
    HANDSHAKE_TIMEOUT_MS,
    `WebSocket open timeout after ${HANDSHAKE_TIMEOUT_MS}ms`,
  );

  ws.send(
    JSON.stringify({
      type: "hello",
      protocolVersion: "1.0",
      clientName: "cli",
      clientVersion: "0.1",
      token,
    }),
  );
  await withTimeout(
    new Promise((resolve, reject) => {
      const onMessage = (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "hello_ok") {
          ws.off("message", onMessage);
          process.stdout.write("[media-smoke] hello_ok\n");
          resolve();
        }
      };
      ws.on("message", onMessage);
      ws.once("error", reject);
    }),
    HANDSHAKE_TIMEOUT_MS,
    `Handshake hello_ok timeout after ${HANDSHAKE_TIMEOUT_MS}ms`,
  );

  const results = [];
  for (const scenario of ACTIVE_SCENARIOS) {
    // eslint-disable-next-line no-await-in-loop
    const result = await runScenario(ws, scenario, projectKey);
    results.push(result);
  }
  ws.close();

  const report = {
    timestamp: new Date().toISOString(),
    gatewayUrl: GATEWAY_URL,
    projectKey,
    results,
    skippedFigma: SKIP_FIGMA,
    allPassed: results.every((item) => item.ok),
  };

  const reportPath = path.join(OUT_DIR, "report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.allPassed) process.exitCode = 1;
}

function withTimeout(promise, timeoutMs, errorMessage) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
