# 功能支柱（Deep Dive）

> Executive Summary (EN): Nova organizes work through a six-stage marketing flywheel, five capability tabs, ~30 workflow templates, a unified model pool, and in-chat deliverable preview—with SaaS cloud storage for enterprises.

---

## 1. 营销飞轮（六阶段）

| 阶段 | 中文名 | 典型产出 |
|------|--------|----------|
| 1 | 调研洞察 | 市场简报、竞品表、舆情要点、用户画像 |
| 2 | 策略策划 | Campaign 方向、GEO 策略、决策框架 |
| 3 | 创意内容 | 落地页、主视觉、文案长文、比稿报告 |
| 4 | 营销触达 | 社媒包、邮件序列、B2B 拓客话术 |
| 5 | 发布分发 | 多平台发布清单、SEO 规模化、上线检查 |
| 6 | 监测复盘 | 指标归因、GEO 可见度、实验优化 |

**导航形态**：L1 分段 Tab → L2 步进 Pill（选中实底）→ L3 纯文字子类。

**AI 搜索**：每阶段均有 AI 搜索 Pill；GEO/AEO 能力经 `secondary_task_groups` 可双归属。

---

## 2. 能力中心（五 Tab）

| Tab | 定位 | 子导航 |
|-----|------|--------|
| 营销飞轮 | 全流程最大覆盖 | 六阶段步进器 |
| 办公 | 文档、表格、演示 | category_subtag Pill |
| 创作 | 设计、视频、Open Design | category_subtag Pill |
| 开发 | 工程、测试、平台 | category_subtag Pill |
| 教育学习 | K12 + 学术 | 学段 Pill（学前～学术研究） |

**规模**：对外 **400+** 即用能力（Hub 口径）。

**体验**：紧凑四列卡片；悬停 description portal；简化星级；分组标题仅名称+数量。

**嵌入**：输入框「模板」弹层与侧栏全页共用同一 `CapabilityHub`（embedded 同步）。

---

## 3. 流程模板（近 30 条）

| 复杂度 | 数量 | 定位 |
|--------|------|------|
| 轻量 | 9 | 2 步快启：快检、通稿、竞品快览 |
| 标准 | 13 | 多步闭环：内容飞轮、GEO 包、社媒矩阵 |
| 全案 | 7 | 端到端：品牌 Campaign、新品上市、SaaS 增长 |

**与能力中心关系**：模板 = 「不知道怎么开始」的**编排好的对话起点**；能力 = 单点技能即试。

**触发**：「试一下」→ 当前项目新建对话 + 预填标准化提示词。

---

## 4. 模型池与智能路由

- **模型池**：平台（或单机用户）统一配置供应商与 Key
- **继承**：能力接入自动继承池凭据，避免重复填写
- **路由**：按任务难度在旗舰 / 轻量模型间切换
- **补充清单**：远程 `GET /models` 不全时合并本地代表型号（通义 3.6/3.7、Seedream、Imagen 等）

---

## 5. 成果交付 UX

| 能力 | 说明 |
|------|------|
| 对话内预览 | md / pdf / 图片 / 视频 / csv / xlsx |
| 路径解析 | 缩短路径、`[N]` 序号、`drafts/` 自动定位 `artifacts/**` |
| 弹窗与右栏对齐 | 统一 `ProjectFilePreview` 管线 |
| 前往任务文件夹 | 右栏展开目录并高亮主成果 |
| 温和容错 | 最多 5 次 recovery；用户只见淡灰弱提示 |

---

## 6. 媒体与文档合成

- **生图 / 生视频**：通义、火山、Google Imagen/Veo 等
- **文档导出**：MD/HTML → PDF/DOCX/PPTX
- **多图合成 PDF/PPTX**；OCR 可编辑 PPT（MinerU + 降级）
- **Open Design**：150 套设计系统，官网落地页取图规范

---

## 7. SaaS 平台能力（企业版）

| 模块 | 功能 |
|------|------|
| 认证 | 注册登录、图形验证码、JWT |
| 租户 | 每用户独立 `tenant-*`、项目与云端文件隔离 |
| 后台 | 访问/用户/运营/订阅/AI 用量五大盘 |
| 存储 | 全云端 `cloud-storage` 枢纽，无本地绑定 |
| 管控 | 模型池/MCP/权限在平台侧；租户用分配的能力与模板 |

---

## 8. 单机版保留能力

- 完整 FilesV2 本地编辑
- ProjectCreationWizard 浏览本地目录
- 适合个人开发者与高敏本地场景

详见 [单机版与 SaaS 版对照](单机版与SaaS版对照.md)。

---

## 相关文档

- `docs/capabilities-hub-taxonomy.md`
- `docs/process-templates-catalog.zh-CN.md`
- `docs/cloud-file-storage-design.md`
