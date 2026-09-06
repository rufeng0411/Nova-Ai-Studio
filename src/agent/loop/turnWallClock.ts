// PD-SAAS-FORK: Goal Loop P2 Step-H5 — per-turn wall-clock budget.

const DEFAULT_DEV_WALL_CLOCK_MS = 45 * 60 * 1000;
const DEFAULT_PROD_WALL_CLOCK_MS = 30 * 60 * 1000;

export type TurnWallClockState = {
  startedAtMs: number;
  limitMs: number;
};

export function resolveTurnWallClockMs(): number {
  const raw = process.env.PILOTDECK_TURN_WALL_CLOCK_MS;
  if (raw != null && raw.trim() !== "") {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const isProd = process.env.NODE_ENV === "production";
  return isProd ? DEFAULT_PROD_WALL_CLOCK_MS : DEFAULT_DEV_WALL_CLOCK_MS;
}

export function createTurnWallClockState(nowMs = Date.now()): TurnWallClockState {
  return {
    startedAtMs: nowMs,
    limitMs: resolveTurnWallClockMs(),
  };
}

export function isTurnWallClockExceeded(state: TurnWallClockState, nowMs = Date.now()): boolean {
  return nowMs - state.startedAtMs >= state.limitMs;
}

export function turnWallClockRemainingMs(state: TurnWallClockState, nowMs = Date.now()): number {
  return Math.max(0, state.limitMs - (nowMs - state.startedAtMs));
}
