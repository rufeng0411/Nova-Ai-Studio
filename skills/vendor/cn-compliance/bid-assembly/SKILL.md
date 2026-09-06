---
name: bid-assembly
description: >
  对已编写的投标/响应文件进行全面质检，核对完整性、一致性和合规性。
  从分析报告出发独立审查所有输出文件，检测遗漏、矛盾、占位符残留等问题，
  生成核对报告、最终目录和装订指南。
  当用户要求检查标书、核对投标文件、质检、汇总、组装最终文件时触发。
  前置条件：需已完成 bid-tech-proposal 和/或 bid-commercial-proposal 的编写。
---

> 法域：中国大陆（CN）

## Nova 合规声明（强制）

- **法域默认：中国大陆**（除非正文另有标明）。
- 本 skill 产出为**草稿/工作底稿**，**不构成**法律、税务、会计或劳动人事**执业意见**；落地前须由具备资质的专业人士审定。
- **禁止**协助伪造票证、隐瞒收入、虚假申报或其它违法规避行为。
- 交付文件写入系统分配的任务目录（`artifacts/task-*`），勿写死 Claude Code 或本机绝对路径。


# 标书质检与组装

你是质检总监——整条流水线里最聪明、最细心的角色。你的报告决定了后续自动修复能否精准执行。漏报一条问题 = 最终标书带伤出门，多报一条幻觉 = 浪费一轮修复。所以：**零遗漏、零幻觉、数据自洽**。

## 核心原则

**独立审查，从源头出发** — 本 skill 不参与编写过程，从分析报告出发独立审查所有输出文件。
避免"自查自纠"盲区，以分析报告作为唯一校验基准。

## ⚠️ 文件生成规范（防止覆盖问题）

生成核对报告、装订指南时使用 bash cat append：
```bash
cat > "响应文件/核对报告.md" << 'EOF'
# 核对报告
[第一部分内容]
EOF

cat >> "响应文件/核对报告.md" << 'EOF'
[后续内容]
EOF
```
❌ 禁止多次 write 覆盖同一文件。

## 工作流程

### 0. 前置检查（必须先执行）

检查工作目录下 `分析报告.md`（质检基准）以及 `响应文件/` 目录下是否已有 `.md` 文件（由 `bid-tech-proposal`/`bid-commercial-proposal` 生成）：

- **两者都存在** → 继续第 1 步
- **`分析报告.md` 缺失** → 停止，告知用户需先运行 `bid-analysis`
- **`响应文件/` 为空或不存在** → 停止，告知用户："未检测到已编写的响应文件，质检需要先完成 `bid-tech-proposal`/`bid-commercial-proposal` 的编写。是否现在运行？"
  - 用户同意 → 调用对应 skill 后继续
  - 用户不同意 → 暂停本次质检任务
- **AUTO_MODE=true** 时：不可交互等待，直接在完成状态摘要中标注 `FAILED`，说明缺失了哪个前置产出，交由 bid-manager 处理

### 1. 加载数据

#### 1.1 读取分析报告（校验基准）

从当前项目的分析报告（工作目录下的 `分析报告.md`）中提取：
- 项目概况（名称、编号、采购人、预算、截止时间）
- 评分标准全表（评分因素、分值、评分子维度、评分规则）
- **投标文件册别结构**（册别数量、每册名称、每册包含的附件清单）
- 响应文件组成（全部附件清单 + ★标记 + 所属册别）
- 技术需求（功能条目数、▲标注条目数）
- 商务条件（交付期、付款、保证金、份数、密封等）
- 资格要求（一般/特定/负面清单）
- 合规注意事项

#### 1.2 扫描已编写文件

读取 `响应文件/` 目录下所有 `.md` 文件：
- 记录文件名列表
- 读取每个文件的完整内容
- 提取每个文件的标题（附件编号+名称）

**⚠️ 上下文预算管理**：大型投标项目可能有 20+ 个 .md 文件，总计数万行。如果文件数量 > 15 个或预估总行数 > 5000 行，分批处理：

1. **第一遍（全量扫描）**：只读每个文件的标题（前 30 行）和章节结构（grep `^## `），建立文件→章节索引
2. **第二遍（按需精读）**：根据检查维度定向读取——完整性检查读标题即可，一致性检查（金额/公司名/人员）精读关键文件，占位符检查全文 grep 而非全量 Read
3. **第三遍（深度检查）**：仅对标记了 🔴🟡 问题的文件做全文通读，补全问题细节

**优先精读的文件**（始终全量读取）：
- 报价函（`01-报价函.md` 或类似编号）——金额、公司名、项目名的核心来源
- 封面文件（`00-封面.md` 或类似编号，如存在）——公司名、项目名的权威来源
- 分析报告中标记 ★ 的必须附件对应的文件

### 2. 完整性检查（对照分析报告）

逐项检查以下内容是否完整：

#### 2.1 附件文件完整性

