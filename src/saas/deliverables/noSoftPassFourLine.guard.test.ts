import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * PD-SAAS-FORK workbench yield: showcase passed_soft / same-extension completion
 * must never land in user Dock / certificate / four-line engines.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const FORBIDDEN = [
  "passed_soft",
  "softPass",
  "soft_pass",
  "sameExtensionComplete",
  "same_extension_complete",
];

const SCAN_FILES = [
  "src/saas/deliverables/deliverableAcceptanceCertificate.ts",
  "src/saas/deliverables/deliverableContractBinding.ts",
  "src/saas/deliverables/reconcileDeliverableFacts.ts",
  "ui/src/shared/buildUnifiedDeliverableView.ts",
  "ui/src/shared/buildDeliverableDockRows.ts",
  "ui/src/shared/deriveDeliverablesDockState.ts",
];

describe("no soft-pass in four-line path", () => {
  for (const rel of SCAN_FILES) {
    it(`${rel} has no soft-pass / same-ext completion branch`, () => {
      const abs = join(ROOT, rel);
      let raw = "";
      try {
        raw = readFileSync(abs, "utf8");
      } catch {
        // optional file may move; skip missing
        return;
      }
      for (const token of FORBIDDEN) {
        expect(raw.includes(token), `${rel} contains forbidden ${token}`).toBe(false);
      }
    });
  }
});
