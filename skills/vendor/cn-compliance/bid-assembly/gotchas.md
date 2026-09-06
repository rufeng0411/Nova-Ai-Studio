# bid-assembly - Gotchas

这些是从实践中学到的反直觉知识和常见陷阱。

## Gotchas

### 自查自纠盲区：质检时参考编写记忆

**问题**：bid-tech-proposal 编写技术标后立即调用 bid-assembly 质检，质检时 LLM 仍记得刚才"为什么这样写"，导致明显的遗漏或错误未被发现（如缺少必须附件、占位符未替换）。

**解决**：质检必须遵循**独立审查原则**：
1. 仅从分析报告出发，不依赖编写时的上下文
2. 像陌生人一样审查响应文件
3. 逐项核对分析报告中的要求是否在响应文件中体现
4. 使用清单式验证，不凭记忆

**示例**：
```markdown
## 质检流程（独立审查原则）

### 第一步：清空上下文
- 不回顾编写过程中的对话
- 仅加载：分析报告.md + 响应文件/*.md

### 第二步：从要求出发核对
- 分析报告中的每个附件 → 检查响应文件中是否存在
- 分析报告中的每个评分项 → 检查响应文件中是否响应
- 分析报告中的商务条件 → 检查响应文件中是否满足

### 第三步：标注缺失/矛盾
- 🔴 必须项缺失
- 🟡 可选项缺失
- 🔵 已满足但有优化空间
```

*（来自 bidsmart-skills-review.md，注入时间：2026-03-18）*

---

### 占位符检测遗漏非标准格式

**问题**：质检时只搜索 `【此处插入】` 和 `【placeholder】`，但文件中还有 `[插入XX]`、`TODO: 补充XX` 等变体，导致占位符残留未被发现。

**解决**：使用正则表达式匹配多种占位符格式：
```python
import re

PLACEHOLDER_PATTERNS = [
    r'【[^】]*插入[^】]*】',     # 【此处插入XX】
    r'\[插入[^\]]*\]',          # [插入XX]
    r'\[待补充[^\]]*\]',        # [待补充XX]
    r'TODO:?\s*[^\n]{5,50}',   # TODO: 补充XX
    r'TBD:?\s*[^\n]{5,50}',    # TBD: XX
    r'XXX+',                    # XXX、XXXX
    r'___+',                    # ___、____
    r'\{\{[^}]+\}\}',          # {{placeholder}}
]

def detect_all_placeholders(text: str) -> list:
    """检测所有可能的占位符格式"""
    found = []
    for pattern in PLACEHOLDER_PATTERNS:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            found.append({
                'text': match.group(),
                'position': match.start(),
                'pattern': pattern
            })
    return found
```

*（来自实践经验，注入时间：2026-03-18）*

---

### 完整性检查未验证文件编号连续性

**问题**：响应文件目录中应有 01-报价函.md ~ 15-售后服务方案.md 共15个文件，但实际只有14个（缺少 08-），质检时只检查了"是否有文件"，未检查编号是否连续。

**解决**：完整性检查必须验证文件编号连续性：
```python
def check_file_sequence(file_list: list, expected_count: int) -> dict:
    """检查文件编号连续性"""
    # 提取编号
    numbers = []
    for filename in file_list:
        match = re.match(r'(\d+)-', filename)
        if match:
            numbers.append(int(match.group(1)))

    numbers.sort()

    # 检查连续性
    missing = []
    for i in range(1, expected_count + 1):
        if i not in numbers:
            missing.append(i)

    return {
        'total': len(numbers),
        'expected': expected_count,
        'missing': missing,
        'is_complete': len(missing) == 0
    }
```

*（来自 bidsmart-skills-review.md，注入时间：2026-03-18）*

---

### 一致性检查只比对名称未比对具体值

**问题**：报价函中写"报价：230万元"，技术方案中写"项目预算：220万元"，质检时只检查了"都提到了金额"，未发现数值矛盾。

**解决**：一致性检查必须提取具体值并交叉对比：
```python
def cross_validate_key_fields(files: dict) -> list:
    """交叉验证关键字段的一致性"""
    issues = []

    # 提取关键字段
    bid_price_in_quote = extract_amount(files['报价函.md'], field='报价')
    bid_price_in_tech = extract_amount(files['技术方案.md'], field='预算')

    # 对比
    if bid_price_in_quote != bid_price_in_tech:
        issues.append({
            'type': '金额矛盾',
            'file1': '报价函.md',
            'value1': bid_price_in_quote,
            'file2': '技术方案.md',
            'value2': bid_price_in_tech
        })

    return issues
```

*（来自实践经验，注入时间：2026-03-18）*

---

### 核对报告缺少可执行的修复指引

**问题**：核对报告只写 "🔴 缺少业绩证明材料"，但未说明应该在哪个文件补充、补充什么内容、如何满足评分要求，导致修复时仍需重新分析。

**解决**：每个问题必须包含**可执行的修复指引**：
```markdown
## 错误清单

### 🔴 缺少业绩证明材料

**问题描述**：分析报告要求提供"近3年类似业绩2个，每个3分"，但响应文件中未找到 `业绩证明.md` 或相关附件。

**影响**：丢失 6 分（评分占比 6%）

**修复指引**：
1. 在 `响应文件/` 目录下创建 `05-业绩证明.md`
2. 按以下结构编写：
   - 业绩1：项目名称、合同金额、完成时间、客户联系方式
   - 业绩2：同上
3. 每个业绩需附合同扫描件或验收证明
4. 确保业绩与本项目类似（关键词：XX系统、XX行业）

**负责 Skill**：bid-commercial-proposal（修复模式）
```

*（来自 bidsmart-skills-review.md，注入时间：2026-03-18）*
