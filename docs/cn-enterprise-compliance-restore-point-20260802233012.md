# 企业合规 — 代码还原点

> 企业合规 Hub/Skills 首包（shadow）与 VAP 加固同批入库。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-cn-enterprise-compliance-20260802233012` |
| **Star 别名** | `star/cn-enterprise-compliance`（★ **企业合规**） |
| **提交** | `d1e241c8` |
| **时间** | 2026-08-02 23:30:12 +0800 |
| **说明** | **企业合规** — Hub/Skills 首包与 VAP 加固同批 |
| **前置 pre** | `restore-point/pre-cn-compliance-20260802214841`（安装前基线） |

```bash
git show restore-point/post-cn-enterprise-compliance-20260802233012 --no-patch --format="%H %s %ci"
git show star/cn-enterprise-compliance --no-patch
```

## 本还原点主要变更

### 企业合规 Hub / Skills

- `skills/vendor/cn-compliance/`（招标/法务/隐私/财税等）+ `cn-enterprise-consult/`
- Hub L1 `enterprise_compliance`（flag shadow；visibility 默认隐藏）
- try-prompt、taxonomy、vendor 脚本与兼容/Hub 验收门禁
- 验收：`docs/cn-compliance-install-acceptance-20260802.zh-CN.md`（全 A enforce **NO_GO**，首包 shadow **GO**）

### VAP 加固

- `forceLadder` / `vapOutboundGate` / `visionImageLocate` / crawler sidecar
- 失败案 fixture 与 `run-vap-hardening-strict` 等编排
- 报告：`docs/vap-perf-effect-hardening-acceptance-20260802.zh-CN.md`

### 其他

- Hub 可见性后台、用户日志弹层
- Showcase/流程模板与 catalog 同步

## 排除项（未纳入提交）

- `general/artifacts/**`
- `dev-saas-deeplink.out.txt`
- `.superpowers/`
- `.tmp-bento-vendor/`
- `scripts/_tmp-*`

## 如何还原

```bash
git reset --hard restore-point/post-cn-enterprise-compliance-20260802233012
# 或 Star 别名
git reset --hard star/cn-enterprise-compliance
```

## 星标里程碑（未移动）

- ★ 准备加固vap：`star/vap-hardening-prep` @ `95b66a43`
- ★ 蒸馏问题修复-1：`star/distill-fix-1` @ `169c92eb`
- ★ 预览模板+新首页：`star/preview-template-homepage` @ `31ad76c0`
- ★ 预览模板：`star/preview-template` @ `03a45def`
- ★ Grok 4.5：`star/grok-45-experiment` @ `2eaa31fc`
- ★ Bento：`star/bento` @ `b5832404`
- ★ 智谱：`star/zhipu-demo-stable` @ `2873c348`