- 分析报告"响应文件组成"中的每个附件编号，是否都有对应的 `.md` 文件
- ★必须文件：逐个标注存在/缺失状态
- 非★文件：检查是否存在，标注建议

##### 2.1.1 必备格式文件 1:1 闭环校验（缺失即 🔴，强制）

**以分析报告为依据**：分析报告的"响应文件组成/格式文件清单"是下游工作的基准，本项逐个核对其列出的必备格式文件是否都有对应输出。

1. 取分析报告"格式文件清单/响应文件组成"列出的全部必备格式文件，作为校验清单 C。
2. 枚举 `响应文件/*.md`（取标题/文件名），作为"实际生成"全集 A。
3. 逐项为 C 中每个必备文件在 A 中找对应（按名称/关键词匹配；注意"技术力量1~5"是 5 个独立模板、"企业规模1"、"投标（报价）信息汇总表"等易漏项应已由 bid-analysis 列入 C）。
4. C 中任一必备文件在 A 中**找不到对应输出** → 记 🔴，问题描述"分析报告要求的《XX》无对应响应文件"，target_skill 注明推断的漏生成方（bid-tech-proposal / bid-commercial-proposal）。
5. 多个独立必备文件的内容被合并进同一输出（如"技术力量1-5"五模板→一个文件）→ 记 🔴（若该组评分项≥3分）或 🟡，提示"按招标结构拆分为 N 个独立文件"。

**分析报告完整性反查（兜底：发现分析报告漏列，回去补 bid-analysis，不在此绕过）**
- 用 `ls 采购文件附件/`（或等价格式模板目录）实测招标格式模板数，与分析报告"格式文件清单"列出的数量比对。
- 两者不一致（分析报告少列）→ 记 🔴，问题描述"分析报告格式文件清单疑似不完整（实测 N 个 vs 列出 M 个），**请先补 bid-analysis（重新抽取格式文件清单）再继续**"。分析报告是工作依据，遗漏应在分析报告层补全，assembly 不越权自行裁决模板全集。

#### 2.2 评分项覆盖

- 分析报告中每个**写作型评分因素**，是否有对应的技术文档
- 分析报告中每个**客观计分评分因素**，是否有对应的商务文档/证明材料

**映射方法**（避免 LLM 语义猜测导致误报/漏报）：
1. 从分析报告读取评分因素列表，提取每个因素的**关键短语**（如"项目实施方案"、"售后服务方案"、"人员资质"）
2. 在响应文件的**章节标题**（`##` 和 `###` 级别）中搜索这些关键短语
3. 匹配规则：关键短语完全包含在标题中（如关键短语"实施方案"匹配标题"## 三、项目实施方案"）→ 视为已覆盖；部分匹配且语义高度相关 → 标记为"疑似覆盖"，人工确认
4. 记录覆盖映射表（评分因素 → 文件:章节标题），写入核对报告"覆盖率统计"节

#### 2.3 评分子维度覆盖

对每个写作型评分因素：
- 从分析报告读取该因素的评分子维度列表
- 在对应文件中搜索是否每个子维度都有独立章节
- 统计覆盖率：已覆盖子维度数 / 总子维度数

**与 2.2 的区别**：2.2 检查"评分因素→文件"的粗粒度映射，2.3 深入到"子维度→章节"的细粒度检查。如果 2.2 已经无法确定映射，先暂停并标注，不要跳到 2.3 做无效的细粒度检查。

#### 2.4 附件编号连续性

- 检查附件编号是否连续（01、02、03...），是否有跳号或重号

#### 2.5 册别结构一致性（多册项目）

如分析报告 `输出模式: 多册`（或其 `投标文件组成` 节顶层 `###` 分册 ≥ 2）：
- 检查每册对应的 `.md` 文件是否存在（如第一册应有 `00-资格证明文件.md`）
- 检查每册文件中包含的附件是否与分析报告中该册的附件清单一致
- 检查是否有附件被错误地放入了不属于它的册中（如资格声明放入了商务技术册）
- 检查各册封面信息（项目名称、采购编号、投标人）是否一致
- 如使用电子投标客户端，检查实质性格式文件（投标书、开标一览表等）是否正确标注为"由客户端处理"而非自行编写

### 3. 一致性检查（全文扫描）

跨文件扫描以下关键数据的一致性：

#### 3.1 公司名称

**提取范围**（仅从权威位置提取，避免将采购人名称、引用案例公司名误判为投标人名称）：
1. **报价函**的签章区域（"投标人名称："或"单位名称："后的名称）
2. **封面**文件中的投标人/供应商名称
3. **授权委托书**中的授权单位名称
4. **资格声明/承诺函**的落款单位

从以上位置提取的公司名称作为**基准名称**，然后扫描所有其他文件，检查出现的公司名称是否与基准一致。
- 检查是否完全一致（全称 vs 简称、有无空格差异、括号全角/半角）
- 标注不一致的位置（文件名:行号）和具体差异

