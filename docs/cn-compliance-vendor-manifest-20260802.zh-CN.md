# 大陆企业合规 Vendor 映射清单（G0）

> 调研/安装日：2026-08-02  
> 还原点：`restore-point/pre-cn-compliance-20260802214841` @ `e0c9b9b8`  
> 备份：`artifacts/cn-compliance-backup/skills-config-pre-cn-compliance-20260802214841.tgz`  
> 目标根：`skills/vendor/cn-compliance/<slug>/`

## LICENSE 门禁

| 上游 | LICENSE 文件 | 结论 |
|------|--------------|------|
| zhou210712/claude-for-legal-ZH | LICENSE（Apache-2.0） | **可装** |
| youyouhe/bidsmart-claude-skills | LICENSE | **可装** |
| Get00/BiaoShu-SKILL | LICENSE | **可装** |
| zh-xx/legal-assistant-skills | LICENSE | **可装** |
| vivy-yi/Greater-China-Legal | **无 LICENSE 文件** | **PR-E=BLOCKED**（README 称 Apache 不足） |

## PR-A zhou 映射（每插件核心 skill，跳过 cold-start/customize/matter-workspace）

| 上游路径 | 目标 slug |
|----------|-----------|
| employment-legal/skills/hiring-review | zh-hiring-review |
| employment-legal/skills/termination-review | zh-termination-review |
| employment-legal/skills/worker-classification | zh-worker-classification |
| employment-legal/skills/wage-hour-qa | zh-wage-hour-qa |
| employment-legal/skills/handbook-updates | zh-handbook-updates |
| employment-legal/skills/policy-drafting | zh-policy-drafting |
| commercial-legal/skills/nda-review | zh-nda-review |
| commercial-legal/skills/vendor-agreement-review | zh-vendor-agreement-review |
| commercial-legal/skills/saas-msa-review | zh-saas-msa-review |
| commercial-legal/skills/review | zh-contract-review |
| corporate-legal/skills/entity-compliance | zh-entity-compliance |
| corporate-legal/skills/diligence-issue-extraction | zh-diligence-issue-extraction |
| corporate-legal/skills/tabular-review | zh-tabular-review |
| corporate-legal/skills/board-minutes | zh-board-minutes |
| privacy-legal/skills/pia-generation | zh-pia-generation |
| privacy-legal/skills/dsar-response | zh-dsar-response |
| privacy-legal/skills/dpa-review | zh-dpa-review |
| privacy-legal/skills/reg-gap-analysis | zh-privacy-reg-gap |
| product-legal/skills/marketing-claims-review | zh-marketing-claims-review |
| product-legal/skills/launch-review | zh-launch-review |
| product-legal/skills/feature-risk-assessment | zh-feature-risk-assessment |
| product-legal/skills/is-this-a-problem | zh-is-this-a-problem |
| regulatory-legal/skills/gap-surfacer | zh-reg-gap-surfacer |
| regulatory-legal/skills/policy-redraft | zh-reg-policy-redraft |
| regulatory-legal/skills/gaps | zh-reg-gaps |

## PR-B 招标

| 上游路径 | 目标 slug |
|----------|-----------|
| skills/bid-analysis | bid-analysis |
| skills/bid-requirements | bid-requirements |
| skills/bid-commercial-proposal | bid-commercial-proposal |
| skills/bid-tech-proposal | bid-tech-proposal |
| skills/bid-evaluation | bid-evaluation |
| skills/bid-assembly | bid-assembly |
| skills/bid-audit | bid-audit |
| BiaoShu-writer-pro（Get00） | biaoshu-writer-pro |

## PR-C zh-xx

| 上游路径 | 目标 slug |
|----------|-----------|
| ad-compliance-review | zhxx-ad-compliance-review |
| contract-review | zhxx-contract-review |
| contract-gen | zhxx-contract-gen |
| food-label-review | zhxx-food-label-review |
| legal-risk-visualization | zhxx-legal-risk-visualization |

（跳过 legal-job-search / legal-architecture / law-to-markdown — 非 SME 合规主路径）

## PR-E vivy（已装 · 用户授权忽略 LICENSE）

上游仍无 LICENSE 文件；**2026-08-02 用户明示忽略 LICENSE 继续安装**（`vendor:cn-compliance:vivy-tax:force` / `PILOTDECK_CN_COMPLIANCE_IGNORE_LICENSE=1`）。

| 上游路径 | 目标 slug |
|----------|-----------|
| …/invoice-compliance-checker | tax-invoice-compliance-checker |
| …/vat-rate-classification-advisor | tax-vat-rate-classification |
| …/vat-credit-calculator | tax-vat-credit-calculator |
| …/input-tax-credit-checker | tax-input-tax-credit-checker |
| …/eit-return-reviewer | tax-eit-return-reviewer |
| …/tax-preference-application-advisor | tax-preference-application-advisor |
| …/deduction-compliance-checker | tax-deduction-compliance-checker |
| …/tax-type-classifier | tax-type-classifier |
| …/individual-income-tax-planner | tax-individual-income-planner |
| …/consumption-tax-compliance | tax-consumption-tax-compliance |

**前台卡**：`comp-cashier-ops`（财税出纳）、`comp-invoice-vat`、`comp-cit-basics`、`comp-bookkeeping-xlsx`、`comp-tax-sme-hnte`、`comp-rd-super-deduction`（均 available）。

**当前状态：INSTALLED（override）— commit `5c0ef5fb`。**
