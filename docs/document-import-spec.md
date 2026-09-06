# 文档附件导入解析规格（Document Import）

> PD-SAAS-FORK：PDF/Word/Excel/PPT 附件 → 可读 Markdown 文本注入对话。

## 1. 目标

用户在对话中上传办公附件后，模型在首条 turn 内获得**可读文本摘要**（非乱码、非仅靠路径注释）。

## 2. 冲突矩阵

| 能力 | 裁决 |
|------|------|
| `export_document` | MD/HTML → 办公格式；import 不改动 |
| `compose_images_to_document` | 多图合成；不覆盖 |
| `ocr_to_editable_pptx` | 扫描件 → 可编辑 PPT **产出**；import 复用 MinerU 作 **fallback 解析** |
| `read_file` | 禁止 Office UTF-8 误读；改委托 import |
| `AttachmentResolver` | **主接入点** |

## 3. Provider 协议

见 `src/saas/document-import/types.ts` 与 `config/document-import-providers.json`。

| Provider | 格式 | 级别 |
|----------|------|------|
| `mupdf-pdf` | PDF 文字层 | L2 |
| `mammoth-docx` | DOCX | L2 |
| `exceljs-xlsx` | XLSX/CSV | L2 |
| `python-pptx` | PPTX 文本 | L2 |
| `mineru-cloud` | 扫描件 fallback | cloud |

## 4. 配置（`pilotdeck.yaml`）

```yaml
tools:
  documentImport:
    enabled: true
    cloudPreference: local_first
    workerConcurrency: 4
    timeoutMs: 30000
    maxFileBytes:
      pdf: 20971520
      office: 10485760
    truncate:
      maxChars: 120000
      maxTableRows: 200
    fallbackProvider: mineru
    providers:
      mupdf-pdf: true
      mammoth-docx: true
      exceljs-xlsx: true
      python-pptx: true
      mineru-cloud: auto
```

环境变量：`PILOTDECK_DOCUMENT_IMPORT_*`、`PILOTDECK_IMPORT_WORKER_CONCURRENCY`、`PILOTDECK_IMPORT_TIMEOUT_MS`。

## 5. 输出形态

- 成功：`text` 块，`<attachment parsed="..." provider="...">` 包裹 Markdown
- 失败：路径注释 + `[Attachment diagnostics]` warning；**不阻断 turn**

## 6. 限流与容错

- 全局并发：worker 池默认 4
- SaaS 租户：5 次/分钟（内存令牌桶）
- 单文件超时 30s → `import_timeout`
- Provider 异常 → 尝试下一候选；全部失败 → `skipped`

## 7. 验收清单

| # | 场景 | 标准 |
|---|------|------|
| A1 | 3 页 PDF（文字层） | `providerId=mupdf-pdf`，charCount≥200 |
| A2 | DOCX | 非乱码 |
| A3 | XLSX | 表格行列注入，超 200 行截断 |
| A4 | PPTX | 每页 slide 文本 |
| A5 | 扫描 PDF + MinerU | fallback 成功或 SKIP |
| A6 | 损坏 docx | turn 不失败 |
| A7 | 10 并发 | 无崩溃 |
| A8 | read_file docx | 走 import |
| A9 | 回归 | smoke:document / smoke:document-export 仍绿 |
| A10 | 报告 | report.json + document-import-test-report-*.md |

## 8. 测试命令

```bash
npm run build
npm run smoke:document-import
npm run smoke:document-import-attachment   # 需 dev:saas
npm run smoke:document
npm run smoke:document-export
```

回归清单写入本文件 §7；smoke 报告路径 `artifacts/document-import-smoke/report.json`。