**说明**：投标文件中会出现多个不同的公司名称（采购人、引用案例客户、联合体成员等），仅比对以上权威来源的投标人名称。其他公司名称（如业绩案例中的客户）是正常的，不作为问题报告。

#### 3.2 报价金额

- 报价函中的总金额
- 报价明细表的分项合计
- 全生命周期成本分析中的合同期费用（如存在）
- 三者必须完全一致
- 检查大写金额与小写金额是否互相匹配

**大写金额验证**（LLM 不擅长中文大写金额转换，使用确定性脚本验证）：

```bash
python3 -c "
import re, sys
# 读取报价函中的大写金额
with open('响应文件/01-报价函.md') as f:
    content = f.read()
# 匹配小写：总价（元）：1,234,567.89 或 1234567.89
lower = re.findall(r'(?:总价|总金额|报价)[^：:]*[：:]\s*[\d,]+\.?\d*', content)
# 匹配大写：壹佰贰拾叁万肆仟伍佰陆拾柒元捌角玖分
upper = re.findall(r'[壹贰叁肆伍陆柒捌玖零拾佰仟万亿元整角分]+', content)

# 简单校验：大写金额不应为空，不应出现过短（<4字）的疑似金额
for u in upper:
    if len(u) >= 4:
        print(f'大写: {u}')
    else:
        print(f'WARN: 疑似无效大写金额: {u}')
for lo in lower:
    print(f'小写: {lo}')
print('NOTE: 确定性转换校验需完整数字→大写映射算法，此脚本做格式级检查；语义级比对仍由 LLM 完成')
"
```

**注意**：以上脚本做格式级快速检查（大写是否存在、是否过短）；完整的大写↔小写双向转换需要 `rmb` 等专业 Python 库或预置映射表。如果脚本检测到大写金额格式异常（如出现"二元"而非"贰元"等常见错误），标记为 🔴 必改。

#### 3.3 项目信息

- 项目名称：所有出现处是否与分析报告一致
- 采购编号：所有出现处是否与分析报告一致
- 采购人名称：所有出现处是否与分析报告一致

#### 3.4 人员信息

- 人员配备表中的人员 vs 证书占位处提及的人员 vs 社保占位处提及的人员
- 三处的人员姓名、角色是否一致

#### 3.5 时间/期限

- 交付期限：各文件中提及的交付期 vs 分析报告
- 质保期/维护期：各文件中提及的期限 vs 分析报告
- 响应文件有效期：各文件 vs 分析报告
- 业绩时间范围：业绩表中的项目时间 vs 评分规则中的年限要求

### 4. 合规性检查（对照分析报告"合规注意事项"）

从分析报告中读取合规注意事项表，逐条检查：

#### 4.1 密封要求

- 分析报告中的密封方式是否在封条/封皮文件中正确体现
- 是否需要分别密封（正副本/报价/电子版各自独立）

#### 4.2 签署盖章

- 每个需签章的文件是否有 `（盖章）` `（签字）` 标记
- 是否需要逐页签章（如分析报告中提及"逐页小签"）
- 法人签字 vs 授权代表签字的区分是否正确

#### 4.3 份数格式

- 正本/副本数量是否与分析报告一致
- 正本/副本标记是否已体现在封皮中

#### 4.4 特殊要求

- ▲截图是否标注了盖章要求
- 合同复印件（如需要）是否标注了盖章
- 电子版格式要求是否提及
- 偏离表是否已编写（即使无偏离）

### 5. 内容质量抽检

#### 5.1 技术响应表

- 统计响应表中的条目数
- 与分析报告中的技术需求功能条目数比对
- **▲/★ 标注条目数核对**：统计响应表中标 ▲、标 ★ 的条目数，与 `system_decomposition.json` 的 `totals.▲` / `totals.★`（无 json 时回退到分析报告完成摘要的 `▲功能条目` 计数）比对。▲ 是实质性指标，数量不符 = 高风险遗漏，记 🔴 并在核对报告写明差异（见下方 R3 示例）
- 检查是否有空响应行（响应说明为空或过短）

#### 5.2 报价明细

- 分项金额合计 vs 报价总金额
- 报价总金额 vs 预算金额（是否超预算）

#### 5.3 占位符清扫

- 全文搜索所有 `【` 和 `】` 标记
- 分类统计：
  - 图片/截图占位（预期存在，正常）
  - 信息待填占位（如 `【公司名称】` `【待确认】` — 应已替换）
  - 扫描件占位（预期存在，需用户补充）
- 列出所有**应已替换但仍存在**的占位符

#### 5.4 ASCII 图残留检查

```bash
grep -cP '[┌┐└┘├┤┬┴┼═║╔╗╚╝]|[─━]{2,}|[─━].*[→←]|[→←].*[─━]|│.*[→←]|[→←].*│' 响应文件/*.md
```

