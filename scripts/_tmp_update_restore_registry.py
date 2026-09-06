# -*- coding: utf-8 -*-
from pathlib import Path
import re

p = Path("docs/code-restore-points-registry.zh-CN.md")
text = p.read_text(encoding="utf-8")

text = text.replace(
    "**当前 HEAD**：`95b66a43`  \n"
    "**最新可用还原点**：`restore-point/post-vap-hardening-prep-20260802154147`"
    "（★ **准备加固vap** — Showcase/营销基线与四线补强）",
    "**当前 HEAD**：`d1e241c8`  \n"
    "**最新可用还原点**：`restore-point/post-cn-enterprise-compliance-20260802233012`"
    "（★ **企业合规** — Hub/Skills 首包与 VAP 加固同批）",
)

old_star = (
    "| Star | 标签 | Star 别名 | 提交 | 时间 | 说明 | 详细文档 |\n"
    "|------|------|-----------|------|------|------|----------|\n"
    "| ★ 准备加固vap |"
)
new_star = (
    "| Star | 标签 | Star 别名 | 提交 | 时间 | 说明 | 详细文档 |\n"
    "|------|------|-----------|------|------|------|----------|\n"
    "| ★ 企业合规 | `restore-point/post-cn-enterprise-compliance-20260802233012` "
    "| `star/cn-enterprise-compliance` | `d1e241c8` | 2026-08-02 23:30:12 | "
    "**企业合规** — Hub/Skills 首包与 VAP 加固同批 | "
    "[`cn-enterprise-compliance-restore-point-20260802233012.md`]"
    "(./cn-enterprise-compliance-restore-point-20260802233012.md) |\n"
    "| ★ 准备加固vap |"
)
if old_star not in text:
    raise SystemExit("star header not found")
text = text.replace(old_star, new_star, 1)

text = text.replace(
    "> 快速回退：`git reset --hard star/vap-hardening-prep` · "
    "`git reset --hard star/distill-fix-1` · "
    "`git reset --hard star/preview-template-homepage` · "
    "`git reset --hard star/preview-template` · "
    "`git reset --hard star/grok-45-experiment` · "
    "`git reset --hard star/bento` · `git reset --hard star/zhipu-demo-stable`",
    "> 快速回退：`git reset --hard star/cn-enterprise-compliance` · "
    "`git reset --hard star/vap-hardening-prep` · "
    "`git reset --hard star/distill-fix-1` · "
    "`git reset --hard star/preview-template-homepage` · "
    "`git reset --hard star/preview-template` · "
    "`git reset --hard star/grok-45-experiment` · "
    "`git reset --hard star/bento` · `git reset --hard star/zhipu-demo-stable`",
)

lines = text.splitlines(keepends=True)
out = []
in_sec = False
for line in lines:
    if line.startswith("## 一、功能里程碑"):
        in_sec = True
        out.append(line)
        continue
    if in_sec and line.startswith("## "):
        in_sec = False
    if in_sec and line.startswith("| 0 | `restore-point/post-vap-hardening-prep-20260802154147`"):
        out.append(
            "| 0 | `restore-point/post-cn-enterprise-compliance-20260802233012` ★ 企业合规 "
            "| `d1e241c8` | 2026-08-02 23:30:12 | **企业合规** — Hub/Skills 首包与 VAP 加固同批 | "
            "[`cn-enterprise-compliance-restore-point-20260802233012.md`]"
            "(./cn-enterprise-compliance-restore-point-20260802233012.md) |\n"
        )
        m = re.match(r"\| (\d+) \|", line)
        n = int(m.group(1)) + 1
        out.append(re.sub(r"^\| \d+ \|", f"| {n} |", line, count=1))
        continue
    if in_sec and re.match(r"^\| (\d+) \| `", line):
        m = re.match(r"\| (\d+) \|", line)
        n = int(m.group(1)) + 1
        out.append(re.sub(r"^\| \d+ \|", f"| {n} |", line, count=1))
        continue
    out.append(line)
text = "".join(out)

text = text.replace(
    "| 日期 | 操作 |\n|------|------|\n| 2026-08-02 15:41:47 |",
    "| 日期 | 操作 |\n|------|------|\n"
    "| 2026-08-02 23:30:12 | 新增 ★ 企业合规 "
    "`restore-point/post-cn-enterprise-compliance-20260802233012` + "
    "`star/cn-enterprise-compliance` @ `d1e241c8`（**企业合规**） |\n"
    "| 2026-08-02 15:41:47 |",
)

p.write_text(text, encoding="utf-8", newline="\n")
t = p.read_text(encoding="utf-8")
assert "star/cn-enterprise-compliance" in t
assert "企业合规" in t
assert "d1e241c8" in t
print("OK")
