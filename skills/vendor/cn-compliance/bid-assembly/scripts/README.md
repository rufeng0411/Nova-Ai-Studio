# bid-assembly 增强脚本工具

基于实战经验的质检增强工具集，修复了CRLF换行符等常见问题。

## 工具列表

### 1. normalize_markdown.py
**文件规范化工具**

自动修复Markdown文件的常见格式问题：
- ✅ 统一换行符（CRLF → LF）
- ✅ 移除BOM标记
- ✅ 移除行尾空白
- ✅ 统一缩进（Tab → 4空格）
- ✅ 修复文件末尾换行符

**用法**：
```bash
python normalize_markdown.py 响应文件/
```

**修复的问题**：
- 解决了`generate_docx.js`因CRLF导致标题识别失败的bug
- 修复编码问题（GB18030 → UTF-8）
- 统一代码风格

---

### 2. validate_structure.py
**结构验证工具**

检查Markdown结构性错误：
- ✅ 标题跳级检测（## → #### 直接跳转）
- ✅ 列表项完整性检查
- ✅ 表格列数一致性验证

**用法**：
```bash
python validate_structure.py 响应文件/
```

**检测问题示例**：
```
✗ 行15: 标题跳级：从 ## 直接到 ####
   建议: 建议插入 ### 级标题

⚠ 行42: 列表项只有标题，缺少内容
   - **投标承诺**
   建议: 补充列表项内容，或删除该列表项

✗ 行78: 表格列数不一致：期望4列，实际3列
```

---

### 3. detect_placeholders.py
**增强的占位符检测工具**

检测各种形式的占位符：
- ✅ 【待填写】、【此处插入...】
- ✅ [待补充]、[待确认]
- ✅ TODO、FIXME、XXX
- ✅ ???、<待...>

**用法**：
```bash
python detect_placeholders.py 响应文件/ 核对报告.md 装订指南.md
```

**检测结果示例**：
```
⚠️  03-投标书.md (2 个占位符)
  ✗ 行45: 【待填写报价金额】
     类型: 中文方括号待处理项
     上下文: 我公司愿意以人民币【待填写报价金额】元的投标总价...

  ✗ 行78: TODO: 补充联系方式
     类型: 代码风格占位符
     上下文: 联系人：TODO: 补充联系方式
```

---

### 4. verify_docx.py
**Word文档后验证工具**

验证生成的Word文档质量：
- ✅ 检查标题数量
- ✅ 检查图片数量
- ✅ 检查空段落比例
- ✅ 检查标题层级
- ✅ 检查文件大小

**用法**：
```bash
python verify_docx.py 响应文件/响应文件-XX公司-XX项目.docx
```

**验证结果示例**：
```
文档统计:
  段落总数: 1245
  标题数量: 68
  表格数量: 15
  图片数量: 21
  空段落数: 12
  文件大小: 11.14 MB

⚠️  发现 1 个警告:
  类型: heading_skip
  警告: 标题跳级: Heading 2 → Heading 4
  建议: 检查Markdown源文件标题层级
```

---

### 5. enhanced_assembly.py
**主质检流程**

整合所有工具的一键质检流程：
1. 文件规范化
2. 结构验证
3. 占位符检测
4. 生成Word文档
5. Word文档后验证
6. 生成质检报告

**用法**：
```bash
python enhanced_assembly.py /path/to/bid/TC261901F1
```

**输出示例**：
```
============================================================
第1步：Markdown文件规范化
============================================================
找到 26 个Markdown文件
✓ 01-投标人资格声明书.md
  - 统一换行符(CRLF→LF)
  - 移除行尾空白
  - 文件大小: 2048 → 1987 (-61 bytes)
...

质检汇总
完成步骤: 5/5
  ✓ 步骤1: normalize
  ✓ 步骤2: validate_structure
  ✓ 步骤3: detect_placeholders
  ✓ 步骤4: generate_docx
  ✓ 步骤5: verify_docx

质检报告已保存: 响应文件/质检报告.json

✓ 质检通过！
```

---

## 快速开始

### 方式1：完整流程（推荐）
```bash
# 一键运行所有质检步骤
cd skills/bid-assembly/scripts
python enhanced_assembly.py /path/to/bid/TC261901F1
```

### 方式2：单独运行工具
```bash
# 1. 规范化文件
python normalize_markdown.py 响应文件/

# 2. 验证结构
python validate_structure.py 响应文件/

# 3. 检测占位符
python detect_placeholders.py 响应文件/

# 4. 生成Word（需要Node.js和generate_docx.js）
cd /path/to/bid/TC261901F1
node generate_docx.js

# 5. 验证Word
python verify_docx.py 响应文件/响应文件-XX-XX.docx
```

---

## 依赖

### Python依赖
```bash
pip install python-docx
```

### Node.js依赖（生成Word文档）
```bash
npm install docx
```

---

## 修复记录

### v1.1 - 2026-03-06
**修复CRLF换行符导致标题识别失败的bug**

**问题**：
- 03-投标书.md使用CRLF换行符（`\r\n`）
- `split('\n')`后每行末尾保留`\r`
- 正则表达式`/^(#{1,6})\s+(.+)$/`无法匹配
- 导致Word文档中标题显示为原始`## 标题`文本

**解决方案**：
1. `normalize_markdown.py`自动统一换行符为LF
2. `generate_docx.js`使用`split(/\r?\n/)`兼容两种换行符

**验证**：
- ✅ 03-投标书.md的6个标题正确识别
- ✅ 标题在Word中显示为正确的标题样式
- ✅ 所有26个文件的标题全部识别

---

## 最佳实践

1. **每次编写完响应文件后，运行完整质检流程**
   ```bash
   python enhanced_assembly.py /path/to/project
   ```

2. **遇到Word文档格式问题时，先规范化Markdown文件**
   ```bash
   python normalize_markdown.py 响应文件/
   ```

3. **提交前检查占位符**
   ```bash
   python detect_placeholders.py 响应文件/
   ```

4. **生成Word后验证**
   ```bash
   python verify_docx.py 响应文件/响应文件-XX-XX.docx
   ```

---

## 贡献

欢迎提交Issue和PR！

优化建议：
- [ ] 支持自动修复简单问题
- [ ] 添加Markdown语法检查
- [ ] 支持自定义占位符模式
- [ ] 生成HTML质检报告
- [ ] CI/CD集成

---

## License

MIT
