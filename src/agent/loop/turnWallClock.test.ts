import test from "node:test";
import assert from "node:assert/strict";

import {
  createTurnWallClockState,
  isTurnWallClockExceeded,
  resolveTurnWallClockMs,
  turnWallClockRemainingMs,
} from "./turnWallClock.js";

test("resolveTurnWallClockMs honors env override", () => {
  const prev = process.env.PILOTDECK_TURN_WALL_CLOCK_MS;
  process.env.PILOTDECK_TURN_WALL_CLOCK_MS = "60000";
  try {
    assert.equal(resolveTurnWallClockMs(), 60_000);
  } finally {
    if (prev == null) delete process.env.PILOTDECK_TURN_WALL_CLOCK_MS;
    else process.env.PILOTDECK_TURN_WALL_CLOCK_MS = prev;
  }
});

test("isTurnWallClockExceeded triggers after limit", () => {
  const state = createTurnWallClockState(1_000);
  state.limitMs = 5_000;
  assert.equal(isTurnWallClockExceeded(state, 5_999), false);
  assert.equal(isTurnWallClockExceeded(state, 6_000), true);
  assert.equal(turnWallClockRemainingMs(state, 6_000), 0);
});
