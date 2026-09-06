# 企业 MCP 首批落地计划同步（2026-08-05）

与 Cursor Plan「企业 MCP 选型调研」全 A 就绪版对齐的仓库内摘要。执行以代码与验收命令为准。

## Code GO

- L0：`npm run test:mcp-features:unit`
- L1：`npm run smoke:mcp-batch1`（及 `smoke:mcp-p1` / `capabilities:gen` / `smoke:capability-hub` / `check:saas-fork` 按发版需要）
- L2：`npm run test:mcp-features:gateway`
- 三处 env 默认 off：`pack.mjs` / `apply-cloud-perf-env.sh` / `devLauncherCore.buildSaasDevEnv`
- 默认 Hub 无本批六卡（flag off）

## Production Enable GO

单键 enforce + L2 + 建议 L3 只读样例。禁止仅 L0/L1 宣称启用。

## 回滚

见 admin-setup 文档。还原点标签：`restore-point/pre-enterprise-mcp-batch1-*`。

## L4 telemetry

事件 `mcp_feature_gate` → `.saas-dev-data/telemetry/mcp-feature-events.jsonl`。灰度后回填 blocked_off / shadow_invokes 等。
