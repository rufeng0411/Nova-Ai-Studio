# 成果目录与命名（防串台）

同一项目里多次做官网、幻灯、落地页时，若都写 `index.html` 或 `slide-01.png`，旧文件会被覆盖或对话链接指向错误版本。

## 目录规则（Nova STDA）

| 产物类型 | 目录模板 | 说明 |
| --- | --- | --- |
| 设计页 / 官网 / 原型 / Deck | `artifacts/task-{YYYYMMDD}-{id8}/` | **唯一权威**：系统分配任务目录；文件如 `index.html` |
| HTML 幻灯（非 Nova 美学 PNG 包） | 同上任务目录内 | 勿另起 `artifacts/slides-*` 除非用户明确要求独立 deck 包 |
| 历史 legacy | `artifacts/design/<slug>/` | **禁止新建**；仅兼容旧对话链接 |

- 任务目录由引擎 / SDM early-bind 分配；Agent **禁止**自造 `artifacts/design/` 语义目录。
- 页内文件名可保留通用名（`index.html`），**冲突由 task 目录隔离**。

## 交付时

1. `write_file` 必须写入当前会话的 `artifacts/task-*/`，**禁止**项目根或 `artifacts/design/`。
2. 对话与总结里引用**完整相对路径**，禁止只写 `index.html`。
3. 若用户要求覆盖旧稿，锚定旧路径后再写，勿串到其他 task 目录。

## 自检

- [ ] 本次所有 HTML/图片是否都在同一 `artifacts/task-*` 下？
- [ ] 回复中是否给出了完整路径而非裸文件名？
- [ ] 是否未再创建 `artifacts/design/`？
