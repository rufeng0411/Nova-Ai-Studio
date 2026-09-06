import { describe, expect, it } from "vitest";
import {
  ENGINE_LOG_PREFIX,
  replaceUserFacingPilotDeckBrand,
  subagentBudgetExceededUserMessage,
  USER_FACING_PRODUCT_NAME,
} from "./userFacingProductName.js";

describe("userFacingProductName", () => {
  it("uses NovaStudio as the user-facing product name", () => {
    expect(USER_FACING_PRODUCT_NAME).toBe("NovaStudio");
    expect(ENGINE_LOG_PREFIX).toBe("[NovaStudio]");
  });

  it("replaces PilotDeck branding in user-visible strings", () => {
    expect(replaceUserFacingPilotDeckBrand("[PilotDeck] hello PilotDeck"))
      .toBe("[NovaStudio] hello NovaStudio");
  });

  it("formats subagent budget exceeded copy without PilotDeck", () => {
    const msg = subagentBudgetExceededUserMessage(56280, 256000);
    expect(msg).toContain("[NovaStudio]");
    expect(msg).not.toContain("PilotDeck");
    expect(msg).toContain("56,280");
    expect(msg).toContain("256,000");
  });
});
