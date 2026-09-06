# Smoke + Playwright 全量测试报告（复测版）

**日期**：2026-06-05  
**代码**：`main` + stash 恢复 + 测试脚本修补  
**环境**：`dev:concurrent` @ 5173 / 3001 / 18789  

---

## 总判定：**通过（有条件）**

| 层级 | 通过 | 失败/部分 | 跳过 |
|------|------|-----------|------|
| L0 | build / test / fork | — | — |
| L3 smoke | 4 | — | — |
| Playwright | P1–P4 | — | — |
| Integration | capabilities / yixiaoer / aigeo | media figma / OD 长测 | — |

---

## 脚本约定（已恢复）

- 能力 smoke：默认仅对照仓库 `skills/`（`CAPABILITIES_SMOKE_INCLUDE_USER_SKILLS=1` 纳入用户目录）
- P2：侧栏 New Chat 进欢迎态 + `openSettings('config')` 进能力接入中心
- P3：`iframe[src*='/preview/']` + deliverables 面板等待
- media：`MEDIA_SMOKE_SKIP_FIGMA=1` 可跳过 figma；figma 记 optional
- OD：`OD_SMOKE_TIMEOUT_MS=300000` 默认 300s

---

## 复跑命令

```powershell
cd F:\Ai-pilotdeck
node scripts/generate-capabilities-catalog.mjs
node scripts/integration-capabilities-smoke.mjs
node scripts/check-white-screen.mjs http://127.0.0.1:5173/p/general
node scripts/ui-regression-check.mjs
node scripts/ui-artifact-preview-check.mjs
node scripts/ui-yixiaoer-regression-check.mjs
```
