import test from "node:test";
import assert from "node:assert/strict";

import { RecoveryBudget } from "../../../src/saas/resilience/recoveryBudget.js";

test("RecoveryBudget enforces recoverable cap across reasons", () => {
  const budget = new RecoveryBudget(8, 3, 0);
  const reasons = [
    "model_error",
    "tool_recovery",
    "soft_fetch_recovery",
    "auto_continue",
    "ui_auto_continue",
  ] as const;

  for (let i = 0; i < 8; i += 1) {
    const consumed = budget.tryConsume(reasons[i % reasons.length]);
    assert.ok(consumed);
    assert.equal(consumed!.attempt, i + 1);
    assert.equal(consumed!.budgetRemaining, 8 - (i + 1));
  }

  assert.equal(budget.tryConsume("model_error"), null);
  assert.ok(budget.isExhausted());
});

test("RecoveryBudget hard-fail lane is separate", () => {
  const budget = new RecoveryBudget(12, 3);
  for (let i = 0; i < 3; i += 1) {
    const consumed = budget.tryConsume("tool_recovery", { tier: "hard_fail" });
    assert.ok(consumed);
    assert.equal(consumed!.tier, "hard_fail");
  }
  assert.equal(budget.tryConsume("tool_recovery", { tier: "hard_fail" }), null);
  assert.equal(budget.remaining(), 12);
});

test("RecoveryBudget reserves last slots for acceptance_repair only", () => {
  const budget = new RecoveryBudget(12, 3, 4);
  assert.equal(budget.generalRecoverableCap(), 8);

  for (let i = 0; i < 8; i += 1) {
    assert.ok(budget.tryConsume("tool_recovery"));
  }
  assert.equal(budget.tryConsume("tool_recovery"), null);
  assert.ok(budget.tryConsume("acceptance_repair"));
  assert.ok(budget.tryConsume("acceptance_repair"));
});

test("RecoveryBudget rejects invalid max", () => {
  assert.throws(() => new RecoveryBudget(0));
});
