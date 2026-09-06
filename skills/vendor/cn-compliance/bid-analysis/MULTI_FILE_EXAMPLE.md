# 多文件分析示例

## 场景描述

政府采购项目通常包含多个文件：

```
投标资料/
├── 磋商文件.docx           # 主文件（评分标准、流程要求）
├── 技术规范.xlsx           # Excel（详细参数表）
├── 报价清单.xlsx           # Excel（分项报价模板）
├── 合同模板.docx           # Word（合同条款）
└── 招标公告.pdf            # PDF（项目概况）
```

## 使用步骤

### 第1步：预处理所有文件

```bash
cd /path/to/投标资料

# 1. 解析 Excel 附件
python .claude/skills/bid-analysis/scripts/parse_excel.py 技术规范.xlsx --format both
python .claude/skills/bid-analysis/scripts/parse_excel.py 报价清单.xlsx --format both

# 输出：
# - 技术规范_data.json / 技术规范_data.md
# - 报价清单_data.json / 报价清单_data.md

# 2. 如有 PDF，运行 PDF 预处理
python .claude/skills/bid-analysis/scripts/parse_pdf.py 招标公告.pdf --output pdf_pages.json
python .claude/skills/bid-analysis/scripts/extract_pdf_toc.py 招标公告.pdf --pages-json pdf_pages.json --output pdf_toc.json

# 3. 如有扫描 PDF 且配置了 OCR
python .claude/skills/bid-analysis/scripts/ocr_pages.py 招标公告.pdf --pages 1-20 --output pdf_ocr.json
```

### 第2步：读取所有文件

#### 2.1 读取主文件（磋商文件）

```python
from docx import Document

doc = Document('磋商文件.docx')

# 提取文本和表格
for para in doc.paragraphs:
    if para.text.strip():
        print(para.text)

for table in doc.tables:
    # 提取评分标准表
    for row in table.rows:
        cells = [cell.text.strip() for cell in row.cells]
        print(cells)
```

#### 2.2 读取 Excel 附件（Markdown 格式）

```bash
# 使用 Read tool 读取生成的 Markdown
Read 技术规范_data.md
Read 报价清单_data.md
```

输出示例：

```markdown
## 工作表: 技术规范

| 序号 | 参数名称 | 技术要求 | 备注 |
|------|----------|----------|------|
| 1 | CPU | ≥8核 | ▲ |
| 2 | 内存 | ≥32GB |  |
| 3 | 硬盘 | ≥1TB SSD | ▲ |
```

#### 2.3 读取其他附件

```python
# 合同模板（Word）
contract_doc = Document('合同模板.docx')

# 招标公告（PDF，使用预处理结果）
import json
with open('pdf_pages.json') as f:
    pdf_data = json.load(f)
    for page in pdf_data['pages']:
        print(page['text'])
```

### 第3步：提取和合并信息

按以下优先级合并：

1. **主文件（磋商文件.docx）**：
   - 评分标准（权威来源）
   - 响应文件格式要求
   - 商务条件概述

2. **Excel 技术规范**：
   - 详细技术参数表（逐行提取）
   - 功能对比表

3. **Excel 报价清单**：
   - 分项名称、数量、单位
   - 预算参考

4. **合同模板**：
   - 付款条款（具体比例）
   - 质保期、维护期

5. **招标公告**：
   - 项目概况（补充信息）

### 第4步：输出分析报告

标注每条信息的来源：

```markdown
## 技术需求

### 技术参数清单

| 序号 | 参数名称 | 技术要求 | 备注 | 来源 |
|------|----------|----------|------|------|
| 1 | CPU | ≥8核 | ▲ | 技术规范.xlsx |
| 2 | 内存 | ≥32GB |  | 技术规范.xlsx |
| 3 | 硬盘 | ≥1TB SSD | ▲ | 技术规范.xlsx |

## 商务要求

- **付款方式**：合同签订后支付30%，验收通过后支付60%，质保期满支付10%（来源：合同模板.docx 第8条）
- **交付期**：合同签订后90日内（来源：磋商文件.docx 第3.2节）
- **质保期**：验收合格后2年（来源：合同模板.docx 第12条）
```

## 常见问题

### Q1：Excel 和主文件的评分标准不一致怎么办？

