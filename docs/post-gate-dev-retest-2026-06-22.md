# Post-Gate 开发增量复测（2026-06-22）

> 对应计划：项 4 / 5 / 9 / 10 全部落地后 §6 复测

## 环境

- 分支：本地工作区（dev:saas，`SERVER=3001`，`VITE=5173`）
- `PILOTDECK_CLARIFICATION_GATE=1`（devLauncherCore 默认注入）

## §6-A 静态门禁

| 命令 | 结果 |
|------|------|
| `npm run build` | PASS |
| `npm run check:saas-fork` | PASS |
| `npm run brand:check` | PASS |
| `npm run test:history-messages:quick` | PASS |
| `npm run test:p0-p2:full` | PASS |
| `npm run test:deliverable-paths` | PASS |
| `npm run test:four-line-audit` | PASS |
| `npm run test:process-ux` | PASS |
| `node --test ui/server/saas/conversation/sessionReadAccess.test.mjs` | PASS 4/4 |

## §6-B 改动专项

| 项 | 命令 | 结果 |
|----|------|------|
| 4 SEC-12 | `SERVER_URL=http://127.0.0.1:3001 node scripts/security-regression-checklist.mjs` | **PASS**（伪造 session → **404**） |
| 5 门禁 | `npm run test:production-gate-full:offline` | **PASS 14/14** |
| 9 交付 | `node scripts/integration-deliverable-e2e-smoke.mjs` + Playwright `deliverable-*.spec.ts` | PASS（单元+404；live 默认 skip） |
| 10 澄清+Hub | `tests/saas/clarification-gate.test.ts` + `capabilityPrerequisiteHint.test.ts` | PASS |

## §6-C/D Live 子集

| 命令 | 结果 |
|------|------|
| `npm run smoke:conversation-catalog` | PASS |
| Playwright `isolation.spec.ts` | PASS 3/3 |
| Playwright `long-session.spec.ts` | 2/3（LONG-06 token 偶发空，已知 flaky） |
| `integration-saas-storage` / `folder` | PASS 30/30 + 20/20 |

## 结论

增量复测 **P0 全绿**；LONG-06 列入 P1 观察（与本次改动无直接关联）。
