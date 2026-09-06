import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveTaskLifecycleStatus,
} from "../src/saas/taskState/taskLifecycle.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const gate = args.has("--gate");
const fixtureDir = resolveFixtureDir(process.argv.slice(2));

const files = fs.readdirSync(fixtureDir)
  .filter((file) => file.endsWith(".jsonl"))
  .sort();

if (files.length === 0) {
  console.error(`No task recovery fixtures found in ${path.relative(repoRoot, fixtureDir)}`);
  process.exit(1);
}

let failed = false;
for (const file of files) {
  const fixturePath = path.join(fixtureDir, file);
  const events = readJsonl(fixturePath);
  const replay = replayFixture(events);
  const status = resolveTaskLifecycleStatus(replay.input);
  const expected = replay.expectedStatus;
  const ok = !expected || expected === status.status;

  console.log([
    ok ? "PASS" : "FAIL",
    file,
    `status=${status.status}`,
    `owner=${status.owner}`,
    `reason=${status.reason}`,
    expected ? `expected=${expected}` : "",
  ].filter(Boolean).join(" "));

  if (gate && !ok) {
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

function resolveFixtureDir(argv) {
  const explicit = argv.find((arg) => arg.startsWith("--fixtures="));
  if (explicit) {
    return path.resolve(repoRoot, explicit.slice("--fixtures=".length));
  }
  return path.join(repoRoot, "tests", "fixtures", "task-recovery");
}

function readJsonl(filePath) {
  const body = fs.readFileSync(filePath, "utf8");
  return body.split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        assertRedacted(line, filePath, index + 1);
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${filePath}:${index + 1} ${error.message}`);
      }
    });
}

function replayFixture(events) {
  const metadata = events.find((event) => event.type === "metadata") ?? {};
  const userGoal = events.find((event) => event.role === "user")?.content ?? "";
  const assistantText = events
    .filter((event) => event.role === "assistant")
    .map((event) => event.content ?? "")
    .join("\n");
  const validation = events.find((event) => event.type === "deliverable_validation") ?? {};
  const blocker = events.find((event) => event.type === "blocker");
  const elicitation = events.find((event) => event.type === "elicitation");
  const turnOutcome = events.find((event) => event.type === "turn_outcome");

  return {
    expectedStatus: metadata.expectedStatus,
    input: {
      userGoal,
      assistantText,
      completion: {
        verified: validation.verified ?? [],
        missing: validation.missing ?? [],
        broken: validation.broken ?? [],
        processOnly: validation.processOnly ?? [],
      },
      blocker: blocker ? {
        kind: blocker.kind,
        reason: blocker.reason,
      } : undefined,
      elicitation: elicitation ? {
        kind: elicitation.kind,
        hasDefaultOption: Boolean(elicitation.hasDefaultOption),
      } : undefined,
      turnOutcome: turnOutcome ? {
        aborted: Boolean(turnOutcome.aborted),
        userAborted: Boolean(turnOutcome.userAborted),
        stopReason: turnOutcome.stopReason,
      } : undefined,
    },
  };
}

function assertRedacted(line, filePath, lineNumber) {
  const forbidden = [
    /AIza[0-9A-Za-z_-]{20,}/u,
    /sk-[0-9A-Za-z_-]{20,}/u,
    /SAAS_ADMIN_PASSWORD/u,
    /password/i,
    /authorization/i,
  ];
  const matched = forbidden.find((pattern) => pattern.test(line));
  if (matched) {
    throw new Error(`fixture is not redacted (${path.basename(filePath)}:${lineNumber}, ${matched.source})`);
  }
}
