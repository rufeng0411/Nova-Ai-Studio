#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import WebSocket from "ws";

const REPO_ROOT = process.cwd();
const TOKEN_PATH = path.join(os.homedir(), ".pilotdeck", "server-token");
const GATEWAY_URL = "ws://127.0.0.1:18789/ws";
const OUT_DIR = path.join(REPO_ROOT, "artifacts", "od-smoke");

const SCENARIOS = [
  {
    id: "landing-open-design",
    output: "landing-open-design.html",
    message:
      "请使用 open-design 技能并直接执行，不要提问。为 B2B AI SaaS 生成高保真落地页 HTML，现代极简风格，包含 Hero/Features/Pricing/CTA 四段。请用 write_file 写入 artifacts/od-smoke/landing-open-design.html。",
  },
  {
    id: "login-flow",
    output: "login-flow.html",
    message:
      "请使用 od-login-flow 技能并直接执行，不要提问。设计登录注册与邮箱验证码流程页面，包含登录、注册、验证码三屏，输出单文件 HTML。请用 write_file 写入 artifacts/od-smoke/login-flow.html。",
  },
  {
    id: "release-notes",
    output: "release-notes.html",
    message:
      "请使用 od-release-notes-one-pager 技能并直接执行，不要提问。生成版本 2.3.0 的发布说明单页，包含亮点、修复、升级步骤与 CTA。请用 write_file 写入 artifacts/od-smoke/release-notes.html。",
  },
];

const STAGE_TIMEOUT_MS = Number(process.env.OD_SMOKE_TIMEOUT_MS || 300_000);

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

async function runScenario(ws, scenario, projectKey) {
  return new Promise((resolve) => {
    const newReqId = `new-${scenario.id}`;
    const runReqId = `run-${scenario.id}`;
    const metrics = {
      toolCalls: {},
      wroteFile: false,
      elicitationRequested: false,
      turnCompleted: false,
    };
    const scenarioStartedAt = Date.now();
    let settled = false;

    const computeFileStatus = () => {
      const outputPath = path.join(OUT_DIR, scenario.output);
      if (!fs.existsSync(outputPath)) {
        return { outputPath, fileExists: false, fileFresh: false };
      }
      const stat = fs.statSync(outputPath);
      // Use mtime freshness instead of requiring turn_completed; some long-stream
      // runs finish the write but delay final response beyond script timeout.
      const fileFresh = stat.mtimeMs >= scenarioStartedAt - 1000 && stat.size > 0;
      return { outputPath, fileExists: true, fileFresh };
    };

    const finalize = (payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      ws.off("message", handler);
      resolve(payload);
    };

    const timeout = setTimeout(() => {
      const { outputPath, fileExists, fileFresh } = computeFileStatus();
      const wroteOutput = metrics.wroteFile || fileFresh;
      finalize({
        scenario: scenario.id,
        ok: wroteOutput,
        responseOk: false,
        turnCompleted: false,
        fileExists,
        fileFresh,
        elicitationRequested: metrics.elicitationRequested,
        toolCalls: metrics.toolCalls,
        outputPath,
        ...(wroteOutput ? {} : { error: `timeout_after_${STAGE_TIMEOUT_MS}ms` }),
      });
    }, STAGE_TIMEOUT_MS);

    const handler = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "response" && msg.id === newReqId && msg.ok) {
        console.log(`[${scenario.id}] session created`);
        const sessionKey = msg.result.sessionKey;
        ws.send(
          req(runReqId, "submit_turn", {
            sessionKey,
            channelKey: "cli",
            projectKey,
            workspaceCwd: projectKey,
            mode: "bypassPermissions",
            maxTurns: 8,
            message: scenario.message,
          }),
        );
        return;
      }

      if (msg.type === "event" && msg.id === runReqId) {
        const e = msg.event || {};
        if (e.type === "tool_call_started") {
          console.log(`[${scenario.id}] tool_start ${e.name}`);
        }
        if (e.type === "tool_call_started") {
          const name = e.name || "unknown";
          metrics.toolCalls[name] = (metrics.toolCalls[name] || 0) + 1;
        }
        if (e.type === "tool_call_finished") {
          if ((e.toolName || "").toLowerCase().includes("write") && e.ok) {
            metrics.wroteFile = true;
            const { outputPath, fileExists, fileFresh } = computeFileStatus();
            if (fileExists && fileFresh) {
              finalize({
                scenario: scenario.id,
                ok: true,
                responseOk: true,
                turnCompleted: metrics.turnCompleted,
                fileExists,
                fileFresh,
                elicitationRequested: metrics.elicitationRequested,
                toolCalls: metrics.toolCalls,
                outputPath,
              });
              return;
            }
          }
        }
        if (e.type === "elicitation_request") {
          metrics.elicitationRequested = true;
        }
        if (e.type === "turn_completed") {
          metrics.turnCompleted = true;
        }
      }

      if (msg.type === "response" && msg.id === runReqId) {
        const { outputPath, fileExists, fileFresh } = computeFileStatus();
        finalize({
          scenario: scenario.id,
          ok: (msg.ok === true && (metrics.turnCompleted || fileFresh) && fileExists) || fileFresh,
          responseOk: msg.ok === true,
          turnCompleted: metrics.turnCompleted,
          fileExists,
          fileFresh,
          elicitationRequested: metrics.elicitationRequested,
          toolCalls: metrics.toolCalls,
          outputPath,
        });
      }
    };

    ws.on("message", handler);
    ws.send(req(newReqId, "new_session", { channelKey: "cli", projectKey }));
  });
}

async function main() {
  safeMkdir(OUT_DIR);
  const token = readToken();
  const projectKey = REPO_ROOT.replace(/\\/g, "/");
  const results = [];

  const ws = new WebSocket(GATEWAY_URL);
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });

  ws.send(
    JSON.stringify({
      type: "hello",
      protocolVersion: "1.0",
      clientName: "cli",
      clientVersion: "0.1",
      token,
    }),
  );

  await new Promise((resolve, reject) => {
    const onMsg = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "hello_ok") {
        console.log("[smoke] hello_ok");
        ws.off("message", onMsg);
        resolve();
      }
    };
    ws.on("message", onMsg);
    ws.once("error", reject);
  });

  for (const scenario of SCENARIOS) {
    console.log(`[smoke] running ${scenario.id}`);
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
    allPassed: results.every((r) => r.ok),
  };

  const reportPath = path.join(OUT_DIR, "report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (!report.allPassed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

