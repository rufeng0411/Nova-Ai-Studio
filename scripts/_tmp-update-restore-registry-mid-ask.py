# -*- coding: utf-8 -*-
from pathlib import Path
import re

ts = Path(r"F:/Ai-pilotdeck/scripts/_rp_ts.txt").read_text(encoding="utf-8").strip()
tag = f"restore-point/post-mid-task-ask-breaker-{ts}"
commit = "87710ea4"
human = f"{ts[0:4]}-{ts[4:6]}-{ts[6:8]} {ts[8:10]}:{ts[10:12]}:{ts[12:14]}"

p = Path(r"F:/Ai-pilotdeck/docs/code-restore-points-registry.zh-CN.md")
text = p.read_text(encoding="utf-8")

text2, n = re.subn(
    r"\*\*当前 HEAD\*\*：`[^`]+`  \n\*\*最新可用还原点\*\*：`[^`]+`（[^）]+）",
    f"**当前 HEAD**：`{commit}`  \n"
    f"**最新可用还原点**：`{tag}`（**任务中间主动提问+熔断**）",
    text,
    count=1,
)
if n != 1:
    raise SystemExit(f"head replace failed n={n}")
text = text2

row = (
    f"| 0 | `{tag}` | `{commit}` | {human} | "
    f"**任务中间主动提问+熔断** — 贵意图澄清问一次 + 阶段预算熔断 | "
    f"[`mid-task-ask-breaker-restore-point-{ts}.md`](./mid-task-ask-breaker-restore-point-{ts}.md) |\n"
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

doc = Path(rf"F:/Ai-pilotdeck/docs/mid-task-ask-breaker-restore-point-{ts}.md")
doc.write_text(
    f"""# 任务中间主动提问+熔断 — 代码还原点

> 贵意图冲突「问一次」澄清门控 + 任务阶段预算熔断落地快照。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `{tag}` |
| **提交** | `{commit}` |
| **时间** | {human} +0800 |
| **说明** | **任务中间主动提问+熔断** |

```bash
git show {tag} --no-patch --format="%H %s %ci"
```

## 本还原点主要变更

- `expensiveIntentConflict`：贵意图冲突主动澄清（问一次）
- `taskStageBudget`：阶段预算熔断
- Sticky 成果栏持久化、续跑/澄清门控与四线相关加固
- 验收：`docs/expensive-intent-clarify-acceptance-20260819.zh-CN.md`、sticky/speed 验收与 live 脚本

## 对照执行前

- `restore-point/pre-expensive-intent-clarify-20260819203348`
- `restore-point/pre-sticky-stage-budget-20260819173414`

## 回退

```bash
git reset --hard {tag}
```
""",
    encoding="utf-8",
)
print("doc OK", doc.name)
