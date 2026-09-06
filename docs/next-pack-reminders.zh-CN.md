# 下一次打包 — 必做提醒（发版后运维）

> **来源**：Gate-A 签收 + 上线优化路线图 **项 1、2、3**  
> **触发**：每次 `npm run pack:deploy` 产出 tar 后、上传 ECS **之前/之后** 各核对一遍  
> **状态**：**待用户下令发版时执行**（Agent 见本文件自动提醒）

---

## 打包前（本机）

- [ ] `git status` 干净或仅允许 artifacts；记录 **Git HEAD** 写入签收报告
- [ ] `npm run pack:preflight` 绿
- [ ] `npm run pack:deploy`（或 `pack:deploy:upload`）产出 tar，核对 `dist-release/` 含：
  - `upgrade.sh`、`apply-cloud-perf-env.sh`、`verify-cloud-perf.sh`、`verify-cloud-runtime.sh`
  - `DEPLOY.md` 含历史加速分阶段说明

---

## 项 1 — ECS 升级 + 容器验收（Day 0，P0）

**做什么**：把新 tar 升到服务器，确认容器与依赖正常。

```bash
# ECS 上（示例，以 DEPLOY.md 为准）
curl -fsSL "<OSS>/nova-ai-studio/upgrade.sh" -o /tmp/upgrade.sh
# 或 upgrade.sh --bundle <完整 tar URL>
sudo bash /tmp/upgrade.sh

sudo bash /opt/nova-ai-studio/verify-cloud-runtime.sh
sudo bash /opt/nova-ai-studio/verify-cloud-perf.sh
```

**通过标准**：Playwright/python-pptx/Redis/443 绿；perf 脚本无 FAIL（warn 须记录）。

**回滚**：上一版 tar + `upgrade.sh --bundle`；env flag=0 见 runbook。

---

## 项 2 — Gate-B 只读抽检 + 改 admin 密码（Day 0–1，P0）

**做什么**：

1. **改密**：ECS 首登后修改 admin 默认密码（`admin123` 仅开发）
2. **白屏**：`node scripts/check-white-screen.mjs https://www.novapage.online/p/general`
3. **长对话加载**（只读，禁止 stress/混沌）：
   ```powershell
   $env:PROD_BASE_URL='https://www.novapage.online'
   $env:DIAG_USER='...'
   $env:DIAG_PASS='...'
   npm run test:cloud:chat-load
   ```
4. 记录生产 tail120 **P50/P95 与 KB**（目标：P95 <1.5s，KB <500KB）

**通过标准**：无白屏；cloud chat-load 无 >10s 且 >1MB；HTTPS 443 正常。

**产出**：`docs/prelaunch-gate-b-YYYYMMDD.md` 或追加 gate 签收报告 Q 章。

---

## 项 3 — 云端性能配置（R2 优先，CACHE 观察后再开）

**做什么**：合并性能 env，**建议 R2 先发**（与 Gate-A 签收一致）。

**推荐顺序**：

| 阶段 | 变量 | 说明 |
|------|------|------|
| **R2（先发）** | `PILOTDECK_HISTORY_SANITIZE=1`、`PILOTDECK_HISTORY_TAIL_READ=1` | 瘦身 + 尾读 |
| **Catalog** | `SAAS_CONVERSATION_CATALOG=1`、`SAAS_CONVERSATION_CATALOG_SHADOW=1` | 侧栏读 PG |
| **R3（观察 3–7 天后再开）** | `PILOTDECK_HISTORY_MESSAGE_CACHE=1`、`CACHE_TTL_MESSAGES_SEC=120` | 须 Redis 稳定 |
| **SDM（Goal Loop Phase 3）** | `PILOTDECK_SESSION_DELIVERABLE_MANIFEST=1` | 会话交付清单；`pack.mjs` / `apply-cloud-perf-env.sh` 已默认注入；回滚设 `0` |

```bash
# 一键（会写入 R3 CACHE — 若只要 R2，先手工只 merge SANITIZE+TAIL_READ+catalog）
sudo bash /opt/nova-ai-studio/apply-cloud-perf-env.sh
sudo bash /opt/nova-ai-studio/verify-cloud-perf.sh
```

**catalog 偏低时**：`docker exec nova-ai-studio node /app/scripts/backfill-conversation-catalog.mjs`

**回滚**：`PILOTDECK_HISTORY_*=0` + `docker compose restart nova`（见 [history-messages-deploy-runbook.zh-CN.md](history-messages-deploy-runbook.zh-CN.md)）

---

## 打包签收勾选

| ☐ | 项 |
|---|-----|
| ☐ | 1 verify-runtime + verify-cloud-perf 绿 |
| ☐ | 2 Gate-B 绿 + admin 已改密 |
| ☐ | 3 apply-cloud-perf（R2 确认；R3 按需） |

**未完成 1–3 不得对外宣称「生产验收闭环」。**
