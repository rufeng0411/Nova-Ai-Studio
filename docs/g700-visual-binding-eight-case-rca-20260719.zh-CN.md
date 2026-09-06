# G700 配图绑定八案 RCA（2026-07-19）

## 共性结论

离线 VAP 发现层 8/8 GO；Gateway 会话失败集中在 **绑定 + 纠正 + Skill** 三层，而非搜图能力本身。

## 断裂点

| 环 | 现象 |
|----|------|
| Discover | `assets/raw/` 后期常有 6–8 张官图 |
| Bind | HTML/slide 仍用 placeholder / generate_image |
| Validate | manifest 路径 merge 进 verified，未检查交付物引用 |
| Correct | 「配图不对」未触发 quality mutation / repair |

## 三问归因

- 对话逻辑 ~45%（注入覆盖、Recovery 占位、假绿 passed）
- Skill/模板 ~30%（Nova Phase D 强制 generate_image；Campaign 模板 placeholder 默认）
- 工具搜索 ~25%（双轨 ledger vs manifest，已 P0-A 归一）

## 已落地修复（本批）

- P0-A：`visual-asset-manifest` + `visual-acquisition-ladder` 注入合并；`fetch_media_asset` → manifest ingest
- P0-B：`deliverableVisualBindingAudit` + validate/certificate/repair 同源
- P0-B2：Nova Official 双模式 Skill；Campaign 模板去 generate/placeholder 默认
- P0-C：`PILOTDECK_VAP_BIND_BEFORE_WRITE` write gate
- P1-A：`detectVisualCorrectionMutation` + repair circuit 视觉 gap 重置
- P1-B/C：binding 对齐 + Official slide compose 管线

## 实机复测 KPI

| KPI | 目标 |
|-----|------|
| 交付物引用 manifest 路径 | ≥ 主视觉槽位数 |
| 用户纠正后 1 turn rewrite | ≥ 80% |
| Nova official generate_image | 0 |
| false complete（占位仍绿） | 0（enforce） |

验收：`npm run test:visual-binding:live:gate`（dev:saas + `--live`）
