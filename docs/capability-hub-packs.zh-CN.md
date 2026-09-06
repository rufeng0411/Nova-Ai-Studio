# 能力中心「能力包」合并策略

## 问题

部分上游技能仓库按「一个大 Skill 拆成许多子目录」 vendoring 进 Nova（如 `mkt-brand-*`、`pms-*`、`create-threejs-*`）。若在能力中心逐条展示，会导致：

- 卡片过多，浏览负担大；
- 用户不清楚该点哪一张；
- 「试一下」前要自己在几十个近似名称里找 slug。

## 原则

| 层 | 策略 |
|---|---|
| **能力中心（Hub）** | 每个大包只显示 **1 张能力包卡片** |
| **磁盘 / Agent** | 子技能 **全部保留**，`read_skill` 仍可按前缀加载 |
| **试一下** | 注入 **路由型提示词**：说明目标，由 Agent 自动选用包内子技能 |

## 当前能力包（7 个）

| 卡片 slug | 名称 | 子技能前缀 | Tab / 位置 |
|---|---|---|---|
| `hub-pack-brand-website` | 品牌官网全案 | `mkt-brand-` | 营销 · 策略 |
| `hub-pack-ad-funnel` | 广告漏斗全案 | `mkt-adv-` | 营销 · 触达 |
| `hub-pack-aso` | 应用商店优化 | `mkt-aso-` | 营销 · 分发 |
| `hub-pack-threejs` | 3D 网页创作 | `create-threejs-` | 创作 |
| `hub-pack-fal-video` | Fal 多模态视频 | `fal-` | 创作 |
| `hub-pack-pm-toolkit` | PM 工具包 | `pms-` | 脑暴 |
| `hub-pack-pm-methods` | 产品方法论 | `pmd-` | 脑暴 |

权威定义：`scripts/lib/capabilityHubPacks.mjs`

## 运维

```bash
npm run capabilities:gen    # 重新生成 catalog + i18n（含能力包卡）
npm run smoke:capability-hub
```

新增大包时：在 `HUB_SKILL_PACKS` 增加一项，`member_prefix` 下所有子技能将自动 `hidden_in_hub`。

## 未合并的包

单技能或少量技能（如 `geo-*`、`anth-*`、Open Design `od-*`）仍单独展示；后续若某前缀下子项 >10 且场景高度同质，可再纳入能力包。
