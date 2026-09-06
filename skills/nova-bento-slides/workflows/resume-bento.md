# Resume Bento — 续跑工作流

会话中断、repair 或用户「继续」时，按此恢复 **nova-bento-slides** 管线。

## 1. 定位进度

检查 `<task-artifact-dir>/`：

| 文件 | 阶段 |
|------|------|
| 无 spec | → Phase B/C |
| `bento-spec.md` 无 `outline.json` | → Phase D |
| `outline.json` 无 doc JSON | → Phase E/F |
| `deck.bento.html` validate 失败 | → 修 doc 重 splice |
| validate 通过 | 已交付，勿重复 write |

## 2. 读取锚点

- **目标目录**：会话 STDA `artifacts/task-*`（勿改道）
- **spec**：theme preset、morph id 策略
- **outline**：页 id / layout / rhythm 不得漂移

## 3. 续跑规则

1. **禁止**新建并列 task 目录
2. **禁止** ask_user；缺页内容按 outline 补默认
3. 已有 `deck.bento.html`：extract JSON（或读中间 doc.json）→ 修 → 重 splice
4. 保留 `docId`：`splice --preserve-doc-id`
5. morph id 与 spec 一致，勿重生 chrome id

## 4. 命令

```bash
# 校验现状
node skills/nova-bento-slides/scripts/validate-bento-doc.mjs --strict artifacts/task-*/deck.bento.html

# 重打包
node skills/nova-bento-slides/scripts/splice-bento-shell.mjs \
  --shell ui/public/vendor/bento/Bento_Slides.bento.html \
  --doc artifacts/task-*/doc.json \
  --out artifacts/task-*/deck.bento.html \
  --preserve-doc-id
```

## 5. 完成判定

- `validate --strict` → `ok: true`
- 成果区仅 `deck.bento.html`
- 助手正文「已完成」须等 validate 通过

## 6. 常见断点

| 症状 | 处理 |
|------|------|
| morphGroups=0/1 | 加 cover→s2、s3→s4 morph |
| 无 ambient | 封面 `fx.ambient: kenburns` |
| notes 过短 | 每页 ≥20 字（strict） |
| 字体>2 | 统一为 theme.fontFamily |
