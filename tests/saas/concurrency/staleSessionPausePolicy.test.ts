import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_STALE_SESSION_PAUSE_MS,
  shouldAutoPauseStaleCatalogRow,
  shouldBlockUiAutoContinue,
  isSessionStale,
} from "../../../src/saas/concurrency/staleSessionPausePolicy.js";

describe("staleSessionPausePolicy", () => {
  const nowMs = Date.parse("2026-06-23T12:00:00.000Z");
  const staleMs = DEFAULT_STALE_SESSION_PAUSE_MS;
  const oldActivity = nowMs - staleMs - 60_000;

  it("auto-pauses queued/running rows older than 24h", () => {
    assert.equal(
      shouldAutoPauseStaleCatalogRow(
        { executionStatus: "running", lastActivityAt: new Date(oldActivity).toISOString() },
        nowMs,
        staleMs,
      ),
      true,
    );
    assert.equal(
      shouldAutoPauseStaleCatalogRow(
        { executionStatus: "idle", lastActivityAt: new Date(oldActivity).toISOString() },
        nowMs,
        staleMs,
      ),
      false,
    );
    assert.equal(
      shouldAutoPauseStaleCatalogRow(
        { executionStatus: "paused", lastActivityAt: new Date(oldActivity).toISOString() },
        nowMs,
        staleMs,
      ),
      false,
    );
  });

  it("blocks UI auto-continue when paused or stale", () => {
    assert.equal(
      shouldBlockUiAutoContinue({
        executionStatus: "paused",
        lastActivityMs: nowMs - 60_000,
        nowMs,
        pauseMs: staleMs,
      }),
      true,
    );
    assert.equal(
      shouldBlockUiAutoContinue({
        executionStatus: "queued",
        lastActivityMs: nowMs - 60_000,
        nowMs,
        pauseMs: staleMs,
        syntheticAutoContinue: false,
      }),
      false,
    );
    assert.equal(
      shouldBlockUiAutoContinue({
        executionStatus: "queued",
        lastActivityMs: nowMs - 60_000,
        nowMs,
        pauseMs: staleMs,
        syntheticAutoContinue: true,
      }),
      true,
    );
    assert.equal(
      shouldBlockUiAutoContinue({
        executionStatus: "idle",
        lastActivityMs: oldActivity,
        nowMs,
        pauseMs: staleMs,
      }),
      true,
    );
    assert.equal(
      shouldBlockUiAutoContinue({
        executionStatus: "idle",
        lastActivityMs: nowMs - 60_000,
        nowMs,
        pauseMs: staleMs,
      }),
      false,
    );
  });

  it("detects stale sessions by last activity", () => {
    assert.equal(isSessionStale(oldActivity, nowMs, staleMs), true);
    assert.equal(isSessionStale(nowMs - 60_000, nowMs, staleMs), false);
  });
});
