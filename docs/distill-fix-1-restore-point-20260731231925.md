# 蒸馏问题修复-1 — 代码还原点

> 0731 调研/蒸馏四线错位、加戏死循环与营销 GEO 加固批次。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-distill-fix-1-20260731231925` |
| **Star 别名** | `star/distill-fix-1`（★ **蒸馏问题修复-1**） |
| **提交** | `169c92eb` |
| **时间** | 2026-07-31 23:19:25 +0800 |
| **说明** | **蒸馏问题修复-1** — 调研/蒸馏四线与加戏死循环 |

```bash
git show restore-point/post-distill-fix-1-20260731231925 --no-patch --format="%H %s %ci"
git show star/distill-fix-1 --no-patch
```

## 本还原点主要变更

### 蒸馏 / 调研四线

- SDM：`PILOTDECK_DISTILL_SDM` / `SDM_HEAL_RESEARCH_LITE` / `RESEARCH_DOCX_BASENAME_FUZZY` / `BLOCK_SILENT_RESEARCH_ADD`（pack 默认 shadow）
- `deliverableChecklistAuthority`、`sdmSlotMatching`、`sessionDeliverableManifest`、`detectGoalMutation`
- `assistantCompletionGate`、Nova research skill 绑定
- fixture + 门禁：`test:four-line-0731:offline` / `live`（4/4）
- 验收：`docs/four-line-0731-research-distill-acceptance.zh-CN.md`

### Viral distill skill

- `skills/viral-article-generator` + `skills/vendor/viral-article-generator/`
- Hub catalog / try-prompt / checklist authority

### 其他

- 营销 GEO / claims / compare / faq、OG、SEO 验收
- 侧栏多选、任务文件夹导航、后台 platform features、Bento/Preflight gate
- 稳定性与对话全链报告（2026-07-31）

## 排除项（未纳入提交）

- `general/artifacts/**`
- `dev-saas-deeplink.out.txt`
- `.superpowers/`
- `.tmp-bento-vendor/`
- `scripts/_tmp_*`

## 如何还原

```bash
git reset --hard restore-point/post-distill-fix-1-20260731231925
# 或 Star 别名
git reset --hard star/distill-fix-1
```

## 星标里程碑（未移动）

- ★ 预览模板+新首页：`star/preview-template-homepage` @ `31ad76c0`
- ★ 预览模板：`star/preview-template` @ `03a45def`
- ★ Grok 4.5：`star/grok-45-experiment` @ `2eaa31fc`
- ★ Bento：`star/bento` @ `b5832404`
- ★ 智谱：`star/zhipu-demo-stable` @ `2873c348`
