# Strategist-lite — 三项快确认

Phase B 用；**缺省可假设，禁止 ask_user 阻塞 write_file**。

## 1. 页数与观众

| 缺省假设 | 值 |
|----------|-----|
| 页数 | 8–12（路演 10、分享 12、数据 8） |
| 观众 | 业务决策者 / 技术同事 / 混合 |
| 语言 | 跟随 UI 系统语言（中文界面 → 中文正文与 notes） |

**推断规则**：「路演/融资/pitch」→ 10 页；「分享/培训/tech talk」→ 12 页；「报告/复盘/数据」→ 8 页。

## 2. Theme preset

从 [themes.md](themes.md) 选 **1 个 id** 写入 `bento-spec.md`：

- 未指定 → `graphite-peach`（Nova 默认 editorial）
- 用户说「深色/科技」→ `midnight-cyan` 或 `ink-violet`
- 用户说「浅色/商务」→ `paper-navy` 或 `warm-slate`

锁定后全 deck 只用该 preset 的 `background/color/accent/fontFamily`。

## 3. 逐字稿深度

| 选项 | notes 要求 |
|------|------------|
| **A 讲稿**（默认） | 每页 ≥80 字，含过渡句与强调点 |
| **B 要点** | 每页 ≥20 字（满足 strict），bullet 式 |
| **C 极简** | 仅关键词；封面/收束页可稍长 |

未指定 → **A**。tech-sharing 模板示范 ≥150 字/页。

## 输出

三项结论写入 `bento-spec.md` 头部 YAML 块，然后进入 Phase C/D，不再问卷。
