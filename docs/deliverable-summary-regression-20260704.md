# 交付汇总表 SDM 回归报告

时间：2026-07-04T15:00:00.141Z
实机：是

## 结果

- modric-component-vitest: PASS
- sdm-unit: PASS
- playwright-offline: PASS
- playwright-live: PASS

## 覆盖场景

- MOD-01 品牌官网 kind-only SDM → 已交付
- MOD-02 Campaign 部分交付
- MOD-03 受众画像 verifiedPaths
- MOD-04 联名营销 acceptance 行
- MOD-05 正文路径回退
- REG-06~09 莫德里奇历史会话实机汇总表

## 实机说明

- REG-06/08：catalog 未收录磁盘 jsonl 时跳过（MOD-01/03 由组件单测覆盖）
- REG-07 Campaign、REG-09 联名：须汇总表含「已交付」且非全「未完成」