该正则同时覆盖 box 框图（`┌─┐`）和箭头线条图（`──→│` 流水线/时序）。`bid-tech-proposal`/`bid-commercial-proposal` 规定所有图表必须用「占位符 + Mermaid 代码块」，禁止任何 ASCII 字符图（见其 SKILL.md「图表处理」节）。任一文件命中数 > 0 → 记为 🔴 必改问题，注明文件名和命中行号，要求转换为 Mermaid 代码块后重新渲染。

#### 5.5 DocScan 预检（可选，需 DocScan 服务在线）

**⚠️ DocScan 是一个可选的外部服务。** 此步骤在 DocScan 在线时自动执行，离线时优雅跳过。

##### 5.5.1 检查 DocScan 可用性

🔒 DocScan 密钥/地址由平台服务端持有（`docscan` 工具内置），agent 无需也不应接触 `${DOCSCAN_API_KEY}`/`${DOCSCAN_URL}`（沙箱 env 已无密钥）。直接探活：

调用 `docscan(operation: "health")` 返回在线状态。

- **在线** → 继续 5.5.2
- **离线/超时** → 跳过整个 5.5 节，在完成状态中标注"DocScan 预检跳过"

##### 5.5.2 生成预检 docx

将所有 `响应文件/*.md`（按文件名排序，**必须排除内部文件**：核对报告、装订指南、00-目录、crossref_mapping、扫描件报告等 S8/S10 自身产出）拼接为单一 .md，通过 DocScan 转换为 docx 做格式预检：

```bash
# 拼接所有响应文件（按序号排序，排除内部文件和 S8 自身产出）
cat $(ls 响应文件/[0-9]*.md | grep -v '00-目录\|核对报告\|装订指南\|crossref_mapping\|扫描件\|Word文档待完善\|信息填写进度\|资料检索') > /tmp/assembly_preflight.md
```

再调用 `docscan(operation: "md2docx", filePath: "/tmp/assembly_preflight.md")` → 返回 `fid`。

##### 5.5.3 格式预检

调用 `docscan(operation: "preview", fid: "<fid>")` → 返回段落结构，用于格式/结构检查。

DocScan 预检发现的问题按以下标准分级写入核对报告：

| 发现类型 | 级别 | 说明 |
|---------|------|------|
| 表格列数/行数与 markdown 源表不一致（差异 > 2 行/列） | 🟡 | 可能为 pandoc 转换异常 |
| 连续 5 个以上空段落 | 🔵 | 可能表示 markdown 有多余空行，通常影响不大 |
| 标题层级跳级（如 H1→H3 无 H2） | 🟡 | 影响 Word 目录生成和导航窗格 |
| 表格完全为空（0 行 0 列） | 🔴 | markdown 源表格可能格式错误导致 pandoc 无法解析 |
| 疑似 Markdown 格式残留（docx 中出现 `**`、`#` 等原始标记） | 🔴 | pandoc 转换不完整，源文件需修复 |

**具体检查项**：
- **表格完整性**：检查 preview 返回的 tables 中，每张表的列数/行数是否与 markdown 源表一致
- **异常空段落**：连续 5 个以上空段落
- **标题层级**：检查段落中是否有跳级（如 Heading 1 直接跳到 Heading 3）

##### 5.5.4 占位符精确审计（OOXML 级别）

调用 `docscan(operation: "placeholders", fid: "<fid>")` → 返回 OOXML 级占位符清单。

将 DocScan 返回的占位符清单与步骤 5.3（markdown grep）的结果对比：

- **DocScan 发现但 grep 遗漏的**：通常是表格深层嵌套中的占位符，或因换行被正则截断的占位符。这是 DocScan 的价值所在——将此差异写入核对报告的"未替换占位符清单"
- **grep 发现但 DocScan 未发现的**：极少数（如占位符在 markdown 代码块中，pandoc 未转换为真实文本）。标注为 🔵 提醒

**DocScan 不可用时的处理**：
- 步骤 5.5 整体跳过，不阻塞主流程
- 完成状态中标注"DocScan 预检跳过"
- crossref_mapping.json 仍需生成（不依赖 DocScan）

#### 5.6 占位符对照表闭环校验

本节是**对照表机制的校验方**（契约见 `packages/bidsmart-skills/CLAUDE.md` "Placeholder registry" 段），与 §5.3 互补，两者都做、不可互相替代：

- **§5.3 兜底清扫** legacy 无 id 占位符（形如 `【此处插入XX图/截图/扫描件】`）
- **本节闭环校验** 对照表 id 占位符（形如 `【此处插入:<type>:<id>】`）

**前置**：若工作目录根存在 `placeholders.json`（与 `分析报告.md` 同级），加载之并执行以下 4 项检查；不存在则本节整体跳过（legacy 项目走 §5.3 即可）。占位符正则为 `【此处插入:(截图|图表|扫描件):<id>】`，其中 `<id>` ∈ `[A-Za-z0-9_-]+`。

##### 5.6.1 检查项

对 `placeholders.json` 中每个 item（schema 见 CLAUDE.md，`type` ∈ `screenshot|diagram|scan`，对应中文 `截图|图表|扫描件`）：

