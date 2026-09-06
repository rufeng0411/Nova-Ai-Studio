// PD-SAAS-FORK: VAP-dedicated outbound concurrency gate and feature flags.

import { OutboundGate } from "../../resilience/outboundGate.js";

let vapOutboundGate: OutboundGate | null = null;

export function resolveVapOutboundMax(): number {
  const raw = process.env.PILOTDECK_VAP_OUTBOUND_MAX?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  const value = Number.isFinite(parsed) ? parsed : 4;
  return Math.max(1, Math.min(8, value));
}

export function getVapOutboundGate(): OutboundGate {
  const max = resolveVapOutboundMax();
  if (!vapOutboundGate || vapOutboundGate.stats.max !== max) {
    vapOutboundGate = new OutboundGate(max);
  }
  return vapOutboundGate;
}

export function resetVapOutboundGateForTests(): void {
  vapOutboundGate = null;
}

function isEnvEnabled(name: string, defaultEnabled = true): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return defaultEnabled;
  return raw !== "0" && raw !== "false";
}

export function isVapOfficialFirstEnabled(): boolean {
  return isEnvEnabled("PILOTDECK_VAP_OFFICIAL_FIRST");
}

export function isVapDiscoverParallelEnabled(): boolean {
  return isEnvEnabled("PILOTDECK_VAP_DISCOVER_PARALLEL");
}

export function isVapDirectImageUrlEnabled(): boolean {
  return isEnvEnabled("PILOTDECK_VAP_DIRECT_IMAGE_URL");
}

export function coerceMinWidth(value: unknown, fallback = 400): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
}
