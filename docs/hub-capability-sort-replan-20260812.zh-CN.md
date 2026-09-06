# 能力中心排序重规划（2026-08-12）

## 规则

1. **同名同类**：同一分组内中文显示名规范化后相同 → 只默认展示最具代表性一项，其余进「显示更多」。代表项优先级：`hub_pinned` > Nova > 非 `*-skills-*` 副本 > 星级 > `hub_sort` > 短 slug。若组内已有必留 pin，仍按必留语义：必留默认展示、其余进更多。
2. **Nova 系列靠前**：`nova-*`（含 Bento）在组内整体置顶，固定序见 `NOVA_HUB_ORDER`（调研×6 → 美学幻灯 → 智能获客 → Bento）。
3. **其余**：推荐星级（热度）→ `hub_sort` / `STAGE_PRIMARY_ORDER`（契合度）→ slug。

## 落地

| 模块 | 作用 |
|------|------|
| `ui/src/shared/hubCapabilityPresentation.ts` | Nova 序、同名规范化、代表项比较 |
| `ui/src/shared/hubPinnedSections.ts` | 同名归并 + 必留折叠 |
| `ui/src/shared/capabilityHubSort.ts` + `scripts/lib/capabilityHubSort.mjs` | 比较器注入 Nova 优先 |
| `CapabilityHub.tsx` | `splitHubSectionItems(..., getDisplayName)` |

## 注

「4 至 Spice」按 **Nova 全系固定序整体靠前** 落地；若本意是别的排序表，请给出 slug 顺序再改 `NOVA_HUB_ORDER`。