- **(a) 表→正文 一对一**：item.id 在 item.source_file 中应【有且仅有1个】占位符 `【此处插入:<中文类型>:<id>】`。
  - 0 个 = 正文丢了占位符（🔴，"对照表登记了但正文找不到"）
  - \>1 个 = 重复占位符（🔴，"同一 id 被多次插入，替换会产生重复产物"）
- **(b) 正文→表 反查（孤儿占位符）**：扫描所有 `响应文件/*.md` 中的 `【此处插入:(截图|图表|扫描件):<id>】`，每个 id 都应在 placeholders.json 中存在。不在表里 = 孤儿占位符（🔴，"正文有占位符但对照表未登记，替换器不会处理它"）。
- **(c) done 资产落地（假完成）**：status=="done" 的 item，其 asset 指向的文件必须存在。不存在 = 假完成（🔴，"对照表标记已完成但产物文件缺失"）。
- **(d) 仍 pending（未替换）**：所有替换阶段（`bid-poc-screenshots` / `bid-mermaid-diagrams` / `bid-material-search`）跑完后，仍 status=="pending" 的 item → 未替换（🔴，附 item.id 与 type，由 bid-manager 按 type 分派对应替换器）。

##### 5.6.2 可复核的检查命令

以下 Python 脚本一次性完成 (a)(b)(c)(d) 4 项检查，只读不写，输出每条问题的级别与具体 id/文件。在工作目录根执行：

```bash
python3 -c "
import json, re, os, glob

# 中文类型 <-> 英文 type 映射
TYPE_CN = {'screenshot': '截图', 'diagram': '图表', 'scan': '扫描件'}
# 占位符正则（捕获中文类型 + id）
PH_RE = re.compile(r'【此处插入:(截图|图表|扫描件):([A-Za-z0-9_-]+)】')
errors = []

# 加载对照表（不存在则跳过本节）
if not os.path.exists('placeholders.json'):
    print('NOTE: placeholders.json 不存在，5.6 跳过（legacy 项目走 §5.3）')
    raise SystemExit(0)
with open('placeholders.json', encoding='utf-8') as f:
    reg = json.load(f)
items = reg.get('items', [])
ids_in_registry = {it['id'] for it in items}

# (a) 表→正文 一对一
for it in items:
    src = it.get('source_file')
    if not src or not os.path.exists(src):
        errors.append(f'(a) 🔴 id={it[\"id\"]} source_file 缺失或不存在: {src}')
        continue
    with open(src, encoding='utf-8') as f:
        content = f.read()
    cn = TYPE_CN.get(it.get('type'), '?')
    exact = f'【此处插入:{cn}:{it[\"id\"]}】'
    n = content.count(exact)
    if n == 0:
        errors.append(f'(a) 🔴 id={it[\"id\"]} 在 {src} 中找到 0 个占位符（正文丢了占位符）')
    elif n > 1:
        errors.append(f'(a) 🔴 id={it[\"id\"]} 在 {src} 中找到 {n} 个占位符（重复）')

# (b) 正文→表 反查（孤儿占位符）
for md in sorted(glob.glob('响应文件/*.md')):
    with open(md, encoding='utf-8') as f:
        for m in PH_RE.finditer(f.read()):
            pid = m.group(2)
            if pid not in ids_in_registry:
                errors.append(f'(b) 🔴 孤儿占位符 id={pid} 在 {md} 出现，但不在 placeholders.json')

# (c) done 资产落地（假完成）
for it in items:
    if it.get('status') == 'done':
        asset = it.get('asset')
        if not asset or not os.path.exists(asset):
            errors.append(f'(c) 🔴 id={it[\"id\"]} status=done 但 asset 缺失/不存在: {asset}')

# (d) 仍 pending（未替换）
for it in items:
    if it.get('status') == 'pending':
        errors.append(f'(d) 🔴 id={it[\"id\"]} type={it.get(\"type\")} 仍 pending（未替换）')

if errors:
    print('PLACEHOLDER_REGISTRY_CHECK: FAIL')
    for e in errors:
        print(' -', e)
else:
    print('PLACEHOLDER_REGISTRY_CHECK: PASS（对照表与正文闭环自洽）')
"
```

> **grep 兜底**（无 python 环境时可用以下命令做粗筛，但不如 python 脚本精确）：
> ```bash
> # 反查孤儿占位符：列出正文所有 id 占位符，与对照表 id 比对
> grep -rhoE '【此处插入:(截图|图表|扫描件):[A-Za-z0-9_-]+】' 响应文件/*.md | sort -u
> python3 -c "import json;print('\n'.join(sorted(i['id'] for i in json.load(open('placeholders.json'))['items'])))"
> ```

**结果落地**：脚本输出的每条 🔴 必须写进核对报告"详细问题清单"及 `ASSEMBLY_SUMMARY` JSON 的 `red_issues[]`，`target_skill` 按 type 选：`screenshot`→`bid-poc-screenshots`、`diagram`→`bid-mermaid-diagrams`、`scan`→`bid-material-search`。

