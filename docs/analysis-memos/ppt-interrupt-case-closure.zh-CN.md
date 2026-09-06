# PPT 中断案例 Closure（沧海 / 美学幻灯类）

**关联会话**：`web-s_c7273358-add6-4c39-9f28-deffd6cbe671`（workspace 沧海）  
**用户目标**：附件 docx 24 页 → **可编辑 .pptx**，商务科技极简  
**对照会话**（用户 UI 反馈）：`web:s_353b74d4-…` 类「装 pptxgenjs 后规划停」

---

## 1. 时间线（turn 88392a08…）

| 序 | 事件 | 问题 |
|----|------|------|
| 1 | `read_skill anth-pptx` | 正确 |
| 2–6 | 读 pptxgenjs 教程、规划配色 | 正常准备 |
| 7–8 | `bash pip list \| grep pptx` **失败**（Windows） | 工具 recovery 注入 |
| 9–51 | **6 次** `tool_recovery`（文案：mobile mockup / index.html） | Recovery 与 PPT 任务无关 |
| 52–67 | 写 Python/JS 脚本、多次 bash 失败 | 空转 |
| 68 | **`turn_result: success`**，finalMessage 承认只有 HTML | **假完成** |
| 69 | 用户：「你没严格按照附件内容和页数…」 | **首次人工干预** |
| 70–121 | 第二轮 turn，`tool_recovery`×4，最终 **aborted** | 仍未交付 pptx |

---

## 2. AgentLoop 分支对照

### 2.1 为何 turn1 未 auto_continue？

结束条件（[`AgentLoop.ts`](../src/agent/loop/AgentLoop.ts) ~815）：

- 最后一轮 assistant **无 tool_calls** → 进入 premature stop 检测
- **修复前**：`hadRecentToolSuccess=true` + 规划英文 → `shouldAutoContinueAfterAssistantText` **返回 false**
- **修复后**：`shouldAutoContinueAfterIncompleteDeliverableStop(userGoal=PPT…)` 应 **返回 true**

本案例 transcript **在 fix 前录制**：turn 以 success 结束，JSONL **无** `purpose: auto_continue` durable 行。

### 2.2 为何 UI 未兜底？

- `useIncompleteDeliverableAutoContinue` **fix 前未部署**
- turn success 后 `looksLikeTaskDelivered` 若正文含 `presentation.html` + 「已完成」可能 **误 suppress**
- 本案例 finalMessage 含「HTML 替代方案」——可能触发 suppress 或 incomplete 判定边界

### 2.3 tool_recovery 加剧偏离

[`toolFailureRecovery.ts`](../src/agent/loop/toolFailureRecovery.ts) 默认文案指向 **index.html / mobile mockup**，与 anth-pptx 路径冲突 → 模型改做 HTML。

---

## 3. UI 续跑 hook 预期（fix 后）

| Hook | 本案例预期 |
|------|------------|
| 引擎 `incompleteDeliverableStop` | turn1 末段规划无 pptx → **同 turn continue** |
| `useIncompleteDeliverableAutoContinue` | 若仍 success 结束 → 800ms 后合成续跑 |
| `useAutoRecoveryContinue` | 仅 recovery_pause；本案例 turn1 无 pause |
| `TaskResumeCoordinator` | 每 `turnCompleteSignal` 一次 UI 续跑 |

---

## 4. 根因链（单页）

```
用户要 pptx
  → bash 在 Windows 失败
  → tool_recovery 文案偏 HTML（6 次）
  → 模型写 presentation.html
  → AgentLoop success（无 tool_calls 收尾）
  → UI 无 incomplete-deliverable 兜底（fix 前）
  → 用户手打纠偏
```

---

## 5. Closure 验收标准

- [ ] 同 prompt replay：turn1 内产出 `.pptx` 或至少触发 auto_continue（JSONL 可见 synthetic continue）
- [ ] tool_recovery 在 `anth-pptx` / PPT goal 下注入 **pptxgenjs/python-pptx/write_file** 指引，非 index.html
- [ ] validate API 对 `.pptx` 为 verified 才展示成果
- [ ] 用户 **零**「继续/不对」消息

---

## 6. 相关文件

- Transcript：`.saas-dev-data/tenants/default/projects/workspaces-沧海/chats/web-s_c7273358-….jsonl`
- 策略：[`userFacingErrors.ts`](../src/agent/errors/userFacingErrors.ts) `shouldAutoContinueAfterIncompleteDeliverableStop`
- UI：[`useIncompleteDeliverableAutoContinue.ts`](../ui/src/components/chat-v2/hooks/useIncompleteDeliverableAutoContinue.ts)
