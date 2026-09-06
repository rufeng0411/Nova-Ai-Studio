# -*- coding: utf-8 -*-
from pathlib import Path

ts = Path(r"F:/Ai-pilotdeck/scripts/_rp_ts.txt").read_text(encoding="utf-8").strip()
tag = f"restore-point/post-new-ui-{ts}"
commit = "66059468"
human = f"{ts[0:4]}-{ts[4:6]}-{ts[6:8]} {ts[8:10]}:{ts[10:12]}:{ts[12:14]}"

p = Path(r"F:/Ai-pilotdeck/docs/code-restore-points-registry.zh-CN.md")
text = p.read_text(encoding="utf-8")

# Replace current HEAD / latest block (may be pre-new-ui)
import re

text2, n = re.subn(
    r"\*\*当前 HEAD\*\*：`[^`]+`  \n\*\*最新可用还原点\*\*：`[^`]+`（[^）]+）",
    f"**当前 HEAD**：`{commit}`  \n"
    f"**最新可用还原点**：`{tag}`（**新版 UI 执行后（还需优化）**）",
    text,
    count=1,
)
if n != 1:
    raise SystemExit(f"head replace failed n={n}")
text = text2

row = (
    f"| 0 | `{tag}` | `{commit}` | {human} | "
    f"**新版 UI 执行后（还需优化）** — 工作台 1.1-Beta 首版落地，布局样式待续精修 | "
    f"[`new-ui-restore-point-{ts}.md`](./new-ui-restore-point-{ts}.md) |\n"
)
marker = (
    "| # | 标签 | 提交 | 时间 | 说明 | 详细文档 |\n"
    "|---|------|------|------|------|----------|\n"
)
if marker not in text:
    raise SystemExit("table header not found")
# demote previous row 0
old0 = "| 0 | `restore-point/pre-new-ui-"
idx = text.find(marker)
if idx < 0:
    raise SystemExit("marker missing")
after = text[idx + len(marker) :]
if after.startswith("| 0 | `restore-point/"):
    after = "| 1 | `" + after[len("| 0 | `") :]
    text = text[: idx + len(marker)] + after
text = text.replace(marker, marker + row, 1)
p.write_text(text, encoding="utf-8")
print("registry OK", tag)

doc = Path(rf"F:/Ai-pilotdeck/docs/new-ui-restore-point-{ts}.md")
doc.write_text(
    f"""# 新版 UI — 代码还原点（执行后 · 还需优化）

> **执行后**快照：工作台 1.1-Beta 新版 UI 首版已落地，**布局/样式仍需继续优化**。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `{tag}` |
| **提交** | `{commit}` |
| **时间** | {human} +0800 |
| **说明** | **新版 UI 执行后（还需优化）** |

```bash
git show {tag} --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- 并行入口 `/app-1.1-beta`、`/m/app-1.1-beta`（`WorkbenchBetaShell` + tokens/Tour）
- AppShell / Sidebar / Chat chrome 与 Beta surface 接线
- Flag / pack / e2e isolation / fixtures / 验收文档
- MdBrowser 导出与 IM 通道帮助等同批

### 待续

- 左栏与全套布局样式深度改版（用户已点名，尚未闭环）
- Beta UX 精修与 cutover 评估

## 回退

```bash
git reset --hard {tag}
```

对照执行前：`restore-point/pre-new-ui-20260805233754`
""",
    encoding="utf-8",
)
print("doc OK", doc.name)
