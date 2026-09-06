# AI 搜索可见度（pd-geo）— 管理员指南

面向维护者：技能、Python CLI、`geo_api` 工具、能力中心、流程模板与冒烟。

用户手册：[`aigeo-user-guide.md`](aigeo-user-guide.md) · 例句：[`aigeo-prompt-examples.md`](aigeo-prompt-examples.md)

---

## 1. 路径一览

| 路径 | 说明 |
|------|------|
| `skills/pd-geo/` | 总控技能 + platforms 模板 + resilience |
| `scripts/aigeo-cli.py` | Headless CLI（JSON stdin/stdout） |
| `scripts/aigeo-api.mjs` | Node 包装，供 `geo_api` 与 smoke |
| `scripts/setup-aigeo-venv.mjs` | 可选 Python venv（httpx 等） |
| `scripts/sync-aigeotools.mjs` | 上游 AIGEOTOOLS pin（MIT） |
| `scripts/sync-aigeotools-templates.mjs` | 刷新 platform 模板（可选） |
| `src/tool/builtin/geoApi.ts` | 内置 `geo_api`（PD-SAAS-FORK） |
| `config/aigeo-sync.manifest.json` | 上游版本记录 |
| `config/capabilities.overrides.json` | `pd-geo`、`mkt-ai-seo` 阶段 |

---

## 2. 一次性准备

```bash
node scripts/sync-aigeotools.mjs
node scripts/setup-aigeo-venv.mjs   # 可选，增强 verify
node scripts/bootstrap-pilotdeck-config.mjs
node scripts/generate-capabilities-catalog.mjs
node scripts/generate-capabilities-i18n.mjs
node scripts/generate-process-templates.mjs
```

---

## 3. 配置

`~/.pilotdeck/pilotdeck.yaml` 或示例 `products/_example/config/pilotdeck.yaml`：

```yaml
tools:
  webSearch:
    provider: bocha          # 推荐；主 provider 失败时也会自动 fallback 博查
    apiKey: "..."            # 或环境变量 BOCHA_API_KEY
  geo:
    dataDir: "~/.pilotdeck/geo-data"  # 可选
    # bochaApiKey: "..."     # 可选，默认同 webSearch / BOCHA_API_KEY
```

**GEO 验证顺序**：Agent **`web_search`（模型联网）→ 博查 Bocha**；`geo_api verify` 有博查 Key 时 CLI 直查，否则返回 `agent_web_search` 由 Agent 完成。**不再使用** `PERPLEXITY_API_KEY` / `tools.geo.perplexityApiKey`（已废弃，配置后仅告警）。

**模型**：`geo_api` 的 LLM 评分继承当前对话 **agent.model** 凭据（能力中心模型池）。

---

## 4. 测试矩阵（T0–T4）

### T0 生成物

```bash
node scripts/generate-capabilities-catalog.mjs
node scripts/generate-capabilities-i18n.mjs
node scripts/generate-process-templates.mjs
```

断言：catalog 含 `pd-geo`；模板 **15** 条含 `geo-visibility-quick` 等 3 个 id。

### T1 CLI 冒烟

```bash
npm run smoke:aigeo
```

报告：`artifacts/aigeo-smoke/report.json`

### T2 集成

```bash
node scripts/integration-capabilities-smoke.mjs
npm run smoke:templates
node scripts/ui-aigeo-regression-check.mjs   # 可选
```

### T3 Agent（本机，Gateway 已启）

```bash
npm run smoke:aigeo:agent
```

### T4 人工 UAT

| # | 场景 | 通过标准 |
|---|------|----------|
| 1 | 能力中心 → 策略策划 → pd-geo → 试一下 | 注入 prompt，`read_skill pd-geo` |
| 2 | 流程模板 → geo-visibility-standard | 多步 prompt |
| 3 | 无 venv | 仍有 keywords + 清单评估 |
| 4 | 无博查 Key | verify 返回 `verification_mode: agent_web_search`，Agent 用 web_search 完成 |
| 5 | 成果预览 | md/json 可预览 |
| 6 | geo-brand-full + 蚁小二 | 仅草稿 |

---

## 5. 与周边分工

| 能力 | 分工 |
|------|------|
| mkt-ai-seo | 方法论、审计清单（监测复盘） |
| pd-geo | 编排 + geo_api |
| yixiaoer | 国内草稿发布 |
| od-data-report | HTML 周报 |
| mkt-schema | JSON-LD 规范 |

上游 [AIGEOTOOLS](https://github.com/chnjames/AIGEOTOOLS) 仅 vendoring 算法模块，**不**运行 Streamlit。

---

## 6. Fork 登记

| 模块 | 路径 | 说明 | 日期 |
|------|------|------|------|
| pd-geo L2 | `skills/pd-geo/` | GEO 总控技能 | 2026-06-02 |
| geo_api | `src/tool/builtin/geoApi.ts` | 内置工具 | 2026-06-02 |
| 能力中心 | `config/capabilities.overrides.json` | pd-geo / mkt-ai-seo 阶段 | 2026-06-02 |
| 流程模板 | `config/process-templates.json` | +3 geo-* | 2026-06-02 |

---

## 7. 排障

1. `smoke:aigeo` 失败 → 检查 `skills/pd-geo/SKILL.md`、`python`/`py` 是否在 PATH  
2. score 恒为 quick → venv/LLM 未配置，属预期降级  
3. verify 无结果 → 确认 Agent 已调用 `web_search`；可选配置 `BOCHA_API_KEY` 或 `tools.webSearch.provider: bocha`
4. 能力中心无卡片 → 重跑 `generate-capabilities-catalog.mjs`