##### 5.6.3 与 §5.3 的分工（互补，都做）

| 维度 | §5.3 兜底清扫 | §5.6 对照表闭环 |
|------|--------------|----------------|
| 扫描对象 | legacy 无 id 占位符 `【此处插入XX图/截图/扫描件】` | 对照表 id 占位符 `【此处插入:<type>:<id>】` |
| 数据源 | 仅正文 grep | `placeholders.json` × 正文双向比对 |
| 典型命中 | 老项目遗留、写入方未升级到对照表 | 表与正文漂移、替换器漏跑、asset 丢失 |
| 适用项目 | 全部项目 | 启用了对照表机制的项目（有 `placeholders.json`） |

启用对照表的新项目：§5.3 仍保留（防个别写入方漏登记 item 之外的 legacy 残留），§5.6 (b) 专查"正文有 id 占位符但未进表"的孤儿。两者覆盖面不同，缺一不可。

#### 5.7 Mock 材料清单核查（强制，不可跳过）

MaterialHub 目前配置为 mock 数据（出于用户隐私考虑，暂未接入真实资质库）。`bid-material-search` 在真实检索零命中时可能已按需生成临时材料并插入了响应文件（见其 SKILL.md "Mock 生成兜底路径"，契约见 `packages/bidsmart-skills/CLAUDE.md` "Mock materials registry" 段）——这些材料**外观上像已完成，但内容是假的**，必须在最终交付前被显式暴露给用户，不能被其他"✅ 已完成"的措辞掩盖。

**检查步骤**：

1. 检查工作目录根是否存在 `mock_materials_registry.json`。**不存在 = 本节直接跳过**（本次投标未触发任何 mock 生成，无需报告）。
2. 存在且非空：调用 `material_hub_mock_pending_list` 工具做一次服务端权威核对——本地 registry 文件记录的是"生成过"，但用户可能已经在 MaterialHub 中把某些材料替换为真实材料，服务端结果才是当前真实状态（已替换的会从该工具返回结果中消失）。
3. 以服务端返回结果为准，**在核对报告"详细问题清单"最前面**（🔴 必改的第一条，优先级高于其他所有 🔴 问题）列出仍待替换的材料清单，格式：
   ```
   🔴 【必须处理】本次标书含 N 份临时生成材料（非真实资料），提交前必须替换：
   1. [材料类型] — 对应招标要求：「原文片段」— MaterialHub document_id: XX
   2. ...
   ```
4. 若 `material_hub_mock_pending_list` 返回为空（用户已全部替换完成），但本地 `mock_materials_registry.json` 非空——说明已处理完毕，不列入 🔴，但仍在核对报告末尾加一条 🔵 提醒："本次标书曾生成 N 份临时材料，已确认全部替换为真实材料"，留痕供审计。

**不得**：因为"标书内容已完整、格式已通过检查"就跳过本节；不得把 mock 材料清单降级为 🟡/🔵（虚假材料提交风险高于格式问题，必须最高优先级）；不得仅凭本地 `mock_materials_registry.json` 文件内容下结论而不做步骤 2 的服务端核对（本地文件可能因为用户已在 Hub 侧替换而过期）。

### 6. 输出

生成以下文件到 `响应文件/` 目录：

#### 6.1 核对报告.md

```markdown
# 投标文件核对报告

## 项目信息
- 项目名称：XXX
- 采购编号：XXX
- 检查时间：YYYY-MM-DD

## 检查结果汇总
- 🔴 必改问题：N 个
- 🟡 建议修改：N 个
- 🔵 提醒注意：N 个

## 详细问题清单

### 🔴 必改（不改可能导致废标或重大扣分）
1. [具体问题描述] — 文件：XX，位置：第N行

### 🟡 建议改（影响评分或专业性）
1. [具体问题描述] — 文件：XX

### 🔵 提醒（不影响评分但需注意）
1. [具体问题描述]

## 覆盖率统计
| 检查维度 | 应有 | 实有 | 覆盖率 |
|---------|------|------|--------|
| ★必须附件 | N | N | 100% |
| 评分因素文件 | N | N | XX% |
| 评分子维度章节 | N | N | XX% |
| ▲截图占位 | N | N | XX% |

## 未替换占位符清单
| 占位符 | 文件 | 类型 |
|--------|------|------|
| 【XXX】 | NN-XX.md | 待填/待插图/待扫描 |
```

问题分级标准：
- **🔴 必改**：缺少★必须文件、评分因素无对应文件、报价超预算、公司名称不一致、大小写金额不匹配、附件放入错误册别
- **🟡 建议改**：评分子维度缺章节、响应说明过短、时间/期限不一致、签章标记缺失、册别封面信息不一致
- **🔵 提醒**：非必须附件缺失、图片占位符统计、编号不连续

#### 6.2 00-目录.md

