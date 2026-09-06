// PD-SAAS-FORK (/goal Feature 1, flag-gated, OBSERVE-ONLY): LLM second-pass verification reviewer.
//
// Borrowed from the Codex /goal loop: after acceptance ALREADY SAYS PASSED for a deliverable task,
// run ONE short, independent model call to sanity-check the delivered result against the original
// goal (and any explicit completion assertions). This module is pure orchestration + parsing — the
// model call itself is INJECTED (`callModel`) so it is fully unit-testable with a fake model.
//
// CRITICAL SAFETY INVARIANT — fail-open: any error, timeout, empty reply, or parse failure resolves
// to `verdict: "pass"`. The reviewer must NEVER block or delay a task that already passed acceptance.
// In observe-only mode the caller records the verdict as telemetry and takes no corrective action.

export type VerificationVerdict = "pass" | "needs_repair";

export type VerificationReviewOutcome =
  | "model_pass"
  | "model_needs_repair"
  | "fail_open_empty"
  | "fail_open_timeout"
  | "fail_open_error"
  | "fail_open_parse";

export type VerificationReviewResult = {
  verdict: VerificationVerdict;
  reasons: string[];
  /** How the verdict was reached — telemetry sub-classification (no file paths). */
  outcome: VerificationReviewOutcome;
};

/** Injected one-shot model call: receives the directive, returns the accumulated reply text. */
export type VerificationReviewerCallModel = (
  directive: string,
  signal?: AbortSignal,
) => Promise<string>;

export type RunVerificationReviewInput = {
  directive: string;
  callModel: VerificationReviewerCallModel;
  /** Soft deadline for the model call; on overrun the reviewer fails open to "pass". */
  timeoutMs?: number;
  signal?: AbortSignal;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_REASONS = 8;
const MAX_REASON_LEN = 280;

const PASS_MARKERS = ["校验通过", "verification passed", "all checks passed", "校验已通过", "全部满足"];
const FAIL_MARKERS = [
  "needs_repair",
  "needs repair",
  "不通过",
  "未通过",
  "不满足",
  "不符合",
  "不符",
  "缺失",
  "缺少",
  "missing",
  "incomplete",
  "placeholder",
  "占位",
];

function passResult(outcome: VerificationReviewOutcome): VerificationReviewResult {
  return { verdict: "pass", reasons: [], outcome };
}

function extractReasons(text: string): string[] {
  const reasons: string[] = [];
  const seen = new Set<string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/^[\s>*\-•\d.、)）(（]+/, "").trim();
    if (!line) continue;
    if (PASS_MARKERS.some((marker) => line.includes(marker))) continue;
    const clipped = line.slice(0, MAX_REASON_LEN);
    if (seen.has(clipped)) continue;
    seen.add(clipped);
    reasons.push(clipped);
    if (reasons.length >= MAX_REASONS) break;
  }
  return reasons;
}

function tryParseJsonVerdict(text: string): VerificationReviewResult | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  const rawVerdict = typeof record.verdict === "string" ? record.verdict.trim().toLowerCase() : "";
  if (rawVerdict !== "pass" && rawVerdict !== "needs_repair") return null;
  const reasons = Array.isArray(record.reasons)
    ? record.reasons
        .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        .map((entry) => entry.trim().slice(0, MAX_REASON_LEN))
        .slice(0, MAX_REASONS)
    : [];
  return rawVerdict === "pass"
    ? { verdict: "pass", reasons: [], outcome: "model_pass" }
    : { verdict: "needs_repair", reasons, outcome: "model_needs_repair" };
}

/**
 * Strict-but-forgiving parse of a verifier reply. JSON `{ verdict, reasons }` is honored first; else
 * a keyword heuristic over the agreed protocol ("校验通过" on success, otherwise listed problems).
 * Ambiguous replies bias to "pass" (observe-only, fail-open) so a chatty model never blocks delivery.
 */
export function parseVerificationReply(reply: string): VerificationReviewResult {
  const text = String(reply ?? "").trim();
  if (!text) return passResult("fail_open_empty");

  const json = tryParseJsonVerdict(text);
  if (json) return json;

  const hasPass = PASS_MARKERS.some((marker) => text.includes(marker))
    || /\b(passed|all checks pass)\b/i.test(text);
  const hasFail = FAIL_MARKERS.some((marker) => text.toLowerCase().includes(marker.toLowerCase()));

  if (hasFail && !hasPass) {
    const reasons = extractReasons(text);
    return { verdict: "needs_repair", reasons, outcome: "model_needs_repair" };
  }
  return { verdict: "pass", reasons: [], outcome: hasPass ? "model_pass" : "fail_open_parse" };
}

const TIMEOUT = Symbol("verification-review-timeout");

async function raceWithTimeout(
  promise: Promise<string>,
  timeoutMs: number,
): Promise<string | typeof TIMEOUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMEOUT>((resolveTimeout) => {
    timer = setTimeout(() => resolveTimeout(TIMEOUT), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Run the observe-only verification review. Always resolves (never throws); fail-open to "pass" on
 * any error/timeout/empty/parse failure so a delivered task is never blocked by the reviewer.
 */
export async function runVerificationReview(
  input: RunVerificationReviewInput,
): Promise<VerificationReviewResult> {
  const directive = String(input.directive ?? "").trim();
  if (!directive) return passResult("fail_open_empty");
  const timeoutMs = Math.max(MIN_TIMEOUT_MS, input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const replyOrTimeout = await raceWithTimeout(
      Promise.resolve(input.callModel(directive, input.signal)),
      timeoutMs,
    );
    if (replyOrTimeout === TIMEOUT) return passResult("fail_open_timeout");
    return parseVerificationReply(typeof replyOrTimeout === "string" ? replyOrTimeout : "");
  } catch {
    return passResult("fail_open_error");
  }
}
