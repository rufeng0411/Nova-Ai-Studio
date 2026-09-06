# Grok 4.5 开始实验 — 代码还原点

> Preflight Studio 前置选模板 Sketch、产品记忆（AGENTS）同步与 Grok 4.5 实验起点。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-grok-45-preflight-experiment-20260730184135` |
| **Star 别名** | `star/grok-45-experiment`（★ **grok 4.5 开始实验**） |
| **提交** | `2eaa31fc` |
| **时间** | 2026-07-30 18:41:35 +0800 |
| **说明** | **grok 4.5 开始实验** — Preflight Studio 完整批次与产品记忆同步 |

```bash
git show restore-point/post-grok-45-preflight-experiment-20260730184135 --no-patch --format="%H %s %ci"
git show star/grok-45-experiment --no-patch
```

## 本还原点主要变更

### Preflight Studio（SuperPreview 前置选模板）

- `artifacts/saas-design/preflight-studio/` — open-design / ppt-master / multi-slot 静态 Sketch
- 共享 tokens、gallery、motion、od-runtime、ppt-runtime、gallery-runtime
- multi-slot 精简、v3 工作台与 ppt v2 三阶段交互补全
- `scripts/capture-shots.mjs` 与示例截图

### 产品记忆（AGENTS.md）

- Bento 所见即所得、企业级/私有化定位
- SuperPreview 前置选模板（open-design / ppt-master）
- 团队协作细化、模型池套组、手机端 sticky 成果栏

### 其他

- `validateDeliverablesEngine.ts` 微调
- `skills/nova-bento-slides/SKILL.md` 更新
- capabilities catalog/i18n、`mobile-browser-compat-matrix.md`、`mobile-regression-check.mjs`

## 提交组成

| 提交 | 说明 |
|------|------|
| `786f4267` | feat: Grok 4.5 实验起点 — Preflight Studio 与产品记忆同步 |
| `2eaa31fc` | chore: Preflight Studio Sketch 迭代与截图更新 |

## 排除项（未纳入提交）

- `general/artifacts/**`
- `dev-saas-deeptest.out.txt`
- `.superpowers/`
- `.tmp-bento-vendor/`

## 如何还原

```bash
git reset --hard restore-point/post-grok-45-preflight-experiment-20260730184135
# 或 Star 别名
git reset --hard star/grok-45-experiment
```

## 星标里程碑（未移动）

- ★ Bento 初集成：`star/bento` @ `b5832404`
- ★ 智谱演示：`star/zhipu-demo-stable` @ `2873c348`
