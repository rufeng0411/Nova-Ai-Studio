# 还原点：任务中间主动提问+熔断+二次修复+skills

| 项 | 值 |
|----|----|
| 标签 | `restore-point/post-mid-ask-breaker-skills-20260820075057` |
| 提交 | `290d1454` |
| 时间戳 | 20260820075057 |
| 说明 | 任务中间主动提问+熔断+二次修复+skills |

## 回退

```bash
git reset --hard restore-point/post-mid-ask-breaker-skills-20260820075057
```

## 本批要点

- 二次修复：`goalKindSanitize`、AgentLoop / toolFailureRecovery / stabilityFlags、kind-mention 验收脚本与文档
- Skills：`anth-docx` / `anth-pptx`、`ppt-master` vendor（含 overlays/templates）、preflight PPT 资产与 catalog
- Jarvis 管家实现计划文档（`docs/jarvis-butler-*`）
