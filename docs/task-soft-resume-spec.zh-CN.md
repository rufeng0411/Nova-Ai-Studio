# 任务软续跑规格（Nova SaaS）

## 目标

- **G-S1**：新会话在 Bridge/Gateway 重启窗口侧栏仍可见（catalog `pending` → `active`）
- **G-S2**：基础设施中断后 60s 内 UI auto-continue 新 turn
- **G-S3**：续跑 prompt 含结构化 `<task-resume>` 进度块
- **G-D1–D4**：成果 validate-before-show（T2 仅 verified/pending）

## 软续跑边界

- **做**：新 turn + JSONL 历史 + 阶段产物 + `<task-resume>` 注入
- **不做**：AgentLoop 同 turnId 内存 checkpoint

## Feature flags（`tools.resilience`）

| Flag | 默认 | 说明 |
|------|------|------|
| `sessionDurability` | true | catalog 同步 UPSERT |
| `infraAutoContinue` | true | infra → recovery_pause / auto-continue |
| `turnProgressEntries` | true | JSONL `turn_progress` / `turn_interrupted` |
| `deliverableValidation` | true | 批量 validate API + T2 门禁 |
| `hidePhantomDeliverables` | true | 隐藏纯正文 phantom（正文链接仍可点） |

## 验收

```bash
npm run test:task-resilience:unit
npm run test:task-resilience:acceptance
```

详见 `docs/conversation-resilience-spec.md` 基础设施中断与成果 validate 章节。
