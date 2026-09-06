# Open Design 部分集成 Batch B+C（2026-08-03）

## SOP（Skills Nova-fit）

1. **精选入库**，禁止整包 Hub 化  
2. **STDA**：`artifacts/task-*`，禁止 `artifacts/design/`  
3. **中文名**：`scripts/lib/capabilityZhAuto.mjs` → `npm run capabilities:gen`  
4. **清单**：`references/checklist.md` + `read_skill relativePath`（`smoke:od-skills`）  
5. **try-prompt**：须交付 basename +「写入系统分配任务目录」  
6. **taxonomy**：创作 Tab / 双入口；内部技能 `hidden_in_hub`  
7. **许可**：Apache-2.0，更新 `ATTRIBUTION.md`  
8. **可回滚**：删 `skills/od-*` + 还原 gen；模板侧 `PILOTDECK_OD_TEMPLATE_REGISTRY=off`

## 轨 B（15）

| Nova | 中文名 | Hub |
|------|--------|-----|
| od-waitlist-page | 候补名单页 | 可见 |
| od-web-prototype | 网页原型页 | 可见 |
| od-team-okrs | 团队 OKR 页 | 可见 |
| od-kanban-board | 看板任务板 | 可见 |
| od-meeting-notes | 会议纪要页 | 可见 |
| od-docs-page | 文档站点页 | 可见 |
| od-blog-post | 博客文章页 | 可见 |
| od-finance-report | 财务报告页 | 可见 |
| od-hr-onboarding | 入职引导页 | 可见 |
| od-pm-spec | 产品规格页 | 可见 |
| od-gamified-app | 游戏化应用页 | 可见 |
| od-deck-swiss | 瑞士国际主义 Deck | 可见 |
| od-social-x-card | X 分享卡片 | 可见 |
| od-creative-director | 创意总监审稿 | 隐藏 |
| od-wireframe-mobile-flow | 手机流程线框 | 隐藏 |

## 轨 C

- `config/open-design-template-registry.json`（`hubVisible: false`）
- Flag：`PILOTDECK_OD_TEMPLATE_REGISTRY`（pack / apply-cloud-perf-env / devLauncher 默认 **shadow**）
- 文档：`docs/open-design-template-registry.zh-CN.md`

## 验收命令

```bash
npm run port:od-batch-b
npm run od:template-registry:gen
npm run capabilities:gen
npm run smoke:od-skills
npm run test:od-template-registry
```

通用优化：既有 `od-*` + `open-design` 交付路径已统一到 STDA（`npm run fix:od-stda`）。
