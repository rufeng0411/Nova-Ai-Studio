// PD-SAAS-FORK VAP: sidecar failure circuit — skip T4/T5 after consecutive failures.

const DEFAULT_THRESHOLD = 3;

let consecutiveFailures = 0;
let openUntilMs = 0;

export function isSidecarCircuitOpen(now = Date.now()): boolean {
  return now < openUntilMs;
}

export function recordSidecarSuccess(): void {
  consecutiveFailures = 0;
  openUntilMs = 0;
}

export function recordSidecarFailure(
  threshold = DEFAULT_THRESHOLD,
  coolDownMs = 60_000,
  now = Date.now(),
): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= threshold) {
    openUntilMs = now + coolDownMs;
  }
}

export function resetSidecarCircuitForTests(): void {
  consecutiveFailures = 0;
  openUntilMs = 0;
}

export function sidecarCircuitSnapshot(): {
  consecutiveFailures: number;
  openUntilMs: number;
} {
  return { consecutiveFailures, openUntilMs };
}
