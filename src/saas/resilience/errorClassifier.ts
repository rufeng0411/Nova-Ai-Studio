// PD-SAAS-FORK: classify errors for fast-fail vs retry

import {
  isProviderArrearageMessage,
} from "../../agent/errors/userFacingErrors.js";
import {
  isTransientNetworkError,
  isTransientNetworkErrorFromUnknown,
} from "../../tool/networkErrors.js";

export type ErrorClassification =
  | "transient"
  | "gateway_unreachable"
  | "model_auth"
  | "model_billing"
  | "rate_limit"
  | "config"
  | "user_abort"
  | "unknown";

export type ClassifiedError = {
  classification: ErrorClassification;
  recoverable: boolean;
  hintKey: "network" | "model" | "gateway" | "rate_limit" | "config" | "unknown";
};

const GATEWAY_PATTERN =
  /(?:gateway|websocket|ws:\/\/|invalid.*url|econnrefused.*18789|econnrefused.*18801)/i;
const AUTH_PATTERN = /(?:401|403|unauthorized|api key|invalid.*key|authentication)/i;
const RATE_LIMIT_PATTERN = /(?:429|rate limit|too many requests)/i;
const ABORT_PATTERN = /(?:aborted|abort|cancelled|canceled)/i;

export function classifyErrorMessage(message: string, code?: string): ClassifiedError {
  const text = String(message ?? "");
  const lower = text.toLowerCase();

  if (ABORT_PATTERN.test(lower) || code === "tool_aborted") {
    return { classification: "user_abort", recoverable: false, hintKey: "unknown" };
  }
  if (GATEWAY_PATTERN.test(text) || code === "gateway_unreachable") {
    return { classification: "gateway_unreachable", recoverable: false, hintKey: "gateway" };
  }
  if (AUTH_PATTERN.test(text) || code === "model_auth") {
    return { classification: "model_auth", recoverable: false, hintKey: "model" };
  }
  if (isProviderArrearageMessage(text)) {
    return { classification: "model_billing", recoverable: false, hintKey: "model" };
  }
  if (RATE_LIMIT_PATTERN.test(text)) {
    return { classification: "rate_limit", recoverable: true, hintKey: "rate_limit" };
  }
  if (isTransientNetworkError(text)) {
    return { classification: "transient", recoverable: true, hintKey: "network" };
  }
  return { classification: "unknown", recoverable: true, hintKey: "unknown" };
}

export function classifyErrorUnknown(error: unknown, code?: string): ClassifiedError {
  if (error instanceof Error) {
    return classifyErrorMessage(error.message, code);
  }
  if (isTransientNetworkErrorFromUnknown(error)) {
    return { classification: "transient", recoverable: true, hintKey: "network" };
  }
  return classifyErrorMessage(String(error), code);
}

export function shouldFastFailClassification(classification: ErrorClassification): boolean {
  switch (classification) {
    case "gateway_unreachable":
    case "model_auth":
    case "model_billing":
    case "config":
    case "user_abort":
      return true;
    case "transient":
    case "rate_limit":
    case "unknown":
      return false;
    default: {
      const _exhaustive: never = classification;
      return _exhaustive;
    }
  }
}
