# ROG Phase 8-2 验收报告（0707-2 小罐茶批次）

日期：2026-07-07  
权威计划：`0707-2长任务引擎与交付可见性-终版.plan.md`

## 1. 范围

- **引擎**：Gateway 视频 env 统一、视频路由、首回合续跑、模板 execution、Campaign SDM re-anchor
- **UI**：Composer 双入口、RightWorkspaceRail（交付|预览）、DeliverableSessionDock、移动 sheet、质量弱提示

## 2. 静态门禁（已跑）

| 命令 | 结果 |
|------|------|
| `npm run test:rog-phase8-2:unit` | **通过**（74 单测 + smoke:video:happyhorse） |
| `npm run test:rog-phase8-2:integration --gate` | **通过** |
| `npm run test:rog-phase8-2:error-matrix --gate` | **通过**（基线 9 行；exports HTML 待补） |
| `npm run test:deliverable-dock:acceptance --gate` | **通过** |
| `npm run test:rog-phase8-2:acceptance --gate` | **通过**（含 Phase 6/7/8 回归） |
| `npm run check:saas-fork` | **通过**（462 条） |

## 3. L4 实机三线（需 `--live` + DashScope Key）

| ID | 场景 | 通过标准 | 状态 |
|----|------|----------|------|
| T0707-2-P0-01 | Campaign 全案 | repair≤5；md/docx≥7；Dock 8 行收敛 | 待 `npm run test:rog-phase8-2:live-p0 --live` |
| T0707-2-P0-02 | 10s 广告视频 | 首轮 generate_video；真 mp4 | 待实机 |
| T0707-2-P0-03 | Battlecard 三步 | 3 md；≤3 轮；首回合 0 用户「继续」 | 待实机 |

## 4. 0707-2 基线 vs 目标 KPI

| 指标 | 基线（9 会话） | 目标 |
|------|----------------|------|
| needs_repair 末态 | 7+/9 含 63 repair 风暴 | ≤2/9 |
| 视频真 mp4 | 0/2 | 2/2 |
| 首回合用户「继续/？？」 | 多例 | ≤1/9 |
| 交付可见性 | 成果 buried | Composer+Dock 实时 |

基线数据：`artifacts/0707-2小罐茶批次/logs/kpi-baseline-0707-2.jsonl`

## 5. 已知缺口

- HTML 导出需用户拖入 `artifacts/0707-2小罐茶批次/exports/` 后 error-matrix RC 项才带 export 证据
- `npm run test:rog-phase8-2:acceptance --gate --live` 须 dev:saas + 模型 Key 跑 L4 三线 KPI
- Git tag `restore-point/pre-rog-phase8-0707-2` 建议在归档 HTML 就绪后打

## 6. 还原点

- 文档：`docs/rog-phase8-2-restore-point.md`
- Tag：`restore-point/pre-rog-phase8-0707-2`（可选）