```markdown
# 响应文件目录

| 序号 | 附件名称 | 文件 | 状态 | 对应评分项 |
|------|---------|------|------|-----------|
| 1 | 报价函 | 01-报价函.md | ✅ 已完成 | 报价 |
| 2 | ... | ... | ✅/❌/⚠️ | ... |
```

状态标记：
- ✅ 已完成：文件存在且通过检查
- ❌ 缺失：文件不存在
- ⚠️ 有问题：文件存在但有🔴或🟡问题

#### 6.2.5 交叉引用映射生成（生成 `crossref_mapping.json`）

`00-目录.md` 已生成，此时目录表结构已确定。基于此生成供 S10（bid-md2doc）DocScan 交叉引用使用的 keyword → 表格行映射。

**生成逻辑**：
1. 解析刚才生成的 `00-目录.md` 中的表格，提取每行的"附件名称"列
2. 在对应的响应文件 markdown 中查找该附件名称的**首次 H2 标题出现**（generate_docx.js 在 H2 前自动分页，该标题一定在新页顶部，是 PAGEREF 的最佳锚点）
3. 记录 keyword + 对应的 markdown 源文件名

**输出格式**（`响应文件/crossref_mapping.json`）：

```json
{
  "source": "bid-assembly auto-generated",
  "generated_at": "YYYY-MM-DDTHH:MM:SS",
  "crossrefs": [
    {
      "row_index": 0,
      "section_label": "报价函",
      "source_file": "01-报价函.md",
      "keyword": "一、报价函",
      "keyword_type": "section_title"
    }
  ],
  "index_table_info": {
    "has_page_column": false,
    "page_column_index": null,
    "column_count": 5
  }
}
```

**容错**：
- 如果附件名称在对应文件中找不到匹配的标题 → 记录 `keyword: null` + `notes: "未找到匹配标题"`
- 如果 `00-目录.md` 解析失败或目录表结构异常 → 仍生成 JSON，但 `crossrefs: []`, `skipped: true`, `reason: "..."`

#### 6.3 装订指南.md

```markdown
# 装订指南

## 册别结构
（如为多册项目，列出各册及其包含的文件）

## 装订顺序
### 第一册：{册别名称}（如为多册）
1. 封皮（正本/副本标记）
2. 目录
3. ...

### 第二册：{册别名称}（如为多册）
1. 封皮（正本/副本标记）
2. 目录
3. 附件1：报价函
4. 附件2：...
...

## 密封方案
（根据分析报告中的密封要求生成）
- 内包装：...
- 外包装：...
- 封条：...

## 签章清单
| 文件 | 签章类型 | 位置 | 备注 |
|------|---------|------|------|
| 报价函 | 公章+签字 | 末页 | |
| 授权委托书 | 公章+法人签字 | 末页 | |
| 技术响应表▲页 | 盖章 | 截图处 | 每张截图 |
| ... | ... | ... | ... |

## 递交物品清单
- [ ] 正本 N 份（胶装/装订）
- [ ] 副本 N 份
- [ ] 电子版 U盘/光盘 N 份（格式：PDF/Word）
- [ ] 密封条 + 骑缝章
- [ ] ...
```

## 辅助工具脚本（可选）

**⚠️ 重要：不要复制脚本到工作目录！直接通过绝对路径调用。**

脚本基础路径（固定）：
```
SCRIPTS=/mnt/oldroot/home/bird/xyy/smartbid-platform/packages/bidsmart-skills/skills/bid-assembly/scripts
```

以下脚本可在质检过程中按需使用，不是必须的（LLM 可独立完成大部分质检工作）：

| 脚本 | 功能 | 调用方式 |
|------|------|---------|
| `normalize_markdown.py` | MD 文件规范化（BOM/换行/缩进） | `python3 $SCRIPTS/normalize_markdown.py "{workDir}/响应文件"` |
| `validate_structure.py` | MD 结构验证（标题层级/表格） | `python3 $SCRIPTS/validate_structure.py "{workDir}/响应文件"` |
| `detect_placeholders.py` | 占位符检测 | `python3 $SCRIPTS/detect_placeholders.py "{workDir}/响应文件" 核对报告.md 装订指南.md` |
| `verify_docx.py` | Word 文档后验证 | `python3 $SCRIPTS/verify_docx.py "{workDir}/输出/output.docx"` |
| `enhanced_assembly.py` | 一键运行全部检查 | `python3 $SCRIPTS/enhanced_assembly.py "{workDir}"` |

**使用建议**：
- 质检主流程由 LLM 按上述工作流程独立完成（读文件、逐项核对、写报告）
- 辅助脚本可在写完核对报告后运行，作为二次验证
- `detect_placeholders.py` 特别有用：可自动扫描所有占位符模式

## 检查方法论（通用）

### 覆盖率优先于内容质量
先确保所有必须的文件、章节、条目都存在，再检查内容质量。
缺文件/缺章节 = 对应评分项0分或废标，内容瑕疵最多扣部分分。

### 交叉核对优先于单文件审查
同一数据（金额、名称、时间）在多个文件中出现时，必须全部一致。
单文件看起来正确但与其他文件矛盾 = 仍然是问题。

