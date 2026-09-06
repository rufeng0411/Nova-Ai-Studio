# 能力中心显示名 / 隐藏深度排查（2026-08-12）

> 数据源：`config/capabilities.catalog.json` + `capabilities.i18n.json` + `hub-visibility.json`  
> 全量表：`artifacts/hub-capability-audit-20260812/all-capabilities.csv`（1406 行）  
> 交互清单：Cursor Canvas `hub-capability-audit.canvas.tsx`

## 1. 总体数字

| 指标 | 数量 | 说明 |
|------|------|------|
| 目录总数 | 1406 | catalog skills |
| `hidden_in_hub=true` | 684 | taxonomy/原子 skill 刻意隐藏 |
| **用户实际不显示** | **963** | hidden ∪ Tab 关闭 ∪ slug 关 |
| 用户可见 | 443 | Hub 前台能扫到 |
| 重复中文显示名 | 97 组 | 最惨：「能力·专项」×19、「HF·专项」×19 |
| 垃圾/过程名 | ~49 | `·专项` / 截断过程句 |

「不显示」= `isCapabilityVisibleInHub === false`（`scripts/lib/hubVisibility.mjs`）。

## 2. 你点名的两个案例

### 2.1 「智能获客」——**没有被隐藏，是改坏了名字**（2026-08-12 已修）

| 字段 | 现状（修复后） |
|------|------|
| slug | `nova-customer-acquisition-leads` |
| 中文显示名 | **Nova-智能获客**（曾误为「检索→抽取→表格版 MD」） |
| `hidden_in_hub` | **否** |
| 实际不显示 | **否**；已 pin；搜「智能获客」可命中 |
| 试一下文案 | 「**Nova-智能获客**」 |

根因：`scripts/generate-capabilities-i18n.mjs` 的 `SKILL_ZH` 只写了：

```js
'nova-customer-acquisition-leads': {
  task_summary: '检索→抽取→表格版 MD 报告',
  description: '…'
  // 缺 display_name
}
```

生成器把 **无 CJK 的 catalog 英文名** 丢掉后，用 `task_summary.slice(0,12)` 当卡名 → 「检索→抽取→表格版 MD」。

**直接改法：**

```js
// generate-capabilities-i18n.mjs SKILL_ZH + capabilityZhAuto SLUG_ZH_OVERRIDE
'nova-customer-acquisition-leads': {
  display_name: 'Nova-智能获客',
  task_summary: 'B2B 智能获客：检索→抽取→评分线索表',
  description: '交付 leads-report.md 整齐表格；对话禁止 JSON/HTML 刷屏。',
}
```

并建议加入 `capability-hub-pinned.json`（当前 **未 pin**）。

### 2.2 「HTML 视频 / 网站成片」——**主入口名烂 + 子能力被藏**

| slug | 中文显示名 | hidden | 不显示 | 备注 |
|------|------------|--------|--------|------|
| `hf-hyperframes` | **HF·专项** | 否 | 否 | 试一下写「HTML 代码做视频」 |
| `hf-website-to-video` | **HF·专项** | **是** | **是** | **已 pin 但仍隐藏** |
| `tool-render-html-video` | HTML 转视频 | 否 | 否 | 名字正确（HTML→MP4 录屏） |

`capabilityHubTaxonomy.mjs`：

```js
'hf-website-to-video': { …, hidden_in_hub: true }
```

与 pin「必留」冲突 → 用户永远点不到「网站一键成片」。

**直接改法：**

| slug | 建议显示名 | 其它 |
|------|------------|------|
| `hf-hyperframes` | **HTML代码做视频** | 保持可见、主入口 |
| `hf-website-to-video` | **网站一键成片** | `hidden_in_hub: false`；副摘要「抓取网址自动出宣传片」 |
| `tool-render-html-video` | 保持「HTML 转视频」 | 与 HyperFrames 区分（录屏 vs 工程渲染） |

## 3. 根因分层

