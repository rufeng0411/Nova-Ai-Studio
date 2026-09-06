# Bridge 稳定性上线验收报告（模板）

**执行日期**：
**Git HEAD**：
**Bridge 端口**：
**执行人**：

## 执行摘要

- [ ] 具备 Bridge 稳定性上线能力

## 功能验收 T1–T8

| ID | 场景 | 结果 |
|----|------|------|
| T1 | manifest 13s 内离开校验中 | |
| T2 | 加载更早 | |
| T3 | smoke 压测 ready | |
| T4 | truncated hasMore | |
| T5 | 重启恢复 | |
| T6 | prelaunch:quick | |
| T7 | 3 表 validate ≤1 | |
| T8 | 链接→右栏 8s | |

## 容量摘要（来自 `artifacts/bridge-stability-test/`）

| 路由 | N_max | Avg ms | P50 | P95 | P99 | Error% |
|------|-------|--------|-----|-----|-----|--------|
| validate | | | | | | |
| messages | | | | | | |
| mixed | | | | | | |
| ready (wedged%) | — | | | | | |

## 命令记录

```bash
npm run test:bridge-stability:full
SERVER_URL=http://127.0.0.1:7990 npm run test:bridge-stability:smoke
```

## 签收