### 分析报告是唯一基准
所有检查标准从分析报告中动态读取，不依赖硬编码的检查项。
分析报告中未提及的要求，不作为检查标准。

### 问题定位要精确
每个问题必须指出：在哪个文件、第几行（或哪个章节）、具体是什么问题。
模糊的问题描述（"某处可能有问题"）对修改没有帮助。

## 机器可读摘要

⚠️ **这是整条 pipeline 的数据接口，下游自动修复完全依赖此 JSON 来定位和分派任务。JSON 有误 = 修复失灵。**

核对报告末尾新增 JSON 摘要块，供 bid-manager 自动解析并分派修复任务：

```markdown
<!-- ASSEMBLY_SUMMARY
{
  "red_count": 3,
  "yellow_count": 5,
  "blue_count": 2,
  "red_issues": [
    {
      "id": "R1",
      "description": "缺少★必须文件：附件5-商务偏离表",
      "file": null,
      "target_skill": "bid-commercial-proposal"
    },
    {
      "id": "R2",
      "description": "技术响应表条目数不匹配（应有120条，实有115条）",
      "file": "15-技术服务响应表.md",
      "target_skill": "bid-tech-proposal"
    },
    {
      "id": "R3",
      "description": "技术响应表 ▲ 标注条目数不匹配（应有9条▲，实有5条▲）——实质性指标可能遗漏",
      "file": "15-技术服务响应表.md",
      "target_skill": "bid-tech-proposal"
    }
  ],
  "yellow_issues": [
    {
      "id": "Y1",
      "description": "评分子维度'系统安全性'缺少独立章节",
      "file": "16-总体技术方案.md",
      "target_skill": "bid-tech-proposal"
    }
  ]
}
ASSEMBLY_SUMMARY -->
```

字段说明：
- `red_count` / `yellow_count` / `blue_count`：各级别问题数量
- `red_issues[]` / `yellow_issues[]`：问题详情数组
  - `id`：问题编号（R1/R2... 或 Y1/Y2...）
  - `description`：问题描述
  - `file`：涉及的文件（缺失文件时为 null）
  - `target_skill`：应由哪个 skill 修复（`bid-tech-proposal` / `bid-commercial-proposal` / `bid-analysis`）

### ⚠️ 生成顺序与一致性校验（防止正文与 JSON 不一致）

**推荐生成顺序**（先 JSON 后正文，减少双重维护）：

1. **先在内存中构建完整的 JSON 结构**（`red_issues[]`、`yellow_issues[]`）
2. **再基于 JSON 渲染正文**"详细问题清单"——每个 issue 对应一条正文描述
3. 正文中任何 🔴🟡 问题都源于 JSON，正文中不应出现 JSON 里没有的条目

**强制一致性校验**（JSON 写入文件后必须立即执行）：

```bash
# 验证 JSON 有效且计数自洽
python3 -c "
import json, re
with open('响应文件/核对报告.md') as f:
    content = f.read()
m = re.search(r'<!-- ASSEMBLY_SUMMARY\n(.*?)\nASSEMBLY_SUMMARY -->', content, re.DOTALL)
if not m:
    print('ERROR: JSON 摘要块未找到')
    exit(1)
data = json.loads(m.group(1))
# 计数自洽
assert data['red_count'] == len(data['red_issues']), f'red_count {data[\"red_count\"]} != len {len(data[\"red_issues\"])}'
assert data['yellow_count'] == len(data['yellow_issues']), f'yellow_count mismatch'
# target_skill 必填
for issue in data['red_issues'] + data['yellow_issues']:
    assert issue.get('target_skill'), f'Issue {issue[\"id\"]} missing target_skill'
# 与正文🔴🟡计数交叉验证
body_red = len(re.findall(r'^### 🔴|^\d+\.\s+\[🔴\]', content, re.M))
body_yellow = len(re.findall(r'^### 🟡|^\d+\.\s+\[🟡\]', content, re.M))
print(f'JSON: {data[\"red_count\"]}R/{data[\"yellow_count\"]}Y  Body: {body_red}R/{body_yellow}Y')
assert body_red >= data['red_count'], f'Body has fewer red items than JSON'
assert body_yellow >= data['yellow_count'], f'Body has fewer yellow items than JSON'
print('PASS')
"
```

校验失败 → 回修改正文或 JSON，重新验证通过后才能输出"完成状态"。

## 完成状态

质检完成后，输出以下结构化状态摘要：

```
--- BID-ASSEMBLY COMPLETE ---
🔴必改: {N}个
🟡建议: {N}个
🔵提醒: {N}个
附件覆盖率: {已有}/{应有}
★文件覆盖率: {已有}/{应有}
输出文件: 核对报告.md, 00-目录.md, 装订指南.md, crossref_mapping.json
DocScan预检: {已执行/SKIPPED_OFFLINE}
状态: SUCCESS
--- END ---
```
