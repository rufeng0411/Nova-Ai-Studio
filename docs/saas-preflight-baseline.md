# SaaS Phase -1 预检基线

> LAN 开发 harness 与单元/冒烟入口；Phase 0～3 已落地，本文件作总索引。

## 还原点

- 标签：`restore-point/pre-saas-2026-06-06` @ `3ca4dea`
- 说明见 [`saas-restore-point.md`](./saas-restore-point.md)

## 测试面

| 区域 | 文件 | 运行方式 |
|------|------|----------|
| WebSocket URL | `ui/src/shared/buildWebSocketUrl.ts` + `.test.ts` | vitest |
| 局域网主机名 | `ui/shared/networkHosts.test.mjs` | `node --test` |
| 开发端口同步 | `scripts/lib/devPortSync.mjs` + `.test.mjs` | `node --test` |
| 端口回退监听 | `ui/server/lib/listenWithPortFallback.js` + `.test.js` | vitest |
| 断线不发 loading | `useChatComposerState.lan.test.ts` | vitest |
| LAN E2E 预检 | `ui/e2e/preflight/lan-oss-chat.spec.ts` | Playwright（OSS `dev`） |
| 设计稿 | `artifacts/saas-design/` | `test:saas:phase0` |
| SaaS 阶段 | `ui/server/saas/`、`ui/src/saas/` | `test:saas:phase1`～`phase3` |

## npm 脚本（根目录）

| 脚本 | 用途 |
|------|------|
| `npm run test:saas:preflight` | Phase -1 vitest + node 单测 |
| `npm run test:saas:regression` | `integration-lan-dev-smoke.mjs` |
| `npm run oss-regression` | P1–P4 OSS 脚本（须 dev 已起；L5 验收内自动跑） |
| `npm run test:saas:phase0` | 设计稿检查 + Playwright |
| `npm run test:saas:phase1`～`phase3` | 各阶段单测 + 集成冒烟 |
| `npm run test:saas:all` | preflight + phase0～3 |
| `npm run test:saas:acceptance` | L5：全量单测 + fork/brand + Playwright |
| `npm run dev:saas` | SaaS 开发（`PILOTDECK_SAAS_MODE=1`） |

## 本地 LAN 开发

`npm run dev` / `npm run dev:saas` 会打印本机与局域网 URL。他机请用 `http://<本机IP>:<VITE_PORT>`。

Gateway 须为 `ws://127.0.0.1:<PILOTDECK_GATEWAY_PORT>/ws`；误用 `http://` 会导致能力中心与会话列表为空。

## 建议验收顺序

```bash
npm run test:saas:all
npm run test:ui:unit
npm run check:saas-fork
npm run brand:check
npm run test:saas:acceptance
```

QA 记录：`docs/saas-phase1-qa.md`～`phase3-qa.md`；签核：`docs/saas-acceptance-signoff.md`。
