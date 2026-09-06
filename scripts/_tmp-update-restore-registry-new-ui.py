# -*- coding: utf-8 -*-
from pathlib import Path

ts = Path(r"F:/Ai-pilotdeck/scripts/_rp_ts.txt").read_text(encoding="utf-8").strip()
tag = f"restore-point/pre-new-ui-{ts}"
commit = "83318ee2"
# human time from tag message / now — use ts parse
human = f"{ts[0:4]}-{ts[4:6]}-{ts[6:8]} {ts[8:10]}:{ts[10:12]}:{ts[12:14]}"

p = Path(r"F:/Ai-pilotdeck/docs/code-restore-points-registry.zh-CN.md")
text = p.read_text(encoding="utf-8")

old_head = (
    "**当前 HEAD**：`54da83ce`  \n"
    "**最新可用还原点**：`restore-point/pre-workbench-yield-align-20260805093545`"
    "（**工作台良品率对齐展示策略执行前**）"
)
new_head = (
    f"**当前 HEAD**：`{commit}`  \n"
    f"**最新可用还原点**：`{tag}`（**新版 UI 执行前**）"
)
if old_head not in text:
    # try current after docs commit from previous session
    alt = (
        "**当前 HEAD**：`54da83ce`  \n"
        "**最新可用还原点**：`restore-point/pre-workbench-yield-align-20260805093545`"
        "（**工作台良品率对齐展示策略执行前**）"
    )
    if alt not in text:
        # find current HEAD line
        for i, line in enumerate(text.splitlines()[:15]):
            print(repr(line))
        raise SystemExit("head block not found")
    text = text.replace(alt, new_head, 1)
else:
    text = text.replace(old_head, new_head, 1)

row = (
    f"| 0 | `{tag}` | `{commit}` | {human} | "
    f"**新版 UI 执行前** — 工作台良品率/IM/企业 MCP/用户组基线 | "
    f"[`new-ui-restore-point-{ts}.md`](./new-ui-restore-point-{ts}.md) |\n"
)
marker = (
    "| # | 标签 | 提交 | 时间 | 说明 | 详细文档 |\n"
    "|---|------|------|------|------|----------|\n"
)
if marker not in text:
    raise SystemExit("table header not found")
old0 = "| 0 | `restore-point/pre-workbench-yield-align-20260805093545`"
if old0 not in text:
    raise SystemExit("row 0 not found")
text = text.replace(marker, marker + row, 1)
text = text.replace(
    old0,
    "| 1 | `restore-point/pre-workbench-yield-align-20260805093545`",
    1,
)
p.write_text(text, encoding="utf-8")
print("registry OK", tag, human)

doc = Path(rf"F:/Ai-pilotdeck/docs/new-ui-restore-point-{ts}.md")
doc.write_text(
    f"""# 新版 UI — 代码还原点（执行前）

> **执行前**基线：新版 UI 落地之前。  
> 同提交含工作台良品率对齐、IM 通道、企业 MCP Batch1、用户组权限。

## 标记

| 项 | 值 |
|----|-----|
| **标签** | `{tag}` |
| **提交** | `{commit}` |
| **时间** | {human} +0800 |
| **说明** | **新版 UI 执行前** |

```bash
git show {tag} --no-patch --format="%H %s %ci"
```

## 本还原点主要变更（基线快照）

- 工作台良品率对齐展示 / brief 契约与 L3 验收编排
- IM 通道后台与 `im-notify` MCP
- 企业 MCP Batch1、MCP feature flags、写工具门控
- 用户组权限（migration 009 + Admin）
- 平台插件/通道管理页与 fork manifest 登记

### 尚未开始

- 新版 UI 主体改版（本标签之后）

## 回退

```bash
git reset --hard {tag}
```
""",
    encoding="utf-8",
)
print("doc OK", doc.name)
