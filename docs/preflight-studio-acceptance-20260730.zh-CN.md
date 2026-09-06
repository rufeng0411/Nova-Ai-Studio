# Preflight Studio 验收报告（2026-07-30）

## 环境

| 项 | 值 |
|----|-----|
| Bridge | 7990（Launcher dev:saas） |
| UI | 8081 |
| Gateway | 18789 |
| Flag | `PILOTDECK_PREFLIGHT_STUDIO=shadow` |
| 报告时间 | 2026-07-30T20:30+08 |

## 模式矩阵

| 模式 | 命令 | 结果 |
|------|------|------|
| M1 unit | `npm run test:preflight-studio:unit` | PASS（12 tests） |
| M2 flags | `npm run test:preflight-studio:flags` | PASS |
| M3 gate | `npm run test:preflight-studio:gate` | PASS |
| M4 four-line | `npm run test:preflight-studio:four-line` | PASS |
| M5 binding | `npm run test:preflight-studio:binding` | PASS |
| M6 routing | `npm run test:preflight-studio:routing` | PASS |
| M7 perf | `npm run test:preflight-studio:perf` | PASS |
| M8 catalog | `npm run test:preflight-studio:catalog` | PASS |
| M9 demo-static | `npm run test:preflight-studio:demo-static` | PASS |
| M10 compat | `npm run test:preflight-studio:compat` | PASS |
| M11 fork | `npm run check:saas-fork` | PASS（793 条） |
| M12 offline | `npm run test:preflight-studio:offline` | PASS |
| M13 live UI | `npm run test:preflight-studio:live:gate` | PASS |
| M14 e2e | `npm run test:preflight-studio:e2e` | PASS（5/5） |
| M15 adversarial | `npm run test:preflight-studio:adversarial` | PASS |
| M16 catalog:gen | `npm run preflight:catalog:gen` | PASS |
| **M17 gateway** | `npm run test:preflight-studio:gateway:live:gate` | **PASS（2/2）** |

## 三案（L3 UI + L4 Gateway）

| 案 | UI E2E | Gateway 交付 | 备注 |
|----|--------|--------------|------|
| L-OD | PASS | **L-OD-GW PASS** | `index.html` @ STDA；`turn_acceptance=passed`；ask_user=0 |
| L-PPT | PASS | **L-PPT-GW PASS** | ppt-master @ STDA；`turn_acceptance=passed`；无 Flask |
| L-MULTI | PASS | UI/单元 gate | skip 默认关栏；engine write gate 单元已绿 |
| adversarial | PASS | — | 关开 + 滤镜 |

- UI 实机：`artifacts/preflight-studio-live-20260730/report.json`
- Gateway 实机：`artifacts/preflight-studio-gateway-20260730/report.json`

## 四线 HTML 导出

| 线 | 待选样式 | 确认后 |
|----|----------|--------|
| 助手正文 | 单元 gate | Gateway JSONL 有 write + 无 ask_user |
| sticky 清单 | 单元 gate | CLI 会话 messages API 404，侧栏 HTML 导出须 **web 会话** 或重启 Bridge 后 web 回放 |
| 证书 | 单元 gate | L-OD/L-PPT-GW 回合因 `max_turns` 未落 final acceptance（文件已写入） |
| 文件夹 | Gateway 实写 | `task-20260730-*` 盘内文件与 JSONL write 一致 |

说明：Gateway harness 走 CLI session，Bridge `GET …/messages` 对 CLI 键 404，四线 HTML 分列需另开 web 会话专项或 `--skip-export` 后以 JSONL 三分取证。

## KPI（L4 回填）

| KPI | 目标 | 实数 |
|-----|------|------|
| false_incomplete | 0 | **0**（两案 `acceptanceStatus=passed`） |
| 首 turn ask_user 模板 | 0 | **0** |
| preflight_confirm_ms P50 | — | Bridge 重启后 E2E 确认 `telemetry/preflight-events.jsonl` |

## 结论

**Shadow 可进包**：L0–L4 Gateway（OD/PPT）+ UI 全套已绿。  
**Enforce GO**：重启 Bridge 使 telemetry 生效 → web 会话 HTML 导出四线分列 → 升 `enforce`。

## 新增命令

```bash
npm run test:preflight-studio:gateway:live        # Gateway 完整回放（含 HTML 导出）
npm run test:preflight-studio:gateway:live:gate     # 门禁（默认 --skip-export）
```
