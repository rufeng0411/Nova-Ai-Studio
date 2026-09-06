#!/usr/bin/env node
/**
 * PD-SAAS-FORK: TTFT benchmark harness — drives S1–S4 via Gateway WebSocket.
 * Requires dev:saas / Gateway on 127.0.0.1. S4 defaults to 3 runs (API quota safety).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import WebSocket from "ws";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN_PATH = path.join(os.homedir(), ".pilotdeck", "server-token");
const GATEWAY_PORT = Number(process.env.PILOTDECK_GATEWAY_PORT || 18789);
const GATEWAY_URL = `ws://127.0.0.1:${GATEWAY_PORT}/ws`;
const COOLDOWN_MS = Number(process.env.TTFT_BENCH_COOLDOWN_MS || 2000);
const TURN_TIMEOUT_MS = Number(process.env.TTFT_BENCH_TURN_TIMEOUT_MS || 120_000);
const PROJECT_KEY = process.env.TTFT_BENCH_PROJECT || "general";

const SCENARIOS = [
  {
    id: "S1",
    label: "热会话短消息",
    iterations: Number(process.env.TTFT_BENCH_S1 || 10),
    newSession: false,
    message: "用一句话总结我们刚才在聊什么。",
  },
  {
    id: "S2",
    label: "新会话首条复杂指令",
    iterations: Number(process.env.TTFT_BENCH_S2 || 10),
    newSession: true,
    message:
      "请分析一份营销方案需要哪些步骤：调研、策划、创意、触达、发布与监测，各用一句话说明。",
  },
  {
    id: "S3",
    label: "带附件短任务",
    iterations: Number(process.env.TTFT_BENCH_S3 || 10),
    newSession: true,
    message: "请阅读附件要点并用三句话概括主题与目标受众。",
    attachmentHint: true,
  },
  {
    id: "S4",
    label: "PPT 类复杂任务",
    iterations: Number(process.env.TTFT_BENCH_S4 || 3),
    newSession: true,
    message:
      "根据附件内容，用 PPT 生成做一套国风简约茶韵风格演示稿，先列出 3 页大纲即可，不必全部生图。",
    attachmentHint: true,
    longTimeout: true,
  },
];

function readToken() {
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error(`Missing token: ${TOKEN_PATH} — start dev:saas first`);
  }
  return fs.readFileSync(TOKEN_PATH, "utf8").trim();
}

function req(id, method, params) {
  return JSON.stringify({ type: "request", id, method, params });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectGateway() {
  const token = readToken();
  const ws = new WebSocket(GATEWAY_URL);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Gateway handshake timeout")), 20_000);
    ws.once("open", () => {
      clearTimeout(timer);
      resolve();
    });
    ws.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Gateway hello timeout")), 15_000);
    const onMessage = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "hello_ok") {
        clearTimeout(timer);
        ws.off("message", onMessage);
        resolve(msg);
      }
    };
    ws.on("message", onMessage);
    ws.send(
      JSON.stringify({
        type: "hello",
        protocolVersion: "1.0",
        clientName: "cli",
        clientVersion: "0.1.0",
        token,
      }),
    );
  });
  return ws;
}

function newSession(ws, projectKey) {
  const id = `bench-new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("new_session timeout")), 15_000);
    const onMessage = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "response" && msg.id === id) {
        clearTimeout(timer);
        ws.off("message", onMessage);
        if (!msg.ok) reject(new Error(msg.error?.message || "new_session failed"));
        else resolve(msg.result.sessionKey);
      }
    };
    ws.on("message", onMessage);
    ws.send(req(id, "new_session", { channelKey: "cli", projectKey }));
  });
}

function submitTurn(ws, sessionKey, message, timeoutMs) {
  const id = `bench-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise((resolve) => {
    let turnCompleted = false;
    const startedAt = Date.now();
    const timer = setTimeout(() => {
      ws.off("message", onMessage);
      resolve({ ok: false, timeout: true, durationMs: Date.now() - startedAt, turnCompleted });
    }, timeoutMs);

    const onMessage = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "event" && msg.id === id && msg.event?.type === "turn_completed") {
        turnCompleted = true;
      }
      if (msg.type === "response" && msg.id === id) {
        clearTimeout(timer);
        ws.off("message", onMessage);
        resolve({
          ok: Boolean(msg.ok),
          timeout: false,
          durationMs: Date.now() - startedAt,
          turnCompleted,
        });
      }
    };
    ws.on("message", onMessage);
    ws.send(
      req(id, "submit_turn", {
        sessionKey,
        channelKey: "cli",
        projectKey: PROJECT_KEY,
        workspaceCwd: PROJECT_KEY,
        mode: "bypassPermissions",
        maxTurns: 6,
        message: `[TTFT-BENCH] ${message}`,
      }),
    );
  });
}

async function runBenchmark() {
  const ws = await connectGateway();
  const results = [];
  let sessionKey = await newSession(ws, PROJECT_KEY);

  for (const scenario of SCENARIOS) {
    console.log(`\n[ttft-benchmark] ${scenario.id} ${scenario.label} x${scenario.iterations}`);
    if (scenario.newSession) {
      sessionKey = await newSession(ws, PROJECT_KEY);
    }
    for (let i = 0; i < scenario.iterations; i += 1) {
      const timeout = scenario.longTimeout ? TURN_TIMEOUT_MS * 2 : TURN_TIMEOUT_MS;
      const run = await submitTurn(ws, sessionKey, scenario.message, timeout);
      results.push({ scenarioId: scenario.id, iteration: i + 1, ...run });
      console.log(
        `  [${scenario.id}] #${i + 1} ${run.ok ? "ok" : run.timeout ? "timeout" : "fail"} ${run.durationMs}ms`,
      );
      if (i < scenario.iterations - 1) await sleep(COOLDOWN_MS);
    }
    if (!scenario.newSession && scenario.id === "S1") {
      // keep same session for S1
    }
  }

  ws.close();
  return results;
}

async function writeReport(runResults) {
  const mod = await import(pathToFileURL(path.join(REPO_ROOT, "src/telemetry/turnTiming.ts")).href);
  const logPath =
    process.env.PILOTDECK_TTFT_LOG?.trim()
    || path.join(REPO_ROOT, ".saas-dev-data", "telemetry", "turn-timing.jsonl");
  let traces = mod.listCompletedTurnTraces();
  if (traces.length === 0) {
    traces = await mod.loadTurnTracesFromLog(logPath);
  }
  const summary = mod.summarizeStageDurations(traces);
  const firstVisible = traces.map((t) => t.firstVisibleMs).filter((v) => typeof v === "number");
  const totalMs = traces.map((t) => t.totalMs);

  const stamp = new Date().toISOString().slice(0, 10);
  const report = {
    generatedAt: new Date().toISOString(),
    gatewayUrl: GATEWAY_URL,
    logPath,
    sampleCount: traces.length,
    scenarioRuns: runResults,
    totalMs: { p50: mod.percentile(totalMs, 50), p95: mod.percentile(totalMs, 95) },
    firstVisibleMs: { p50: mod.percentile(firstVisible, 50), p95: mod.percentile(firstVisible, 95) },
    stages: summary,
    sla: {
      hotFirstVisibleP95Ms: 3000,
      hotFirstTextP95Ms: 8000,
      newSessionFirstVisibleP95Ms: 5000,
    },
  };

  const docsDir = path.join(REPO_ROOT, "docs");
  fs.mkdirSync(docsDir, { recursive: true });
  const jsonPath = path.join(docsDir, `ttft-benchmark-${stamp}.json`);
  const mdPath = path.join(docsDir, `ttft-benchmark-report-${stamp}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const md = [
    `# TTFT 跑测报告（${stamp}）`,
    "",
    `Gateway：\`${GATEWAY_URL}\``,
    `轨迹样本：**${report.sampleCount}**（${logPath}）`,
    "",
    "## 场景执行",
    "",
    "| 场景 | 次数 | 成功 | 超时 |",
    "|------|------|------|------|",
    ...SCENARIOS.map((s) => {
      const rows = runResults.filter((r) => r.scenarioId === s.id);
      const ok = rows.filter((r) => r.ok).length;
      const timeout = rows.filter((r) => r.timeout).length;
      return `| ${s.id} ${s.label} | ${rows.length} | ${ok} | ${timeout} |`;
    }),
    "",
    "## SLA 对照",
    "",
    "| 指标 | 目标 p95 | 实测 p95 | 达标 |",
    "|------|----------|----------|------|",
    `| 首可见反馈 | <${report.sla.hotFirstVisibleP95Ms}ms | ${report.firstVisibleMs.p95 ?? "—"} | ${report.firstVisibleMs.p95 != null && report.firstVisibleMs.p95 < report.sla.hotFirstVisibleP95Ms ? "是" : "待验证"} |`,
    `| turn 总时长 | — | ${report.totalMs.p95 ?? "—"} | — |`,
    "",
    "## 分阶段（ms）",
    "",
    "| 阶段 | 样本 | p50 | p95 |",
    "|------|------|-----|-----|",
    ...Object.entries(summary)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([stage, stats]) => `| ${stage} | ${stats.count} | ${stats.p50 ?? "—"} | ${stats.p95 ?? "—"} |`),
    "",
    `原始 JSON：[ttft-benchmark-${stamp}.json](./ttft-benchmark-${stamp}.json)`,
  ].join("\n");
  fs.writeFileSync(mdPath, `${md}\n`, "utf8");
  console.log(`\nWrote ${mdPath}`);
  console.log(`Wrote ${jsonPath}`);
  return { mdPath, sampleCount: traces.length };
}

async function main() {
  if (process.argv.includes("--report-only")) {
    await writeReport([]);
    return;
  }
  const runResults = await runBenchmark();
  const { sampleCount } = await writeReport(runResults);
  if (sampleCount === 0) {
    console.warn("No turn-timing traces captured — ensure Gateway records TTFT during runs.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
