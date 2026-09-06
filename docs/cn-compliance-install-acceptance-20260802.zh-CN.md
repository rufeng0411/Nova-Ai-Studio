# 企业合规 Skills + Hub 安装验收报告（2026-08-02）

## 总览

| 项 | 结论 |
|----|------|
| 生产宣称「全 A + enforce」 | **NO_GO（暂缓）** — L4 九案 Gateway 实机未跑；Hub 保持 **shadow** |
| 首包代码安装（G0→PR-M） | **GO（shadow）** |
| PR-E vivy 财税 | **INSTALLED（override）** — 用户授权忽略 LICENSE；10 tax 原子 +「财税出纳」卡 |
| 回滚 | `restore-point/pre-cn-compliance-20260802214841` + tarball `artifacts/cn-compliance-backup/` |

## Feature flags（三处已同步）

| Flag | 当前默认 | 位置 |
|------|----------|------|
| `VITE_HUB_ENTERPRISE_COMPLIANCE_TAB` | `shadow` | `pack.mjs` UI env、`apply-cloud-perf-env.sh`、`devLauncherCore.mjs` |
| `PILOTDECK_CN_COMPLIANCE_BINDING` | `1` | 同上 + Gateway binding |
| `hub-visibility.categories.enterprise_compliance` | `false` | `config/hub-visibility.json`（用户前台不见 Tab） |

**enforce 条件（未满足）**：L4≥9 案且成果四线一致后，再将 visibility 置 `true` 且 Tab mode→`enforce`。

## L0–L4

| 级 | 命令 / 证据 | 结果 |
|----|-------------|------|
| L0 | `npm run check:cn-compliance:compat` | **PASS** FAIL=0（38 skills）；报告 `docs/cn-compliance-compat-report-20260802.zh-CN.md` |
| L0 | `npm run audit:skill-duplicates` | 软重复提示（bid-assembly/audit 等同 Pill 隐藏原子，可接受） |
| L1 | `npm run capabilities:gen` + `check-task-dir-prompts` | **PASS**；22 卡 try-prompt 已升为非专家填空（`cnComplianceTryPrompts.mjs`），含「你在做什么/请填写/请准备/你会得到/须交付」 |
| L1 | `cn-compliance-*` profiles | **PASS**（`resolveProfile`→contract/bid-write/entity 等） |
| L2 | `npm run smoke:skills-batch` | **PASS** 45/45 |
| L2 | `npm run smoke:mcp-p1` | **PASS**（example + catalog `mcp-cn-central-policy`） |
| L2 | `npm run smoke:capability-hub` | **PASS**；7 Pill 非空（taxonomy-audit） |
| L2 | `npm run check:cn-compliance:hub` | **PASS**（P0=15、原子 hidden、visibility shadow） |
| L3 | UI 双入口实机（`smoke:skills-batch-ui`） | **SKIP/PARTIAL** — shadow 下用户 Tab 隐藏属预期；后台可见性可开类目验收 |
| L4 | 九案 Gateway + 成果四线 | **未跑** — Bridge:7990 就绪但未开专用项目九案；**禁止 enforce** |

## 安装清单

- Skills：`skills/vendor/cn-compliance/` × **38**（zhou + bidsmart/BiaoShu + zh-xx）
- Hub L1：`enterprise_compliance` + 7 Pill
- 前台 virtual 卡：**22**（经营/合同招投标/人力/治理/惠企 + 财税 6 卡 + MCP 卡）；Hub 试一下权威 `scripts/lib/cnComplianceTryPrompts.mjs`
- MCP：仅 example `cn-central-policy`；运维见 `docs/cn-compliance-mcp-setup.zh-CN.md`
- Binding：`capabilityBindingPrompt.resolveCnComplianceExtra`
- Vendor scripts：`vendor:cn-compliance:*` / `check:cn-compliance:compat|hub`

## KPI（实数）

| KPI | 值 |
|-----|-----|
| compat FAIL | **0** |
| 入库 skill | **38** |
| P0 前台卡（catalog） | **15** |
| Pill 非空 | **7/7** |
| false_incomplete（L4） | *未测* |
| LICENSE vivy | 无文件；**用户 override 已装** |
| tax 原子 / 财税前台卡 | **10** / **6**（含 `comp-cashier-ops`） |

## 后续（用户下令）

1. 提交本批改动 + 打 `restore-point/post-cn-compliance-*`
2. 后台 visibility 开类目 → 双入口 UI 抽检（L3）
3. admin 专用项目跑 L4 九案 → 四线分列取证 → 再 enforce
4. vivy LICENSE 出现后跑 `vendor:cn-compliance:vivy-tax` + compat 复跑
