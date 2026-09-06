# Element ID Registry

跨页 **稳定 id** 供 morph / connector / link 使用。格式：`{scope}-{role}`，小写 kebab。

## Chrome（全 deck 复用）

| id | 用途 | morph |
|----|------|-------|
| `logo` | 品牌 mark / wordmark | ✓ 每页 |
| `headline` | 主标题 | ✓ section↔content |
| `kicker` | 上标 / 章节标签 | 可选 |
| `bar` | accent 条（横/竖变形） | ✓ 推荐 |
| `page-num` | `{{page:2}}` 页码 |  rarely |

## 数据 / KPI

| id | 用途 |
|----|------|
| `kpi-main` | 英雄数字（countUp） |
| `kpi-1` … `kpi-4` | 指标行 |
| `chart-main` | 主 chart |
| `chart-secondary` | 次要 chart |
| `table-main` | 主 table |

## 布局块

| id | 用途 |
|----|------|
| `body` | 正文区 |
| `col-left` / `col-right` | 双栏 |
| `card-a` / `card-b` / `card-c` | 三卡 |
| `image-hero` | 主图 |
| `scrim` | 遮罩矩形 |

## 封面专用

| id | 用途 |
|----|------|
| `bg-photo` | 全幅图 + ken-burns |
| `cover-title` | 可与 headline 合并；若合并则用 `headline` |

## 流程 / 交互

| id | 用途 |
|----|------|
| `node-{step}` | 流程节点 shape |
| `conn-{a}-{b}` | connector line |
| `state-dismiss` | 隐藏页全屏透明返回 |

## 命名规则

1. **同一 slide 内 id 唯一**
2. morph 配对：**字符串完全一致**（或同 `morphId`）
3. 新建 slide 从上一页 **复制** chrome 元素再改 frame，勿新建 id
4. 避免 `el1`、`text2` 等无语义名

## 示例：pitch deck 最小 morph 集

```
headline, bar, logo  —  贯穿 cover / problem / solution / ask
kpi-main             —  traction 页 countUp
chart-main           —  market 页（fade 进入，非 morph）
```
