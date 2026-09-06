# N2 Bot 验收 20260820

- gitHead: `2cb0ef88d1d9376a01efef2fca7181e8651d1fa1`
- 命令：`npm run test:n2-bot:acceptance`（`--lean` = L0+L1+L3）
- L0 pass / L1 pass / L2 skipped / L3 pass
- leanPass: **true**
- L3 Playwright：13 passed（HUD / 工作台隔离 / 手机工具页）
- L2 live 本轮未跑（`--lean` 跳过；无「多任务实机监控通过」结论）
- 不宣称生产 GO。pack / apply-cloud / devLauncher 默认 `PILOTDECK_N2_BOT=off`。

证据目录：`artifacts/n2-bot-acceptance-20260820/`（含 `summary.json` 与各阶 log）。