**答**：以主文件（磋商文件）为准，标注冲突：

```markdown
## 评分标准
| 评审因素 | 分值 | 来源 | 备注 |
|----------|------|------|------|
| 技术方案 | 60分 | 磋商文件.docx | Excel中为65分，存在冲突，以磋商文件为准 |
```

### Q2：Excel 表格很大（1000+行）如何处理？

**答**：`parse_excel.py` 的 Markdown 输出默认只显示前100行，但 JSON 包含完整数据。如需完整提取：

```bash
# 方法1：读取 JSON（程序化处理）
Read 技术规范_data.json

# 方法2：分批读取 Excel
Read 技术规范.xlsx  # Claude 可以直接读取 Excel
```

### Q3：如何识别文件的作用？

**答**：根据文件名和内容判断：

| 文件名关键词 | 文件类型 | 用途 |
|--------------|----------|------|
| 磋商文件、招标文件、采购文件 | 主文件 | 评分标准、流程 |
| 技术规范、参数表、功能清单 | Excel/Word | 详细参数 |
| 报价清单、预算清单 | Excel | 分项报价 |
| 合同模板、合同草案 | Word | 付款、质保 |
| 招标公告、采购公告 | PDF/Word | 项目概况 |

### Q4：必须预处理吗？

**答**：不是必须，但强烈推荐：

- **Excel**：预处理生成 Markdown，LLM 更容易理解表格结构
- **PDF**：预处理提取 TOC，避免读取整个 PDF
- **直接读取**：Claude 也可以直接读取 Excel/PDF，但效率较低

## 完整工作流示例

```bash
#!/bin/bash
# 多文件分析脚本

WORK_DIR="投标资料"
cd "$WORK_DIR"

echo "=== 1. 预处理 Excel 文件 ==="
for excel in *.xlsx *.xls; do
    [ -f "$excel" ] || continue
    echo "Processing $excel..."
    python ~/.claude/skills/bid-analysis/scripts/parse_excel.py "$excel" --format both
done

echo "=== 2. 预处理 PDF 文件 ==="
for pdf in *.pdf; do
    [ -f "$pdf" ] || continue
    echo "Processing $pdf..."
    python ~/.claude/skills/bid-analysis/scripts/parse_pdf.py "$pdf" --output "${pdf%.pdf}_pages.json"
    python ~/.claude/skills/bid-analysis/scripts/extract_pdf_toc.py "$pdf" \
        --pages-json "${pdf%.pdf}_pages.json" \
        --output "${pdf%.pdf}_toc.json"
done

echo "=== 3. 列出所有文件 ==="
ls -lh

echo "=== 4. 启动 Claude Code 进行分析 ==="
echo "请使用 /bid-analysis 分析所有文件"
```

## 实际案例

某智慧医院项目投标资料：

```
智慧护理项目/
├── 磋商文件.docx              ✅ 主文件
├── 技术规范表.xlsx            ✅ 400行参数表
├── 功能清单.xlsx              ✅ 150个功能点
├── 报价清单模板.xlsx          ✅ 50个分项
├── 合同模板.docx              ✅ 付款条款
└── 采购公告.pdf               ✅ 项目背景
```

**分析结果**：
- 主文件提取：评分标准（技术60+商务30+价格10）
- Excel提取：技术参数400条、功能清单150条、报价分项50条
- 合同提取：付款比例（30%+60%+10%）、质保期2年
- 汇总生成：完整的`分析报告.md`，所有信息标注来源

**用时**：
- 预处理：~2分钟（Excel解析快）
- 分析：~5分钟（多文件读取）
- 总计：~7分钟（人工需要2-3小时）

## 注意事项

1. **文件编码**：确保 Excel/Word 使用 UTF-8 或 GBK 编码
2. **文件路径**：避免文件名包含特殊字符
3. **工作表名称**：Excel 工作表名称最好使用中文描述性名称
4. **表格格式**：第一行应为表头，后续为数据行
5. **数据一致性**：多文件出现冲突时，以主文件为准

## 版本兼容性

- **Excel**：支持 .xlsx, .xlsm（需要 openpyxl 3.0+）
- **Word**：支持 .docx（需要 python-docx）
- **PDF**：支持文本型和扫描型 PDF（需要 pdfplumber + OCR 服务）