1. **自动中文兜底失败**（`capabilityZhAuto.enrichZhLocaleFields`）  
   - 英文 slug 译不出 → `` `${label}·专项` `` → 大量「HF·专项 / 能力·专项 / 创作·专项」撞名。
2. **curated 只写 summary 不写 display_name**  
   - 过程描述被截成卡名（智能获客、Nova 美学幻灯「大纲→页描述→文生图配图」）。
3. **显隐三闸**  
   - `hidden_in_hub`（684）  
   - `hub-visibility.categories` 整 Tab 关：开发 / 脑爆 / 教育 / 媒体 / 金融  
   - `hub-visibility.capabilities` 单关：联网搜索、Firecrawl 等  
   - pin 不覆盖 hidden。

## 4. P0 改名/显隐清单（可直接照抄）

| slug | 当前中文名 | 建议中文名 | 动作 |
|------|------------|------------|------|
| `nova-customer-acquisition-leads` | 检索→抽取→表格版 MD | **Nova-智能获客** | 改名；建议 pin |
| `hf-hyperframes` | HF·专项 | **HTML代码做视频** | 改名 |
| `hf-website-to-video` | HF·专项 | **网站一键成片** | **改名 + 取消隐藏** |
| `html-ppt` | 能力·专项 | **HTML演示稿** | 改名（已 pin） |
| `remotion-video` | 能力·专项 | **React程序化视频** | 改名 |
| `nova-ppt-aesthetic-slides` | 大纲→页描述→文生图配图 | **Nova-美学幻灯** | 改名 |
| `hf-product-launch-video` | HF·专项 | **HF·产品发布片** | 改名 |
| `hf-faceless-explainer` | HF·专项 | **HF·无脸解说** | 改名 |
| `hf-motion-graphics` | HF·专项 | **HF·动态图形** | 改名 |
| `hf-general-video` | HF·专项 | **HF·通用成片** | 改名 |
| `hf-slideshow` | HF·专项 | **HF·幻灯成片** | 改名 |
| `create-vid-scriptwriting` | 创作·专项 | **视频脚本写作** | 改名 |
| `create-vid-saas-demo-script` | 创作·专项 | **SaaS演示脚本** | 改名 |
| `create-vid-seedance-prompt` | 创作·专项 | **Seedance提示词** | 改名 |
| `create-vid-seedance-codec` | 创作·专项 | **Seedance编码规范** | 改名 |
| `create-vid-visual-prompt` | 创作·专项 | **视频画面提示词** | 改名 |
| `create-vid-director` | 创作·专项 | **AI导演分镜** | 改名 |
| `create-vid-storyboard-pack` | 创作·专项 | **分镜包** | 改名 |

机读：`artifacts/hub-capability-audit-20260812/p0-rename-unhide.json`。

## 5. P1 建议（批次）

1. **门禁**：`capabilities:gen` 后禁止出现「·专项」作为 **可见** 卡的 display_name；禁止 display_name === task_summary 前 12 字且含 `→`。  
2. **pin 一致性**：凡 `capability-hub-pinned.json` 中的 slug，断言 `hidden_in_hub !== true` 且 `hub-visibility.capabilities[slug] !== false`（当前踩雷：`hf-website-to-video`、`tool-web-search`、`mkt-brand-mention` 等）。  
3. **品牌站双份**：`mkt-brand-*` 与 `mkt-brand-skills-*` 大量同名 → 后者统一 `hidden_in_hub`（若尚未），前台只留一份。  
4. **Tab 策略**：教育/媒体/金融若要对用户可用，在后台 Hub 可见性打开对应一级 Tab（当前默认关导致整类「不显示」）。

## 6. 全量清单怎么看

- CSV：`artifacts/hub-capability-audit-20260812/all-capabilities.csv`  
  列：`slug, display_zh, hidden_in_hub, not_shown, major, availability, reason`  
- Canvas：筛选「垃圾/过程名 / 实际不显示 / 全部」，分页浏览 1406 项。

---

**需要我下一步直接改 `SLUG_ZH_OVERRIDE` + 取消 `hf-website-to-video` 隐藏并跑 `capabilities:gen` 吗？**
