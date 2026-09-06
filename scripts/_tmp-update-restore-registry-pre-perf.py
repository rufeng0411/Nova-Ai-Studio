# -*- coding: utf-8 -*-
from pathlib import Path
import re

ts = Path(r"F:/Ai-pilotdeck/scripts/_rp_ts.txt").read_text(encoding="utf-8").strip()
tag = f"restore-point/pre-perf-speed-{ts}"
commit = "cc507126"
human = f"{ts[0:4]}-{ts[4:6]}-{ts[6:8]} {ts[8:10]}:{ts[10:12]}:{ts[12:14]}"

p = Path(r"F:/Ai-pilotdeck/docs/code-restore-points-registry.zh-CN.md")
text = p.read_text(encoding="utf-8")

text2, n = re.subn(
    r"\*\*当前 HEAD\*\*：`[^`]+`  \n\*\*最新可用还原点\*\*：`[^`]+`（[^）]+）",
    f"**当前 HEAD**：`{commit}`  \n"
    f"**最新可用还原点**：`{tag}`（**性能提速优化前**）",
    text,
    count=1,
)
if n != 1:
    raise SystemExit(f"head replace failed n={n}")
text = text2

row = (
    f"| 0 | `{tag}` | `{commit}` | {human} | "
    f"**性能提速优化前** — Hub 排序/展示与 Showcase 基线，提速专项启动前 | "
    f"[`perf-speed-restore-point-{ts}.md`](./perf-speed-restore-point-{ts}.md) |\n"
)
marker = (
    "| # | 标签 | 提交 | 时间 | 说明 | 详细文档 |\n"
    "|---|------|------|------|------|----------|\n"
)
if marker not in text:
    raise SystemExit("table header not found")
idx = text.find(marker)
after = text[idx + len(marker) :]
if after.startswith("| 0 | `restore-point/"):
    after = "| 1 | `" + after[len("| 0 | `") :]
    text = text[: idx + len(marker)] + after
text = text.replace(marker, marker + row, 1)
p.write_text(text, encoding="utf-8")
print("registry OK", tag)

doc = Path(rf"F:/Ai-pilotdeck/docs/perf-speed-restore-point-{ts}.md")
doc.write_text(
    f"""# 性能提速优化 — 代码还原点（执行前）

> **执行前**基线：性能提速优化专项启动之前。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `{tag}` |
| **提交** | `{commit}` |
| **时间** | {human} +0800 |
| **说明** | **性能提速优化前** |

```bash
git show {tag} --no-patch --format="%H %s %ci"
```

## 本还原点主要变更（基线快照）

- 能力中心排序 / 置顶 / 可见性与 `hubCapabilityPresentation`
- catalog / i18n / Hub 缓存与 Showcase viewer 同批
- pack / cloud runtime 小幅同步

### 尚未开始

- 性能提速专项（本标签之后）

## 回退

```bash
git reset --hard {tag}
```
""",
    encoding="utf-8",
)
print("doc OK", doc.name)
