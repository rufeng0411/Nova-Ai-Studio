# Word/PPT 超级预览修复 — 代码还原点

> 在 Word 分页/留白/左栏缩略图与 PPT 缩略图串行渲染修复完成后创建，用于后续大改失败时回退。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `restore-point/post-word-super-preview-2026-07-02` |
| **说明** | DOCX 块级虚拟分页 + 默认页边距；Word 左栏真实预览；PPT 缩略图队列；document canvas smoke 增强 |

```bash
git show restore-point/post-word-super-preview-2026-07-02 --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- **DOCX**：`docxDocumentAdapter` 按块分页、默认 96px 页边距、横向溢出约束
- **Word 左栏**：移除占位缩略图，走 `renderPage` DOM 预览
- **PPT**：`documentRenderQueue` 串行渲染，缩略图后恢复主视图
- **验收**：`ui-document-canvas-check.mjs` 增加留白/缩略图内容检查

## 如何还原

### 硬回退（丢弃还原点之后所有提交）

```bash
git reset --hard restore-point/post-word-super-preview-2026-07-02
```

### 从还原点开实验分支

```bash
git checkout -b experiment/word-preview restore-point/post-word-super-preview-2026-07-02
```

### 仅恢复单个文件

```bash
git checkout restore-point/post-word-super-preview-2026-07-02 -- path/to/file
```
