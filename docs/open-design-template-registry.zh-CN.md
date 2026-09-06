# Open Design 模板影子目录（轨 C）

> 生成：`node scripts/generate-open-design-template-registry.mjs`  
> 权威 JSON：`config/open-design-template-registry.json`  
> Flag：`PILOTDECK_OD_TEMPLATE_REGISTRY=off|shadow|1`（默认 **shadow**）

## 原则

- **Hub 默认不可见**（`hubVisible: false`）——避免 100+ 模板炸能力中心。
- 需要用户可发现的场景 → 精选 port 为 `skills/od-*`（轨 B）。
- `html-ppt-*` / 视频类 → `skip_use_native`，走本仓 PPT / HyperFrames。
- **不接** OD marketplace daemon / `open-design.json` 原子链。

## 统计

| 状态 | 数量 |
|------|------|
| 合计 | 117 |
| 已 port（ported） | 15 |
| 仅影子（shadow_only） | 44 |
| 跳过用本仓（skip_use_native） | 58 |

## 已 port 对照

| 上游 slug | Nova skill | 中文名 |
|-----------|------------|--------|
| `blog-post` | `od-blog-post` | 博客文章页 |
| `card-twitter` | `od-social-x-card` | X 分享卡片 |
| `creative-director` | `od-creative-director` | 创意总监审稿 |
| `deck-swiss-international` | `od-deck-swiss` | 瑞士国际主义 Deck |
| `docs-page` | `od-docs-page` | 文档站点页 |
| `finance-report` | `od-finance-report` | 财务报告页 |
| `gamified-app` | `od-gamified-app` | 游戏化应用页 |
| `hr-onboarding` | `od-hr-onboarding` | 入职引导页 |
| `kanban-board` | `od-kanban-board` | 看板任务板 |
| `meeting-notes` | `od-meeting-notes` | 会议纪要页 |
| `pm-spec` | `od-pm-spec` | 产品规格页 |
| `team-okrs` | `od-team-okrs` | 团队 OKR 页 |
| `waitlist-page` | `od-waitlist-page` | 候补名单页 |
| `web-prototype` | `od-web-prototype` | 网页原型页 |
| `wireframe-mobile-flow` | `od-wireframe-mobile-flow` | 手机流程线框 |

## 分类摘要

- **看板**（`dashboard`）：7
- **演示/PPT 变体**（`deck_ppt`）：54
- **文档协作**（`docs_collab`）：8
- **财务**（`finance`）：4
- **营销网页**（`marketing_web`）：9
- **动效/视频**（`motion_video`）：5
- **其他**（`other`）：16
- **产品界面**（`product_ui`）：4
- **社媒卡片**（`social_card`）：6
- **线框**（`wireframe`）：4
