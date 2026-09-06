# 鸣镝 G700 三案配图失败 RCA（2026-07-19）

## 背景

上一轮 VAP（Visual Asset Platform）落地后，用户又导出 3 个新会话 HTML，均在「图和资料要来自官网」约束下仍未自动取得可用配图。本报告归纳共性根因，并说明本次「多手段配图阶梯」策略更新。

## 三案概览

| 案例 | 会话前缀 | 能力 | 主要失败表现 |
|------|----------|------|----------------|
| Nova 美学幻灯 8 页 | `358b28a2` | nova-ppt-aesthetic-slides | `fetch_page_images` DNS 失败 → Agent 改 `generate_image×8` → 限流后 slide 03–08 为 SVG；`placeholderCount=6`；**未强制走 VAP 六层阶梯** |
| HTML 演示 8 页 | `4d7f1fe7` | HTML 演示 | 官网 DNS 失败；后调 `resolve_session_visual_assets` 但 manifest 空；最终 CSS 渐变占位；goal 中 URL 尾部粘连中文 |
| 品牌 Hero 官网 | `6439aedb` | 官网 Hero 文案 | 误抓错误品牌域；VAP 空；最终 SVG 占位 |

## 共性根因

1. **CDN/DNS 导致官网直链不可达**（开发/评测环境常见），首手段失败后 Agent 过早降级。
2. **未跑满多源阶梯**：行业权威站、综合门户、HTML 候选提取、视口截图等兜底未在首轮失败时自动串联执行。
3. **URL 解析污染**：用户 goal 中「官网：https://…，8页16:9」类句式把中文后缀粘进 URL，导致 fetch 目标错误。
4. **official_only 与 skill 冲突**：Nova 幻灯 skill 仍引导逐页 `generate_image`，与「官图来自官网」约束冲突。
5. **失败反馈过早**：首轮 `fetch_page_images` 失败即写 SVG/渐变，未满足「全部手段尝试后才告知用户」的产品要求。

## 策略更新（本次落地）

### 八层配图阶梯（按序、安全、有审计）

`visualAcquisitionLadder.ts` 定义固定顺序：

1. **official_direct** — 用户 goal 中的官网 URL
2. **official_roots** — 品牌官网根域
3. **authority_industry** — 汽车之家/懂车帝/易车/太平洋汽车等
4. **portal_general** — 中关村在线/有驾/百度/搜狗等
5. **search_engine_web** — 博查 API + Bing 网页搜索，定位权威产品页
6. **search_engine_image** — Bing Images 图片搜索，直取候选图 URL
7. **html_image_extract** — 抓取 HTML 并提取候选图本地化
8. **page_screenshot** — Playwright 视口截图兜底

每层尝试写入 `manifest.acquisitionAttempts`；仅当 **六层均已尝试且 `assetCount=0`** 时，`ladderExhausted=true`，才允许：
- 向用户说明「已按安全策略依次尝试多种渠道，仍无法获取配图」
- 非 official_only 任务使用 SVG/CSS 占位（须标注 degraded）

### 集成点

| 模块 | 变更 |
|------|------|
| `discoveryPipeline.ts` | 重写为多 tier 管线 + `acquisitionAttempts` |
| `manifestStore.ts` | 空 manifest 时输出阶梯策略；耗尽时输出结构化失败文案 |
| `resolveSessionVisualAssets.ts` | 返回 `acquisitionAttempts`、`ladderExhausted` |
| `visualMediaDegradePolicy.ts` | 策略块嵌入六层阶梯说明 |
| `capabilityBindingPrompt.ts` | official_only 绑定注入阶梯 |
| `recoveryHints.ts` | fetch/generate 恢复提示禁止首轮 SVG，要求 phase_a 跑满 |
| `urlSanitize.ts` | 剥离 goal URL 尾部中文标点 |

### 验收命令

```bash
npm run test:visual-asset-platform:acceptance
npm run check:saas-fork
```

## 仍待 Gateway 实机验证

- Nova 幻灯在 enforce 下是否仍 bypass VAP 走 `generate_image`（需 skill binding + ToolRuntime 硬拦联动）
- 生产环境 `official-source-roots` 运维灌根域（canary fixture 仅 dev/CI）
- 三案 HTML 导出会话在 dev:saas 下 replay 复测

## 结论

三案失败主因是 **「单手段失败即降级」**，而非 VAP 模块缺失。本次更新将「多手段尝试 → 审计 → 耗尽才占位/告知」固化为平台默认行为；离线 acceptance 通过后，须在 Gateway 实机复跑 G700 三场景方可宣称生产可用。
