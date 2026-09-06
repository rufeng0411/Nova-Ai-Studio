# Nova Ai-Studio · 市场品牌资料库

> **对外品牌**：Nova Ai-Studio 2.0 · 智能体创作平台  
> **垂直定位**：AI 营销创意生产平台  
> **最后更新**：2026-06-17

本目录为 Nova Ai-Studio 的**市场、品牌、销售、投资**权威资料集。中文为主，关键文档附英文简版（见 [`en/`](en/)）。

> **网页浏览**：请打开 [`index.html`](index.html)（相对路径导航，可整包拷贝到任意目录）。HTML 引导页见 [`_pdf-html/README.html`](_pdf-html/README.html)。

---

## 按读者导航

### 官网 / 获客

| 顺序 | 文档 | 用途 |
|------|------|------|
| 1 | [产品总览](product/产品总览-one-pager.md) | 1 页纸：是什么、给谁、核心价值 |
| 2 | [价值主张与八大亮点](product/价值主张与八大亮点.md) | 展开平台卖点 |
| 3 | [功能支柱](product/功能支柱-deep-dive.md) | 飞轮、能力中心、模板、模型池 |
| 4 | [安全与信任白皮书](trust/安全与信任白皮书-简版.md) | 企业客户关心的隔离与审计 |

### 销售 / 渠道

| 顺序 | 文档 | 用途 |
|------|------|------|
| 1 | [销售指导手册](sales/销售指导手册.md) | **主手册**：获客、破冰、认知分层、行业策略、POC |
| 2 | [私有化与企业政务销售手册](sales/私有化与企业政务销售手册.md) | 政企大客户：私有部署、定制、招投标 |
| 3 | [销售手册（速查）](sales/销售手册-enablement.md) | 卖点、演示、报价一页纸 |
| 4 | [信息屋](brand/信息屋-messaging-house.md) | 主标语、电梯演讲 30s / 2min / 5min |
| 5 | [演示脚本](sales/演示脚本-demo-script.md) | 15 分钟标准演示 |
| 6 | [异议处理 FAQ](sales/异议处理-faq-sales.md) | 常见客户问题 |
| 7 | [四列产品对照表](sales/四列产品对照表.md) | 技术 vs 市场话术对照（可打印 PDF） |

### 投资 / 战略合作

| 顺序 | 文档 | 用途 |
|------|------|------|
| 1 | [市场洞察与趋势](market/市场洞察与趋势.md) | 行业背景 |
| 2 | [竞品与差异化矩阵](market/竞品与差异化矩阵.md) | 定位与应对 |
| 3 | [商业模式与套餐](business/商业模式与套餐.md) | 怎么收钱 |
| 4 | [上市路线三阶段](business/上市路线三阶段.md) | 落地节奏 |
| 5 | [风险与合规摘要](business/风险与合规摘要.md) | 决策向风险清单 |

---

## 目录索引

| 目录 | 内容 |
|------|------|
| [00-口径与更新.md](00-口径与更新.md) | 数字口径、禁词、版本 |
| [brand/](brand/) | 品牌手册、信息屋、术语表 |
| [product/](product/) | 产品总览、亮点、功能、用户画像、双轨对照 |
| [market/](market/) | 市场洞察、竞品、目标市场、行业场景包 |
| [business/](business/) | 商业模式、定价、上市路线、风险 |
| [sales/](sales/) | 销售指导、政企私有、速查、FAQ、演示脚本、四列表 |
| [design/](design/) | 设计风格、界面叙事 |
| [trust/](trust/) | 安全白皮书、部署运维 |
| [press/](press/) | 新闻稿、媒体 FAQ、社媒内容库 |
| [en/](en/) | 英文 Executive Summary |

---

## 生成 PDF

```bash
npm run brand:about-pdfs           # 全部 Markdown → about/pdf/（Nova 页眉页脚 + 图表）
npm run brand:product-brief-pdf    # 四列对照横版（同 sales/nova-product-features）
```

输出目录：[`pdf/`](pdf/)（索引见 [`pdf/README.md`](pdf/README.md)）

---

## 维护说明

- 对外数字以 [00-口径与更新.md](00-口径与更新.md) 为准
- 用户可见文案统一 Nova 品牌（见 [品牌手册](brand/品牌手册.md)）
- UI 产品弹窗文案与本文库对齐：`ui/src/i18n/locales/*/common.json` → `productInfo`
