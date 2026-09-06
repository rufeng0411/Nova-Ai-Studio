import { describe, expect, it } from "vitest";
import {
  isAssistantWorkingFromPhase,
  isComposerDisabledForPhase,
  isSessionTaskInFlight,
  resolveSessionTaskPhase,
  shouldShowComposerStopButton,
} from "./sessionTaskLifecycle";

describe("sessionTaskLifecycle", () => {
  it("streaming is in-flight", () => {
    const phase = resolveSessionTaskPhase({ isLoading: true });
    expect(phase).toBe("turn_streaming");
    expect(isSessionTaskInFlight(phase)).toBe(true);
  });

  it("auto_continue_pending is in-flight when lifecycle UI enabled", () => {
    const phase = resolveSessionTaskPhase({
      isLoading: false,
      pendingAutoContinue: true,
    });
    expect(phase).toBe("auto_continue_pending");
    expect(isAssistantWorkingFromPhase(phase)).toBe(true);
  });

  it("needs_repair without loading is repair pending", () => {
    const phase = resolveSessionTaskPhase({
      isLoading: false,
      lastAcceptanceStatus: "needs_repair",
    });
    expect(phase).toBe("deliverable_repair_pending");
  });

  it("idle when no signals", () => {
    expect(resolveSessionTaskPhase({ isLoading: false })).toBe("idle");
  });

  it("deliverable_incomplete when dock contract unmet and turn idle", () => {
    const phase = resolveSessionTaskPhase({
      isLoading: false,
      deliverableIncomplete: true,
    });
    expect(phase).toBe("deliverable_incomplete");
    expect(isComposerDisabledForPhase(phase)).toBe(true);
    expect(isSessionTaskInFlight(phase)).toBe(true);
  });

  it("turn_queued is in-flight and disables composer", () => {
    const phase = resolveSessionTaskPhase({ executionStatus: "queued", isLoading: false });
    expect(phase).toBe("turn_queued");
    expect(isSessionTaskInFlight(phase)).toBe(true);
    expect(isComposerDisabledForPhase(phase)).toBe(true);
  });

  it("turn_queued is in-flight and disables composer", () => {
    const phase = resolveSessionTaskPhase({ executionStatus: "queued", isLoading: false });
    expect(phase).toBe("turn_queued");
    expect(isSessionTaskInFlight(phase)).toBe(true);
    expect(isComposerDisabledForPhase(phase)).toBe(true);
  });

  it("userAcknowledgedComplete forces idle even while loading", () => {
    const phase = resolveSessionTaskPhase({
      isLoading: true,
      pendingAutoContinue: true,
      lastAcceptanceStatus: "needs_repair",
      userAcknowledgedComplete: true,
    });
    expect(phase).toBe("idle");
    expect(isSessionTaskInFlight(phase)).toBe(false);
  });

  it("needs_repair stays repair pending even when sessionTerminalComplete", () => {
    const phase = resolveSessionTaskPhase({
      isLoading: false,
      lastAcceptanceStatus: "needs_repair",
      sessionTerminalComplete: true,
    });
    expect(phase).toBe("deliverable_repair_pending");
    expect(isSessionTaskInFlight(phase)).toBe(true);
  });

  it("deliverable_incomplete wins over sessionTerminalComplete when slots pending", () => {
    const phase = resolveSessionTaskPhase({
      isLoading: false,
      sessionTerminalComplete: true,
      deliverableIncomplete: true,
    });
    expect(phase).toBe("deliverable_incomplete");
    expect(isSessionTaskInFlight(phase)).toBe(true);
  });

  it("shouldShowComposerStopButton false when deliverables incomplete but turn idle", () => {
    expect(
      shouldShowComposerStopButton({
        canAbortSession: false,
        isLoading: false,
        sessionTaskPhase: "deliverable_incomplete",
        deliverablesInProgress: true,
      }),
    ).toBe(false);
  });

  it("shouldShowComposerStopButton false for stale catalog running when turn idle", () => {
    expect(
      shouldShowComposerStopButton({
        canAbortSession: false,
        isLoading: false,
        sessionTaskPhase: "idle",
        executionStatus: "running",
      }),
    ).toBe(false);
  });

  it("shouldShowComposerStopButton true for queued turn", () => {
    expect(
      shouldShowComposerStopButton({
        canAbortSession: false,
        isLoading: false,
        sessionTaskPhase: "turn_queued",
        executionStatus: "queued",
      }),
    ).toBe(true);
  });

  it("shouldShowComposerStopButton true for auto_continue even without canAbort", () => {
    expect(
      shouldShowComposerStopButton({
        canAbortSession: false,
        isLoading: false,
        sessionTaskPhase: "auto_continue_pending",
      }),
    ).toBe(true);
  });

  it("shouldShowComposerStopButton false when user acknowledged complete", () => {
    expect(
      shouldShowComposerStopButton({
        userAcknowledgedComplete: true,
        canAbortSession: true,
        isLoading: true,
        sessionTaskPhase: "turn_streaming",
      }),
    ).toBe(false);
  });

  it("paused execution status forces idle phase and hides stop button", () => {
    const phase = resolveSessionTaskPhase({
      isLoading: false,
      executionStatus: "paused",
      deliverableIncomplete: true,
    });
    expect(phase).toBe("idle");
    expect(isComposerDisabledForPhase(phase)).toBe(false);
    expect(
      shouldShowComposerStopButton({
        canAbortSession: true,
        isLoading: true,
        sessionTaskPhase: phase,
        executionStatus: "paused",
        deliverablesInProgress: true,
      }),
    ).toBe(false);
  });
});
