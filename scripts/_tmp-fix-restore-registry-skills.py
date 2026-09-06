# -*- coding: utf-8 -*-
from pathlib import Path
import re

ts = "20260820075057"
tag = f"restore-point/post-mid-ask-breaker-skills-{ts}"
sha = "290d1454"
doc_name = f"mid-ask-breaker-skills-restore-point-{ts}.md"
row = (
    f"| 0 | `{tag}` | `{sha}` | 2026-08-20 07:50:57 | "
    f"**任务中间主动提问+熔断+二次修复+skills** — goalKindSanitize / 熔断加固 / anth+ppt-master | "
    f"[`{doc_name}`](./{doc_name}) |\n"
)

p = Path("docs/code-restore-points-registry.zh-CN.md")
text = p.read_text(encoding="utf-8")

# Replace malformed inserted row (any variant for this tag)
text = re.sub(
    r"\|[^\n]*`restore-point/post-mid-ask-breaker-skills-20260820075057`[^\n]*\n",
    row,
    text,
    count=1,
)

text = re.sub(
    r"\*\*当前 HEAD\*\*：`[^`]+`",
    f"**当前 HEAD**：`{sha}`",
    text,
    count=1,
)
text = re.sub(
    r"\*\*最新可用还原点\*\*：`[^`]+`（[^）]+）",
    f"**最新可用还原点**：`{tag}`（**任务中间主动提问+熔断+二次修复+skills**）",
    text,
    count=1,
)

p.write_text(text, encoding="utf-8")
print("ok")
# show first 12 lines
print("\n".join(p.read_text(encoding="utf-8").splitlines()[:12]))
print("---")
print(next(l for l in p.read_text(encoding="utf-8").splitlines() if "post-mid-ask-breaker-skills" in l))
