// PD-SAAS-FORK: rate-limit outbound tools while keeping other tools parallel

import type { PilotDeckToolCall, PilotDeckToolRuntimeContext } from "../../tool/protocol/types.js";
import type { PilotDeckToolResult } from "../../tool/protocol/result.js";
import type { PilotDeckToolScheduler } from "../../tool/scheduler/ToolScheduler.js";
import type { ToolRuntime } from "../../tool/execution/ToolRuntime.js";
import type { ToolRegistry } from "../../tool/registry/ToolRegistry.js";
import { ConcurrentToolScheduler } from "../../tool/scheduler/ConcurrentToolScheduler.js";
import type { ResilienceConfig } from "../../pilot/config/resolveResilienceConfig.js";
import { getSharedOutboundGate } from "./outboundGate.js";

const OUTBOUND_TOOL_NAMES = new Set([
  "web_search",
  "web_fetch",
  "fetch_page_images",
]);

export function isOutboundToolName(name: string): boolean {
  return OUTBOUND_TOOL_NAMES.has(name.trim().toLowerCase());
}

export class SafeConcurrentScheduler implements PilotDeckToolScheduler {
  private readonly inner: PilotDeckToolScheduler;
  private readonly gate;

  constructor(
    inner: PilotDeckToolScheduler,
    maxConcurrent: number,
  ) {
    this.inner = inner;
    this.gate = getSharedOutboundGate(maxConcurrent);
  }

  async executeAll(
    calls: PilotDeckToolCall[],
    context: PilotDeckToolRuntimeContext,
  ): Promise<PilotDeckToolResult[]> {
    const hasOutbound = calls.some((call) => isOutboundToolName(call.name));
    if (!hasOutbound) {
      return this.inner.executeAll(calls, context);
    }
    return this.gate.run(() => this.inner.executeAll(calls, context));
  }
}

export function wrapSchedulerWithResilience(
  scheduler: PilotDeckToolScheduler,
  config: ResilienceConfig,
): PilotDeckToolScheduler {
  if (!config.enabled) return scheduler;
  return new SafeConcurrentScheduler(scheduler, config.outboundMaxConcurrent);
}

export function createResilienceAwareScheduler(
  runtime: ToolRuntime,
  registry: ToolRegistry,
  config: ResilienceConfig,
): PilotDeckToolScheduler {
  const base = new ConcurrentToolScheduler(runtime, registry);
  return wrapSchedulerWithResilience(base, config);
}
