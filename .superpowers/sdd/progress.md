# 鸣镝 G700 稳态加固 — 进度

**更新：2026-07-19**

| 阶段 | 状态 |
|------|------|
| P0-0 基线 + Bridge load | ✅ |
| P0-1 能力范围 | ✅ |
| P0-2 质量合同 | ✅ |
| P0-3 公网/来源安全 | ✅ |
| P0-4/5 官方素材工具链 | ✅ |
| P0-6 官方素材 FSM | ✅ |
| P0-7 终验收证书 | ✅ |
| P0-8 UI 质量状态 | ✅ |
| P0-9 内容断言 | ✅ |
| P0-10 live 门禁 | ✅ |
| P1 scope 审计 | ✅ |

## 验收命令

```powershell
npm run test:mingdi-g700:unit
npm run test:mingdi-g700:replay
npm run test:mingdi-g700:live -- --gate --tier=p0 --workers=1
npm run test:official-media:acceptance
npm run test:export-four-line-parity
npm run check:saas-fork
npm run audit:capability-scope
```

## 已知 Concerns

- Bridge load `wedgedCount` 未在本会话重跑 5 分钟 soak
- dev:saas 7 场景实机需 `MINGDI_G700_LIVE_URL` + Gateway harness
